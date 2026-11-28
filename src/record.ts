import {
  type Awards,
  type Course,
  type Key,
  type LessonTrace,
  type Mode,
  type Outcome,
  type Progress,
  type Prompt,
  type RoundScore,
  type RunScore,
  type TimingSamples,
  type Trace,
  pc,
} from './domain.ts';

const MINUTE = 60_000;
const INITIAL_HALF_LIFE = 45 * MINUTE;
const MIN_HALF_LIFE = 5 * MINUTE;
const MAX_HALF_LIFE = 180 * 24 * 60 * MINUTE;
const MASTERY_LIMIT = 20;
const RECALL_LIMIT = 20;
const TRACE_TIMING_LIMIT = 21;
const RESPONSE_LIMIT = 25;
const DEFAULT_LATENCY_SLOPE = 1.75;

const MODE_POINTS: Record<Mode, number> = {
  notes: 40,
  intervals: 55,
  scales: 80,
  chords: 65,
  inversions: 75,
  guides: 95,
  voicings: 88,
  cadence: 108,
};

type CurriculumPrompt = Prompt & { lessonId: string };

type TimingPlan = {
  responseMs: number;
  total?: { key: string; value: number };
  first?: { key: string; value: number };
  primary?: { key: string; value: number };
  perNote: { key: string; value: number }[];
};

type TraceTiming = { responseMs?: number };

