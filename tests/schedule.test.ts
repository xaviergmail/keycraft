import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../src/catalog.ts';
import { acceptAdmission, declineAdmission, lessonMastered, nextAdmission, rotation, selectGuided } from '../src/schedule.ts';
import { KEYS, type Course, type LessonTrace, type Trace } from '../src/domain.ts';

function trace(overrides: Partial<Trace> = {}): Trace {
  return {
    points: 0,
    recent: [],
    mastery: [],
    attempts: 0,
    firstTry: 0,
    halfLife: 45 * 60_000,
    solidified: 0,
    timings: [],
    latencySlope: 1.75,
    ...overrides,
  };
}

function masteredLesson(): LessonTrace {
  return {
    ...trace({
      points: 80,
      mastery: Array.from({ length: 20 }, (_, index) => index < 18 ? 'unaided-success' : 'miss'),
    }),
    rootTraces: Object.fromEntries(KEYS.map((key) => [key, trace({ mastery: ['unaided-success', 'unaided-success', 'unaided-success', 'unaided-success'] })])),
  };
}

function course(admitted: string[] = ['notes']): Course {
  return { version: 3, concepts: {}, items: {}, admitted, offerAfter: 0, guidedExplained: [] };
}

test('rotation interleaves lesson slots and offsets each lesson key', () => {
  assert.deepEqual(rotation(['major']), KEYS.map((key) => ({ lessonId: 'major', key })));
  const branch = rotation(['major', 'natural-minor']);
  assert.deepEqual(branch.slice(0, 4), [
    { lessonId: 'major', key: 'C' },
    { lessonId: 'natural-minor', key: 'C#' },
    { lessonId: 'major', key: 'C#' },
    { lessonId: 'natural-minor', key: 'D' },
  ]);
  assert.equal(branch.length, 34);
});

test('mastery requires score, twenty outcomes, and every spelled key streak', () => {
  const current = course();
  current.concepts.notes = masteredLesson();
  assert.equal(lessonMastered(current, 'notes'), true);
  current.concepts.notes.rootTraces['G#']!.mastery = ['unaided-success', 'unaided-success', 'unaided-success', 'miss'];
  assert.equal(lessonMastered(current, 'notes'), false);
});

test('guided focus starts at a starter key, then leaves a distinct due review slot', () => {
  const current = course(['notes', 'major']);
  current.concepts.notes = masteredLesson();
  current.concepts.major = {
    ...trace(),
    rootTraces: {},
  };
  const first = selectGuided(current, 1, 1_000);
  assert.deepEqual(first, { lessonId: 'major', key: 'C', role: 'focus' });
  current.concepts.major.rootTraces.D = trace({ lastAsked: 1, lastAnswered: 1, halfLife: 1 });
  current.concepts.major.rootTraces.E = trace({ lastAsked: 2, lastAnswered: 2, halfLife: 1 });
  const review = selectGuided(current, 3, 10_000);
  assert.equal(review.role, 'review');
  assert.deepEqual({ lessonId: review.lessonId, key: review.key }, { lessonId: 'major', key: 'D' });
});

test('admission gate rechecks mastery and preserves ten-minute decline cooldown', () => {
  const current = course(['notes']);
  current.concepts.notes = masteredLesson();
  assert.equal(nextAdmission(current, 10)?.id, 'm2');
  assert.equal(acceptAdmission(current, 'm2', 10), true);
  assert.deepEqual(current.focus, { lessonId: 'm2', key: 'C' });
  declineAdmission(current, 20);
  assert.equal(nextAdmission(current, 20), undefined);
  assert.equal(nextAdmission(current, 20 + 10 * 60_000), undefined);
  // m2 is not mastered, so the offer remains closed after the cooldown.
  assert.equal(nextAdmission(current, 20 + 10 * 60_000 + 1), undefined);
  assert.equal(LESSONS.length, 39);
});

test('a miss in an earlier admission blocks the next offer without removing the lesson', () => {
  const current = course(['notes', 'm2']);
  current.concepts.notes = masteredLesson();
  current.concepts.m2 = masteredLesson();
  assert.equal(nextAdmission(current, 10)?.id, 'M2');
  current.concepts.notes.rootTraces['G#']!.mastery.push('miss');
  assert.equal(nextAdmission(current, 11), undefined);
  assert.deepEqual(selectGuided(current, 1, 11), { lessonId: 'notes', key: 'G#', role: 'focus' });
  assert.deepEqual(current.admitted, ['notes', 'm2']);
});

test('a finished path continues reviewing without offering a nonexistent lesson', () => {
  const current = course(LESSONS.map(lesson => lesson.id));
  for (const id of current.admitted) current.concepts[id] = masteredLesson();
  const last = current.admitted.at(-1)!;
  current.concepts[last].rootTraces.C!.lastAsked = 1;
  assert.equal(nextAdmission(current, 10), undefined);
  assert.deepEqual(selectGuided(current, 1, 10), { lessonId: last, key: 'C', role: 'review' });
});
