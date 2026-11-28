# Spec Delta

## Purpose

Keep KeyCraft playable without an account and carry verifiable browser-local progress into the rebuilt app without silently resetting or inflating it.

## ADDED Requirements

### Requirement: Preserve same-origin progress with stable identifiers
The rebuilt app SHALL read the existing `keycraft-midi-arcade-v1` local save at the same origin and persist completed updates there in a versioned, backward-readable shape. Preserve XP, totals, high scores, key/mode stats, lesson and item IDs, timestamps, response times, badges, daily claim state, guided position and cooldown, and up to ten historical snapshots. Keep cached voice and voice preferences separate.

#### Scenario: Migrate a previous course and keep its scores
- **GIVEN** a valid `curriculum.courseV2` save with lesson (`concepts`), key (`rootTraces` or older `roots`), variant (`items`), and `pacing` or older `focus` records
- **WHEN** the rebuild loads it on the same origin
- **THEN** retain the lesson scores, spelled roots, item records, recent results, explanation and recall timestamps, historical charts, and timing/retention inputs
- **AND** preserve explicit legacy `points`; where only boolean `recent` exists, initialize visible score as `min(100, cleanCount × 100/8)`; retain original history when its identity is ambiguous
- **AND** keep legacy fields that the prior app can still read, including existing `bestScores` keys and `freeDrills` metadata; write classified outcomes separately rather than inserting them into legacy boolean arrays

#### Scenario: Preserve independently selected speech settings
- **WHEN** the user had previously saved `keycraft-spoken-prompts` or `keycraft-voice-engine`
- **THEN** retain `on` or `off` and explicit `browser` or `neural` preferences if usable; a saved mute is not turned on by migration

### Requirement: Migrate older grouped curriculum records without guesses
When no `courseV2` is present, the app SHALL also recognize older per-lesson and legacy interval-group histories. Carry forward chronological results and known keys from finite `lastPracticed` timestamps, use the original lesson IDs and interval semitone keys, and do not create per-key evidence when the source does not identify a key.

#### Scenario: Split an older interval group by actual distance
- **WHEN** a save contains `curriculum.seconds` with `intervalHistory` entries for distances 1 and 2
- **THEN** map distance 1 to `m2` and distance 2 to `M2` independently, preserving their separate chronological results at each recognized spelled root
- **AND** the other groups are `thirds` for 3/4, `perfect-intervals` for 5/7, `sixths` for 8/9, `seventh-intervals` for 10/11, and `tritone-octave` for 6/12; prefer a stored per-lesson entry when present
- **AND** in the migrated legacy score trace use up to the newest ten boolean results, ordered by source time, with the latest source timestamp as the legacy answered/presented date

### Requirement: Restore the guided frontier conservatively
Persist the explicit ordered guided admissions, focused lesson/key, and any active cooldown. For a legacy save use a valid `pacing` focus or older `focus` as a migration anchor; reconstruct only the contiguous presented prefix up to that anchor. Without a usable anchor keep the default note-recognition path. Legacy flags, histories without assistance provenance, and XP SHALL NOT certify full mastery.

#### Scenario: Do not silently enroll independently played material
- **GIVEN** a legacy save records every lesson through Major scale, a saved focus on its D key, and unrelated Tritone substitute practice
- **WHEN** the rebuild first opens the guided path
- **THEN** restore the prefix through Major scale and the saved D focus for its first eligible focus prompt; preserve the later result outside the guided path
- **AND** if an earlier lesson has no trace, stop the inferred prefix at that gap (with note recognition always admitted) and preserve score data beyond the gap for future admission or Free Play
- **AND** existing traces and `pacing.outcomes` remain available as history but cannot meet all the new mastery evidence requirements without classified attempts

### Requirement: Continue playing when storage is unavailable
The app SHALL recover independently from corrupt or unsupported save data and storage read/write failures. Use usable fields when possible and maintain a playable in-memory session otherwise. Explain if progress cannot be saved. An unsuccessful migration SHALL not erase the previous saved value. No account or network service is required for practice, scoring, or export.

#### Scenario: Storage blocked or a save is unreadable
- **WHEN** local storage throws or cannot decode a previous save
- **THEN** initialize playable state, make progress for this page session, and allow export of readable in-memory data without pretending it was persisted
- **AND** a reload does not claim missing legacy records were migrated

### Requirement: Export usable browser-local progress
Export progress SHALL download JSON as `keycraft-progress-YYYY-MM-DD.json`, using the local calendar date in the file name and the envelope `{exportedAt, application: "Keycraft", progress}`. Include current progress and migrated histories, not audio blobs or transient held notes. Explain that browser storage is origin-local; exporting is a backup, not automatic cross-host migration.

#### Scenario: Check the exported score by spelled key
- **WHEN** the learner plays C and D natural minor and exports from the rebuilt app
- **THEN** the envelope uses an ISO timestamp and the `progress` data contains both separate key histories along with the saved guided state and exercise scores
- **AND** moving from ChatGPT Sites or localhost to Pages without a shared origin does not make that data appear there automatically
