import test from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_KEYS, type Course, type Progress, type RunScore } from '../src/domain.ts';
import { chartSeries, awardBadges, challengeAttack, challengeClear, claimDaily, finishExercise, levelFor, refreshDaily } from '../src/results.ts';

function emptyCourse(): Course {
  return { version: 3, concepts: {}, items: {}, admitted: ['notes'], offerAfter: 0, guidedExplained: [] };
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
    curriculum: { courseV3: emptyCourse() },
    daily: { date: '', rounds: 0, notes: 0, jazz: 0, claimed: false },
  };
}

function score(overrides: Partial<RunScore> = {}): RunScore {
  return { points: 100, xp: 40, clears: 8, errors: 2, skips: 0, combo: 0, bestCombo: 5, responseSamples: [800, 1_200], ...overrides };
}

test('finishExercise snapshots all lesson scores and keeps the latest ten rows', () => {
  const current = progress();
  current.curriculum.courseV3.concepts.notes = { points: 42, recent: [], mastery: [], attempts: 0, firstTry: 0, halfLife: 1, solidified: 0, timings: [], latencySlope: 1.75, rootTraces: {} };
  const first = finishExercise(current, 'guided:notes', 'Practice', 10, score(), new Set(['notes']));
  assert.equal(first.number, 1);
  assert.equal(first.accuracy, 80);
  assert.equal(first.responseAverageMs, 1_000);
  assert.equal(first.responseCount, 2);
  assert.equal(current.exerciseHistory[0].curriculumScores?.notes, 42);
  assert.equal(Object.keys(current.exerciseHistory[0].curriculumScores ?? {}).length, 39);
  for (let index = 0; index < 10; index += 1) finishExercise(current, `scope-${index}`, `Run ${index}`, 1, score({ responseSamples: [] }), new Set());
  assert.equal(current.exerciseHistory.length, 10);
  assert.deepEqual(current.exerciseHistory.map((row) => row.number), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('chart series uses the latest tested groups and omits snapshots without scores', () => {
  const history = [
    { number: 1, label: 'old legacy', accuracy: 50, testedSkills: ['sus4'] },
    { number: 2, label: 'first', accuracy: 80, curriculumScores: { sus4: 20, guides: 40 } },
    { number: 3, label: 'latest', accuracy: 90, curriculumScores: { sus4: 30, guides: 60 }, testedSkills: ['sus4', 'guides'] },
  ];
  const series = chartSeries(history);
  assert.deepEqual(series.map((entry) => entry.label), ['Suspended chords', 'Cadence']);
  assert.deepEqual(series[0].points, [{ number: 2, value: 10 }, { number: 3, value: 15 }]);
  assert.deepEqual(series[1].points, [{ number: 2, value: 20 }, { number: 3, value: 30 }]);
  assert.deepEqual(chartSeries([{ number: 1, label: 'standalone', accuracy: 100, curriculumScores: {} }]), []);
});

test('levels, badges, date rollover, and daily claim are idempotent', () => {
  assert.deepEqual(levelFor(1_000), { level: 3, progress: 0, rank: 'Foundation Builder' });
  const current = progress();
  current.correct = 100;
  current.bestStreak = 8;
  current.modeStats = { scales: { attempts: 10, correct: 10 }, guides: { attempts: 5, correct: 5 }, voicings: { attempts: 5, correct: 5 } };
  current.keyStats = Object.fromEntries(CANONICAL_KEYS.map((key) => [key, { attempts: 1, correct: 1 }]));
  assert.equal(awardBadges(current), true);
  assert.equal(current.xp, 600);
  assert.equal(awardBadges(current), false);
  assert.equal(current.xp, 600);

  const now = Date.UTC(2025, 0, 15, 12);
  assert.equal(refreshDaily(current, now), true);
  for (let index = 0; index < 30; index += 1) challengeAttack(current, now);
  for (let index = 0; index < 6; index += 1) challengeClear(current, 'notes', now);
  challengeClear(current, 'guides', now);
  challengeClear(current, 'cadence', now);
  assert.equal(claimDaily(current, now), true);
  assert.equal(current.xp, 800);
  assert.equal(claimDaily(current, now), false);
  assert.equal(refreshDaily(current, now + 3 * 86_400_000), true);
  assert.deepEqual(current.daily, { date: current.daily.date, rounds: 0, notes: 0, jazz: 0, claimed: false });
});
