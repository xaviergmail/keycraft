import {
  KEYS,
  type Course,
  type Key,
  type ScheduledSelection,
  type Selection,
  type Trace,
} from './domain.ts';
import { LESSONS, LESSON_BY_ID, type Lesson } from './catalog.ts';
import { due, recallWeight } from './record.ts';

const REVIEW_BLOCK = 3;
const OFFER_COOLDOWN = 10 * 60_000;

function presentedAt(trace: Trace | undefined): number | undefined {
  if (!trace) return undefined;
  const asked = Number.isFinite(trace.lastAsked) ? trace.lastAsked : undefined;
  const answered = Number.isFinite(trace.lastAnswered) ? trace.lastAnswered : undefined;
  return asked ?? answered;
}

function unaidedStreak(trace: Trace | undefined): number {
  if (!trace) return 0;
  let streak = 0;
  for (let index = trace.mastery.length - 1; index >= 0; index -= 1) {
    if (trace.mastery[index] !== 'unaided-success') break;
    streak += 1;
  }
  return streak;
}

function keyIndex(key: Key): number {
  return KEYS.indexOf(key);
}

function traceFor(course: Course, lessonId: string, key: Key): Trace | undefined {
  return course.concepts[lessonId]?.rootTraces?.[key];
}

function lessonNeedsWork(course: Course, lessonId: string): boolean {
  return !lessonMastered(course, lessonId);
}

