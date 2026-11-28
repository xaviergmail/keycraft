import {
  ALL_CHORD_QUALITIES,
  CHORD_RECIPES,
  DIATONIC_SEVENTHS,
  DIATONIC_TRIADS,
  INTERVAL_RECIPES,
  LESSON_BY_ID,
  LESSON_RECIPES,
  PROGRESSIONS,
  SCALE_FORMULAS,
  VOICING_RECIPES,
  type ChordQuality,
  type IntervalRecipe,
  type ProgressionId,
  type ScaleFormulaId,
  type VoicingRecipe,
} from './catalog.ts';
import {
  CANONICAL_KEYS,
  KEYS,
  pc,
  type Difficulty,
  type Key,
  type Mode,
  type Prompt,
  type Progress,
  type Stage,
  type Tone,
} from './domain.ts';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_PC: Readonly<Record<(typeof LETTERS)[number], number>> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};
const KEY_PC: Readonly<Record<Key, number>> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7,
  'G#': 8, A: 9, 'A#': 10, B: 11, Db: 1, Eb: 3, Gb: 6, Ab: 8, Bb: 10,
};

const INTERVAL_BY_SEMITONES: Readonly<Record<number, IntervalRecipe>> = Object.freeze(
  Object.values(INTERVAL_RECIPES).reduce<Record<number, IntervalRecipe>>((result, value) => {
    result[value.semitones] = value;
    return result;
  }, {}),
);

const FORMULA_LABELS: Readonly<Record<ScaleFormulaId, string>> = {
  major: 'major',
  minor: 'natural minor',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
  harmonic: 'harmonic minor',
  melodic: 'ascending melodic minor',
};

const INVERSION_NAMES = ['root position', 'first inversion', 'second inversion'] as const;
const INVERSION_DEGREES = ['root', 'third', 'fifth'] as const;

export function keyPitchClass(key: Key): number {
  return KEY_PC[key];
}

function letterAt(letter: string, degree: number): (typeof LETTERS)[number] {
  const index = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  if (index < 0) throw new Error(`Invalid note letter: ${letter}`);
  return LETTERS[((index + degree - 1) % LETTERS.length + LETTERS.length) % LETTERS.length];
}

function accidentalValue(name: string): number {
  let value = 0;
  for (const character of name.slice(1)) {
    if (character === '#') value += 1;
    else if (character === 'b') value -= 1;
  }
  return value;
}

function nearestAccidental(targetPc: number, naturalPc: number): string {
  const normalized = ((targetPc - naturalPc) % 12 + 12) % 12;
  // Choose the signed accidental with the fewest symbols. In the exact tritone tie,
  // the sharp spelling is deterministic and agrees with the catalog's sharp-first order.
  const signed = normalized === 6 ? 6 : normalized <= 5 ? normalized : normalized - 12;
  return signed > 0 ? '#'.repeat(signed) : 'b'.repeat(-signed);
}

/** Spell a degree from a tonic, preserving letter names before pitch classes. */
export function spellTone(tonic: string, degree: number, offset: number): Tone {
  const letter = letterAt(tonic[0], degree);
  const targetPc = pc(keyPitchClassFromName(tonic) + offset);
  const name = `${letter}${nearestAccidental(targetPc, NATURAL_PC[letter])}`;
  return { name, pc: targetPc, degree, offset };
}

/** Spell a degree/offset pair from an already-spelled chord root. */
export function relativeTone(root: Tone, degree: number, offset: number): Tone {
  const letter = letterAt(root.name[0], degree);
  const targetPc = pc(root.pc + offset);
  const name = `${letter}${nearestAccidental(targetPc, NATURAL_PC[letter])}`;
  return { name, pc: targetPc, degree, offset };
}

function keyPitchClassFromName(name: string): number {
  const key = KEYS.find((candidate) => candidate === name);
  if (key !== undefined) return KEY_PC[key];
  const letter = name[0] as (typeof LETTERS)[number];
  if (!(letter in NATURAL_PC)) throw new Error(`Invalid tonic: ${name}`);
  return pc(NATURAL_PC[letter] + accidentalValue(name));
}

