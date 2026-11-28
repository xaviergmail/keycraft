import {
  KEYS,
  localDate,
  type Course,
  type Daily,
  type HistoryRow,
  type Key,
  type LessonTrace,
  type Progress,
  type Selection,
  type Trace,
} from './domain.ts';
import { LESSONS, LESSON_BY_ID } from './catalog.ts';
import { blankTrace } from './record.ts';

export const SAVE_KEY = 'keycraft-midi-arcade-v1';

const HALF_LIFE = 45 * 60 * 1000;
const DEFAULT_LATENCY_SLOPE = 1.75;
const MAX_TRACE_RESULTS = 20;
const MAX_TRACE_TIMINGS = 21;
const MAX_HISTORY_ROWS = 10;


const INTERVAL_GROUPS: Record<string, Record<string, string>> = {
  seconds: { '1': 'm2', '2': 'M2' },
  thirds: { '3': 'm3', '4': 'M3' },
  'perfect-intervals': { '5': 'P4', '7': 'P5' },
  sixths: { '8': 'm6', '9': 'M6' },
  'seventh-intervals': { '10': 'm7-interval', '11': 'M7' },
  'tritone-octave': { '6': 'A4', '12': 'P8' },
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const finite = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const nonNegative = (value: unknown, fallback: number): number => (
  finite(value) ? Math.max(0, value) : fallback
);

const bounded = (value: unknown, minimum: number, maximum: number, fallback: number): number => (
  finite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback
);

const clockValue = (now?: number): number => finite(now) ? now : Date.now();

const cloneValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (const item of value) {
      const cloned = cloneValue(item, seen);
      if (cloned !== undefined) result.push(cloned);
    }
    return result;
  }
  if (!isRecord(value)) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const cloned = cloneValue(item, seen);
    if (cloned !== undefined) result[key] = cloned;
  }
  return result;
};

const cloneRecord = (value: unknown): Record<string, unknown> => {
  const cloned = cloneValue(value);
  return isRecord(cloned) ? cloned : {};
};

const validKey = (value: unknown): value is Key => (
  typeof value === 'string' && (KEYS as readonly string[]).includes(value)
);

const isoTimestamp = (now: number): string => {
  const date = new Date(now);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};


const boolResults = (value: unknown): boolean[] => (
  Array.isArray(value) ? value.filter((item): item is boolean => typeof item === 'boolean') : []
);

const numericArray = (value: unknown, maximum = MAX_TRACE_TIMINGS): number[] => (
  Array.isArray(value)
    ? value.filter((item): item is number => finite(item) && item >= 0).slice(-maximum)
    : []
);

const masteryResults = (value: unknown): Trace['mastery'] => (
  Array.isArray(value)
    ? value.filter((item): item is Trace['mastery'][number] => (
      item === 'unaided-success' || item === 'miss' || item === 'assisted'
    )).slice(-MAX_TRACE_RESULTS)
    : []
);

const readTimestamp = (source: Record<string, unknown>, key: string, fallback?: number): number | undefined => {
  const value = source[key];
  if (finite(value) && value >= 0) return value;
  return fallback;
};

