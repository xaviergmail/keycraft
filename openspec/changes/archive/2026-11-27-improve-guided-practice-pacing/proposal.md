# Proposal

## Why

On a fresh save, the guided path currently requires at least 476 clean rounds before it can offer the first major-triad lesson: note finding and six intervals, with a four-clean streak in each of 17 spellings. Practicing until something feels fluent in one sitting is not the same as recalling it later; [spaced retrieval research](https://doi.org/10.1007/s10648-020-09572-8) supports moving some repetition into later review instead of front-loading it as a prerequisite.

## What Changes

- In **Just Practice**, offer the next lesson after a short period of successful, unaided practice in a small set of starting keys. Keep the learner's choice to advance or keep practicing; don't require a minimum playing speed or a day-long wait.
- Introduce one starting key per scale lesson (beginning with C major and its relative A natural minor); move the remaining scale keys out of the core progression gate. Keep root coverage and proficiency as long-term practice goals.
- Give new material several focused turns, then mix it with already-introduced work. Prioritize overdue material on review turns, including after reload. Keep hints available without treating assisted play as independent recall.
- Use the same pacing on both entry points to the scheduled curriculum: **Just Practice** and **Start suggested drill**. Keep individual lesson, root, and branch selection in Free Play.

**Out of scope:** New lessons or drill modes, changed musical answer rules, score changes, a rename of Just Practice, and new analytics or data collection.

## Capabilities

### New Capabilities

- `guided-practice-pacing`: Readiness, lesson introductions, and spaced review on the guided curriculum path.

### Modified Capabilities

## Impact

- `dist/curriculum.js` for scheduling and progression; `dist/app.js` for prompt selection, hint/round handling, and advancement UI; `dist/lessons.js` for starter keys.
- Preserve existing browser saves, lesson IDs, scores, per-root histories, and memory estimates. No new runtime dependencies.