export function majorScaleTones(key: Key): readonly Tone[] {
  return SCALE_FORMULAS.major.map((offset, index) => spellTone(key, index + 1, offset));
}

export function scaleTones(key: Key, formula: ScaleFormulaId): readonly Tone[] {
  return SCALE_FORMULAS[formula].map((offset, index) => spellTone(key, index + 1, offset));
}

function chordTones(root: Tone, quality: ChordQuality): readonly Tone[] {
  return CHORD_RECIPES[quality].tones.map(([degree, offset]) => relativeTone(root, degree, offset));
}

function chordLabel(root: Tone, quality: ChordQuality): string {
  return `${root.name}${CHORD_RECIPES[quality].suffix}`;
}

function qualityDescription(quality: ChordQuality): string {
  return CHORD_RECIPES[quality].name;
}

function scaleFormulaText(formula: ScaleFormulaId): string {
  return SCALE_FORMULAS[formula].join('–');
}

function spokenName(name: string): string {
  const letter = name[0] || '';
  const accidental = name.slice(1);
  let suffix = '';
  if (accidental === '#') suffix = ' sharp';
  else if (accidental === 'b') suffix = ' flat';
  else if (accidental === '##') suffix = ' double sharp';
  else if (accidental === 'bb') suffix = ' double flat';
  else if (accidental) suffix = ` ${accidental}`;
  // Kokoro's compatible voice vocabulary says “Eh” for the letter A. Browser
  // normalization can turn this into “A, …” without changing the cache key.
  return `${letter === 'A' ? 'Eh' : letter}${suffix}`;
}

function intervalSpeech(root: Tone, interval: IntervalRecipe): string {
  return `${spokenName(root.name)} ${interval.name}.`;
}

function stableItemId(lessonId: string | undefined, mode: Mode, key: Key, variant: string, center: Tone): string {
  return `${lessonId ?? 'standalone'}|${key}|${mode}|${variant}|${center.name}`;
}

function legacyItemId(prompt: Prompt): string | undefined {
  // Target lessons did not have a discriminator in the old tuple and therefore
  // must remain historical rather than being aliased to a possibly wrong item.
  if (!prompt.lessonId || prompt.lessonId === 'targets') return undefined;
  const stages = prompt.kind === 'stack'
    ? prompt.stages.map((stage) => [stage.tones.map((tone) => tone.pc), stage.bass ?? null])
    : null;
  const semitones = prompt.kind === 'interval' ? prompt.semitones : null;
  const targetPc = prompt.kind === 'interval' || prompt.kind === 'note' ? prompt.target.pc : null;
  const scaleOffsets = prompt.kind === 'scale' ? [...prompt.steps] : null;
  const identity: unknown[] = [prompt.lessonId, prompt.root.pc, semitones, targetPc, stages, scaleOffsets];
  if (!CANONICAL_KEYS.includes(prompt.key)) identity.push(prompt.key);
  return JSON.stringify(identity);
}

function finalize(prompt: Prompt): Prompt {
  const withId: Prompt = {
    ...prompt,
    itemId: stableItemId(prompt.lessonId, prompt.mode, prompt.key, prompt.variant, prompt.root),
  };
  const oldId = legacyItemId(withId);
  return oldId === undefined ? withId : { ...withId, legacyItemId: oldId };
}

function base(
  mode: Mode,
  key: Key,
  root: Tone,
  title: string,
  instruction: string,
  theory: string,
  speech: string,
  variant: string,
  lessonId: string | undefined,
): Omit<Prompt, 'kind' | 'target' | 'semitones' | 'tones' | 'steps' | 'stages'> {
  return {
    mode, key, root, title, instruction, theory, speech, variant,
    ...(lessonId === undefined ? {} : { lessonId }),
  } as Omit<Prompt, 'kind' | 'target' | 'semitones' | 'tones' | 'steps' | 'stages'>;
}