const normalizeTrace = (value: unknown): Trace => {
  const source = isRecord(value) ? value : {};
  const recent = boolResults(source.recent).slice(-MAX_TRACE_RESULTS);
  const mastery = masteryResults(source.mastery);
  const explicitPoints = source.points ?? source.score;
  const cleanCount = recent.filter(Boolean).length;
  const points = bounded(
    explicitPoints,
    0,
    100,
    recent.length ? Math.min(100, cleanCount * 100 / 8) : 0,
  );
  const attempts = Math.max(
    0,
    Math.floor(nonNegative(source.attempts, Math.max(recent.length, mastery.length))),
  );
  const firstTry = Math.min(
    attempts || Math.max(recent.length, mastery.length),
    Math.floor(nonNegative(source.firstTry, cleanCount)),
  );
  const halfLife = bounded(source.halfLife, 5 * 60 * 1000, 180 * 24 * 60 * 60 * 1000, HALF_LIFE);
  const timings = numericArray(source.timings);
  const normalized: Record<string, unknown> = {
    ...blankTrace(),
    ...cloneRecord(source),
    points,
    recent,
    mastery,
    attempts,
    firstTry,
    halfLife,
    solidified: nonNegative(source.solidified, points),
    timings,
    latencySlope: bounded(source.latencySlope, 0, 3, DEFAULT_LATENCY_SLOPE),
  };
  const lastAsked = readTimestamp(source, 'lastAsked', readTimestamp(source, 'lastPracticed'));
  const lastAnswered = readTimestamp(source, 'lastAnswered', readTimestamp(source, 'lastPracticed'));
  const explainedAt = readTimestamp(source, 'explainedAt');
  if (lastAsked !== undefined) normalized.lastAsked = lastAsked;
  else delete normalized.lastAsked;
  if (lastAnswered !== undefined) normalized.lastAnswered = lastAnswered;
  else delete normalized.lastAnswered;
  if (explainedAt !== undefined) normalized.explainedAt = explainedAt;
  else delete normalized.explainedAt;
  if (finite(source.baseline) && source.baseline >= 0) normalized.baseline = source.baseline;
  else delete normalized.baseline;
  return normalized as unknown as Trace;
};

const rootMap = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  const result: Record<string, unknown> = {};
  if (isRecord(value.roots)) Object.assign(result, value.roots);
  if (isRecord(value.rootTraces)) Object.assign(result, value.rootTraces);
  if (Object.keys(result).length) return result;
  for (const key of KEYS) {
    if (isRecord(value[key])) result[key] = value[key];
  }
  return result;
};

const normalizeLessonTrace = (value: unknown): LessonTrace => {
  const source = isRecord(value) ? value : {};
  const trace = normalizeTrace(source) as unknown as LessonTrace & Record<string, unknown>;
  const roots: Partial<Record<Key, Trace>> = {};
  for (const [key, row] of Object.entries(rootMap(source))) {
    if (validKey(key) && isRecord(row)) roots[key] = normalizeTrace(row);
  }
  trace.rootTraces = roots;
  const hasLessonEvidence = ['recent', 'points', 'score', 'attempts', 'firstTry'].some((key) => key in source);
  if (!hasLessonEvidence && Object.keys(roots).length) {
    const rootRows = Object.values(roots).filter((root): root is Trace => root !== undefined);
    trace.points = rootRows.reduce((sum, root) => sum + root.points, 0) / rootRows.length;
    trace.recent = rootRows.flatMap((root) => root.recent).slice(-MAX_TRACE_RESULTS);
    trace.attempts = rootRows.reduce((sum, root) => sum + root.attempts, 0);
    trace.firstTry = rootRows.reduce((sum, root) => sum + root.firstTry, 0);
    const asked = rootRows.flatMap((root) => root.lastAsked === undefined ? [] : [root.lastAsked]);
    const answered = rootRows.flatMap((root) => root.lastAnswered === undefined ? [] : [root.lastAnswered]);
    const explained = rootRows.flatMap((root) => root.explainedAt === undefined ? [] : [root.explainedAt]);
    if (explained.length && trace.explainedAt === undefined) trace.explainedAt = Math.max(...explained);
    if (asked.length) trace.lastAsked = Math.max(...asked);
    if (answered.length) trace.lastAnswered = Math.max(...answered);
  }
  return trace;
};

const normalizeTraceMap = (value: unknown, lesson = false): Record<string, Trace | LessonTrace> => {
  const source = isRecord(value) ? value : {};
  const result: Record<string, Trace | LessonTrace> = {};
  for (const [key, row] of Object.entries(source)) {
    if (!isRecord(row)) continue;
    result[key] = lesson ? normalizeLessonTrace(row) : normalizeTrace(row);
  }
  return result;
};

