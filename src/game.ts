import { answerText } from './answer-display.ts';
import { LESSON_BY_ID } from './catalog.ts';
import type { Lesson } from './catalog.ts';
import { MODES, pretty } from './domain.ts';
import type { Progress, Prompt, RoundScore, RunScore, ScheduledSelection, Scope, Selection, StandaloneSettings } from './domain.ts';
import { Answer } from './evaluate.ts';
import type { Verdict } from './evaluate.ts';
import { choosePrompt, chooseStandaloneKey, lessonPrompts, previewPrompt, previewSpeech, standalonePrompts } from './prompts.ts';
import { ensureKey, ensureLesson, finishRound, present, recall, recordMistake, roundScore, runScore } from './record.ts';
import { awardBadges, challengeAttack, challengeClear, claimDaily, finishExercise, refreshDaily } from './results.ts';
import type { Summary } from './results.ts';
import { acceptAdmission, declineAdmission, nextAdmission, rotation, selectGuided } from './schedule.ts';

const HINT_DELAY = 6_000;
const TRANSITION = 850;
const DAY = 86_400_000;
const systemClock = { wall: () => Date.now(), mono: () => performance.now() };

type Phase = 'ready' | 'teaching' | 'playing' | 'feedback' | 'summary' | 'advance';

class PlayingTime {
  #elapsed = 0;
  #since: number | undefined;