function notePrompt(key: Key, target: Tone, mode: Mode, variant: string, lessonId?: string): Prompt {
  return finalize({
    ...base(
      mode,
      key,
      target,
      `Play ${target.name}`,
      `Find ${target.name} in any octave.`,
      `Pitch classes repeat every octave. ${target.name} is the requested named note.`,
      `Play ${spokenName(target.name)}.`,
      variant,
      lessonId,
    ),
    kind: 'note',
    target,
  });
}

function intervalPrompt(
  key: Key,
  root: Tone,
  interval: IntervalRecipe,
  mode: Mode,
  variant: string,
  lessonId?: string,
): Prompt {
  const target = relativeTone(root, interval.degree, interval.semitones);
  return finalize({
    ...base(
      mode,
      key,
      root,
      `${root.name} + ${interval.symbol}`,
      `Play the ${interval.name} above ${root.name}. Hold the two notes together, or play the root and then the upper note.`,
      `A ${interval.name} spans ${interval.semitones} semitone${interval.semitones === 1 ? '' : 's'}; spell it as degree ${interval.degree} from ${root.name}.`,
      intervalSpeech(root, interval),
      variant,
      lessonId,
    ),
    kind: 'interval',
    target,
    semitones: interval.semitones,
  });
}

function scalePrompt(
  key: Key,
  formula: ScaleFormulaId,
  mode: Mode,
  variant: string,
  lessonId?: string,
): Prompt {
  const tones = scaleTones(key, formula);
  const root = tones[0];
  const label = FORMULA_LABELS[formula];
  return finalize({
    ...base(
      mode,
      key,
      root,
      `${root.name} ${label} scale`,
      `Play one ascending octave of the ${label} scale, starting on ${root.name}.`,
      `${label[0].toUpperCase()}${label.slice(1)} uses the offsets ${scaleFormulaText(formula)}.`,
      `${spokenName(root.name)} ${label} scale.`,
      variant,
      lessonId,
    ),
    kind: 'scale',
    tones,
    steps: SCALE_FORMULAS[formula],
  });
}

function inversionName(inversion: number): string {
  return INVERSION_NAMES[inversion] ?? `${inversion}th inversion`;
}

function inversionPrompt(
  key: Key,
  root: Tone,
  quality: ChordQuality,
  inversion: number,
  mode: Mode,
  variant: string,
  lessonId?: string,
): Prompt {
  const tones = chordTones(root, quality);
  const bass = tones[inversion];
  const name = inversionName(inversion);
  const degree = INVERSION_DEGREES[inversion] ?? 'requested tone';
  const label = chordLabel(root, quality);
  const stage: Stage = {
    label,
    tones,
    bass: bass.pc,
    speech: `Play the ${name} of ${label}.`,
  };
  return finalize({
    ...base(
      mode,
      key,
      root,
      `${root.name} ${qualityDescription(quality)}, ${name}`,
      `Play the ${qualityDescription(quality)} with its ${degree} as the lowest note.`,
      `${label} has the same tones in every inversion; only the lowest absolute note changes.`,
      `${spokenName(root.name)} ${qualityDescription(quality)}, ${name}.`,
      variant,
      lessonId,
    ),
    kind: 'stack',
    stages: [stage],
  });
}

function chordPrompt(
  key: Key,
  root: Tone,
  quality: ChordQuality,
  mode: Mode,
  variant: string,
  lessonId?: string,
): Prompt {
  const label = chordLabel(root, quality);
  const stage: Stage = {
    label,
    tones: chordTones(root, quality),
    speech: `Play the ${label} chord.`,
  };
  return finalize({
    ...base(
      mode,
      key,
      root,
      `${root.name} ${qualityDescription(quality)}`,
      `Play all ${stage.tones.length} notes of this ${qualityDescription(quality)} together.`,
      `${label} is built from ${CHORD_RECIPES[quality].tones.map(([degree, offset]) => `${degree}:${offset}`).join(' · ')}.`,
      `${spokenName(root.name)} ${qualityDescription(quality)}.`,
      variant,
      lessonId,
    ),
    kind: 'stack',
    stages: [stage],
  });
}