const CATALOG_IDS = LESSONS.map((lesson) => lesson.id);
const catalogIds = (): readonly string[] => CATALOG_IDS;
const catalogRow = (id: string) => LESSON_BY_ID.get(id);
const isScaleLesson = (id: string): boolean => catalogRow(id)?.mode === 'scales';

const readLessonId = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const candidate = value.lessonId ?? value.skillId ?? value.id ?? value.lesson;
  return typeof candidate === 'string' ? candidate : undefined;
};

const readSelection = (value: unknown): Selection | undefined => {
  if (!isRecord(value)) return undefined;
  const lessonId = readLessonId(value);
  const key = value.key ?? value.root ?? value.center;
  if (!lessonId || !validKey(key)) return undefined;
  return { lessonId, key };
};

const starterKey = (lessonId: string): Key => {
  const candidate = catalogRow(lessonId)?.starterKey;
  return validKey(candidate) ? candidate : 'C';
};


const normalizeStats = (value: unknown): Record<string, { attempts: number; correct: number }> => {
  const source = isRecord(value) ? value : {};
  const result: Record<string, { attempts: number; correct: number }> = {};
  for (const [key, row] of Object.entries(source)) {
    if (!isRecord(row)) continue;
    const declaredAttempts = Math.floor(nonNegative(row.attempts, 0));
    const correct = Math.floor(nonNegative(row.correct, 0));
    const attempts = Math.max(declaredAttempts, correct);
    result[key] = { attempts, correct };
  }
  return result;
};

const normalizeResponseTimes = (value: unknown): Record<string, number[]> => {
  const source = isRecord(value) ? value : {};
  const result: Record<string, number[]> = {};
  for (const [key, row] of Object.entries(source)) {
    if (Array.isArray(row)) result[key] = numericArray(row, 25);
  }
  return result;
};

const normalizeBestScores = (value: unknown): Record<string, number> => {
  const source = isRecord(value) ? value : {};
  const result: Record<string, number> = {};
  for (const [key, score] of Object.entries(source)) {
    if (finite(score)) result[key] = score;
  }
  return result;
};

const normalizeHistory = (value: unknown): Progress['exerciseHistory'] => {
  if (!Array.isArray(value)) return [];
  const result: Progress['exerciseHistory'] = [];
  for (const row of value) {
    if (!isRecord(row)) continue;
    const number = finite(row.number) ? Math.max(0, Math.floor(row.number)) : result.length + 1;
    const label = typeof row.label === 'string' ? row.label : 'Exercise';
    const accuracy = bounded(row.accuracy, 0, 100, 0);
    const item: HistoryRow = {
      ...cloneRecord(row),
      number,
      label,
      accuracy,
    } as HistoryRow;
    if (isRecord(row.curriculumScores)) item.curriculumScores = normalizeBestScores(row.curriculumScores);
    if (Array.isArray(row.testedSkills)) item.testedSkills = row.testedSkills.filter((skill): skill is string => typeof skill === 'string');
    result.push(item);
  }
  return result.slice(-MAX_HISTORY_ROWS);
};

const normalizeDaily = (value: unknown, now: number): Daily => {
  const source = isRecord(value) ? value : {};
  const date = typeof source.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.date)
    ? source.date
    : localDate(now);
  return {
    date,
    rounds: Math.floor(nonNegative(source.rounds, 0)),
    notes: Math.floor(nonNegative(source.notes, 0)),
    jazz: Math.floor(nonNegative(source.jazz, 0)),
    claimed: source.claimed === true,
  };
};
const hasProgressFields = (value: Record<string, unknown>): boolean => {
  const known = ['xp', 'correct', 'attempts', 'bestStreak', 'modeStats', 'keyStats', 'achievements', 'bestScores', 'responseTimes', 'freeDrills', 'exerciseHistory', 'curriculum', 'daily'];
  return known.some((key) => key in value);
};

const TRACE_EVIDENCE_KEYS = ['recent', 'mastery', 'points', 'score', 'attempts', 'firstTry', 'lastAsked', 'lastAnswered', 'lastPracticed', 'halfLife', 'solidified', 'timings', 'baseline', 'latencySlope', 'explainedAt', 'learned', 'mastered'];

