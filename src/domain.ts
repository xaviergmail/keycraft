export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Db', 'Eb', 'Gb', 'Ab', 'Bb'] as const;
export type Key = (typeof KEYS)[number];
export const CANONICAL_KEYS: readonly Key[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

export const MODES = {
  notes: 'Note Dash', intervals: 'Interval Hunter', scales: 'Scale Sprint', chords: 'Chord Forge',
  inversions: 'Inversion Lab', guides: 'Guide-Tone Glide', voicings: 'Voicing Studio', cadence: 'Cadence Quest',
} as const;
export type Mode = keyof typeof MODES;
export type Difficulty = 'foundation' | 'intermediate' | 'jazz';
export type RunType = 'practice' | 'arcade';
export type GuidedEntry = 'continuous' | 'suggested';
export type Outcome = 'unaided-success' | 'miss' | 'assisted';

export interface Tone {
  name: string;
  pc: number;
  degree: number;
  offset: number;
}

export interface Stage {
  label: string;
  tones: readonly Tone[];
  bass?: number;
  speech: string;
}

interface PromptBase {
  mode: Mode;
  key: Key;
  root: Tone;
  title: string;
  instruction: string;
  theory: string;
  speech: string;
  variant: string;
  lessonId?: string;
  itemId?: string;
  legacyItemId?: string;
}

export type Prompt = PromptBase & (
  | { kind: 'note'; target: Tone }
  | { kind: 'interval'; target: Tone; semitones: number }
  | { kind: 'scale'; tones: readonly Tone[]; steps: readonly number[] }
  | { kind: 'stack'; stages: readonly Stage[] }
);

export interface Selection { lessonId: string; key: Key }
export interface ScheduledSelection extends Selection { role: 'focus' | 'review' }
export type Scope =
  | { kind: 'standalone'; mode: Mode }
  | ({ kind: 'fixed' } & Selection)
  | { kind: 'rotation'; label: string; lessonIds: readonly string[]; section: boolean }
  | { kind: 'guided'; entry: GuidedEntry };

export interface StandaloneSettings {
  key: Key | 'auto';
  difficulty: Difficulty;
  runType: RunType;
}

export interface Trace {
  points: number;
  recent: boolean[];
  mastery: Outcome[];
  attempts: number;
  firstTry: number;
  lastAsked?: number;
  lastAnswered?: number;
  halfLife: number;
  solidified: number;
  timings: number[];
  baseline?: number;
  latencySlope: number;
  explainedAt?: number;
}

export interface LessonTrace extends Trace {
  rootTraces: Partial<Record<Key, Trace>>;
}

export interface Course {
  version: 3;
  concepts: Record<string, LessonTrace>;
  items: Record<string, Trace>;
  admitted: string[];
  focus?: Selection;
  offerAfter: number;
  guidedExplained: string[];
}

export interface Totals { attempts: number; correct: number }
export interface Daily { date: string; rounds: number; notes: number; jazz: number; claimed: boolean }
export interface HistoryRow {
  number: number;
  label: string;
  accuracy: number;
  curriculumScores?: Record<string, number>;
  testedSkills?: string[];
}

export interface Progress {
  xp: number;
  correct: number;
  attempts: number;
  bestStreak: number;
  modeStats: Partial<Record<Mode, Totals>>;
  keyStats: Partial<Record<Key, Totals>>;
  achievements: string[];
  bestScores: Record<string, number>;
  responseTimes: Record<string, number[]>;
  freeDrills: Record<string, unknown>;
  exerciseHistory: HistoryRow[];
  curriculum: { courseV3: Course } & Record<string, unknown>;
  daily: Daily;
  [field: string]: unknown;
}

export interface RunScore {
  points: number;
  xp: number;
  clears: number;
  errors: number;
  skips: number;
  combo: number;
  bestCombo: number;
  responseSamples: number[];
}

export interface RoundScore {
  mistakes: number;
  committed?: Outcome;
  finished: boolean;
}

export interface TimingSamples {
  elapsed: number;
  notes: readonly { note: number; at: number }[];
  invalid: boolean;
}

export interface Awards {
  points: number;
  xp: number;
  outcome?: Outcome;
  recovered: boolean;
  responseMs?: number;
}

export const pc = (note: number) => ((note % 12) + 12) % 12;
export const pretty = (name: string) => name.replaceAll('##', '𝄪').replaceAll('bb', '𝄫').replaceAll('#', '♯').replaceAll('b', '♭');
const KEY_NAMES = KEYS.slice(0, 12);
export const midiName = (note: number) => `${pretty(KEY_NAMES[pc(note)])}${Math.floor(note / 12) - 1}`;

export function localDate(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
