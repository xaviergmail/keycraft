import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHORD_RECIPES,
  LESSONS,
  LESSON_BY_ID,
  PROGRESSIONS,
  SCALE_FORMULAS,
  SECTIONS,
  VOICING_RECIPES,
} from '../src/catalog.ts';
import {
  choosePrompt,
  chooseStandaloneKey,
  lessonPrompts,
  previewPrompt,
  previewSpeech,
  standalonePrompts,
  voiceCatalog,
} from '../src/prompts.ts';
import { KEYS } from '../src/domain.ts';
test('catalog keeps ten sections and the ordered 39-lesson path', () => {
  assert.equal(SECTIONS.length, 10);
  assert.equal(LESSONS.length, 39);
  assert.deepEqual(LESSONS.map((lesson) => lesson.id), [
    'notes', 'm2', 'M2', 'm3', 'M3', 'P4', 'P5', 'major-triad', 'minor-triad',
    'major', 'natural-minor', 'harmonic-minor', 'melodic-minor', 'diminished', 'sus2',
    'sus4', 'inversion-1', 'inversion-2', 'P8', 'A4', 'm6', 'M6', 'm7-interval', 'M7',
    'major-seventh', 'minor-seventh', 'dominant-seventh', 'half-diminished', 'cadence',
    'guides', 'dorian', 'mixolydian', 'targets', 'shells', 'rootless', 'altered',
    'minor-cadence', 'turnaround', 'tritone-sub',
  ]);
  assert.equal(LESSON_BY_ID.get('major')?.starterKey, 'C');
  assert.equal(LESSON_BY_ID.get('natural-minor')?.starterKey, 'A');
  assert.deepEqual(KEYS, ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Db', 'Eb', 'Gb', 'Ab', 'Bb']);
});

test('recipes preserve scale, chord, progression, and voicing contracts', () => {
  assert.deepEqual(SCALE_FORMULAS.major, [0, 2, 4, 5, 7, 9, 11, 12]);
  assert.deepEqual(SCALE_FORMULAS.minor, [0, 2, 3, 5, 7, 8, 10, 12]);
  assert.deepEqual(CHORD_RECIPES.halfdim.tones, [[1, 0], [3, 3], [5, 6], [7, 10]]);
  assert.deepEqual(PROGRESSIONS.major.map(({ degree, offset, quality }) => [degree, offset, quality]), [[2, 2, 'm7'], [5, 7, 'dom7'], [1, 0, 'maj7']]);
  assert.deepEqual(PROGRESSIONS['minor-cadence'].map(({ degree, offset, quality }) => [degree, offset, quality]), [[2, 2, 'halfdim'], [5, 7, 'dom7'], [1, 0, 'minor']]);
  assert.deepEqual(VOICING_RECIPES['rootless-altered-dominant'].tones, [[3, 4], [7, 10], [9, 13], [13, 20]]);
});

test('spells G-sharp major and D natural minor independently', () => {
  const major = lessonPrompts('major', 'G#')[0];
  assert.equal(major.kind, 'scale');
  if (major.kind !== 'scale') return;
  assert.deepEqual(major.tones.map((tone) => tone.name), ['G#', 'A#', 'B#', 'C#', 'D#', 'E#', 'F##', 'G#']);
  const minor = lessonPrompts('natural-minor', 'D')[0];
  assert.equal(minor.kind, 'scale');
  if (minor.kind !== 'scale') return;
  assert.deepEqual(minor.tones.map((tone) => tone.name), ['D', 'E', 'F', 'G', 'A', 'Bb', 'C', 'D']);
  assert.equal(minor.itemId?.includes('|D|scales|'), true);
  assert.notEqual(minor.itemId, lessonPrompts('natural-minor', 'Ab')[0].itemId);
});

test('item identities retain the legacy spelling discriminator only for noncanonical keys', () => {
  const sharp = lessonPrompts('natural-minor', 'G#')[0];
  const flat = lessonPrompts('natural-minor', 'Ab')[0];
  assert.notEqual(sharp.itemId, flat.itemId);
  assert.equal(sharp.legacyItemId, '["natural-minor",8,null,null,null,[0,2,3,5,7,8,10,12],"G#"]');
  assert.equal(flat.legacyItemId, '["natural-minor",8,null,null,null,[0,2,3,5,7,8,10,12]]');
});

test('generates target, inversion, guide, cadence, and altered variants', () => {
  const targets = lessonPrompts('targets', 'C');
  assert.equal(targets.length, 6);
  assert.ok(targets.every((prompt) => prompt.kind === 'note' && prompt.lessonId === 'targets' && !prompt.legacyItemId));
  const inversion = lessonPrompts('inversion-1', 'C');
  assert.equal(inversion.length, 3);
  assert.ok(inversion.every((prompt) => prompt.kind === 'stack' && prompt.stages[0].bass !== undefined));
  const guides = lessonPrompts('guides', 'C')[0];
  assert.equal(guides.kind, 'stack');
  if (guides.kind === 'stack') {
    assert.deepEqual(guides.stages.map((stage) => stage.label), ['Dm7', 'G7', 'Cmaj7']);
    assert.deepEqual(guides.stages[0].tones.map((tone) => tone.name), ['F', 'C']);
    assert.match(guides.stages[0].speech, /third and seventh/);
  }
  const minorCadence = lessonPrompts('minor-cadence', 'C')[0];
  assert.equal(minorCadence.kind, 'stack');
  if (minorCadence.kind === 'stack') assert.deepEqual(minorCadence.stages.map((stage) => stage.label), ['Dm7b5', 'G7', 'Cm']);
  const altered = lessonPrompts('altered', 'C')[0];
  assert.equal(altered.kind, 'stack');
  if (altered.kind === 'stack') assert.deepEqual(altered.stages[0].tones.map((tone) => tone.pc), [11, 5, 8, 3]);
});

test('standalone banks obey difficulty ranges', () => {
  assert.equal(standalonePrompts('notes', 'C', 'foundation').length, 7);
  assert.equal(standalonePrompts('intervals', 'C', 'foundation').length, 35);
  assert.equal(standalonePrompts('intervals', 'C', 'intermediate').length, 70);
  assert.equal(standalonePrompts('intervals', 'C', 'jazz').length, 84);
  assert.equal(standalonePrompts('scales', 'C', 'foundation').length, 1);
  assert.equal(standalonePrompts('scales', 'C', 'intermediate').length, 4);
  assert.equal(standalonePrompts('scales', 'C', 'jazz').length, 6);
  assert.equal(standalonePrompts('chords', 'C', 'foundation').length, 7);
  assert.equal(standalonePrompts('chords', 'C', 'intermediate').length, 7);
  assert.equal(standalonePrompts('inversions', 'C', 'foundation').length, 21);
  assert.equal(standalonePrompts('guides', 'C', 'jazz').length, 1);
  assert.equal(standalonePrompts('voicings', 'C', 'foundation').length, 2);
  assert.equal(standalonePrompts('voicings', 'C', 'intermediate').length, 3);
  assert.equal(standalonePrompts('voicings', 'C', 'jazz').length, 4);
  assert.equal(standalonePrompts('cadence', 'C', 'foundation').length, 1);
});

test('selection avoids immediate repeats and favors lower exposure', () => {
  const options = standalonePrompts('inversions', 'C', 'foundation');
  const first = options[0];
  const picked = choosePrompt(options, () => 0, first, (prompt) => prompt.variant.endsWith('-0') ? 10 : 0);
  assert.notEqual(picked.root.pc, first.root.pc);
  const key = chooseStandaloneKey('notes', 'foundation', { C: { attempts: 100, correct: 100 } }, () => 0.05);
  assert.equal(key, 'G');
});

test('continuations alternate scale and chord families and retain spoken text', () => {
  const scale = previewPrompt(2, undefined, () => 0);
  assert.equal(scale.kind, 'scale');
  const chord = previewPrompt(1, undefined, () => 0);
  assert.equal(chord.kind, 'stack');
  assert.equal(previewSpeech(chord), chord.speech);
  const noteOnly = previewPrompt(2, ['notes'], () => 0);
  assert.equal(noteOnly.lessonId, 'notes');
  assert.ok([...voiceCatalog()].includes('Eh flat minor third.'));
});