const hasTraceEvidence = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (TRACE_EVIDENCE_KEYS.some((key) => key in value)) return true;
  if (isRecord(value.rootTraces) && Object.keys(value.rootTraces).length > 0) return true;
  if (isRecord(value.roots) && Object.keys(value.roots).length > 0) return true;
  return KEYS.some((key) => isRecord(value[key]));
};
const conceptsFromLegacy = (curriculum: Record<string, unknown>, ids: readonly string[]): Record<string, LessonTrace> => {
  const result: Record<string, LessonTrace> = {};
  const courseV2 = isRecord(curriculum.courseV2) ? curriculum.courseV2 : undefined;
  const courseConcepts = courseV2 && isRecord(courseV2.concepts) ? courseV2.concepts : undefined;
  const genericConcepts = isRecord(curriculum.concepts) ? curriculum.concepts : undefined;
  const sources = [courseConcepts, genericConcepts];
  for (const id of ids) {
    for (const source of sources) {
      const row = source?.[id];
      if (hasTraceEvidence(row)) {
        result[id] = normalizeLessonTrace(row);
        break;
      }
    }
    const direct = curriculum[id];
    if (!result[id] && hasTraceEvidence(direct)) result[id] = normalizeLessonTrace(direct);
  }
  return result;
};

const mergeGroupedIntervals = (
  curriculum: Record<string, unknown>,
  concepts: Record<string, LessonTrace>,
): void => {
  for (const [group, mapping] of Object.entries(INTERVAL_GROUPS)) {
    const rows = curriculum[group];
    if (!isRecord(rows)) continue;
    for (const [root, rootRow] of Object.entries(rows)) {
      if (!validKey(root) || !isRecord(rootRow)) continue;
      const histories = isRecord(rootRow.intervalHistory) ? rootRow.intervalHistory : {};
      for (const [distance, lessonId] of Object.entries(mapping)) {
        if (!Array.isArray(histories[distance])) continue;
        const existing = concepts[lessonId];
        if (existing?.rootTraces[root]) continue;
        const recent = boolResults(histories[distance]).slice(-10);
        const migrated = normalizeTrace({
          ...rootRow,
          recent,
          lastPracticed: rootRow.lastPracticed,
          points: rootRow.points,
        });
        if (!concepts[lessonId]) concepts[lessonId] = normalizeLessonTrace({});
        concepts[lessonId].rootTraces[root] = migrated;
        if (!concepts[lessonId].recent.length) {
          concepts[lessonId].recent = [...recent];
          concepts[lessonId].points = migrated.points;
          concepts[lessonId].attempts = migrated.attempts;
          concepts[lessonId].firstTry = migrated.firstTry;
          concepts[lessonId].lastAsked = migrated.lastAsked;
          concepts[lessonId].lastAnswered = migrated.lastAnswered;
        }
      }
    }
  }
};

const mergeConceptMaps = (
  primary: Record<string, LessonTrace>,
  secondary: Record<string, LessonTrace>,
): Record<string, LessonTrace> => {
  const result: Record<string, LessonTrace> = { ...secondary };
  for (const [lessonId, trace] of Object.entries(primary)) {
    const previous = result[lessonId];
    if (!previous) {
      result[lessonId] = trace;
      continue;
    }
    const roots: Partial<Record<Key, Trace>> = {
      ...previous.rootTraces,
      ...trace.rootTraces,
    };
    result[lessonId] = { ...previous, ...trace, rootTraces: roots };
  }
  return result;
};

const mergeTraceMaps = (primary: Record<string, Trace>, secondary: Record<string, Trace>): Record<string, Trace> => ({
  ...secondary,
  ...primary,
});

const admittedPrefix = (raw: unknown, ids: readonly string[]): string[] => {
  const requested = new Set(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []);
  const result: string[] = [];
  for (const id of ids) {
    if (!requested.has(id)) break;
    result.push(id);
  }
  if (!result.length && ids.length) result.push(ids[0]);
  return result;
};