function progressionStages(key: Key, progression: ProgressionId, guides: boolean): readonly Stage[] {
  return PROGRESSIONS[progression].map(({ degree, offset, quality }) => {
    const root = spellTone(key, degree, offset);
    const fullTones = chordTones(root, quality);
    const tones = guides ? fullTones.filter((tone) => tone.degree === 3 || tone.degree === 7) : fullTones;
    const label = chordLabel(root, quality);
    return {
      label,
      tones,
      speech: guides ? `Play the third and seventh of ${label}.` : `Play the ${label} chord.`,
    };
  });
}

function progressionPrompt(
  key: Key,
  progression: ProgressionId,
  guides: boolean,
  mode: Mode,
  variant: string,
  lessonId?: string,
): Prompt {
  const stages = progressionStages(key, progression, guides);
  const root = spellTone(key, PROGRESSIONS[progression][0].degree, PROGRESSIONS[progression][0].offset);
  const firstName = guides ? 'guide tones' : 'chords';
  const line = stages.map((stage) => stage.label).join(' → ');
  return finalize({
    ...base(
      mode,
      key,
      root,
      `${line} progression`,
      guides
        ? 'Play the third and seventh of each chord in order, retaining common tones when possible.'
        : 'Play each chord in order. Release prior extras before accepting the next stage.',
      `${progression === 'major' ? 'Major ii–V–I' : progression} uses ${line}.`,
      stages[0]?.speech ?? `Play the ${firstName} in order.`,
      variant,
      lessonId,
    ),
    kind: 'stack',
    stages,
  });
}

function voicingPrompt(
  key: Key,
  recipe: VoicingRecipe,
  mode: Mode,
  variant: string,
  lessonId?: string,
): Prompt {
  const root = majorScaleTones(key)[recipe.rootDegree - 1];
  const tones = recipe.tones.map(([degree, offset]) => relativeTone(root, degree, offset));
  const label = `${root.name}${recipe.label}`;
  const stage: Stage = {
    label,
    tones,
    speech: `Play the ${recipe.name} voicing for ${spokenName(root.name)}.`,
  };
  return finalize({
    ...base(
      mode,
      key,
      root,
      `${root.name} ${recipe.name}`,
      `Play the ${recipe.name}; omit the root and play the indicated colors.`,
      `${recipe.name} uses ${recipe.tones.map(([degree, offset]) => `${degree}:${offset}`).join(' · ')} above the root.`,
      stage.speech,
      variant,
      lessonId,
    ),
    kind: 'stack',
    stages: [stage],
  });
}

function targetPrompt(
  key: Key,
  stage: Stage,
  stageRoot: Tone,
  targetIndex: number,
  lessonId: string,
  variant: string,
): Prompt {
  const target = stage.tones[targetIndex];
  const targetName = target.degree === 3 ? 'third' : target.degree === 7 ? 'seventh' : `degree ${target.degree}`;
  return finalize({
    ...base(
      'notes',
      key,
      stageRoot,
      `${stage.label}: land on its ${targetName}`,
      `Imagine a phrase over ${stage.label}. Land on its ${targetName}; the target pitch alone is assessed.`,
      `Guide tones are the third and seventh of a chord. Hear the requested degree as the destination.`,
      `Land on the ${targetName} of ${stage.label}.`,
      variant,
      lessonId,
    ),
    kind: 'note',
    target,
  });
}


