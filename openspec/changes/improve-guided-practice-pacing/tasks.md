# Tasks

## 1. Curriculum policy and persisted readiness

- [ ] 1.1 Add scale starter keys in `dist/lessons.js` and replace the all-root gate in `dist/curriculum.js` with core-first offers. Check C major → A natural minor with only C major played, no duplicate offer for a previously presented lesson, and selection of an unseen scale spelling after core coverage.
- [ ] 1.2 Track the bounded focus window and initialize it from a valid saved focus without changing legacy histories. With a fixed-clock Node `vm` probe, verify that three clean results can qualify, enharmonic spellings do not count as two roots, an unmatched scale key does not count, and a recent miss prevents advancement until readiness recovers.
- [ ] 1.3 Schedule distinct focus and review turns and choose overdue introduced entries using existing traces. Verify the acquiring and ready three-round mixes, a single-entry fallback, review-only behavior at the end, and selection of a due scale key over a recent non-due entry after serializing and reloading the same progress.

## 2. Guided runs and teaching aids

- [ ] 2.1 Feed scheduled selections into `planChallenge()` in `dist/app.js`, varying the root when non-scale readiness needs contrast. Plan each paced prompt from committed outcomes and the latest focus; verify a completed round changes the next planned role and neural narration never speaks a discarded prompt.
- [ ] 2.2 Track outcomes once at the round boundary and suppress automatic hint display in paced scored rounds. Verify that a worked example, an opened-then-hidden hint, a recovered error, and a skip cannot qualify; an abandoned prompt has no outcome; and a slow but clean unaided answer still qualifies.
- [ ] 2.3 Update the existing focus/review labels and offer controls for both scheduled entry points. Check that acceptance changes the focus, declining continues with the saved cooldown across reload, and direct root and branch drills still play their requested scope without changing the guided focus. Update the README practice section to match those distinctions.

## 3. End-to-end verification

- [ ] 3.1 Run a fixed-clock, deterministic fresh-save sequence through the actual scheduler and round recording. Verify that an error-free learner who accepts each offer reaches the first major-triad prompt by scored round 40, with at least one earlier lesson returning in mixed review before then. Remove throwaway probes after verification.
- [ ] 3.2 Run `node --check` on modified JavaScript and `python3 scripts/build-assets.py`; keep `dist/index.html` and its matching hashed assets together. Smoke-test the rebuilt app with the on-screen keys: advance, keep practicing, leave and resume on a legacy save, and inspect **Export progress** for the original scores and histories. Verify a spoken prompt addresses the lesson actually displayed.