const inferredAdmission = (
  ids: readonly string[],
  concepts: Record<string, LessonTrace>,
  anchor: string | undefined,
): string[] => {
  if (!anchor || !ids.includes(anchor)) return ids.length ? [ids[0]] : [];
  const result: string[] = [];
  const end = ids.indexOf(anchor);
  for (let index = 0; index <= end; index += 1) {
    const id = ids[index];
    if (index > 0 && !concepts[id]) break;
    result.push(id);
  }
  return result.length ? result : ids.length ? [ids[0]] : [];
};

const pickAnchor = (
  courseV2: Record<string, unknown> | undefined,
  curriculum: Record<string, unknown>,
  ids: readonly string[],
): { selection?: Selection; lessonId?: string } => {
  const pacing = courseV2 && isRecord(courseV2.pacing) ? courseV2.pacing : undefined;
  const focus = courseV2 && isRecord(courseV2.focus) ? courseV2.focus : undefined;
  const curriculumFocus = isRecord(curriculum.focus) ? curriculum.focus : undefined;
  const candidates = [pacing, focus, curriculumFocus, isRecord(curriculum.pacing) ? curriculum.pacing : undefined];
  for (const candidate of candidates) {
    const lessonId = readLessonId(candidate);
    if (!lessonId || !ids.includes(lessonId)) continue;
    const candidateKey = isRecord(candidate) ? (candidate.key ?? candidate.root ?? candidate.center) : undefined;
    if (candidateKey !== undefined && !validKey(candidateKey)) continue;
    const key = readSelection(candidate)?.key ?? starterKey(lessonId);
    return { lessonId, selection: { lessonId, key } };
  }
  return {};
};

const guidedExplanations = (
  concepts: Record<string, LessonTrace>,
  admitted: readonly string[],
  anchorId: string | undefined,
  existing: unknown,
  currentCourse: boolean,
): string[] => {
  const allowed = new Set(admitted);
  if (currentCourse) {
    return Array.isArray(existing)
      ? existing.filter((item): item is string => typeof item === 'string' && allowed.has(item))
      : [];
  }
  if (!anchorId || !allowed.has(anchorId)) return [];
  const result: string[] = [];
  for (const lessonId of admitted) {
    const trace = concepts[lessonId];
    if (!trace) continue;
    const legacyFields = trace as LessonTrace & Record<string, unknown>;
    const genericIntro = !isScaleLesson(lessonId)
      && (legacyFields.learned === true || finite(trace.explainedAt));
    const keyIntro = Object.entries(trace.rootTraces ?? {}).some(([key, rootTrace]) => (
      validKey(key) && finite(rootTrace.explainedAt)
    ));
    if (genericIntro || keyIntro) result.push(lessonId);
  }
  return result;
};