function makeLessonPrompts(lessonId: string, key: Key): readonly Prompt[] {
  const lesson = LESSON_BY_ID.get(lessonId);
  const recipe = LESSON_RECIPES[lessonId];
  if (!lesson || !recipe) return [];
  switch (recipe.kind) {
    case 'notes': {
      const tonic = spellTone(key, 1, 0);
      return [notePrompt(key, tonic, lesson.mode, 'tonic', lessonId)];
    }
    case 'interval': {
      const root = spellTone(key, 1, 0);
      return [intervalPrompt(key, root, recipe.interval, lesson.mode, recipe.interval.symbol, lessonId)];
    }
    case 'scale':
      return [scalePrompt(key, recipe.formula, lesson.mode, recipe.formula, lessonId)];
    case 'chord': {
      const root = spellTone(key, 1, 0);
      return [chordPrompt(key, root, recipe.quality, lesson.mode, recipe.quality, lessonId)];
    }
    case 'inversion': {
      const root = spellTone(key, 1, 0);
      return (['major', 'minor', 'diminished'] as const).map((quality) =>
        inversionPrompt(key, root, quality, recipe.inversion, lesson.mode, `${quality}-inversion-${recipe.inversion}`, lessonId));
    }
    case 'progression':
      return [progressionPrompt(key, recipe.progression, recipe.guides === true, lesson.mode, recipe.progression, lessonId)];
    case 'targets': {
      const stages = progressionStages(key, recipe.progression, false);
      const prompts: Prompt[] = [];
      for (const [stageIndex, stage] of stages.entries()) {
        const stageRecipe = PROGRESSIONS[recipe.progression][stageIndex];
        const stageRoot = spellTone(key, stageRecipe.degree, stageRecipe.offset);
        for (const targetIndex of [1, 3]) {
          if (targetIndex >= stage.tones.length) continue;
          const target = stage.tones[targetIndex];
          const targetName = target.degree === 3 ? 'third' : 'seventh';
          prompts.push(targetPrompt(key, stage, stageRoot, targetIndex, lessonId, `${stageIndex}-${targetName}`));
        }
      }
      return prompts;
    }
    case 'voicings':
      return recipe.voicings.map((id) => voicingPrompt(key, VOICING_RECIPES[id], lesson.mode, id, lessonId));
  }
}

const lessonPromptCache = new Map<string, readonly Prompt[]>();

export function lessonPrompts(lessonId: string, key: Key): readonly Prompt[] {
  const cacheKey = `${lessonId}|${key}`;
  const cached = lessonPromptCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const prompts = makeLessonPrompts(lessonId, key);
  lessonPromptCache.set(cacheKey, prompts);
  return prompts;
}

function difficultyScales(difficulty: Difficulty): readonly ScaleFormulaId[] {
  if (difficulty === 'foundation') return ['major'];
  if (difficulty === 'intermediate') return ['major', 'minor', 'dorian', 'mixolydian'];
  return ['major', 'minor', 'dorian', 'mixolydian', 'harmonic', 'melodic'];
}

function difficultyIntervals(difficulty: Difficulty): readonly number[] {
  if (difficulty === 'foundation') return [2, 3, 4, 5, 7];
  if (difficulty === 'intermediate') return Array.from({ length: 10 }, (_, index) => index + 1);
  return Array.from({ length: 12 }, (_, index) => index + 1);
}

function difficultyVoicings(difficulty: Difficulty): readonly string[] {
  if (difficulty === 'foundation') return ['dominant-shell', 'minor-shell'];
  if (difficulty === 'intermediate') return ['rootless-dominant-13', 'rootless-minor-9', 'rootless-major-9'];
  return ['rootless-dominant-13', 'rootless-minor-9', 'rootless-major-9', 'rootless-altered-dominant'];
}


export function standalonePrompts(mode: Mode, key: Key, difficulty: Difficulty): readonly Prompt[] {
  const major = majorScaleTones(key);
  switch (mode) {
    case 'notes':
      return major.slice(0, 7).map((tone, index) => notePrompt(key, tone, mode, `degree-${index + 1}`));
    case 'intervals': {
      const prompts: Prompt[] = [];
      for (const [rootIndex, root] of major.slice(0, 7).entries()) {
        for (const semitones of difficultyIntervals(difficulty)) {
          const interval = INTERVAL_BY_SEMITONES[semitones];
          if (!interval) continue;
          prompts.push(intervalPrompt(key, root, interval, mode, `degree-${rootIndex + 1}-${interval.symbol}`));
        }
      }
      return prompts;
    }
    case 'scales':
      return difficultyScales(difficulty).map((formula) => scalePrompt(key, formula, mode, formula));
    case 'chords': {
      const qualities = difficulty === 'foundation' ? DIATONIC_TRIADS : DIATONIC_SEVENTHS;
      return major.slice(0, 7).map((root, index) => chordPrompt(key, root, qualities[index], mode, `degree-${index + 1}-${qualities[index]}`));
    }
    case 'inversions':
      return major.slice(0, 7).flatMap((root, index) =>
        [0, 1, 2].map((inversion) => inversionPrompt(
          key,
          root,
          DIATONIC_TRIADS[index],
          inversion,
          mode,
          `degree-${index + 1}-${DIATONIC_TRIADS[index]}-${inversion}`,
        )),
      );
    case 'guides':
      return [progressionPrompt(key, 'major', true, mode, 'major-guides')];
    case 'voicings':
      return difficultyVoicings(difficulty).map((id) => voicingPrompt(key, VOICING_RECIPES[id], mode, id));
    case 'cadence':
      return [progressionPrompt(key, 'major', false, mode, 'major-cadence')];
  }
}

