import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankTrace,
  due,
  finishRound,
  present,
  recall,
  recordMistake,
  roundScore,
  runScore,
} from '../src/record.ts';
import type { Course, Key, Progress, Prompt, Tone } from '../src/domain.ts';

const keyPc: Record<Key, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
  Db: 1, Eb: 3, Gb: 6, Ab: 8, Bb: 10,
};

function tone(name: Key): Tone {
  return { name, pc: keyPc[name], degree: 1, offset: 0 };
}

function course(): Course {
  return { version: 3, concepts: {}, items: {}, admitted: [], offerAfter: 0, guidedExplained: [] };
}

function progress(): Progress {
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
    curriculum: { courseV3: course() },
    daily: { date: '2026-01-01', rounds: 0, notes: 0, jazz: 0, claimed: false },
  };
}

function prompt(key: Key = 'G#', itemId = `scale:${key}`): Prompt {
  const root = tone(key);
  return {
    kind: 'note',
    mode: 'notes',
    key,
    root,
    target: root,
    title: 'Find the note',
    instruction: 'Play it',
    theory: '',
    speech: '',
    variant: 'target',
    lessonId: 'natural-minor',
    itemId,
  };
}

test('records one unaided curriculum result at every scope', () => {
  const state = progress();
  const p = prompt();
  present(state, p, 1_000);
  const run = runScore();
  const round = roundScore();
  const awards = finishRound(state, p, run, round, {
    now: 1_600,
    cleared: true,
    arcade: false,
    assisted: false,
    manualHint: false,
    timing: { elapsed: 600, invalid: false, notes: [{ note: 68, at: 600 }] },
  });

  assert.equal(awards?.outcome, 'unaided-success');
  assert.equal(awards?.points, 40);
  assert.equal(awards?.xp, 22);
  assert.equal(run.clears, 1);
  assert.equal(state.curriculum.courseV3.concepts['natural-minor']?.points, 2);
  assert.equal(state.curriculum.courseV3.concepts['natural-minor']?.rootTraces['G#']?.points, 2);
  assert.deepEqual(state.curriculum.courseV3.concepts['natural-minor']?.mastery, ['unaided-success']);
  assert.equal(state.attempts, 1);
  assert.equal(state.correct, 1);
  assert.equal(state.responseTimes['notes:target:8']?.[0], 600);
});

test('keeps enharmonic keys, variants, and one miss penalty separate', () => {
  const state = progress();
  const first = prompt('G#', 'variant:g-sharp');
  const second = prompt('Ab', 'variant:a-flat');
  const run = runScore();
  const failed = roundScore();
  assert.equal(recordMistake(state, first, run, failed, 2_000), 160);
  assert.equal(recordMistake(state, first, run, failed, 2_001), 0);
  const recovered = finishRound(state, first, run, failed, {
    now: 2_002,
    cleared: true,
    arcade: false,
    assisted: false,
    manualHint: false,
  });
  present(state, second, 3_000);

  assert.equal(recovered?.recovered, true);
  assert.equal(run.points, -160);
  assert.equal(run.errors, 2);
  assert.equal(run.combo, 0);
  assert.deepEqual(state.curriculum.courseV3.concepts['natural-minor']?.mastery, ['miss']);
  assert.equal(state.curriculum.courseV3.concepts['natural-minor']?.rootTraces['G#']?.points, 0);
  assert.equal(state.curriculum.courseV3.concepts['natural-minor']?.rootTraces.Ab?.lastAsked, 3_000);
  assert.notEqual(state.curriculum.courseV3.items['variant:g-sharp'], state.curriculum.courseV3.items['variant:a-flat']);
  assert.equal(finishRound(state, first, run, failed, {
    now: 2_003,
    cleared: true,
    arcade: false,
    assisted: false,
    manualHint: false,
  }), undefined);
});

test('assistance earns run reward without curriculum recall or score', () => {
  const state = progress();
  const p = prompt('C');
  const run = runScore();
  const round = roundScore();
  const awards = finishRound(state, p, run, round, {
    now: 4_000,
    cleared: true,
    arcade: false,
    assisted: false,
    manualHint: true,
  });
  const trace = state.curriculum.courseV3.concepts['natural-minor'];

  assert.equal(awards?.outcome, 'assisted');
  assert.equal(awards?.points, 20);
  assert.equal(awards?.xp, 11);
  assert.equal(trace?.points, 0);
  assert.equal(trace?.lastAnswered, undefined);
  assert.deepEqual(trace?.mastery, ['assisted']);
});

test('recall uses half-life and due is false before first answer', () => {
  const trace = blankTrace();
  assert.equal(recall(trace, 2_700_000), 0);
  assert.equal(due(trace, 2_700_000), false);
  trace.lastAnswered = 1_000;
  assert.equal(recall(trace, 1_000 + trace.halfLife), 0.5);
  assert.equal(due(trace, 1_000 + trace.halfLife), true);
});

test('rejects hidden, non-monotonic, and outlier timing without rejecting the clear', () => {
  const state = progress();
  const p = prompt('D', 'timed-item');
  state.responseTimes['notes:target:2'] = [1_000, 1_000, 1_000, 1_000, 1_000];
  const run = runScore();
  const round = roundScore();
  const awards = finishRound(state, p, run, round, {
    now: 5_000,
    cleared: true,
    arcade: false,
    assisted: false,
    manualHint: false,
    timing: { elapsed: 4_500, invalid: false, notes: [{ note: 62, at: 2_000 }, { note: 64, at: 1_900 }] },
  });

  assert.equal(awards?.outcome, 'unaided-success');
  assert.equal(awards?.responseMs, undefined);
  assert.deepEqual(run.responseSamples, []);
  assert.equal(state.responseTimes['notes:target:2']?.length, 5);
});