const normalizeCourse = (source: Record<string, unknown>): Course => {
  const curriculum = isRecord(source.curriculum) ? source.curriculum : {};
  const legacyCurriculum = isRecord(source.focus) && !isRecord(curriculum.focus)
    ? { ...curriculum, focus: source.focus }
    : curriculum;
  const ids = catalogIds();
  const oldCourse = isRecord(curriculum.courseV2) ? curriculum.courseV2 : undefined;
  const currentCourse = isRecord(curriculum.courseV3) ? curriculum.courseV3 : undefined;
  const oldConcepts = conceptsFromLegacy(curriculum, ids);
  const currentConcepts = currentCourse
    ? normalizeTraceMap(currentCourse.concepts, true) as unknown as Record<string, LessonTrace>
    : {};
  const concepts = mergeConceptMaps(currentConcepts, oldConcepts);
  mergeGroupedIntervals(curriculum, concepts);
  const oldItems = oldCourse
    ? normalizeTraceMap(oldCourse.items) as unknown as Record<string, Trace>
    : {};
  const currentItems = currentCourse
    ? normalizeTraceMap(currentCourse.items) as unknown as Record<string, Trace>
    : {};
  const items = mergeTraceMaps(currentItems, oldItems);

  const currentAnchor = currentCourse ? readSelection(currentCourse.focus) : undefined;
  const legacyAnchor = pickAnchor(oldCourse, legacyCurriculum, ids);
  const anchorId = currentAnchor?.lessonId ?? legacyAnchor.lessonId;
  const admitted = currentCourse
    ? admittedPrefix(currentCourse.admitted, ids)
    : inferredAdmission(ids, concepts, anchorId);
  const selected = currentAnchor && admitted.includes(currentAnchor.lessonId)
    ? currentAnchor
    : legacyAnchor.selection && admitted.includes(legacyAnchor.selection.lessonId)
      ? legacyAnchor.selection
      : { lessonId: admitted[0] ?? 'notes', key: starterKey(admitted[0] ?? 'notes') };

  const oldPacing = oldCourse && isRecord(oldCourse.pacing) ? oldCourse.pacing : undefined;
  const offerAfter = currentCourse && finite(currentCourse.offerAfter)
    ? currentCourse.offerAfter
    : oldCourse && finite(oldCourse.offerAfter)
      ? oldCourse.offerAfter
      : oldPacing && finite(oldPacing.offerAfter)
        ? oldPacing.offerAfter
        : 0;
  const guidedExplained = guidedExplanations(
    concepts,
    admitted,
    legacyAnchor.lessonId,
    currentCourse?.guidedExplained,
    currentCourse !== undefined,
  );
  return {
    version: 3,
    concepts,
    items,
    admitted,
    focus: selected,
    offerAfter: offerAfter >= 0 ? offerAfter : 0,
    guidedExplained,
  };
};

const normalizeProgress = (source: Record<string, unknown>, now: number): Progress => {
  const result = cloneRecord(source) as Progress & Record<string, unknown>;
  result.xp = nonNegative(source.xp, 0);
  result.correct = Math.floor(nonNegative(source.correct, 0));
  result.attempts = Math.max(
    Math.floor(nonNegative(source.attempts, 0)),
    result.correct,
  );
  result.bestStreak = Math.floor(nonNegative(source.bestStreak, 0));
  result.modeStats = normalizeStats(source.modeStats) as unknown as Progress['modeStats'];
  result.keyStats = normalizeStats(source.keyStats) as unknown as Progress['keyStats'];
  result.achievements = Array.isArray(source.achievements)
    ? source.achievements.filter((item): item is string => typeof item === 'string')
    : [];
  result.bestScores = normalizeBestScores(source.bestScores);
  result.responseTimes = normalizeResponseTimes(source.responseTimes);
  result.freeDrills = isRecord(source.freeDrills) ? cloneRecord(source.freeDrills) : {};
  result.exerciseHistory = normalizeHistory(source.exerciseHistory);
  result.curriculum = {
    ...(isRecord(source.curriculum) ? cloneRecord(source.curriculum) : {}),
    courseV3: normalizeCourse(source),
  };
  result.daily = normalizeDaily(source.daily, now);
  return result;
};

export function createProgress(now?: number): Progress {
  const at = clockValue(now);
  const course: Course = {
    version: 3,
    concepts: {},
    items: {},
    admitted: ['notes'],
    focus: { lessonId: 'notes', key: 'C' },
    offerAfter: 0,
    guidedExplained: [],
  };
  return {
    xp: 0,
    correct: 0,
    attempts: 0,
    bestStreak: 0,
    modeStats: {},
    keyStats: {},
    achievements: [],
    bestScores: {},
    responseTimes: {},
    freeDrills: {},
    exerciseHistory: [],
    curriculum: { courseV3: course },
    daily: { date: localDate(at), rounds: 0, notes: 0, jazz: 0, claimed: false },
  };
}

