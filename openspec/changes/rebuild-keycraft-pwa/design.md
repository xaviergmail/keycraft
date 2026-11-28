# Design

## Context

The legacy app is a static page with a shared script scope: curriculum recipes in `dist/lessons.js`, memory policy in `dist/curriculum.js`, and generation, input, scoring, and rendering in `dist/app.js`. `dist/neural-voice*.js` own the browser cache and synthesis worker. The Python builder and Pages workflow currently publish one HTML file and three generated assets. The historical handoff predates the current scheduler and Pages workflow; use it for rationale, not for current behavior.

## Goals / Non-Goals

**Goals:** Build a new client from these specs and logical fixtures alone. Keep music and policy testable outside the browser, browser adapters replaceable, and the app static and usable without cloud state.

**Non-Goals:** Port the shared JS globals or DOM tree, require a server, redesign visual styling, add new music lessons, or claim that pitch accuracy proves fingering, phrasing, or general musical mastery.

## Decisions

### 1. Use a small static TypeScript PWA

Default to Svelte, TypeScript, and Vite with npm and a lockfile. Use a scoped service worker (for example, Vite PWA with an explicit worker) and an install manifest; no SSR, router, account service, or external state library is necessary for one practice surface. The acceptance contracts do not depend on component names or framework syntax. Keep a single musical catalog with data-driven recipes; don't recreate a separate generator, example diagram, and prose answer key for each lesson.

Separate the pure music/generation, session, scoring, and scheduling functions from browser adapters for input, persistence, audio, and rendering. Type the prompt and event unions. A single active round owns its answer and input state; a distinct stage identity owns narration and delayed checks. Clock and randomness are ordinary inputs to policy functions so deterministic tests can drive every boundary. Do not copy the legacy code into the new source tree or require it as a test oracle.

### 2. Treat admission and recall as different state

Admission is an ordered path independent of activity in Free Play. Track live mastery from explicit classification at the lesson/key level; no old three-of-four shortcut remains. An admitted lesson exposes all its transpositions for coverage, and all supported spellings are required before the next admission. This reinstates the full breadth of the legacy proficiency metric at the path boundary; it deliberately gives up the earlier fast progression goal. A miss can block the next admission, not remove previously admitted work.

Choose focus from admitted deficits at presentation time, reserving review turns for already presented pairs of admitted lessons. Start a new scale in its catalog starter key. Reuse current half-life inputs for overdue selection and stable ordering, not as proof of mastery. A preview or direct Free Play is not a new admission. Check the gate at the summary's continuation action rather than interrupting a scored run with a lesson offer. Recheck when accepting. This gives every finished exercise its chart and playable continuation even if a gate became eligible mid-exercise.

### 3. Normalize input into one correct evaluation path

Use per-source note ownership and track fresh attacks separately from aggregate held notes. Leave held common tones available between stages, but never treat a stale note from a prior round, dialog, or preview as a fresh attack. Preserve the default computer-key layout and add register shifts to remove the single-octave dead end. Keep episode-scoped timers and score events idempotent; do not couple a render or speech callback to the authority to commit a result. The underlying pitch recipes drive scored rounds and both kinds of playable example. Audio and charts are consumers of results, not sources of them.

### 4. Migrate saved history without manufacturing evidence

Read and validate `keycraft-midi-arcade-v1` before writing. Retain legacy totals and maps and add explicitly versioned admission and classified mastery data under `curriculum`, separate from early-readiness state. Preserve recognized legacy item keys; match or alias when the old identity determines a unique current item. Legacy item IDs are serialized tuples `[lessonId, promptRootPc, intervalSemitones, targetPc, stages, scaleOffsets]`, with `null` for omitted fields and each stage `[orderedTonePcs, bassPc]`; a noncanonical spelling is a seventh field. If a legacy key lacked a discriminator that a new item needs, retain it as historical instead of guessing. Keep per-spelling legacy trace results and key accuracy separate. Any newly added counters with no historical source begin without observations.

For a valid `pacing`/`focus` anchor, restore the contiguous exposed prefix through it; a later Free Play result is not proof of prior guided admission. A migrated score can satisfy the score component of mastery, but old clean/learned/readiness flags are not replayed as unaided attempts. Keep the JSON export shape. The fixtures are synthetic and intentionally include non-matching and separately spelled records.

### 5. Never queue foreground speech behind synthesis