function targetSignature(prompt: Prompt): string {
  switch (prompt.kind) {
    case 'note':
    case 'interval':
      return `${prompt.kind}:${prompt.target.pc}`;
    case 'scale':
      return `scale:${prompt.tones.map((tone) => tone.pc).join(',')}`;
    case 'stack':
      return `stack:${prompt.stages.map((stage) => `${stage.tones.map((tone) => tone.pc).join(',')}/${stage.bass ?? ''}`).join('|')}`;
  }
}

function normalizedRandom(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 0.999999999999 : value;
}

/** Choose an option while avoiding the previous root/target and preferring low exposure. */
export function choosePrompt(
  options: readonly Prompt[],
  random: () => number,
  previous?: Prompt,
  exposure?: (prompt: Prompt) => number,
): Prompt {
  if (options.length === 0) throw new Error('Cannot choose from an empty prompt bank');
  let candidates = [...options];
  if (previous !== undefined) {
    const distinctRootAndTarget = candidates.filter((prompt) =>
      prompt.root.pc !== previous.root.pc && targetSignature(prompt) !== targetSignature(previous));
    if (distinctRootAndTarget.length > 0) candidates = distinctRootAndTarget;
    else {
      const distinctRoot = candidates.filter((prompt) => prompt.root.pc !== previous.root.pc);
      if (distinctRoot.length > 0) candidates = distinctRoot;
      else {
        const distinctTarget = candidates.filter((prompt) => targetSignature(prompt) !== targetSignature(previous));
        if (distinctTarget.length > 0) candidates = distinctTarget;
      }
    }
  }
  if (exposure !== undefined && candidates.length > 1) {
    const values = candidates.map((prompt) => {
      const value = exposure(prompt);
      return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
    });
    const minimum = Math.min(...values);
    const leastExposed = candidates.filter((_, index) => values[index] === minimum);
    if (leastExposed.length > 0) candidates = leastExposed;
  }
  return candidates[Math.floor(normalizedRandom(random) * candidates.length)] ?? candidates[0];
}

