import { MODES, type Key, type Mode } from './domain.ts';

/** A stable curriculum entry. Recipe details live in LESSON_RECIPES. */
export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly mode: Mode;
  readonly starterKey?: Key;
}

export interface Section {
  readonly title: string;
  readonly lessons: readonly Lesson[];
}

export type ScaleFormulaId = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'harmonic' | 'melodic';
export type ChordQuality = 'major' | 'minor' | 'sus2' | 'sus4' | 'diminished' | 'maj7' | 'm7' | 'dom7' | 'halfdim';

export interface ChordRecipe {
  readonly suffix: string;
  readonly name: string;
  readonly tones: readonly (readonly [degree: number, offset: number])[];
}

export interface IntervalRecipe {
  readonly semitones: number;
  readonly degree: number;
  readonly name: string;
  readonly symbol: string;
}

export interface ProgressionStageRecipe {
  readonly degree: number;
  readonly offset: number;
  readonly quality: ChordQuality;
}

export type ProgressionId = 'major' | 'minor-cadence' | 'turnaround' | 'tritone-sub';

export interface VoicingRecipe {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly rootDegree: number;
  readonly tones: readonly (readonly [degree: number, offset: number])[];
}

export type LessonRecipe =
  | { readonly kind: 'notes' }
  | { readonly kind: 'interval'; readonly interval: IntervalRecipe }
  | { readonly kind: 'scale'; readonly formula: ScaleFormulaId }
  | { readonly kind: 'chord'; readonly quality: ChordQuality }
  | { readonly kind: 'inversion'; readonly inversion: 1 | 2 }
  | { readonly kind: 'progression'; readonly progression: ProgressionId; readonly guides?: boolean }
  | { readonly kind: 'targets'; readonly progression: 'major' }
  | { readonly kind: 'voicings'; readonly voicings: readonly string[] };

/** Ascending scale offsets. The final offset closes the octave. */
export const SCALE_FORMULAS: Readonly<Record<ScaleFormulaId, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
  mixolydian: [0, 2, 4, 5, 7, 9, 10, 12],
  harmonic: [0, 2, 3, 5, 7, 8, 11, 12],
  melodic: [0, 2, 3, 5, 7, 9, 11, 12],
};

/** Chord tones are degree/offset pairs measured from the chord root. */
export const CHORD_RECIPES: Readonly<Record<ChordQuality, ChordRecipe>> = {
  major: { suffix: '', name: 'major', tones: [[1, 0], [3, 4], [5, 7]] },
  minor: { suffix: 'm', name: 'minor', tones: [[1, 0], [3, 3], [5, 7]] },
  sus2: { suffix: 'sus2', name: 'suspended second', tones: [[1, 0], [2, 2], [5, 7]] },
  sus4: { suffix: 'sus4', name: 'suspended fourth', tones: [[1, 0], [4, 5], [5, 7]] },
  diminished: { suffix: 'dim', name: 'diminished', tones: [[1, 0], [3, 3], [5, 6]] },
  maj7: { suffix: 'maj7', name: 'major seventh', tones: [[1, 0], [3, 4], [5, 7], [7, 11]] },
  m7: { suffix: 'm7', name: 'minor seventh', tones: [[1, 0], [3, 3], [5, 7], [7, 10]] },
  dom7: { suffix: '7', name: 'dominant seventh', tones: [[1, 0], [3, 4], [5, 7], [7, 10]] },
  halfdim: { suffix: 'm7b5', name: 'half-diminished seventh', tones: [[1, 0], [3, 3], [5, 6], [7, 10]] },
};

export const INTERVAL_RECIPES: Readonly<Record<string, IntervalRecipe>> = {
  m2: { semitones: 1, degree: 2, name: 'minor second', symbol: 'm2' },
  M2: { semitones: 2, degree: 2, name: 'major second', symbol: 'M2' },
  m3: { semitones: 3, degree: 3, name: 'minor third', symbol: 'm3' },
  M3: { semitones: 4, degree: 3, name: 'major third', symbol: 'M3' },
  P4: { semitones: 5, degree: 4, name: 'perfect fourth', symbol: 'P4' },
  A4: { semitones: 6, degree: 4, name: 'tritone', symbol: 'A4' },
  P5: { semitones: 7, degree: 5, name: 'perfect fifth', symbol: 'P5' },
  m6: { semitones: 8, degree: 6, name: 'minor sixth', symbol: 'm6' },
  M6: { semitones: 9, degree: 6, name: 'major sixth', symbol: 'M6' },
  'm7-interval': { semitones: 10, degree: 7, name: 'minor seventh', symbol: 'm7' },
  M7: { semitones: 11, degree: 7, name: 'major seventh', symbol: 'M7' },
  P8: { semitones: 12, degree: 8, name: 'octave', symbol: 'P8' },
};

