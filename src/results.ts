import { CANONICAL_KEYS, localDate, type HistoryRow, type Mode, type Progress, type RunScore } from './domain.ts';
import { LESSONS, LESSON_BY_ID } from './catalog.ts';

export interface Summary {
  readonly number: number;
  readonly label: string;
  readonly planned: number;
  readonly clears: number;
  readonly bestCombo: number;
  readonly points: number;
  readonly xp: number;
  readonly accuracy: number;
  readonly bestScore: number;
  readonly responseAverageMs?: number;
  readonly responseCount: number;
}

export interface ChartPoint {
  number: number;
  value: number;
}

export interface ChartSeries {
  label: string;
  points: ChartPoint[];
}

export interface Badge {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export type QuestId = 'rounds' | 'notes' | 'jazz';

export interface Quest {
  readonly id: QuestId;
  readonly title: string;
  readonly description: string;
  readonly target: number;
}

export const BADGES: Badge[] = [
  { id: 'first', title: 'First Contact', description: 'Clear at least one challenge.' },
  { id: 'streak', title: 'On a Roll', description: 'Reach a best combo of eight.' },
  { id: 'scales', title: 'Scale Explorer', description: 'Clear ten scale challenges.' },
  { id: 'jazz', title: 'Jazz Apprentice', description: 'Clear ten guide-tone or voicing challenges.' },
  { id: 'keys', title: 'Circle Complete', description: 'Make a first-try clear in each canonical key.' },
  { id: 'century', title: 'Centurion', description: 'Clear at least one hundred challenges.' },
];

export const QUESTS: Quest[] = [
  { id: 'rounds', title: 'Daily Practice', description: 'Clear six rounds today.', target: 6 },
  { id: 'notes', title: 'Daily Keyboard', description: 'Play thirty note attacks today.', target: 30 },
  { id: 'jazz', title: 'Daily Harmony', description: 'Clear two guide, voicing, or cadence rounds today.', target: 2 },
];

interface GroupDefinition {
  readonly label: string;
  readonly lessonIds: readonly string[];
}

const GROUPS: readonly GroupDefinition[] = [
  { label: 'Note recognition', lessonIds: ['notes'] },
  { label: 'Intervals', lessonIds: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5'] },
  { label: 'Major triads', lessonIds: ['major-triad'] },
  { label: 'Minor triads', lessonIds: ['minor-triad'] },
  { label: 'Major scale', lessonIds: ['major'] },
  { label: 'Natural minor scale', lessonIds: ['natural-minor'] },
  { label: 'Harmonic minor scale', lessonIds: ['harmonic-minor'] },
  { label: 'Melodic minor', lessonIds: ['melodic-minor'] },
  { label: 'Diminished triads', lessonIds: ['diminished'] },
  { label: 'Suspended chords', lessonIds: ['sus2', 'sus4'] },
  { label: 'Chord inversions', lessonIds: ['inversion-1', 'inversion-2'] },
  { label: 'Extended intervals', lessonIds: ['P8', 'A4', 'm6', 'M6', 'm7-interval', 'M7'] },
  { label: 'Seventh chords', lessonIds: ['major-seventh', 'minor-seventh', 'dominant-seventh', 'half-diminished'] },
  { label: 'Cadence', lessonIds: ['cadence', 'guides'] },
  { label: 'Phrasing', lessonIds: ['dorian', 'mixolydian', 'targets'] },
  { label: 'Advanced voicing', lessonIds: ['shells', 'rootless', 'altered'] },
  { label: 'Jazz harmony', lessonIds: ['minor-cadence', 'turnaround', 'tritone-sub'] },
];

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boundedScore(value: unknown): number {
  return Math.min(100, Math.max(0, finite(value)));
}

function totals(progress: Progress, mode: Mode): { attempts: number; correct: number } {
  const value = progress.modeStats?.[mode];
  return {
    attempts: Math.max(0, finite(value?.attempts)),
    correct: Math.max(0, finite(value?.correct)),
  };
}

function historyNumber(history: readonly HistoryRow[]): number {
  let maximum = 0;
  for (const row of history) {
    const number = finite(row.number);
    if (number > maximum) maximum = number;
  }
  return maximum + 1;
}

function testedSkills(tested: ReadonlySet<string>): string[] {
  return [...tested].filter((id) => LESSON_BY_ID.has(id));
}

function curriculumSnapshot(progress: Progress): Record<string, number> {
  const concepts = progress.curriculum?.courseV3?.concepts ?? {};
  return Object.fromEntries(LESSONS.map((lesson) => [lesson.id, boundedScore(concepts[lesson.id]?.points)]));
}

function responseSummary(samples: readonly number[]): { average?: number; count: number } {
  const valid = samples.filter((sample) => Number.isFinite(sample));
  if (valid.length === 0) return { count: 0 };
  return {
    average: valid.reduce((sum, sample) => sum + sample, 0) / valid.length,
    count: valid.length,
  };
}

/** Append one immutable exercise snapshot and return the presentation summary. */
export function finishExercise(
  progress: Progress,
  scopeKey: string,
  label: string,
  planned: number,
  score: RunScore,
  tested: ReadonlySet<string>,
): Summary {
  const history = Array.isArray(progress.exerciseHistory) ? progress.exerciseHistory : [];
  const number = historyNumber(history);
  const accuracyDenominator = Math.max(0, score.clears + score.errors);
  const accuracy = accuracyDenominator > 0 ? Math.round((score.clears / accuracyDenominator) * 100) : 0;
  const response = responseSummary(score.responseSamples ?? []);
  const bestScores = progress.bestScores ?? (progress.bestScores = {});
  const priorBest = finite(bestScores[scopeKey]);
  const bestScore = Math.max(priorBest, finite(score.points));
  bestScores[scopeKey] = bestScore;
  const row: HistoryRow = {
    number,
    label,
    accuracy,
    curriculumScores: curriculumSnapshot(progress),
    testedSkills: testedSkills(tested),
  };
  progress.exerciseHistory = [...history, row].slice(-10);
  const summary: Summary = {
    number,
    label,
    planned,
    clears: score.clears,
    bestCombo: score.bestCombo,
    points: score.points,
    xp: score.xp,
    accuracy,
    bestScore,
    responseCount: response.count,
  };
  return response.average === undefined ? summary : { ...summary, responseAverageMs: response.average };
}

function groupMean(row: HistoryRow, group: GroupDefinition): number {
  const scores = row.curriculumScores ?? {};
  const total = group.lessonIds.reduce((sum, id) => sum + boundedScore(scores[id]), 0);
  return Math.round((total / group.lessonIds.length) * 10) / 10;
}

/** Build only the analytical groups represented by the latest saved exercise. */
export function chartSeries(history: readonly HistoryRow[]): ChartSeries[] {
  const latest = history.at(-1);
  const latestTested = new Set(latest?.testedSkills ?? []);
  if (!latest || latestTested.size === 0) return [];
  const selected = GROUPS.filter((group) => group.lessonIds.some((id) => latestTested.has(id)));
  return selected.map((group) => ({
    label: group.label,
    points: history
      .filter((row) => row.curriculumScores !== undefined && Object.keys(row.curriculumScores).length > 0)
      .map((row) => ({ number: row.number, value: groupMean(row, group) })),
  }));
}

const RANKS = [
  'Novice',
  'Foundation Builder',
  'Chord Explorer',
  'Harmony Seeker',
  'Jazz Apprentice',
  'Voicing Architect',
  'Jazz Navigator',
  'Improviser',
] as const;

export function levelFor(xp: number): { level: number; progress: number; rank: string } {
  const safeXp = Math.max(0, Math.floor(finite(xp)));
  const level = Math.floor(safeXp / 500) + 1;
  const progress = safeXp % 500;
  const rank = RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))];
  return { level, progress, rank };
}