function validAdmitted(course: Course): readonly string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of course.admitted ?? []) {
    if (!LESSON_BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  // A blank course is playable on the note path even before persistence has
  // materialized its first admission.
  return result.length > 0 ? result : ['notes'];
}

function focusLesson(course: Course, admitted: readonly string[]): string | undefined {
  const newest = admitted.at(-1);
  if (newest !== undefined && lessonNeedsWork(course, newest)) return newest;
  return admitted.find((id) => lessonNeedsWork(course, id));
}

function keyHasObservation(trace: Trace | undefined): boolean {
  return presentedAt(trace) !== undefined;
}

function focusKey(course: Course, lessonId: string): Key {
  const lesson = LESSON_BY_ID.get(lessonId);
  const traces = KEYS.map((key) => ({ key, trace: traceFor(course, lessonId, key) }));
  const observed = traces.some(({ trace }) => keyHasObservation(trace));
  if (!observed && lesson?.starterKey !== undefined) return lesson.starterKey;

  const deficient = traces.filter(({ trace }) => unaidedStreak(trace) < 4);
  const pool = deficient.length > 0 ? deficient : traces;
  const sorted = [...pool].sort((left, right) => {
    const leftAt = presentedAt(left.trace) ?? Number.NEGATIVE_INFINITY;
    const rightAt = presentedAt(right.trace) ?? Number.NEGATIVE_INFINITY;
    if (leftAt !== rightAt) return leftAt - rightAt;
    return keyIndex(left.key) - keyIndex(right.key);
  });
  return sorted[0]?.key ?? lesson?.starterKey ?? KEYS[0];
}

function compareReview(
  left: { lessonId: string; key: Key; trace: Trace },
  right: { lessonId: string; key: Key; trace: Trace },
  now: number,
  dueOnly: boolean,
): number {
  if (dueOnly) {
    const leftAt = presentedAt(left.trace) ?? Number.NEGATIVE_INFINITY;
    const rightAt = presentedAt(right.trace) ?? Number.NEGATIVE_INFINITY;
    if (leftAt !== rightAt) return leftAt - rightAt;
  } else {
    const weightDifference = recallWeight(right.trace, now) - recallWeight(left.trace, now);
    if (weightDifference !== 0) return weightDifference;
    const leftAt = presentedAt(left.trace) ?? Number.NEGATIVE_INFINITY;
    const rightAt = presentedAt(right.trace) ?? Number.NEGATIVE_INFINITY;
    if (leftAt !== rightAt) return leftAt - rightAt;
  }
  const lessonDifference = LESSONS.findIndex((lesson) => lesson.id === left.lessonId)
    - LESSONS.findIndex((lesson) => lesson.id === right.lessonId);
  if (lessonDifference !== 0) return lessonDifference;
  return keyIndex(left.key) - keyIndex(right.key);
}

function reviewSelection(
  course: Course,
  admitted: readonly string[],
  now: number,
  excluded?: Selection,
): Selection | undefined {
  const candidates: { lessonId: string; key: Key; trace: Trace }[] = [];
  for (const lessonId of admitted) {
    const lesson = course.concepts[lessonId];
    if (!lesson) continue;
    for (const key of KEYS) {
      const trace = lesson.rootTraces?.[key];
      if (!trace || presentedAt(trace) === undefined) continue;
      if (excluded?.lessonId === lessonId && excluded.key === key) continue;
      candidates.push({ lessonId, key, trace });
    }
  }
  if (candidates.length === 0) return undefined;
  const dueCandidates = candidates.filter(({ trace }) => due(trace, now));
  const pool = dueCandidates.length > 0 ? dueCandidates : candidates;
  pool.sort((left, right) => compareReview(left, right, now, dueCandidates.length > 0));
  const selected = pool[0];
  return selected ? { lessonId: selected.lessonId, key: selected.key } : undefined;
}

/** Return a complete branch rotation, interleaving lessons and offsetting key slots. */
export function rotation(lessonIds: readonly string[]): Selection[] {
  const result: Selection[] = [];
  for (let keySlot = 0; keySlot < KEYS.length; keySlot += 1) {
    for (let lessonIndex = 0; lessonIndex < lessonIds.length; lessonIndex += 1) {
      result.push({
        lessonId: lessonIds[lessonIndex],
        key: KEYS[(keySlot + lessonIndex) % KEYS.length],
      });
    }
  }
  return result;
}

/** A lesson is mastered only when visible score, global recall, and every spelling pass. */
export function lessonMastered(course: Course, id: string): boolean {
  const lesson = course.concepts[id];
  if (!lesson) return false;
  const points = Number.isFinite(lesson.points) ? Math.min(100, Math.max(0, lesson.points)) : 0;
  if (points < 80) return false;
  const recent = lesson.mastery.slice(-20);
  if (recent.length < 20 || recent.filter((outcome) => outcome === 'unaided-success').length < 18) return false;
  return KEYS.every((key) => unaidedStreak(lesson.rootTraces?.[key]) >= 4);
}

/** Select a focus/review pair for one 1-based guided round. */
export function selectGuided(
  course: Course,
  round: number,
  now: number,
  resume?: Selection,
): ScheduledSelection {
  const admitted = validAdmitted(course);
  const focusId = focusLesson(course, admitted);
  const focus = focusId === undefined ? undefined : { lessonId: focusId, key: focusKey(course, focusId) };
  const normalizedRound = Math.max(1, Math.floor(round));
  const reviewSlot = normalizedRound % REVIEW_BLOCK === 0;

  if (focus && normalizedRound === 1 && resume && admitted.includes(resume.lessonId) && resume.lessonId === focus.lessonId && KEYS.includes(resume.key)) {
    return { ...resume, role: 'focus' };
  }

  if (focus && !reviewSlot) return { ...focus, role: 'focus' };
  const review = reviewSelection(course, admitted, now, focus);
  if (review) return { ...review, role: 'review' };
  if (focus) return { ...focus, role: 'focus' };

  // All admitted entries are mastered and there is no historical review yet.
  const fallback = course.focus && admitted.includes(course.focus.lessonId) && KEYS.includes(course.focus.key)
    ? course.focus
    : { lessonId: admitted[0], key: KEYS[0] };
  return { ...fallback, role: 'review' };
}

function nextLessonIndex(course: Course): number {
  const admitted = new Set(course.admitted ?? []);
  let index = 0;
  while (index < LESSONS.length && admitted.has(LESSONS[index].id)) index += 1;
  return index;
}

function gateMastered(course: Course): boolean {
  const admitted = (course.admitted ?? []).filter((id) => LESSON_BY_ID.has(id));
  return admitted.every((id) => lessonMastered(course, id));
}

/** Return the next ordered lesson only when the current full-path gate is clear. */
export function nextAdmission(course: Course, now: number): Lesson | undefined {
  if (Number.isFinite(course.offerAfter) && now < course.offerAfter) return undefined;
  if (!gateMastered(course)) return undefined;
  return LESSONS[nextLessonIndex(course)];
}

/** Accept exactly the currently eligible next lesson and focus its starter key. */
export function acceptAdmission(course: Course, id: string, now: number): boolean {
  const next = nextAdmission(course, now);
  if (!next || next.id !== id || (course.admitted ?? []).includes(id)) return false;
  course.admitted = [...(course.admitted ?? []), id];
  course.focus = { lessonId: id, key: next.starterKey ?? KEYS[0] };
  course.offerAfter = 0;
  return true;
}

/** Decline an offer for ten minutes; repeated dismissals cannot shorten the cooldown. */
export function declineAdmission(course: Course, now: number): void {
  const cooldown = now + OFFER_COOLDOWN;
  course.offerAfter = Math.max(Number.isFinite(course.offerAfter) ? course.offerAfter : 0, cooldown);
}

