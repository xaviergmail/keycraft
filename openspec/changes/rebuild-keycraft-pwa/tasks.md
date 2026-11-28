# Tasks

## 1. Static app and musical data

- [x] 1.1 Set up the static Svelte/TypeScript/Vite app, locked dependencies, and deterministic test entry point without overwriting the legacy publish tree. Verify a clean install, type check, and production build without the legacy scripts.
- [x] 1.2 Recreate the catalog and spelling functions from `curriculum-catalog`. Check all 39 IDs in order, ten sections, 17 separate spellings, and all scale, chord, progression, and voicing recipes. Use the G♯ major and minor-cadence fixtures to check generated notes and spellings.
- [x] 1.3 Generate note, interval, scale, stack, and progression prompts from explicit scopes. Check that fixed D natural minor stays fixed, less-tested equivalents vary when available, and each standalone difficulty uses only its allowed bank.

## 2. Evaluation and input

- [x] 2.1 Implement note, anchored interval, and ascending scale evaluation. Verify the 100 ms upper-first interval boundary, held high-then-low octaves, and the wrong-octave scale restart with deterministic input sequences.
- [x] 2.2 Implement stack, inversion, and multi-stage evaluation. Use the fixtures to check wrong bass, octave doubling, extra-note recovery, retained common tones, rootless and altered shapes, and exactly one result for a completed cadence.
- [x] 2.3 Route MIDI, computer keys, and the virtual piano through shared note ownership. Verify startup requests without a permission grant, denied/unavailable access and retry, hotplug and channel releases, focus loss, and overlapping sources. In a browser, play a D scale with register shifts and latch a chord with the on-screen piano.

## 3. Scoring and local records

- [x] 3.1 Record at most one classified mastery outcome and one curriculum score change per round, at lesson and spelled-key scope, with exact item histories. Check that C, D, G♯, and A♭ natural minor stay separate, assisted and recovered clears differ, and repeated mistakes cannot duplicate a penalty. Verify run points, combo, XP, and key/mode counts against the scoring scenarios.
- [x] 3.2 Track compatible, bounded response samples and per-lesson/key/item recall estimates. Check the half-life and latency formulas with fixed clocks, acceptance bounds, outlier rejection, and a valid answer after tab hiding that earns no timing sample.
- [x] 3.3 Migrate each raw legacy save, use browser-local persistence, and implement JSON export. Verify v1 interval separation, v2 focus and cooldown, unchanged historical scores and ambiguous item records, saved preference retention, and no legacy-only mastery. Verify reload and download on one origin, and a usable in-memory session when reading or writing storage fails.

## 4. Scored practice and instruction

- [x] 4.1 Run untimed Practice and Arcade with stage-safe clocks, skips, hearts, and cancellation. Check 20/35/52-second Arcade budgets, hidden-tab and transition pauses, simultaneous timeout and Skip, and abandonment without a new history row.
- [x] 4.2 Implement the shared guided scheduler and full-path gate for Just Practice and Start suggested drill. Verify focus/review blocks, starter keys, due review after reload, and that one missing G♯ streak or a miss in an earlier lesson blocks the next offer without revoking admission. Check the last lesson and the separate continuous-mode stop action.
- [x] 4.3 Implement direct lesson/key, whole-lesson, and section drills plus standalone controls. Verify 17 distinct spellings per rotated lesson, fixed scope across settings changes, readable per-key and section scores, and Free Play with no effect on guided admission.
- [x] 4.4 Add worked introductions, refreshers, manual and timed hints, Theory Lens, and live outcomes. In a browser, use only the keyboard to open and leave the teaching dialog, answer the round, and inspect note, progress, and result feedback. Check that a prior reveal prevents independent credit and a scheduled round never reveals an answer on a timer.

## 5. Exercise results and rewards

- [x] 5.1 Display finished-run stats and scoped best scores; append immutable snapshots and render their tested-group chart with readable values. Check the mixed result example, eviction of the oldest row on the eleventh exercise, and the empty group state after standalone practice.
- [x] 5.2 Add the playable random example below the chart, using the same evaluation rules without scoring it. Verify the non-scheduled scale/chord alternation and admitted-only guided examples. From both guided routes, check play-to-continue and Continue, eligible offer acceptance, and a decline cooldown that survives reload. Verify exact direct-scope replay and that a late callback cannot start two drills.
- [x] 5.3 Restore levels, ranks, badge predicates, and daily quests. Check badge award idempotence, one explicit quest claim per local date, rollover with the app left open, and no preview activity counted toward rewards.

## 6. Spoken prompts

- [x] 6.1 Run Kokoro generation off the main thread with versioned clip identity, compatible IndexedDB reuse, and priority over catalog warming for current/likely next requests. Verify warm legacy clips without model startup, duplicate-job suppression, and usable subsequent jobs after a failed or stalled clip.
- [x] 6.2 Play the current cached clip or hand off to browser speech within the cache deadline without waiting for inference. Check cold, slow, unavailable, failed, and autoplay-blocked cases; change stages during playback to verify no stale speech or clock hold. Verify mute, explicit engine choice, and Replay after reload.
- [x] 6.3 Expose optional catalog warming and download status. Verify progress and failure reporting, no generation while muted/browser-only or fetching a model offline, and usable text prompts when neither voice can play.

## 7. Install, update, and packaging

- [x] 7.1 Add the install manifest, icons, scoped worker, and complete offline shell. On a disposable `/keycraft/` path and at root, verify that the supported browser can install or open the manifest start URL, then finish a drill and export offline without a voice-model fetch.
- [x] 7.2 Stage coherent updates without interrupting an active drill or summary. Serve two disposable builds to verify safe activation, continued operation in another active tab, retention of saved progress, and fallback to the old generation when a required update asset fails.
- [x] 7.3 Cut over the local build and Pages workflow to the rebuilt artifact, keeping ChatGPT Sites as a separate static publication. Update local commands and hosting guidance. Lint the workflow and verify in a clean staging directory that a missing or escaped dependency blocks upload, stale files are excluded, and only a successful `main` build can deploy its own artifact. Do not push or change hosting settings for this check.

## 8. Cross-capability verification

- [x] 8.1 Use the built app on a disposable Pages-style origin. Complete the teaching example and a subsequent unaided guided round, play a fixed-key drill by a different input, inspect its score/history, complete the chart preview, and reload and export. Verify the supplied saves' distinct key histories survive and a cold Kokoro cache does not delay input or browser fallback.

## Workflow follow-up

- After an authorized release, verify the Pages URL and its install entry serve the same generation. Publishing to ChatGPT Sites remains separate.
- At archive, align the accepted guided-pacing Purpose with full-path mastery and resolve any synced legacy four-file Pages requirement as described in the migration plan.
