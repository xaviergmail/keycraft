# Proposal

## Why

KeyCraft’s behavior is spread across a browser bundle, a historical handoff, and a few OpenSpec artifacts. A source-independent contract makes it possible to rebuild the trainer on a modern, installable web stack without quietly losing lessons, progress, or practice behavior.

## What Changes

- Specify the complete musical catalog, three input routes, generated drills, scoring by lesson and spelled key, and the practice loop. Preserve runnable examples and representative legacy-save fixtures for the new implementation.
- **BREAKING — guided progression:** Just Practice and Start suggested drill offer a new concept only after every lesson already on the guided path meets full mastery. This replaces the old early-readiness gate and round-40 promise. Free Play remains open without enrolling lessons in the guided path.
- Request basic MIDI access automatically on startup where the browser exposes it. If Kokoro does not have the current prompt ready, use browser speech without waiting for synthesis. Neither permission nor voice availability blocks play.
- Preserve playable post-exercise diagrams, teaching aids, summaries and history, run modes, feedback, milestones, export, and browser-local progress. Guided continuation previews reinforce admitted material rather than teaching a locked concept.
- Specify offline, install, update, and static-release behavior for the rebuilt PWA. Keep UI styling, a backend, accounts, cross-origin automatic data transfer, and production rollout out of this proposal.

## Capabilities

### New Capabilities

- `curriculum-catalog`: Stable ordered lesson catalog, supported spellings, and musical recipes.
- `performance-input`: Computer keyboard, playable piano, and Web MIDI lifecycle.
- `curriculum-scoring`: Score events, lesson and key identity, and independent mastery evidence.
- `guided-drills`: Scope-driven challenge generation and musical answer validation.
- `spoken-prompts`: Narration, Kokoro background generation, and deadline fallback.
- `exercise-continuation`: Playable random post-run chart previews and next-run routing.
- `free-play`: Direct lesson, root, branch, and standalone mode selection.
- `session-modes`: Untimed Practice, timed Arcade, and run lifecycle.
- `lesson-support`: Introductions, refreshers, hints, examples, and Theory Lens.
- `performance-feedback`: Meaningful live and accessible feedback independent of styling.
- `exercise-history`: Run summaries, score history charts, and accessible data.
- `progress-milestones`: Ranks, achievements, and daily quests.
- `local-progress`: Same-origin save compatibility, recovery, and JSON backup.
- `installable-web-app`: Installability, offline play, and coherent updates.
- `pwa-release`: Validation and publication of the rebuilt static asset set on existing hosts.

### Modified Capabilities

- `guided-practice-pacing`: Replace introduction on initial readiness with full-path mastery; retain delayed review and an explicit learner choice to advance.

## Impact

The implementation will replace the classic browser bundle with a new static PWA. Use the specs and their fixtures as the rebuild inputs, not the old source tree as a dependency. Keep stable lesson IDs, original browser storage compatibility, and existing publishing destinations; use a new packaging contract for the rebuild rather than the completed legacy Pages change’s four-file allowlist. No code, hosting settings, or deployment changes are made by this proposal.
