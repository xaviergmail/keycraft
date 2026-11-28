import assert from 'node:assert/strict';
import test from 'node:test';
import { exampleKeys } from '../src/answer-display.ts';
import { KEYS } from '../src/domain.ts';
import { Game } from '../src/game.ts';
import { ensureKey, ensureLesson } from '../src/record.ts';
import { createProgress, migrateProgress } from '../src/storage.ts';

const WALL = Date.UTC(2025, 0, 15, 12);

function exercise(progress = createProgress(WALL)) {
  let elapsed = 0;
  const narration: (string | undefined)[] = [];
  const game = new Game(progress, {
    changed() {}, save() {}, clearVirtual() {}, speech: text => { narration.push(text); },
  }, { wall: () => WALL + elapsed, mono: () => elapsed }, () => 0);
  const advance = (ms: number) => { elapsed += ms; game.tick(); };
  const tap = (note: number) => {
    game.input({ kind: 'attack', note });
    game.input({ kind: 'release', note });
  };
  return { game, progress, narration, advance, tap };
}

test('a worked example and a timed hint are assisted, while a slow scheduled recall is not', () => {
  const { game, progress, advance, tap, narration } = exercise();
  game.start({ kind: 'fixed', lessonId: 'natural-minor', key: 'D' });
  assert.equal(game.phase, 'teaching');
  assert.equal(narration.at(-1), undefined);
  for (const note of [62, 64, 65, 67, 69, 70, 72, 74]) tap(note);
  assert.equal(game.phase, 'playing');
  assert.equal(progress.attempts, 0);
  for (const note of [62, 64, 65, 67, 69, 70, 72, 74]) tap(note);
  advance(850);
  assert.equal(game.phase, 'playing');
  advance(6_001);
  assert.equal(game.view().hint, true);
  for (const note of [62, 64, 65, 67, 69, 70, 72, 74]) tap(note);
  assert.deepEqual(progress.curriculum.courseV3.concepts['natural-minor'].rootTraces.D?.mastery, ['assisted', 'assisted']);

  game.start({ kind: 'guided', entry: 'continuous' });
  game.dismissTeaching();
  const first = game.view().prompt!;
  tap(60 + first.root.pc);
  advance(850);
  advance(6_001);
  const second = game.view().prompt!;
  assert.equal(game.view().hint, false);
  tap(60 + second.root.pc);
  assert.deepEqual(progress.curriculum.courseV3.concepts.notes.mastery, ['assisted', 'unaided-success']);
});

test('Arcade pauses its clock and simultaneous terminal Skip cannot duplicate a timeout', () => {
  const { game, progress, advance, tap } = exercise();
  game.settings.runType = 'arcade';
  game.start({ kind: 'standalone', mode: 'notes' });
  assert.equal(game.view().seconds, 20);
  advance(5_000);
  game.setSpeaking(true);
  advance(20_000);
  assert.equal(game.view().seconds, 15);
  game.setSpeaking(false);
  game.setHidden(true);
  advance(20_000);
  assert.equal(game.view().seconds, 15);
  game.setHidden(false);
  const prompt = game.view().prompt!;
  assert.equal(prompt.kind, 'note');
  if (prompt.kind !== 'note') throw new Error('Expected a note prompt');
  tap(60 + (prompt.target.pc + 1) % 12);
  tap(60 + (prompt.target.pc + 2) % 12);
  advance(15_000);
  game.skip();
  assert.equal(game.view().hearts, 0);
  assert.match(game.view().message, /Time is up/);
  advance(850);
  assert.equal(game.view().summary?.points, -160);
  assert.equal(progress.attempts, 1);
  advance(60_000);
  assert.equal(progress.exerciseHistory.length, 1);
});

test('a committed result survives scope changes without finishing the abandoned run', () => {
  const { game, progress, advance, tap } = exercise();
  game.start({ kind: 'standalone', mode: 'notes' });
  const prompt = game.view().prompt!;
  if (prompt.kind !== 'note') throw new Error('Expected a note prompt');
  game.settings.key = 'G';
  tap(60 + prompt.target.pc);
  assert.equal(game.view().prompt?.key, 'C');
  assert.equal(progress.keyStats.C?.correct, 1);
  advance(850);
  assert.equal(game.view().prompt?.key, 'G');
  game.start({ kind: 'fixed', lessonId: 'harmonic-minor', key: 'Eb' });
  advance(20_000);
  assert.equal(game.view().round, 1);
  assert.equal(game.view().prompt?.key, 'Eb');
  assert.equal(progress.exerciseHistory.length, 0);
});