export const PROGRESSIONS: Readonly<Record<ProgressionId, readonly ProgressionStageRecipe[]>> = {
  major: [
    { degree: 2, offset: 2, quality: 'm7' },
    { degree: 5, offset: 7, quality: 'dom7' },
    { degree: 1, offset: 0, quality: 'maj7' },
  ],
  'minor-cadence': [
    { degree: 2, offset: 2, quality: 'halfdim' },
    { degree: 5, offset: 7, quality: 'dom7' },
    { degree: 1, offset: 0, quality: 'minor' },
  ],
  turnaround: [
    { degree: 1, offset: 0, quality: 'maj7' },
    { degree: 6, offset: 9, quality: 'dom7' },
    { degree: 2, offset: 2, quality: 'm7' },
    { degree: 5, offset: 7, quality: 'dom7' },
  ],
  'tritone-sub': [
    { degree: 2, offset: 2, quality: 'm7' },
    { degree: 2, offset: 1, quality: 'dom7' },
    { degree: 1, offset: 0, quality: 'maj7' },
  ],
};

export const VOICING_RECIPES: Readonly<Record<string, VoicingRecipe>> = {
  'dominant-shell': {
    id: 'dominant-shell', name: 'dominant shell', label: '7', rootDegree: 5,
    tones: [[3, 4], [7, 10]],
  },
  'minor-shell': {
    id: 'minor-shell', name: 'minor shell', label: 'm7', rootDegree: 2,
    tones: [[3, 3], [7, 10]],
  },
  'rootless-dominant-13': {
    id: 'rootless-dominant-13', name: 'rootless dominant 13', label: '13', rootDegree: 5,
    tones: [[3, 4], [7, 10], [9, 14], [13, 21]],
  },
  'rootless-minor-9': {
    id: 'rootless-minor-9', name: 'rootless minor 9', label: 'm9', rootDegree: 2,
    tones: [[3, 3], [7, 10], [9, 14], [5, 7]],
  },
  'rootless-major-9': {
    id: 'rootless-major-9', name: 'rootless major 9', label: 'maj9', rootDegree: 1,
    tones: [[3, 4], [7, 11], [9, 14], [5, 7]],
  },
  'rootless-altered-dominant': {
    id: 'rootless-altered-dominant', name: 'rootless altered dominant', label: '7(b9,b13)', rootDegree: 5,
    tones: [[3, 4], [7, 10], [9, 13], [13, 20]],
  },
};

const lesson = (id: string, title: string, mode: Mode, starterKey?: Key): Lesson =>
  starterKey === undefined ? { id, title, mode } : { id, title, mode, starterKey };

const sections: readonly Section[] = [
  {
    title: 'Find your way around the keyboard',
    lessons: [lesson('notes', 'Find a note by name', 'notes')],
  },
  {
    title: 'Intervals',
    lessons: [
      lesson('m2', 'Minor second', 'intervals'),
      lesson('M2', 'Major second', 'intervals'),
      lesson('m3', 'Minor third', 'intervals'),
      lesson('M3', 'Major third', 'intervals'),
      lesson('P4', 'Perfect fourth', 'intervals'),
      lesson('P5', 'Perfect fifth', 'intervals'),
    ],
  },
  {
    title: 'Chords - Triads',
    lessons: [
      lesson('major-triad', 'Major triad', 'chords'),
      lesson('minor-triad', 'Minor triad', 'chords'),
    ],
  },
  {
    title: 'Scales',
    lessons: [
      lesson('major', 'Major scale', 'scales', 'C'),
      lesson('natural-minor', 'Natural minor scale', 'scales', 'A'),
      lesson('harmonic-minor', 'Harmonic minor scale', 'scales', 'A'),
      lesson('melodic-minor', 'Ascending melodic minor', 'scales', 'A'),
    ],
  },
  {
    title: 'Suspended chords and inversions',
    lessons: [
      lesson('diminished', 'Diminished triad', 'chords'),
      lesson('sus2', 'Suspended second', 'chords'),
      lesson('sus4', 'Suspended fourth', 'chords'),
      lesson('inversion-1', 'First inversion', 'inversions'),
      lesson('inversion-2', 'Second inversion', 'inversions'),
    ],
  },
  {
    title: 'Extended intervals',
    lessons: [
      lesson('P8', 'Octave', 'intervals'),
      lesson('A4', 'Tritone', 'intervals'),
      lesson('m6', 'Minor sixth', 'intervals'),
      lesson('M6', 'Major sixth', 'intervals'),
      lesson('m7-interval', 'Minor seventh', 'intervals'),
      lesson('M7', 'Major seventh', 'intervals'),
    ],
  },
  {
    title: 'Seventh chords and cadences',
    lessons: [
      lesson('major-seventh', 'Major seventh chord', 'chords'),
      lesson('minor-seventh', 'Minor seventh chord', 'chords'),
      lesson('dominant-seventh', 'Dominant seventh chord', 'chords'),
      lesson('half-diminished', 'Half-diminished seventh chord', 'chords'),
      lesson('cadence', 'Connect a major two–five–one', 'cadence'),
      lesson('guides', 'Lead two voices through a cadence', 'guides'),
    ],
  },
  {
    title: 'Phrase over changing harmony',
    lessons: [
      lesson('dorian', 'Dorian over a minor seventh', 'scales', 'D'),
      lesson('mixolydian', 'Mixolydian over a dominant seventh', 'scales', 'G'),
      lesson('targets', 'Land a phrase on a guide tone', 'notes'),
    ],
  },
  {
    title: 'Voice an advanced jazz cadence',
    lessons: [
      lesson('shells', 'Comp with guide-tone shells', 'voicings'),
      lesson('rootless', 'Add ninths and thirteenths', 'voicings'),
      lesson('altered', 'Create tension on an altered dominant', 'voicings'),
    ],
  },
  {
    title: 'Apply harmony to a jazz progression',
    lessons: [
      lesson('minor-cadence', 'Resolve a minor two–five–one', 'cadence'),
      lesson('turnaround', 'Connect a one–six–two–five turnaround', 'cadence'),
      lesson('tritone-sub', 'Resolve a tritone substitute', 'cadence'),
    ],
  },
];