  get running() { return this.#since !== undefined; }
  elapsed(now: number) { return this.#elapsed + (this.#since === undefined ? 0 : now - this.#since); }
  run(running: boolean, now: number) {
    if (running) this.#since ??= now;
    else if (this.#since !== undefined) {
      this.#elapsed += now - this.#since;
      this.#since = undefined;
    }
  }
}

interface Example {
  answer: Answer;
  prompt: Prompt;
  feedback: string;
}

interface Round {
  prompt: Prompt;
  role?: ScheduledSelection['role'];
  answer: Answer;
  score: RoundScore;
  clock: PlayingTime;
  notes: { note: number; at: number }[];
  activityAt: number;
  timingInvalid: boolean;
  assisted: boolean;
  manualHint: boolean;
  hint: boolean;
  message: string;
  error: boolean;
  teaches?: 'New concept' | 'Concept refresher';
  teaching?: Example;
  transitionAt?: number;
}

interface Exercise {
  scope: Scope;
  scoreKey: string;
  label: string;
  arcade: boolean;
  hearts: number;
  total: number;
  number: number;
  score: RunScore;
  tested: Set<string>;
  rotation?: readonly Selection[];
  round?: Round;
  summary?: Summary;
  preview?: Example;
  offer?: Lesson;
}

interface Hooks {
  changed: () => void;
  save: () => void;
  clearVirtual: () => void;
  speech: (text?: string, next?: string) => void;
}

interface ExampleView {
  prompt: Prompt;
  message: string;
  stage: number;
  step: number;
}

export interface GameView {
  phase: Phase;
  scope?: Scope;
  label?: string;
  prompt?: Prompt;
  role?: ScheduledSelection['role'];
  round: number;
  total: number;
  step: number;
  stage: number;
  hint: boolean;
  message: string;
  error: boolean;
  points: number;
  combo: number;
  hearts?: number;
  seconds?: number;
  lastNote?: number;
  teaching?: ExampleView & { title: string };
  summary?: Summary;
  preview?: ExampleView;
  offer?: Lesson;
}

function budget(prompt: Prompt): number {
  if (prompt.kind === 'note') return 20_000;
  if (prompt.kind === 'scale' || (prompt.kind === 'stack' && prompt.stages.length > 1)) return 52_000;
  return 35_000;
}

function example(prompt: Prompt): Example {
  return { prompt, answer: new Answer(prompt), feedback: '' };
}

function describeExample(e: Example): ExampleView {
  return { prompt: e.prompt, message: e.feedback, stage: e.answer.stageIndex, step: e.answer.step };
}

function speechAt(prompt: Prompt, stage: number): string {
  return prompt.kind === 'stack' ? prompt.stages[stage].speech : prompt.speech;
}

export class Game {
  readonly progress: Progress;
  readonly settings: StandaloneSettings = { key: 'C', difficulty: 'foundation', runType: 'practice' };
  #hooks: Hooks;
  #clock: typeof systemClock;
  #random: () => number;
  #session?: Exercise;
  #savedFocus?: Selection;
  #lastNote?: number;
  #hidden = false;
  #speaking = false;
  #dirty = false;

  constructor(progress: Progress, hooks: Hooks, clock = systemClock, random = Math.random) {
    this.progress = progress;
    this.#hooks = hooks;
    this.#clock = clock;
    this.#random = random;
    this.#savedFocus = progress.curriculum.courseV3.focus;
  }

  get phase(): Phase {
    const s = this.#session;
    if (!s?.round) return 'ready';
    if (s.offer) return 'advance';
    if (s.summary) return 'summary';
    if (s.round.teaching) return 'teaching';
    return s.round.transitionAt === undefined ? 'playing' : 'feedback';
  }

  view(now = this.#clock.mono()): GameView {
    const s = this.#session;
    const r = s?.round;
    const phase = this.phase;
    return {
      phase, scope: s?.scope, label: s?.label, prompt: r?.prompt, role: r?.role,
      round: s?.number ?? 0, total: s?.total ?? 0, step: r?.answer.step ?? 0, stage: r?.answer.stageIndex ?? 0,
      hint: r?.hint ?? false, message: r?.message ?? '', error: r?.error ?? false,
      points: s?.score.points ?? 0, combo: s?.score.combo ?? 0, hearts: s?.arcade ? s.hearts : undefined,
      seconds: s?.arcade && r ? Math.max(0, Math.ceil((budget(r.prompt) - r.clock.elapsed(now)) / 1_000)) : undefined,
      lastNote: this.#lastNote, teaching: r?.teaching ? { ...describeExample(r.teaching), title: r.teaches! } : undefined,
      summary: s?.summary, preview: s?.preview ? describeExample(s.preview) : undefined, offer: s?.offer,
    };
  }

  start(scope: Scope, admittedFocus?: Selection) {
    this.#retire();
    const course = this.progress.curriculum.courseV3;
    const guided = scope.kind === 'guided'
      ? admittedFocus ? { ...admittedFocus, role: 'focus' as const } : selectGuided(course, 1, this.#clock.wall(), this.#savedFocus)
      : undefined;
    if (guided) this.#savedFocus = undefined;
    const rotated = scope.kind === 'rotation' ? rotation(scope.lessonIds) : undefined;
    const type = this.settings.runType;
    const arcade = type === 'arcade' && (scope.kind === 'standalone' || scope.kind === 'fixed');
    let scoreKey: string;
    let label: string;
    if (scope.kind === 'standalone') {
      scoreKey = `${scope.mode}:${type}`;
      label = MODES[scope.mode];
    } else if (scope.kind === 'rotation') {
      label = scope.label;
      scoreKey = scope.section ? `branch:${scope.label}` : `curriculum:${scope.lessonIds[0]}`;
    } else if (scope.kind === 'fixed') {
      scoreKey = `curriculum:${scope.lessonId}`;
      label = `${pretty(scope.key)} · ${LESSON_BY_ID.get(scope.lessonId)!.title}`;
    } else {
      scoreKey = `curriculum:${guided!.lessonId}`;
      label = scope.entry === 'continuous' ? 'Just Practice' : 'Suggested drill';
    }
    const session: Exercise = {
      scope, scoreKey, label, arcade, hearts: 3, total: rotated?.length ?? 10, number: 0,
      score: runScore(), tested: new Set(), rotation: rotated,
    };
    this.#session = session;
    this.#beginRound(session, guided);
  }

  stop() {
    this.#retire();
    this.#notify();
  }

  input(event: { kind: 'attack' | 'release'; note: number }) {
    const now = this.#clock.mono();
    const phase = this.phase;
    if (event.kind === 'attack') {
      this.#lastNote = event.note;
      if (phase !== 'teaching' && phase !== 'summary' && phase !== 'advance') {
        challengeAttack(this.progress, this.#clock.wall());
        this.#dirty = true;
      }
    }
    const answer = this.#activeAnswer();
    if (answer) {
      if (phase === 'playing' && this.#timeUp(now)) {
        this.#skip(now, 'Time is up.');
        return;
      }
      if (this.#expire(answer, now) && this.#activeAnswer() !== answer) {
        this.#notify();
        return;
      }
      const round = this.#session!.round!;
      if (event.kind === 'attack' && phase === 'playing') {
        round.activityAt = round.clock.elapsed(now);
        if (!round.clock.running) round.timingInvalid = true;
        if (!round.timingInvalid && !round.assisted && !round.score.mistakes) {
          round.notes.push({ note: event.note, at: round.activityAt });
        }
      }
      const verdict = event.kind === 'attack' ? answer.attack(event.note, now) : answer.release(event.note);
      if (verdict) this.#handleVerdict(verdict, now);
    }
    this.#notify();
  }

  dismissTeaching() {
    const round = this.#session?.round;
    if (!round?.teaching) return;
    round.teaching = undefined;
    this.#hooks.clearVirtual();
    this.#updateClock(this.#clock.mono());
    this.#speak();
    this.#notify();
  }

  toggleHint() {
    if (this.phase !== 'playing') return;
    const round = this.#session!.round!;
    round.hint = !round.hint;
    if (round.hint) {
      round.assisted = true;
      round.manualHint = true;
    } else {
      round.activityAt = round.clock.elapsed(this.#clock.mono());
    }
    this.#notify();
  }

  skip() {
    if (this.phase === 'playing') this.#skip(this.#clock.mono(), 'Skipped.');
  }

  continue() {
    const s = this.#session;
    if (!s?.summary || !s.preview || s.offer) return;
    s.preview = undefined;
    const offer = s.scope.kind === 'guided' ? nextAdmission(this.progress.curriculum.courseV3, this.#clock.wall()) : undefined;
    if (!offer) {
      this.start(s.scope);
      return;
    }
    s.offer = offer;
    this.#hooks.clearVirtual();
    this.#hooks.speech();
    this.#notify();
  }

  answerOffer(accept: boolean) {
    const s = this.#session;
    if (!s?.offer || s.scope.kind !== 'guided') return;
    const course = this.progress.curriculum.courseV3;
    const now = this.#clock.wall();
    const accepted = accept && acceptAdmission(course, s.offer.id, now);
    if (!accept) declineAdmission(course, now);
    this.#dirty = true;
    this.start(s.scope, accepted ? course.focus : undefined);
  }

  setHidden(hidden: boolean) {
    this.#hidden = hidden;
    if (hidden) this.invalidateTiming();
    this.#updateClock(this.#clock.mono());
    this.maintenance();
  }

  invalidateTiming() {
    if (this.phase === 'playing') this.#session!.round!.timingInvalid = true;
  }

  setSpeaking(playing: boolean) {
    if (playing === this.#speaking) return;
    this.#speaking = playing;
    this.#updateClock(this.#clock.mono());
    this.#notify();
  }

  replay() { this.#speak(); }

  maintenance() {
    if (refreshDaily(this.progress, this.#clock.wall())) this.#dirty = true;
    if (awardBadges(this.progress)) this.#dirty = true;
    this.#notify();
  }

  claimReward() {
    if (claimDaily(this.progress, this.#clock.wall())) this.#dirty = true;
    this.maintenance();
  }

  wakeAfter(now = this.#clock.mono()): number | undefined {
    const round = this.#session?.round;
    if (this.phase === 'feedback') return Math.max(0, round!.transitionAt! - now);
    const expiry = this.#activeAnswer()?.pendingUntil;
    let delay = expiry === undefined ? Infinity : Math.max(0, expiry - now + 1);
    if (this.phase === 'playing' && round!.clock.running) {
      const elapsed = round!.clock.elapsed(now);
      if (this.#session!.arcade) {
        const remaining = Math.max(0, budget(round!.prompt) - elapsed);
        delay = Math.min(delay, remaining === 0 ? 0 : remaining % 1_000 || 1_000);
      }
      if (this.#session!.scope.kind !== 'guided' && !round!.hint) {
        delay = Math.min(delay, Math.max(0, HINT_DELAY - (elapsed - round!.activityAt)));
      }
    }
    return delay === Infinity ? undefined : delay;
  }

  tick(now = this.#clock.mono()) {
    const s = this.#session;
    const r = s?.round;
    if (!s || !r) return;
    if (this.phase === 'feedback' && now >= r.transitionAt!) {
      if (s.number >= s.total || (s.arcade && s.hearts === 0)) this.#summarize(s);
      else this.#beginRound(s);
      return;
    }
    if (this.phase === 'playing' && this.#timeUp(now)) {
      this.#skip(now, 'Time is up.');
      return;
    }
    const answer = this.#activeAnswer();
    if (answer) this.#expire(answer, now);
    if (this.phase === 'playing' && s.scope.kind !== 'guided' && !r.hint && r.clock.elapsed(now) - r.activityAt >= HINT_DELAY) {
      r.hint = true;
      r.assisted = true;
    }
    this.#notify();
  }

  #notify() {
    if (this.#dirty) {
      this.#dirty = false;
      this.#hooks.save();
    }
    this.#hooks.changed();
  }

  #retire() {
    this.#session = undefined;
    this.#speaking = false;
    this.#hooks.speech();
    this.#hooks.clearVirtual();
  }

  #activeAnswer(): Answer | undefined {
    const s = this.#session;
    if (this.phase === 'teaching') return s!.round!.teaching!.answer;
    if (this.phase === 'playing') return s!.round!.answer;
    if (this.phase === 'summary') return s!.preview?.answer;
    return undefined;
  }

  #expire(answer: Answer, now: number): boolean {
    const result = answer.expire(now);
    if (!result) return false;
    this.#handleVerdict(result, now);
    return true;
  }

  #timeUp(now: number) {
    const s = this.#session!;
    return s.arcade && s.round!.clock.elapsed(now) >= budget(s.round!.prompt);
  }

  #updateClock(now: number) {
    this.#session?.round?.clock.run(this.phase === 'playing' && !this.#hidden && !this.#speaking, now);
  }

  #speak() {
    const s = this.#session;
    const phase = this.phase;
    if (phase === 'playing') {
      const { prompt, answer } = s!.round!;
      const next = prompt.kind === 'stack' ? prompt.stages[answer.stageIndex + 1]?.speech : undefined;
      this.#hooks.speech(speechAt(prompt, answer.stageIndex), next);
    } else if (phase === 'summary' && s?.preview) {
      const { prompt, answer } = s.preview;
      const next = prompt.kind === 'stack' ? prompt.stages[answer.stageIndex + 1]?.speech : undefined;
      this.#hooks.speech(answer.stageIndex === 0 ? previewSpeech(prompt) : speechAt(prompt, answer.stageIndex), next);
    } else this.#hooks.speech();
  }

  #beginRound(s: Exercise, first?: ScheduledSelection) {
    const course = this.progress.curriculum.courseV3;
    const now = this.#clock.wall();
    const previous = s.round?.prompt;
    s.number += 1;
    const scope = s.scope;
    const scheduled = scope.kind === 'guided' ? first ?? selectGuided(course, s.number, now) : undefined;
    const selection = scheduled ?? (scope.kind === 'fixed' ? scope : s.rotation?.[s.number - 1]);
    let prompt: Prompt;
    if (selection) {
      const exposure = (candidate: Prompt) => {
        const trace = course.items[candidate.itemId!] ?? (candidate.legacyItemId ? course.items[candidate.legacyItemId] : undefined);
        return trace?.attempts ?? 0;
      };
      prompt = choosePrompt(lessonPrompts(selection.lessonId, selection.key), this.#random, previous, exposure);
      if (scheduled?.role === 'focus') course.focus = { lessonId: selection.lessonId, key: selection.key };
    } else if (scope.kind === 'standalone') {
      const { key, difficulty } = this.settings;
      const center = key === 'auto' ? chooseStandaloneKey(scope.mode, difficulty, this.progress.keyStats, this.#random, previous) : key;
      prompt = choosePrompt(standalonePrompts(scope.mode, center, difficulty), this.#random, previous);
    } else throw new Error('A curriculum scope has no lesson or key');

    const r: Round = {
      prompt, role: scheduled?.role, answer: new Answer(prompt), score: roundScore(), clock: new PlayingTime(), notes: [],
      activityAt: 0, timingInvalid: this.#hidden, assisted: false, manualHint: false, hint: false, message: '', error: false,
    };
    if (prompt.lessonId) {
      const keyTrace = ensureKey(course, prompt.lessonId, prompt.key);
      const introTrace = prompt.kind === 'scale' ? keyTrace : ensureLesson(course, prompt.lessonId);
      const firstGuided = Boolean(scheduled && !course.guidedExplained.includes(prompt.lessonId));
      const firstExposure = introTrace.lastAsked === undefined && introTrace.lastAnswered === undefined && introTrace.explainedAt === undefined;
      const explained = keyTrace.explainedAt ?? introTrace.explainedAt ?? 0;
      const refresher = (keyTrace.lastAnswered ?? 0) > explained && now - explained >= DAY &&
        keyTrace.recent.slice(-8).filter(result => !result).length >= 2 && recall(keyTrace, now) < 0.25;
      if (firstGuided || firstExposure || refresher) {
        r.teaches = firstGuided || firstExposure ? 'New concept' : 'Concept refresher';
        r.teaching = example(prompt);
        r.assisted = true;
        keyTrace.explainedAt = now;
        if (firstGuided || firstExposure) introTrace.explainedAt = now;
        if (firstGuided) course.guidedExplained.push(prompt.lessonId);
      }
      present(this.progress, prompt, now);
      this.#dirty = true;
      s.tested.add(prompt.lessonId);
    }
    s.round = r;
    this.#hooks.clearVirtual();
    this.#updateClock(this.#clock.mono());
    this.#speak();
    this.#notify();
  }

  #handleVerdict(verdict: Verdict, now: number) {
    const s = this.#session!;
    const r = s.round!;
    if (r.teaching) {
      if (verdict.kind === 'clear') this.dismissTeaching();
      else r.teaching.feedback = verdict.message;
      return;
    }
    if (s.preview) {
      if (verdict.kind === 'clear') this.continue();
      else {
        s.preview.feedback = verdict.message;
        if (verdict.kind === 'stage') this.#speak();
      }
      return;
    }
    if (this.phase !== 'playing') return;
    r.message = verdict.message;
    r.error = verdict.kind === 'miss';
    if (verdict.kind === 'miss') {
      const penalty = this.#judgeMistake();
      if (penalty) r.message += ` −${penalty} pts.`;
      if (s.hearts === 0) this.#finishRound(false, now, r.message);
    } else if (verdict.kind === 'clear') this.#finishRound(true, now);
    else if (verdict.kind === 'stage') this.#speak();
  }

  #judgeMistake(skipped = false): number {
    const s = this.#session!;
    const r = s.round!;
    const penalty = recordMistake(this.progress, r.prompt, s.score, r.score, this.#clock.wall(), skipped);
    if (s.arcade) s.hearts -= 1;
    this.#dirty = true;
    return penalty;
  }

  #skip(now: number, message: string) {
    if (this.phase !== 'playing') return;
    const penalty = this.#judgeMistake(true);
    this.#finishRound(false, now, `${message}${penalty ? ` −${penalty} pts.` : ''}`);
    this.#notify();
  }

  #finishRound(cleared: boolean, now: number, message?: string) {
    const s = this.#session!;
    const r = s.round!;
    const wall = this.#clock.wall();
    const result = finishRound(this.progress, r.prompt, s.score, r.score, {
      now: wall, cleared, arcade: s.arcade, assisted: r.assisted, manualHint: r.manualHint,
      timing: { elapsed: r.clock.elapsed(now), notes: r.notes, invalid: r.timingInvalid },
    });
    if (!result) return;
    if (cleared) challengeClear(this.progress, r.prompt.mode, wall);
    awardBadges(this.progress);
    this.#dirty = true;
    r.error = !cleared;
    if (cleared) {
      const status = result.recovered ? 'Recovered' : r.assisted ? 'Assisted clear' : 'Clean';
      const scoped = r.prompt.lessonId ? this.progress.curriculum.courseV3.concepts[r.prompt.lessonId].rootTraces[r.prompt.key] : undefined;
      r.message = `${status}. +${result.points} pts · +${result.xp} XP${scoped ? ` · ${pretty(r.prompt.key)} score ${scoped.points}%` : ''}.`;
    } else r.message = `${message ?? 'Not cleared.'} Answer: ${answerText(r.prompt)}.`;
    r.transitionAt = now + TRANSITION;
    this.#updateClock(now);
    this.#hooks.speech();
  }

  #summarize(s: Exercise) {
    s.summary = finishExercise(this.progress, s.scoreKey, s.label, s.total, s.score, s.tested);
    this.#dirty = true;
    const admitted = s.scope.kind === 'guided' ? this.progress.curriculum.courseV3.admitted : undefined;
    s.preview = example(previewPrompt(s.summary.number, admitted, this.#random));
    this.#hooks.clearVirtual();
    this.#speak();
    this.#notify();
  }
}