function isCurriculumPrompt(prompt: Prompt): prompt is CurriculumPrompt {
  return typeof prompt.lessonId === 'string' && prompt.lessonId.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function traceArrays(trace: Trace): void {
  if (!Array.isArray(trace.recent)) trace.recent = [];
  if (!Array.isArray(trace.mastery)) trace.mastery = [];
  if (!Array.isArray(trace.timings)) trace.timings = [];
  if (!isFiniteNumber(trace.points)) {
    const clean = trace.recent.filter((entry): entry is boolean => typeof entry === 'boolean').filter(Boolean).length;
    trace.points = Math.min(100, clean * 100 / 8);
  }
  if (!isFiniteNumber(trace.attempts)) trace.attempts = 0;
  if (!isFiniteNumber(trace.firstTry)) trace.firstTry = 0;
  if (!isFiniteNumber(trace.halfLife) || trace.halfLife <= 0) trace.halfLife = INITIAL_HALF_LIFE;
  if (!isFiniteNumber(trace.solidified)) trace.solidified = trace.points;
  if (!isFiniteNumber(trace.latencySlope) || trace.latencySlope < 0) trace.latencySlope = DEFAULT_LATENCY_SLOPE;
}

function normalizeTrace(trace: Trace): Trace {
  traceArrays(trace);
  return trace;
}

function scoreOf(trace: Trace): number {
  const saved = trace.points;
  traceArrays(trace);
  if (isFiniteNumber(saved)) return clamp(saved, 0, 100);
  const clean = trace.recent.filter((entry): entry is boolean => typeof entry === 'boolean').filter(Boolean).length;
  return Math.min(100, clean * 100 / 8);
}

function courseFor(progress: Progress): Course {
  const curriculum = progress.curriculum ?? (progress.curriculum = {} as Progress['curriculum']);
  const current = curriculum.courseV3;
  if (current && current.version === 3 && current.concepts && current.items) {
    current.admitted ??= [];
    current.offerAfter ??= 0;
    current.guidedExplained ??= [];
    return current;
  }
  const course: Course = {
    version: 3,
    concepts: {},
    items: {},
    admitted: [],
    offerAfter: 0,
    guidedExplained: [],
  };
  curriculum.courseV3 = course;
  return course;
}

function normalizeLegacyItemId(value: string): { id: string; hasSpelling: boolean } {
  const raw = value.trim();
  try {
    const parsed: unknown = JSON.parse(raw);
    const hasSpelling = Array.isArray(parsed) && typeof parsed[6] === 'string' && parsed[6].length > 0;
    return { id: JSON.stringify(parsed), hasSpelling };
  } catch {
    return { id: raw, hasSpelling: false };
  }
}

function itemIdFor(prompt: Prompt): string | undefined {
  if (typeof prompt.itemId === 'string' && prompt.itemId.length > 0) return prompt.itemId;
  if (typeof prompt.legacyItemId === 'string' && prompt.legacyItemId.trim().length > 0) {
    const normalized = normalizeLegacyItemId(prompt.legacyItemId);
    // Older tuple IDs without a spelling discriminator are only historical. A
    // key suffix keeps a newly presented item from joining another spelling's
    // trace while retaining the normalized legacy identity.
    return normalized.hasSpelling
      ? `legacy:${normalized.id}`
      : `legacy:${normalized.id}|key:${prompt.key}`;
  }
  if (typeof prompt.variant === 'string' && prompt.variant.length > 0) {
    return `${prompt.lessonId ?? prompt.mode}|${prompt.key}|${prompt.variant}`;
  }
  return undefined;
}

function itemTrace(course: Course, prompt: CurriculumPrompt): Trace | undefined {
  const itemId = itemIdFor(prompt);
  if (!itemId) return undefined;
  const existing = course.items[itemId];
  if (existing) return normalizeTrace(existing);
  const legacy = prompt.legacyItemId ? course.items[prompt.legacyItemId] : undefined;
  const item: Trace = legacy
    ? { ...legacy, mastery: [], recent: [...legacy.recent], timings: [...legacy.timings] }
    : blankTrace();
  course.items[itemId] = item;
  return item;
}

function effectiveStrength(trace: Trace): number {
  traceArrays(trace);
  return isFiniteNumber(trace.solidified) ? Math.max(0, trace.solidified) : Math.max(0, scoreOf(trace));
}

function hasAnswer(trace: Trace): boolean {
  return isFiniteNumber(trace.lastAnswered);
}

function initialHalfLife(trace: Trace): number {
  traceArrays(trace);
  return clamp(trace.halfLife, MIN_HALF_LIFE, MAX_HALF_LIFE);
}

function timingBaseline(trace: Trace): number | undefined {
  traceArrays(trace);
  const values = trace.timings.filter(isFiniteNumber).sort((a, b) => a - b);
  if (values.length < 3) return undefined;
  return values[Math.floor(values.length / 3)];
}

function median(values: readonly number[]): number | undefined {
  const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined;
}

function appendLimited<T>(values: readonly T[], value: T, limit: number): T[] {
  return [...values, value].slice(-limit);
}

function updateBaseline(trace: Trace): void {
  traceArrays(trace);
  const values = trace.timings.filter(isFiniteNumber).sort((a, b) => a - b);
  if (values.length < 3) {
    delete trace.baseline;
    return;
  }
  trace.baseline = values[Math.floor(values.length / 3)];
}

function updateRecallTrace(trace: Trace, success: boolean, now: number, timing: TraceTiming = {}): void {
  traceArrays(trace);
  const answered = hasAnswer(trace);
  const oldRecall = recall(trace, now);
  const oldBaseline = timingBaseline(trace);
  const oldStrength = effectiveStrength(trace);

  trace.solidified = success
    ? oldStrength + 2 + 4 * (1 - oldRecall)
    : Math.max(0, 0.85 * oldStrength - 6);

  const responseMs = timing.responseMs;
  if (answered && isFiniteNumber(responseMs) && oldBaseline && oldBaseline > 0 && oldRecall > 0.05 && oldRecall < 0.9) {
    const observedSlope = clamp(Math.log(responseMs / oldBaseline) / -Math.log(oldRecall), 0, 3);
    trace.latencySlope = clamp(trace.latencySlope * 0.75 + observedSlope * 0.25, 0, 3);
  }

  // The first remembered outcome changes strength and timestamp but keeps the
  // initial 45-minute half-life. Later outcomes adapt the half-life.
  if (answered) {
    const speed = isFiniteNumber(responseMs) && oldBaseline && oldBaseline > 0
      ? clamp(oldBaseline / responseMs, 0.4, 1.2)
      : 1;
    const factor = success ? 1.005 + 0.7 * (1 - oldRecall) * speed : 0.52;
    trace.halfLife = clamp(initialHalfLife(trace) * factor, MIN_HALF_LIFE, MAX_HALF_LIFE);
  }

  trace.recent = appendLimited(
    trace.recent.filter((entry): entry is boolean => typeof entry === 'boolean'),
    success,
    RECALL_LIMIT,
  );
  trace.lastAnswered = now;

  if (isFiniteNumber(responseMs) && responseMs >= 0) {
    trace.timings = appendLimited(trace.timings.filter(isFiniteNumber), responseMs, TRACE_TIMING_LIMIT);
    updateBaseline(trace);
  }
}

function appendMastery(trace: Trace, outcome: Outcome, firstTry: boolean): void {
  traceArrays(trace);
  trace.mastery = appendLimited(trace.mastery, outcome, MASTERY_LIMIT);
  trace.attempts += 1;
  if (firstTry) trace.firstTry += 1;
}

function updateVisibleScore(trace: Trace, success: boolean): void {
  const points = scoreOf(trace);
  trace.points = clamp(points + (success ? 2 : -6), 0, 100);
}

function curriculumOutcome(
  progress: Progress,
  prompt: CurriculumPrompt,
  outcome: Outcome,
  now: number,
  firstTry: boolean,
  responseMs?: number,
): void {
  const course = courseFor(progress);
  const lesson = ensureLesson(course, prompt.lessonId);
  const key = ensureKey(course, prompt.lessonId, prompt.key);
  const item = itemTrace(course, prompt);
  const traces = [lesson, key, item].filter((trace): trace is Trace => Boolean(trace));
  const distinct = [...new Set(traces)];

  for (const trace of distinct) appendMastery(trace, outcome, firstTry);

  if (outcome === 'assisted') return;
  const success = outcome === 'unaided-success';
  for (const trace of distinct) updateRecallTrace(trace, success, now, { responseMs });
  updateVisibleScore(lesson, success);
  updateVisibleScore(key, success);
}

function modeBase(prompt: Prompt): number {
  return MODE_POINTS[prompt.mode];
}

function ensureTotals(progress: Progress, prompt: Prompt, cleared: boolean, firstTry: boolean): void {
  progress.attempts = (isFiniteNumber(progress.attempts) ? progress.attempts : 0) + 1;
  if (cleared) progress.correct = (isFiniteNumber(progress.correct) ? progress.correct : 0) + 1;

  const modeStats = progress.modeStats ?? (progress.modeStats = {});
  const mode = modeStats[prompt.mode] ?? (modeStats[prompt.mode] = { attempts: 0, correct: 0 });
  mode.attempts = (isFiniteNumber(mode.attempts) ? mode.attempts : 0) + 1;
  if (cleared) mode.correct = (isFiniteNumber(mode.correct) ? mode.correct : 0) + 1;

  const keyStats = progress.keyStats ?? (progress.keyStats = {});
  const key = keyStats[prompt.key] ?? (keyStats[prompt.key] = { attempts: 0, correct: 0 });
  key.attempts = (isFiniteNumber(key.attempts) ? key.attempts : 0) + 1;
  if (cleared && firstTry) key.correct = (isFiniteNumber(key.correct) ? key.correct : 0) + 1;
}

function totalTimingKey(prompt: Prompt): string | undefined {
  if (prompt.kind === 'note') return `${prompt.mode}:target:${pc(prompt.target.pc)}`;
  if (prompt.kind === 'interval') return `interval:${pc(prompt.root.pc)}:${prompt.semitones}`;
  return undefined;
}


function timingPlan(prompt: Prompt, samples: TimingSamples): TimingPlan | undefined {
  if (samples.invalid || !Array.isArray(samples.notes) || samples.notes.length === 0) return undefined;
  if (!isFiniteNumber(samples.elapsed) || samples.elapsed < 0) return undefined;

  let previous = 0;
  const perNote: { key: string; value: number }[] = [];
  for (const note of samples.notes) {
    if (!note || !isFiniteNumber(note.note) || !isFiniteNumber(note.at) || note.at < previous) return undefined;
    const gap = note.at - previous;
    if (gap >= 0 && gap <= 15_000) perNote.push({ key: `${prompt.mode}:note:${pc(note.note)}`, value: gap });
    previous = note.at;
  }
  if (samples.elapsed < previous) return undefined;

  const totalKey = totalTimingKey(prompt);
  if (prompt.kind === 'note') {
    if (samples.elapsed < 100 || samples.elapsed > 8_000) return undefined;
    return {
      responseMs: samples.elapsed,
      total: totalKey ? { key: totalKey, value: samples.elapsed } : undefined,
      primary: totalKey ? { key: totalKey, value: samples.elapsed } : undefined,
      perNote,
    };
  }
  if (prompt.kind === 'interval') {
    if (samples.elapsed < 100 || samples.elapsed > 12_000) return undefined;
    return {
      responseMs: samples.elapsed,
      total: totalKey ? { key: totalKey, value: samples.elapsed } : undefined,
      primary: totalKey ? { key: totalKey, value: samples.elapsed } : undefined,
      perNote,
    };
  }

  const firstResponse = samples.notes[0].at;
  if (firstResponse < 100 || firstResponse > 10_000) return undefined;
  const itemKey = itemIdFor(prompt);
  return {
    responseMs: firstResponse,
    first: itemKey ? { key: itemKey, value: firstResponse } : undefined,
    primary: itemKey ? { key: itemKey, value: firstResponse } : undefined,
    perNote,
  };
}

function acceptsResponse(values: readonly number[], value: number): boolean {
  if (!isFiniteNumber(value)) return false;
  if (values.length < 5) return true;
  const mid = median(values);
  return mid === undefined || value <= Math.max(4_000, 3 * mid);
}

function saveResponseSample(progress: Progress, key: string, value: number): boolean {
  if (!isFiniteNumber(value)) return false;
  const responseTimes = progress.responseTimes ?? (progress.responseTimes = {});
  const current = Array.isArray(responseTimes[key]) ? responseTimes[key] : [];
  if (!acceptsResponse(current, value)) return false;
  responseTimes[key] = appendLimited(current.filter(isFiniteNumber), value, RESPONSE_LIMIT);
  return true;
}

function addTimingSamples(progress: Progress, plan: TimingPlan): { anyAccepted: boolean; primaryAccepted: boolean } {
  let anyAccepted = false;
  let primaryAccepted = false;
  const entries = [
    ...(plan.total ? [plan.total] : []),
    ...(plan.first && plan.first.value >= 100 && plan.first.value <= 10_000 ? [plan.first] : []),
    ...plan.perNote,
  ];
  for (const sample of entries) {
    const accepted = saveResponseSample(progress, sample.key, sample.value);
    if (!accepted) continue;
    anyAccepted = true;
    if (plan.primary?.key === sample.key && plan.primary.value === sample.value) primaryAccepted = true;
  }
  return { anyAccepted, primaryAccepted };
}

export function blankTrace(): Trace {
  return {
    points: 0,
    recent: [],
    mastery: [],
    attempts: 0,
    firstTry: 0,
    halfLife: INITIAL_HALF_LIFE,
    solidified: 0,
    timings: [],
    latencySlope: DEFAULT_LATENCY_SLOPE,
  };
}

export function ensureLesson(course: Course, id: string): LessonTrace {
  const existing = course.concepts[id];
  if (existing) {
    normalizeTrace(existing);
    existing.rootTraces ??= {};
    return existing;
  }
  const lesson: LessonTrace = { ...blankTrace(), rootTraces: {} };
  course.concepts[id] = lesson;
  return lesson;
}

export function ensureKey(course: Course, id: string, key: Key): Trace {
  const lesson = ensureLesson(course, id);
  const existing = lesson.rootTraces[key];
  if (existing) return normalizeTrace(existing);
  const trace = blankTrace();
  lesson.rootTraces[key] = trace;
  return trace;
}

export function present(progress: Progress, prompt: Prompt, now: number): void {
  if (!isCurriculumPrompt(prompt)) return;
  const course = courseFor(progress);
  const lesson = ensureLesson(course, prompt.lessonId);
  const key = ensureKey(course, prompt.lessonId, prompt.key);
  const item = itemTrace(course, prompt);
  lesson.lastAsked = now;
  key.lastAsked = now;
  if (item) item.lastAsked = now;
}

export function recall(trace: Trace | undefined, now: number): number {
  if (!trace || !isFiniteNumber(trace.lastAnswered)) return 0;
  const halfLife = isFiniteNumber(trace.halfLife) && trace.halfLife > 0 ? trace.halfLife : INITIAL_HALF_LIFE;
  return 2 ** (-Math.max(0, now - trace.lastAnswered) / halfLife);
}

export function recallWeight(trace: Trace | undefined, now: number): number {
  if (!trace) return 1.4;
  traceArrays(trace);
  const observations = trace.recent.filter((entry): entry is boolean => typeof entry === 'boolean');
  if (observations.length === 0) return 1.4;

  const retention = recall(trace, now);
  const available = observations.slice(-5);
  const missRate = available.filter((entry) => !entry).length / available.length;
  const baseline = timingBaseline(trace);
  const latest = median(observations.length ? trace.timings.slice(-3) : []);
  const slowing = baseline && latest
    ? clamp(latest / baseline - 1, 0, 2)
    : 0;
  const slope = isFiniteNumber(trace.latencySlope) && trace.latencySlope >= 0
    ? trace.latencySlope
    : DEFAULT_LATENCY_SLOPE;
  const latencyMultiplier = Math.min(5, Math.max(0.05, retention) ** -slope);
  const need = 0.2 + 2 * (1 - retention) + 2 * missRate + slowing + 0.2 * (latencyMultiplier - 1);
  return need / (1 + effectiveStrength(trace) * retention / 50);
}

export function due(trace: Trace | undefined, now: number): boolean {
  if (!trace || !isFiniteNumber(trace.lastAnswered)) return false;
  const halfLife = isFiniteNumber(trace.halfLife) && trace.halfLife > 0 ? trace.halfLife : INITIAL_HALF_LIFE;
  return now >= trace.lastAnswered + halfLife;
}

export function runScore(): RunScore {
  return {
    points: 0,
    xp: 0,
    clears: 0,
    errors: 0,
    skips: 0,
    combo: 0,
    bestCombo: 0,
    responseSamples: [],
  };
}

export function roundScore(): RoundScore {
  return { mistakes: 0, finished: false };
}

export function recordMistake(
  progress: Progress,
  prompt: Prompt,
  run: RunScore,
  round: RoundScore,
  now: number,
  skipped = false,
): number {
  if (round.finished) return 0;
  run.errors += 1;
  if (skipped) run.skips += 1;
  round.mistakes += 1;
  run.combo = 0;

  if (round.mistakes !== 1) return 0;
  const penalty = 4 * modeBase(prompt);
  run.points -= penalty;
  if (isCurriculumPrompt(prompt) && round.committed === undefined) {
    round.committed = 'miss';
    curriculumOutcome(progress, prompt, 'miss', now, false);
  }
  return penalty;
}

export function finishRound(
  progress: Progress,
  prompt: Prompt,
  run: RunScore,
  round: RoundScore,
  options: {
    now: number;
    cleared: boolean;
    arcade: boolean;
    assisted: boolean;
    manualHint: boolean;
    timing?: TimingSamples;
  },
): Awards | undefined {
  if (round.finished) return undefined;

  if (!options.cleared && round.mistakes === 0) {
    recordMistake(progress, prompt, run, round, options.now);
  }

  const recovered = options.cleared && round.mistakes > 0;
  const firstTry = options.cleared && round.mistakes === 0;
  const assisted = firstTry && (options.assisted || options.manualHint);
  const outcome: Outcome | undefined = isCurriculumPrompt(prompt)
    ? (round.mistakes > 0 ? 'miss' : assisted ? 'assisted' : 'unaided-success')
    : undefined;

  let responseMs: number | undefined;
  let timingPlanValue: TimingPlan | undefined;
  let timingAccepted = false;
  const timingEligible = firstTry && !options.assisted && !options.manualHint;
  if (timingEligible && options.timing) {
    timingPlanValue = timingPlan(prompt, options.timing);
    if (timingPlanValue) timingAccepted = addTimingSamples(progress, timingPlanValue).primaryAccepted;
    if (timingAccepted) responseMs = timingPlanValue?.responseMs;
  }

  if (isCurriculumPrompt(prompt) && round.committed === undefined && outcome !== undefined) {
    round.committed = outcome;
    curriculumOutcome(progress, prompt, outcome, options.now, firstTry, responseMs);
  }

  const awardable = firstTry;
  let points = 0;
  let xp = 0;
  if (awardable) {
    run.combo += 1;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    const multiplier = Math.min(2, 1 + Math.floor((run.combo - 1) / 3) * 0.2);
    const hint = options.manualHint ? 0.5 : 1;
    points = Math.round(modeBase(prompt) * multiplier * hint * (options.arcade ? 1.35 : 1));
    xp = Math.round((12 + 0.25 * modeBase(prompt)) * hint * (options.arcade ? 1.25 : 1));
    run.points += points;
    run.xp += xp;
    progress.xp = (isFiniteNumber(progress.xp) ? progress.xp : 0) + xp;
  }

  run.clears += options.cleared ? 1 : 0;
  ensureTotals(progress, prompt, options.cleared, firstTry);
  progress.bestStreak = Math.max(isFiniteNumber(progress.bestStreak) ? progress.bestStreak : 0, run.bestCombo);
  round.finished = true;

  if (timingPlanValue && timingAccepted && responseMs !== undefined) {
    run.responseSamples.push(responseMs);
  }

  const awards: Awards = {
    points,
    xp,
    recovered,
  };
  if (outcome !== undefined) awards.outcome = outcome;
  if (responseMs !== undefined) awards.responseMs = responseMs;
  return awards;
}