test('a recovered interval key can get a refresher without revealing another key', () => {
  const progress = createProgress(WALL);
  const course = progress.curriculum.courseV3;
  const lesson = ensureLesson(course, 'm2');
  lesson.explainedAt = WALL - 172_800_000;
  lesson.lastAsked = WALL - 43_200_000;
  const due = ensureKey(course, 'm2', 'D');
  due.lastAnswered = WALL - 43_200_000;
  due.recent = [false, false];
  const { game } = exercise(progress);
  game.start({ kind: 'fixed', lessonId: 'm2', key: 'C' });
  assert.equal(game.view().teaching, undefined);
  game.start({ kind: 'fixed', lessonId: 'm2', key: 'D' });
  assert.equal(game.view().teaching?.title, 'Concept refresher');
  game.dismissTeaching();
  game.start({ kind: 'fixed', lessonId: 'm2', key: 'D' });
  assert.equal(game.view().teaching, undefined);
});

test('Arcade uses interval and scale budgets, but a branch remains untimed', () => {
  const { game } = exercise();
  game.settings.runType = 'arcade';
  game.start({ kind: 'standalone', mode: 'intervals' });
  assert.equal(game.view().seconds, 35);
  game.start({ kind: 'fixed', lessonId: 'natural-minor', key: 'D' });
  assert.equal(game.view().seconds, 52);
  game.start({ kind: 'rotation', section: false, lessonIds: ['major'], label: 'Major scale' });
  assert.equal(game.view().seconds, undefined);
  assert.equal(game.view().total, 17);
});

test('a first-try answer after tab hiding qualifies for mastery but not timing', () => {
  const progress = createProgress(WALL);
  progress.curriculum.courseV3.guidedExplained.push('notes');
  ensureLesson(progress.curriculum.courseV3, 'notes').lastAsked = WALL - 2_000;
  const { game, advance, tap } = exercise(progress);
  game.start({ kind: 'guided', entry: 'suggested' });
  game.setHidden(true);
  advance(1_000);
  game.setHidden(false);
  advance(1_000);
  tap(60 + game.view().prompt!.root.pc);
  assert.deepEqual(progress.curriculum.courseV3.concepts.notes.mastery, ['unaided-success']);
  assert.deepEqual(progress.responseTimes, {});
});

for (const entry of ['continuous', 'suggested'] as const) {
  test(`${entry} continues through an admitted preview to the next lesson decision`, () => {
    const progress = createProgress(WALL);
    const course = progress.curriculum.courseV3;
    const notes = ensureLesson(course, 'notes');
    notes.points = 100;
    notes.lastAsked = WALL - 5_000;
    notes.mastery = Array.from({ length: 20 }, () => 'unaided-success');
    course.guidedExplained.push('notes');
    for (const key of KEYS) {
      const trace = ensureKey(course, 'notes', key);
      trace.lastAsked = WALL - 5_000;
      trace.mastery = ['unaided-success', 'unaided-success', 'unaided-success', 'unaided-success'];
    }
    const { game, advance, tap } = exercise(progress);
    game.start({ kind: 'guided', entry });
    for (let round = 1; round <= 10; round++) {
      const current = game.view();
      assert.equal(current.phase, 'playing');
      tap(60 + current.prompt!.root.pc);
      advance(850);
    }
    const summary = game.view();
    assert.equal(summary.offer, undefined);
    assert.equal(summary.preview?.prompt.kind, 'note');
    assert.equal(progress.exerciseHistory.length, 1);
    const before = { attempts: progress.attempts, daily: progress.daily.notes, xp: progress.xp };
    if (entry === 'continuous') tap(exampleKeys(summary.preview!.prompt)[0]);
    else game.continue();
    assert.deepEqual({ attempts: progress.attempts, daily: progress.daily.notes, xp: progress.xp }, before);
    assert.deepEqual(course.admitted, ['notes']);
    assert.equal(game.view().offer?.id, 'm2');
    game.continue();
    assert.equal(game.view().offer?.id, 'm2');
    if (entry === 'continuous') {
      game.answerOffer(true);
      assert.deepEqual(course.admitted, ['notes', 'm2']);
      assert.equal(game.view().teaching?.prompt.lessonId, 'm2');
    } else {
      game.answerOffer(false);
      assert.ok(course.offerAfter >= WALL + 600_000);
      const restored = migrateProgress(JSON.parse(JSON.stringify(progress)), WALL);
      assert.equal(restored.curriculum.courseV3.offerAfter, course.offerAfter);
      assert.deepEqual(restored.curriculum.courseV3.admitted, ['notes']);
    }
    assert.deepEqual(game.view().scope, { kind: 'guided', entry });
    assert.equal(game.view().summary, undefined);
    assert.equal(game.view().round, 1);
    game.stop();
    assert.equal(game.phase, 'ready');
    assert.equal(progress.exerciseHistory.length, 1);
  });
}