Keep Kokoro in one background worker with urgent prompt jobs and lower-priority warmup. When compatible, preserve `kokoro-js` 1.2.1, Kokoro-82M v1.0 ONNX in q8 WASM, `af_heart` at speed 1, and the versioned legacy clip keys. Start model work lazily on narration or explicit warmup, not as a prerequisite for the shell. Read a matching ready clip with a bounded cache lookup, then use browser TTS on a miss; never await an in-flight generation promise for active speech. Revoke obsolete audio and ignore stale callbacks. A hung worker job may be terminated at 120 seconds; a foreground playback watchdog releases the clock after `max(12 s, 120 ms × text length)` if no completion arrives. Use native speech or text when audio cannot play. Cache downloads are optional, not part of offline readiness.

### 6. Publish one build generation per host

Initially develop the new app without rebuilding over the legacy `dist/` source tree. Move the build to a clean, generated `dist/` at cutover, leaving `.openai/hosting.json`'s publish root and project identity intact. Keep all site references within the resolved deployment path. Precache the complete same-generation shell and activate a verified update only at a safe boundary. Validate the full local build closure before upload, including worker, manifest, and offline dependencies. The existing `deploy-to-github-pages` change describes the legacy four-file package; `pwa-release` specifies its replacement artifact, while retaining exact-SHA builds, main-only deploys, serial publication, and least-privilege job permissions. Keep ChatGPT Sites publishing a separate action on built static output.

### Contract index

- **Music:** [`curriculum-catalog`](specs/curriculum-catalog/spec.md), [`guided-drills`](specs/guided-drills/spec.md), [`free-play`](specs/free-play/spec.md).
- **Practice loop:** [`performance-input`](specs/performance-input/spec.md), [`guided-practice-pacing`](specs/guided-practice-pacing/spec.md), [`session-modes`](specs/session-modes/spec.md), [`exercise-continuation`](specs/exercise-continuation/spec.md).
- **Learning and records:** [`lesson-support`](specs/lesson-support/spec.md), [`performance-feedback`](specs/performance-feedback/spec.md), [`curriculum-scoring`](specs/curriculum-scoring/spec.md), [`exercise-history`](specs/exercise-history/spec.md), [`progress-milestones`](specs/progress-milestones/spec.md), [`local-progress`](specs/local-progress/spec.md).
- **Platform:** [`spoken-prompts`](specs/spoken-prompts/spec.md), [`installable-web-app`](specs/installable-web-app/spec.md), [`pwa-release`](specs/pwa-release/spec.md).

### Fixture inputs

[`acceptance.json`](fixtures/acceptance.json) supplies musical inputs, timing boundaries, and representative gate, review, and speech cases. The two referenced legacy JSON files are synthetic raw values for `keycraft-midi-arcade-v1`, not export envelopes. Seed them on a disposable origin at the fixture's fixed clock and time zone; inspect the first selected prompt, reload the migrated save, and compare the exported data with the fixture expectations.

## Risks / Trade-offs

- Full mastery takes more repetition → make the deficient lesson/key clear, use due review and exposure-aware selection, and keep all Free Play scopes reachable.
- A MIDI permission prompt, missing voice, or first model download varies by browser → test the request and fallback paths, not an assumed permission dialog or voice service.
- Correctness fixes change legacy edges → explicitly test assisted evidence, overlap and disconnect, retained guide tones, and local-day rollover. Preserve the saved outcomes rather than copying bugs into the new code.
- A service worker or rollback can leave old clients and future builds coexisting → retain compatible save fields and explicit cache generations; never clear progress as part of shell maintenance.

## Migration Plan

1. Hand the fresh implementation session this change directory, including the fixtures, not a copy of the old source. Build and test the new app on a disposable origin and Pages-style subpath, including seeded v1/v2 saves.
2. At implementation cutover, switch the local build and Pages staging to the whole new static artifact together. Validate actual deployed behavior only on an authorized release. Keep the public origin and existing progress key stable; rollback uses a previously working coherent build, not a forced storage clear.
3. On approval and archive of the rebuild, update the existing `guided-practice-pacing` main spec's Purpose separately to say it reinforces admitted material and gates new lessons on full-path mastery. The delta replaces the old normative early-readiness requirement; OpenSpec does not replace an established Purpose from a delta.
4. If the legacy Pages delta is synced before the rebuild is archived, reconcile its Python-builder and four-file rules with `pwa-release` at rebuild cutover. Keep the earlier change as history of the legacy release; it is not a second packaging contract for the PWA.