/** Weighted canonical-key selection for automatic standalone focus. */
export function chooseStandaloneKey(
  _mode: Mode,
  _difficulty: Difficulty,
  stats: Progress['keyStats'],
  random: () => number,
  previous?: Prompt,
): Key {
  let keys = [...CANONICAL_KEYS];
  if (previous !== undefined && keys.length > 1) {
    const withoutPrevious = keys.filter((key) => key !== previous.key);
    if (withoutPrevious.length > 0) keys = withoutPrevious;
  }
  const weights = keys.map((key) => {
    const totals = stats?.[key];
    const attempts = Math.max(0, totals?.attempts ?? 0);
    const correct = Math.min(attempts, Math.max(0, totals?.correct ?? 0));
    const errorRate = attempts > 0 ? (attempts - correct) / attempts : 0.4;
    return 1 + 5 / (1 + attempts) + 4 * errorRate;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let needle = normalizedRandom(random) * total;
  for (let index = 0; index < keys.length; index += 1) {
    needle -= weights[index];
    if (needle < 0) return keys[index];
  }
  return keys[keys.length - 1];
}

function chooseOne<T>(values: readonly T[], random: () => number): T {
  if (values.length === 0) throw new Error('Cannot choose from an empty list');
  return values[Math.floor(normalizedRandom(random) * values.length)] ?? values[0];
}

function admittedLessonIds(admitted: readonly string[]): readonly string[] {
  return [...new Set(admitted.filter((id) => LESSON_BY_ID.has(id)))];
}

function previewFromAdmitted(exerciseNumber: number, admitted: readonly string[], random: () => number): Prompt {
  const ids = admittedLessonIds(admitted);
  const preferred = exerciseNumber % 2 === 0
    ? ids.filter((id) => LESSON_BY_ID.get(id)?.mode === 'scales')
    : ids.filter((id) => ['chords', 'inversions', 'guides', 'voicings', 'cadence'].includes(LESSON_BY_ID.get(id)?.mode ?? ''));
  const candidates = preferred.length > 0 ? preferred : ids;
  if (candidates.length === 0) {
    // A fresh guided path has only the named-note exercise available.
    return lessonPrompts('notes', 'C')[0];
  }
  const lessonId = chooseOne(candidates, random);
  const key = chooseOne(CANONICAL_KEYS, random);
  const options = lessonPrompts(lessonId, key);
  return choosePrompt(options.length > 0 ? options : lessonPrompts('notes', key), random);
}

/** Generate a playable, unscored continuation example. */
export function previewPrompt(
  exerciseNumber: number,
  admitted: readonly string[] | undefined,
  random: () => number,
): Prompt {
  if (admitted !== undefined) return previewFromAdmitted(exerciseNumber, admitted, random);
  const key = chooseOne(CANONICAL_KEYS, random);
  if (exerciseNumber % 2 === 0) {
    const formula = chooseOne(Object.keys(SCALE_FORMULAS) as ScaleFormulaId[], random);
    return scalePrompt(key, formula, 'scales', `preview-${formula}`);
  }
  const quality = chooseOne(ALL_CHORD_QUALITIES, random);
  return chordPrompt(key, spellTone(key, 1, 0), quality, 'chords', `preview-${quality}`);
}

export function previewSpeech(prompt: Prompt): string {
  return prompt.speech;
}

/**
 * Enumerate every reachable spoken prompt from the same candidate banks used by
 * lesson, standalone, and continuation generation. The Set makes aliases and
 * repeated stage wording harmless to callers warming a voice cache.
 */
export function* voiceCatalog(): Iterable<string> {
  const seen = new Set<string>();
  const add = (text: string): void => {
    if (text && !seen.has(text)) seen.add(text);
  };
  for (const key of KEYS) {
    for (const lesson of LESSON_BY_ID.values()) {
      for (const prompt of lessonPrompts(lesson.id, key)) {
        add(prompt.speech);
        add(previewSpeech(prompt));
        if (prompt.kind === 'stack') for (const stage of prompt.stages) add(stage.speech);
      }
    }
    for (const mode of Object.keys({ notes: 1, intervals: 1, scales: 1, chords: 1, inversions: 1, guides: 1, voicings: 1, cadence: 1 }) as Mode[]) {
      for (const difficulty of ['foundation', 'intermediate', 'jazz'] as const) {
        for (const prompt of standalonePrompts(mode, key, difficulty)) {
          add(prompt.speech);
          add(previewSpeech(prompt));
          if (prompt.kind === 'stack') for (const stage of prompt.stages) add(stage.speech);
        }
      }
    }
  }

  for (const key of CANONICAL_KEYS) {
    for (const formula of Object.keys(SCALE_FORMULAS) as ScaleFormulaId[]) {
      const prompt = scalePrompt(key, formula, 'scales', `preview-${formula}`);
      add(previewSpeech(prompt));
    }
    for (const quality of ALL_CHORD_QUALITIES) {
      const prompt = chordPrompt(key, spellTone(key, 1, 0), quality, 'chords', `preview-${quality}`);
      add(previewSpeech(prompt));
    }
  }

  yield* seen;
}

export { FORMULA_LABELS, INTERVAL_BY_SEMITONES, spokenName };
