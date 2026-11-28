import test from 'node:test';
import assert from 'node:assert/strict';
import { Answer } from '../src/evaluate.ts';
import type { Prompt, Stage, Tone } from '../src/domain.ts';

function tone(name: string, pitchClass: number, degree = 1, offset = 0): Tone {
  return { name, pc: pitchClass, degree, offset };
}

function base(mode: Prompt['mode'], root = tone('C', 0)): Omit<Prompt, 'kind'> {
  return {
    mode,
    key: 'C',
    root,
    title: 'fixture',
    instruction: 'fixture',
    theory: 'fixture',
    speech: 'fixture',
    variant: 'fixture',
  };
}

function stackPrompt(stages: readonly Stage[]): Prompt {
  return { ...base('chords'), kind: 'stack', stages };
}

test('interval upper-first accepts the inclusive 100 ms boundary and expires later', () => {
  const prompt: Prompt = {
    ...base('intervals'),
    kind: 'interval',
    target: tone('E', 4, 3, 4),
    semitones: 4,
  };
  const answer = new Answer(prompt);
  assert.equal(answer.attack(64, 0)?.kind, 'progress');
  assert.equal(answer.pendingUntil, 100);
  assert.equal(answer.attack(60, 100)?.kind, 'clear');

  const late = new Answer(prompt);
  late.attack(64, 0);
  assert.equal(late.expire(101)?.kind, 'miss');
  assert.equal(late.pendingUntil, undefined);
});

test('octave accepts an upper anchor followed by its lower root', () => {
  const prompt: Prompt = {
    ...base('intervals', tone('D', 2)),
    kind: 'interval',
    target: tone('D', 2, 8, 12),
    semitones: 12,
  };
  const answer = new Answer(prompt);
  assert.equal(answer.attack(74, 0)?.kind, 'progress');
  assert.equal(answer.attack(62, 5)?.kind, 'clear');
});

test('replaying a released interval root is not a mistake', () => {
  const answer = new Answer({
    ...base('intervals', tone('C', 0)),
    kind: 'interval',
    target: tone('E', 4, 3, 4),
    semitones: 4,
  });
  const root = answer.attack(60, 0);
  assert.equal(root?.kind, 'progress');
  assert.match(root!.message, /4 semitones/);
  assert.doesNotMatch(root!.message, /\bE\b/);
  answer.release(60);
  assert.equal(answer.attack(60, 5)?.kind, undefined);
  assert.equal(answer.attack(64, 9)?.kind, 'clear');
});

test('scale resets only its own sequence on a wrong absolute octave', () => {
  const root = tone('D', 2);
  const names = ['D', 'E', 'F', 'G', 'A', 'Bb', 'C', 'D'];
  const offsets = [0, 2, 3, 5, 7, 8, 10, 12];
  const prompt: Prompt = {
    ...base('scales', root),
    kind: 'scale',
    tones: names.map((name, index) => tone(name, (2 + offsets[index]) % 12, index + 1, offsets[index])),
    steps: offsets,
  };
  const answer = new Answer(prompt);
  assert.equal(answer.attack(62, 0)?.kind, 'progress');
  assert.equal(answer.attack(64, 1)?.kind, 'progress');
  assert.equal(answer.attack(76, 2)?.kind, 'miss');
  assert.equal(answer.step, 0);
});

test('stack wrong bass is deduplicated and an extra can be released for recovery', () => {
  const stages: Stage[] = [{
    label: 'C major',
    tones: [tone('C', 0), tone('E', 4), tone('G', 7)],
    bass: 4,
    speech: 'fixture',
  }];
  const answer = new Answer(stackPrompt(stages));
  assert.equal(answer.attack(60, 0)?.kind, 'progress');
  assert.equal(answer.attack(55, 1)?.kind, 'progress');
  assert.equal(answer.attack(64, 2)?.kind, 'miss');
  assert.equal(answer.attack(64, 3), undefined);

  const recoveryStages: Stage[] = [{
    label: 'C major',
    tones: [tone('C', 0), tone('E', 4), tone('G', 7)],
    speech: 'fixture',
  }];
  const recovery = new Answer(stackPrompt(recoveryStages));
  assert.equal(recovery.attack(60, 0)?.kind, 'progress');
  assert.equal(recovery.attack(59, 1)?.kind, 'miss');
  assert.equal(recovery.attack(64, 2)?.kind, 'progress');
  assert.equal(recovery.attack(55, 3)?.kind, 'progress');
  assert.equal(recovery.release(59)?.kind, 'clear');
});