function keyBadgeReady(progress: Progress): boolean {
  return CANONICAL_KEYS.every((key) => Math.max(0, finite(progress.keyStats?.[key]?.correct)) >= 1);
}

function badgeReady(progress: Progress, id: string): boolean {
  const scaleTotals = totals(progress, 'scales');
  const jazzTotals = totals(progress, 'guides');
  const voicingTotals = totals(progress, 'voicings');
  switch (id) {
    case 'first': return finite(progress.correct) >= 1;
    case 'streak': return finite(progress.bestStreak) >= 8;
    case 'scales': return scaleTotals.correct >= 10;
    case 'jazz': return jazzTotals.correct + voicingTotals.correct >= 10;
    case 'keys': return keyBadgeReady(progress);
    case 'century': return finite(progress.correct) >= 100;
    default: return false;
  }
}

/** Award each satisfied badge at most once; return whether progress changed. */
export function awardBadges(progress: Progress): boolean {
  if (!Array.isArray(progress.achievements)) progress.achievements = [];
  const earned = new Set(progress.achievements);
  let changed = false;
  for (const badge of BADGES) {
    if (!badgeReady(progress, badge.id) || earned.has(badge.id)) continue;
    progress.achievements.push(badge.id);
    earned.add(badge.id);
    progress.xp = finite(progress.xp) + 100;
    changed = true;
  }
  return changed;
}

/** Reset daily counters on a local-date boundary, even while the app stays open. */
export function refreshDaily(progress: Progress, now: number): boolean {
  const date = localDate(now);
  const current = progress.daily;
  if (current && current.date === date && Number.isFinite(current.rounds) && Number.isFinite(current.notes) && Number.isFinite(current.jazz) && typeof current.claimed === 'boolean') {
    return false;
  }
  progress.daily = { date, rounds: 0, notes: 0, jazz: 0, claimed: false };
  return true;
}

export function challengeAttack(progress: Progress, now: number): void {
  refreshDaily(progress, now);
  progress.daily.notes += 1;
}

export function challengeClear(progress: Progress, mode: Mode, now: number): void {
  refreshDaily(progress, now);
  progress.daily.rounds += 1;
  if (mode === 'guides' || mode === 'voicings' || mode === 'cadence') progress.daily.jazz += 1;
}

/** Claim the completed daily trio exactly once for the current local date. */
export function claimDaily(progress: Progress, now: number): boolean {
  refreshDaily(progress, now);
  const ready = QUESTS.every((quest) => {
    if (quest.id === 'rounds') return progress.daily.rounds >= quest.target;
    if (quest.id === 'notes') return progress.daily.notes >= quest.target;
    return progress.daily.jazz >= quest.target;
  });
  if (!ready || progress.daily.claimed) return false;
  progress.daily.claimed = true;
  progress.xp = finite(progress.xp) + 200;
  return true;
}

