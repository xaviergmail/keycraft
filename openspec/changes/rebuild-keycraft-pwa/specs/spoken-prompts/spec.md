# Spec Delta

## Purpose

Narrate the current exercise without making a learner wait for voice-model startup, synthesis, or a browser audio permission decision.

## ADDED Requirements

### Requirement: Narrate the shown exercise and stage
When enabled, narration SHALL describe the current scored prompt, each new progression stage, and the playable continuation. Scored narration SHALL wait until a worked teaching dialog closes. Replay SHALL narrate the current live exercise or continuation on user action, never a superseded prompt, and SHALL not reveal an otherwise hidden answer.

#### Scenario: Replaying a guide-tone target
- **WHEN** the prompt asks for the seventh of a minor seventh chord on A♭
- **THEN** audio names A-flat, the chord quality, and the requested seventh rather than saying the answer pitch; Replay speaks that same current request
- **AND** distinguish accidentals and speak the letter A intelligibly in both engines

### Requirement: Default to background Kokoro with deadline fallback
Spoken prompts SHALL default to on when an engine exists unless a saved preference disables them. Use Kokoro by default with browser fallback. Play a ready matching clip; on a miss, try browser speech without waiting for generation. Allow at most 100 ms for a cached-clip lookup, never a grace period for inference. Generate missing clips independently of playback.

#### Scenario: Render a warm clip without starting the model
- **GIVEN** a matching Kokoro clip is already available in memory or the on-device cache by the lookup deadline
- **WHEN** the learner reaches or replays that prompt in Kokoro mode
- **THEN** play the cached clip without loading the model to reproduce it

#### Scenario: Cold or slow cache
- **GIVEN** no clip is ready, the cache lookup exceeds its budget, or the synthesis queue is busy
- **WHEN** the prompt is presented
- **THEN** use browser speech by the cache deadline if available and request missing neural audio in the background
- **AND** do not interrupt or duplicate a running fallback when the clip arrives; later playback of that prompt can use the new clip

#### Scenario: Recover from a broken cached clip
- **WHEN** a matching clip is ready but fails to play for a reason other than missing user activation
- **THEN** release its playback clock hold and try browser speech for the same active prompt once if available; do not repeat the fallback on a later callback from the failed clip

#### Scenario: Neither engine can start
- **WHEN** the requested clip is unavailable and browser speech is missing or fails, or autoplay requires activation
- **THEN** keep the playable text prompt and an actionable voice status; offer Replay after a user gesture or when audio becomes available, without blocking input or retrying playback in a loop

### Requirement: Prepare and reuse audio in the background
Kokoro synthesis SHALL run off the UI thread, prioritize the current and likely next requests over catalog warming, and deduplicate pending work by exact clip identity. A warmup option SHALL prepare the full reachable narration catalog in the background with progress, skipping already cached clips. Model downloads, a failed clip, or unavailable storage SHALL not halt drills or other speech.

#### Scenario: Warm upcoming stages without picking the next drill early
- **WHEN** the current round is partway through a progression or a next prompt is predictable
- **THEN** the app can prepare that text without committing a future score target; only the actual active text can play when it is shown

#### Scenario: Warm the catalog or recover a worker
- **WHEN** the learner starts warming clips and a generation fails or times out
- **THEN** audio preparation reports useful progress or failure without failing the exercise; a bad job does not prevent later clips from being prepared
- **AND** report the model download cost before starting explicit catalog warmup; warmup does not auto-play clips

### Requirement: Reuse compatible versioned voice clips
Kokoro clips SHALL be keyed by engine/model version, voice, speed, and normalized prompt text and stored on the current origin. Reuse the legacy `keycraft-prompt-audio` IndexedDB `clips` store and compatible keys when the same voice configuration is used. A different rendering configuration MUST NOT replay a mismatched cached clip.

#### Scenario: Preserve a compatible legacy clip
- **WHEN** a save supplies the legacy JSON tuple `['kokoro-js@1.2.1/kokoro-82m-v1.0-onnx/q8', 'af_heart', 1, 'Eh flat minor third.']` as a cache key (serialized as JSON with double quotes and no extra whitespace)
- **THEN** use that clip for the same Kokoro rendering of A♭ minor third without a second network download
- **AND** normalize the browser utterance to speak the letter A, not the Kokoro pronunciation token

### Requirement: Persist voice preferences and guard playback lifecycle
Allow spoken prompts on/off, explicit Browser voice or Kokoro when supported, and Replay. Save the settings independently of progress. Leaving a stage, replacing a run, muting, or changing engine SHALL cancel or invalidate old playback. Pause the active response clock only for actual prompt narration, not background work, and release it on completion, error, or a bounded watchdog.

#### Scenario: Change prompt during speech
- **WHEN** a learner skips or changes drill before cache lookup or audio ends
- **THEN** stop obsolete audio, ignore old callbacks, and release its clock hold; a late clip can populate the cache but cannot speak for the new prompt

#### Scenario: Retain an explicit browser-only preference
- **WHEN** the learner chooses Browser voice, mutes, or reloads
- **THEN** retain saved preferences, skip Kokoro generation while disabled or browser-only, and keep visual text usable without either engine