export function migrateProgress(value: unknown, now?: number): Progress {
  const at = clockValue(now);
  if (!isRecord(value)) return createProgress(at);
  try {
    return normalizeProgress(value, at);
  } catch {
    return createProgress(at);
  }
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const defaultStorage = (): StorageLike => {
  if (typeof globalThis.localStorage === 'undefined') throw new Error('Browser storage is unavailable');
  return globalThis.localStorage;
};

export function openProgress(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'> = defaultStorage,
  now?: number,
): { progress: Progress; save: () => boolean; readonly error: string | null } {
  const at = clockValue(now);
  let error: string | null = null;
  let canSave = true;
  let progress = createProgress(at);
  try {
    const storage = getStorage();
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      throw new Error('Browser storage is unavailable');
    }
    const raw = storage.getItem(SAVE_KEY);
    if (raw !== null) {
      let decoded: unknown = undefined;
      try {
        decoded = JSON.parse(raw);
      } catch {
        canSave = false;
        error = 'Saved progress could not be decoded; the original value was left untouched.';
      }
      if (canSave) {
        if (!isRecord(decoded) || !hasProgressFields(decoded)) {
          canSave = false;
          error = 'Saved progress is unsupported; the original value was left untouched.';
        } else {
          try {
            progress = normalizeProgress(decoded, at);
          } catch {
            canSave = false;
            error = 'Saved progress could not be migrated; the original value was left untouched.';
          }
        }
      }
    }
    const save = (): boolean => {
      if (!canSave) return false;
      try {
        storage.setItem(SAVE_KEY, JSON.stringify(progress));
        return true;
      } catch {
        error = 'Progress could not be saved; the previous value was left untouched.';
        canSave = false;
        return false;
      }
    };
    return {
      progress,
      save,
      get error(): string | null { return error; },
    };
  } catch (cause) {
    error = `Browser storage is unavailable${cause instanceof Error && cause.message ? `: ${cause.message}` : '.'}`;
    canSave = false;
    return {
      progress,
      save: () => {
        canSave = false;
        return false;
      },
      get error(): string | null { return error; },
    };
  }
}

const exportSafeValue = (value: unknown, key?: string, seen = new WeakSet<object>()): unknown => {
  if (key && /^(?:audio|audioBlob|voiceCache|voiceClips|heldNotes|transient|session)$/i.test(key)) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => exportSafeValue(item, undefined, seen)).filter((item) => item !== undefined);
  if (!isRecord(value)) return undefined;
  const result: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    const safe = exportSafeValue(childValue, childKey, seen);
    if (safe !== undefined) result[childKey] = safe;
  }
  return result;
};

export function progressBackup(progress: Progress, now?: number): { filename: string; contents: string } {
  const at = clockValue(now);
  const envelope = {
    exportedAt: isoTimestamp(at),
    application: 'Keycraft',
    progress: exportSafeValue(progress) ?? createProgress(at),
  };
  let contents: string;
  try {
    contents = JSON.stringify(envelope, null, 2);
  } catch {
    contents = JSON.stringify({
      exportedAt: isoTimestamp(at),
      application: 'Keycraft',
      progress: createProgress(at),
    }, null, 2);
  }
  return {
    filename: `keycraft-progress-${localDate(at)}.json`,
    contents,
  };
}

export function exportProgress(progress: Progress, now?: number): void {
  const backup = progressBackup(progress, now);
  if (typeof document === 'undefined') return;
  try {
    const blob = new Blob([backup.contents], { type: 'application/json' });
    const urlApi = globalThis.URL;
    const href = typeof urlApi?.createObjectURL === 'function'
      ? urlApi.createObjectURL(blob)
      : `data:application/json;charset=utf-8,${encodeURIComponent(backup.contents)}`;
    const link = document.createElement('a');
    link.href = href;
    link.download = backup.filename;
    link.rel = 'noopener';
    if (document.body) document.body.appendChild(link);
    link.click();
    if (typeof link.remove === 'function') link.remove();
    if (typeof urlApi?.revokeObjectURL === 'function' && href.startsWith('blob:')) urlApi.revokeObjectURL(href);
  } catch {
    // A browser without download primitives still has a readable backup via progressBackup.
  }
}
