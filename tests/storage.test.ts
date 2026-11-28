import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  SAVE_KEY,
  createProgress,
  exportProgress,
  migrateProgress,
  openProgress,
  progressBackup,
} from '../src/storage.ts';
import type { Progress } from '../src/domain.ts';

const FIXED_NOW = Date.parse('2025-01-15T12:00:00Z');

const fixture = (name: string): unknown => JSON.parse(readFileSync(
  new URL(`../openspec/changes/rebuild-keycraft-pwa/fixtures/${name}`, import.meta.url),
  'utf8',
));

function course(progress: Progress) {
  return progress.curriculum.courseV3;
}

test('creates a playable version-three default', () => {
  const progress = createProgress(FIXED_NOW);
  assert.equal(progress.curriculum.courseV3.version, 3);
  assert.deepEqual(progress.curriculum.courseV3.admitted, ['notes']);
  assert.deepEqual(progress.curriculum.courseV3.focus, { lessonId: 'notes', key: 'C' });
  assert.equal(progress.daily.date, '2025-01-15');
});

test('splits grouped v1 interval history by distance without mastery claims', () => {
  const progress = migrateProgress(fixture('legacy-progress-v1.json'), FIXED_NOW);
  const migrated = course(progress);
  assert.deepEqual(migrated.concepts.m2.rootTraces.C!.recent, [true, false, true]);
  assert.deepEqual(migrated.concepts.M2.rootTraces.C!.recent, [false, true]);
  assert.equal(migrated.concepts.m2.rootTraces.C!.mastery.length, 0);
  assert.deepEqual(migrated.admitted, ['notes']);
  assert.equal(migrated.focus?.lessonId, 'notes');
  assert.equal(progress.xp, 1200);
  assert.equal(progress.bestScores['chords:practice'], 320);
});

test('migrates v2 traces, spellings, focus, cooldown, and item IDs', () => {
  const progress = migrateProgress(fixture('legacy-progress-v2.json'), FIXED_NOW);
  const migrated = course(progress);
  assert.equal(migrated.focus?.lessonId, 'major');
  assert.equal(migrated.focus?.key, 'D');
  assert.equal(migrated.offerAfter, 1736942700000);
  assert.equal(migrated.concepts['natural-minor'].rootTraces['G#']!.points, 17);
  assert.equal(migrated.concepts['natural-minor'].rootTraces.Ab!.points, 52);
  assert.equal(migrated.concepts['natural-minor'].mastery.length, 0);
  assert.deepEqual(migrated.admitted, ['notes', 'm2', 'M2', 'm3', 'M3', 'P4', 'P5', 'major-triad', 'minor-triad', 'major']);
  assert.equal(migrated.admitted.includes('natural-minor'), false);
  assert.equal(Object.keys(migrated.items).length, 2);
  assert.equal(progress.xp, 1234);
  assert.equal(progress.daily.claimed, true);
});
test('does not derive guided introductions from a future V3 free-play trace', () => {
  const source = fixture('legacy-progress-v2.json') as Record<string, unknown>;
  source.curriculum = {
    courseV3: {
      version: 3,
      admitted: ['notes'],
      focus: { lessonId: 'notes', key: 'C' },
      guidedExplained: [],
      concepts: {
        'natural-minor': { explainedAt: FIXED_NOW, points: 90 },
      },
    },
  };
  const migrated = course(migrateProgress(source, FIXED_NOW));
  assert.deepEqual(migrated.guidedExplained, []);
});


test('does not overwrite an unreadable save and exposes a usable session', () => {
  let raw = '{not-json';
  const storage = {
    getItem: (key: string) => key === SAVE_KEY ? raw : null,
    setItem: (_key: string, value: string) => { raw = value; },
  };
  const opened = openProgress(() => storage, FIXED_NOW);
  assert.equal(opened.save(), false);
  assert.equal(raw, '{not-json');
  assert.match(opened.error ?? '', /could not be decoded/i);
  opened.progress.xp = 4;
  assert.equal(opened.progress.xp, 4);
});

test('writes a versioned save and exports a local-date envelope', () => {
  let raw: string | null = null;
  const storage = {
    getItem: (_key: string) => raw,
    setItem: (_key: string, value: string) => { raw = value; },
  };
  const opened = openProgress(() => storage, FIXED_NOW);
  opened.progress.xp = 9;
  assert.equal(opened.save(), true);
  assert.equal(JSON.parse(raw ?? '').curriculum.courseV3.version, 3);

  const backup = progressBackup(opened.progress, FIXED_NOW);
  assert.equal(backup.filename, 'keycraft-progress-2025-01-15.json');
  const envelope = JSON.parse(backup.contents) as { exportedAt: string; application: string; progress: { xp: number } };
  assert.equal(envelope.application, 'Keycraft');
  assert.equal(envelope.progress.xp, 9);
  assert.equal(envelope.exportedAt, new Date(FIXED_NOW).toISOString());
  assert.doesNotThrow(() => exportProgress(opened.progress, FIXED_NOW));
});

test('prefers a direct per-lesson trace over a grouped interval record', () => {
  const source = fixture('legacy-progress-v1.json') as Record<string, unknown>;
  const curriculum = source.curriculum as Record<string, unknown>;
  curriculum.m2 = { C: { recent: [false], points: 77, lastPracticed: FIXED_NOW - 1000 } };
  const migrated = course(migrateProgress(source, FIXED_NOW));
  assert.deepEqual(migrated.concepts.m2.rootTraces.C!.recent, [false]);
  assert.equal(migrated.concepts.m2.rootTraces.C!.points, 77);
});

test('recovers from storage access errors while leaving export available', () => {
  const opened = openProgress(() => {
    throw new Error('denied');
  }, FIXED_NOW);
  assert.equal(opened.save(), false);
  assert.match(opened.error ?? '', /denied|unavailable/i);
  const envelope = JSON.parse(progressBackup(opened.progress, FIXED_NOW).contents) as { progress: Progress };
  assert.equal(envelope.progress.curriculum.courseV3.version, 3);
});