test('multi-stage guide retains common members without charging the transition', () => {
  const prompt = stackPrompt([
    { label: 'Dm7 guide', tones: [tone('C', 0), tone('F', 5)], speech: 'fixture' },
    { label: 'G7 guide', tones: [tone('F', 5), tone('B', 11)], speech: 'fixture' },
    { label: 'Cmaj7 guide', tones: [tone('E', 4), tone('B', 11)], speech: 'fixture' },
  ]);
  const answer = new Answer(prompt);
  assert.equal(answer.attack(60, 0)?.kind, 'progress');
  assert.equal(answer.attack(65, 1)?.kind, 'stage');
  answer.release(60);
  assert.equal(answer.attack(59, 2)?.kind, 'stage');
  answer.release(65);
  assert.equal(answer.attack(64, 3)?.kind, 'clear');
});


test('G-sharp major scale uses absolute offsets through the high tonic', () => {
  const offsets = [0, 2, 4, 5, 7, 9, 11, 12];
  const names = ['G#', 'A#', 'B#', 'C#', 'D#', 'E#', 'F##', 'G#'];
  const root = tone('G#', 8);
  const prompt: Prompt = {
    ...base('scales', root),
    key: 'G#',
    kind: 'scale',
    tones: names.map((name, index) => tone(name, (8 + offsets[index]) % 12, index + 1, offsets[index])),
    steps: offsets,
  };
  const answer = new Answer(prompt);
  for (const [index, note] of [68, 70, 72, 73, 75, 77, 79, 80].entries()) {
    const verdict = answer.attack(note, index);
    if (index < 7) assert.equal(verdict?.kind, 'progress');
    else assert.equal(verdict?.kind, 'clear');
  }
});

test('minor cadence and altered voicing reject a held extra until release', () => {
  const cadence = new Answer(stackPrompt([
    { label: 'Dm7b5', tones: [tone('D', 2), tone('F', 5), tone('Ab', 8), tone('C', 0)], speech: 'fixture' },
    { label: 'G7', tones: [tone('G', 7), tone('B', 11), tone('D', 2), tone('F', 5)], speech: 'fixture' },
    { label: 'Cm', tones: [tone('C', 0), tone('Eb', 3), tone('G', 7)], speech: 'fixture' },
  ]));
  const first = [62, 65, 68, 72];
  for (const note of first) cadence.attack(note, note);
  assert.equal(cadence.stageIndex, 1);
  for (const note of first) cadence.release(note);
  const second = [67, 71, 74, 77];
  for (const note of second) cadence.attack(note, note);
  assert.equal(cadence.stageIndex, 2);
  for (const note of second) cadence.release(note);
  cadence.attack(70, 0);
  cadence.attack(60, 1);
  cadence.attack(63, 2);
  cadence.attack(67, 3);
  assert.equal(cadence.release(70)?.kind, 'clear');

  const altered = new Answer(stackPrompt([{
    label: 'altered dominant',
    tones: [tone('B', 11), tone('F', 5), tone('Ab', 8), tone('Eb', 3)],
    speech: 'fixture',
  }]));
  altered.attack(59, 0);
  altered.attack(65, 1);
  assert.equal(altered.attack(55, 2)?.kind, 'miss');
  assert.equal(altered.attack(68, 3)?.kind, 'progress');
  assert.equal(altered.attack(75, 4)?.kind, 'progress');
  assert.equal(altered.release(55)?.kind, 'clear');
});