export const SECTIONS: readonly Section[] = sections;
export const LESSONS: readonly Lesson[] = sections.flatMap((section) => section.lessons);
export const LESSON_BY_ID: ReadonlyMap<string, Lesson> = new Map(LESSONS.map((entry) => [entry.id, entry]));

export const LESSON_RECIPES: Readonly<Record<string, LessonRecipe>> = {
  notes: { kind: 'notes' },
  m2: { kind: 'interval', interval: INTERVAL_RECIPES.m2 },
  M2: { kind: 'interval', interval: INTERVAL_RECIPES.M2 },
  m3: { kind: 'interval', interval: INTERVAL_RECIPES.m3 },
  M3: { kind: 'interval', interval: INTERVAL_RECIPES.M3 },
  P4: { kind: 'interval', interval: INTERVAL_RECIPES.P4 },
  P5: { kind: 'interval', interval: INTERVAL_RECIPES.P5 },
  'major-triad': { kind: 'chord', quality: 'major' },
  'minor-triad': { kind: 'chord', quality: 'minor' },
  major: { kind: 'scale', formula: 'major' },
  'natural-minor': { kind: 'scale', formula: 'minor' },
  'harmonic-minor': { kind: 'scale', formula: 'harmonic' },
  'melodic-minor': { kind: 'scale', formula: 'melodic' },
  diminished: { kind: 'chord', quality: 'diminished' },
  sus2: { kind: 'chord', quality: 'sus2' },
  sus4: { kind: 'chord', quality: 'sus4' },
  'inversion-1': { kind: 'inversion', inversion: 1 },
  'inversion-2': { kind: 'inversion', inversion: 2 },
  P8: { kind: 'interval', interval: INTERVAL_RECIPES.P8 },
  A4: { kind: 'interval', interval: INTERVAL_RECIPES.A4 },
  m6: { kind: 'interval', interval: INTERVAL_RECIPES.m6 },
  M6: { kind: 'interval', interval: INTERVAL_RECIPES.M6 },
  'm7-interval': { kind: 'interval', interval: INTERVAL_RECIPES['m7-interval'] },
  M7: { kind: 'interval', interval: INTERVAL_RECIPES.M7 },
  'major-seventh': { kind: 'chord', quality: 'maj7' },
  'minor-seventh': { kind: 'chord', quality: 'm7' },
  'dominant-seventh': { kind: 'chord', quality: 'dom7' },
  'half-diminished': { kind: 'chord', quality: 'halfdim' },
  cadence: { kind: 'progression', progression: 'major' },
  guides: { kind: 'progression', progression: 'major', guides: true },
  dorian: { kind: 'scale', formula: 'dorian' },
  mixolydian: { kind: 'scale', formula: 'mixolydian' },
  targets: { kind: 'targets', progression: 'major' },
  shells: { kind: 'voicings', voicings: ['dominant-shell', 'minor-shell'] },
  rootless: { kind: 'voicings', voicings: ['rootless-dominant-13', 'rootless-minor-9', 'rootless-major-9'] },
  altered: { kind: 'voicings', voicings: ['rootless-altered-dominant'] },
  'minor-cadence': { kind: 'progression', progression: 'minor-cadence' },
  turnaround: { kind: 'progression', progression: 'turnaround' },
  'tritone-sub': { kind: 'progression', progression: 'tritone-sub' },
};

/** Names retained as convenient aliases for consumers of the music layer. */
export const SCALE_RECIPES = SCALE_FORMULAS;
export const CHORDS = CHORD_RECIPES;
export const PROGRESSION_RECIPES = PROGRESSIONS;
export const VOICINGS = VOICING_RECIPES;
export const STANDALONE_MODES = MODES;

export const DIATONIC_TRIADS: readonly ChordQuality[] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
export const DIATONIC_SEVENTHS: readonly ChordQuality[] = ['maj7', 'm7', 'm7', 'maj7', 'dom7', 'm7', 'halfdim'];
export const ALL_CHORD_QUALITIES: readonly ChordQuality[] = ['major', 'minor', 'sus2', 'sus4', 'diminished', 'maj7', 'm7', 'dom7', 'halfdim'];

export const MAJOR_SCALE_OFFSETS = SCALE_FORMULAS.major;

