# Spec Delta

## Purpose

Give learners immediate access to any practice target and standalone difficulty without enrolling it in the guided curriculum.

## ADDED Requirements

### Requirement: Launch any curriculum scope directly
The Free Play catalog SHALL let the learner start any spelled key of a lesson, the full lesson across its keys, or a curriculum section across its lessons and keys, without mastery prerequisites. Fixed scopes SHALL override unrelated key and difficulty selections. Launching direct play SHALL leave the guided frontier unchanged.

#### Scenario: Play a locked lesson in a fixed key
- **WHEN** a new learner chooses E♭ harmonic minor directly
- **THEN** the app generates a ten-round drill in that exact lesson and spelling, updates its own progress, and preserves the note-only guided path

#### Scenario: Rotate a full lesson or section
- **WHEN** the learner presses Play for a whole lesson or a section with `N` lessons
- **THEN** an untimed drill generates 17 rounds per lesson, exactly one for each lesson/spelled-key pair
- **AND** iterate key slots in catalog order, interleaving lessons in section order and offsetting each lesson's root index by its index in the section (wrap at 17)

### Requirement: Offer standalone key focus and difficulty controls
Standalone mode runs SHALL allow a fixed one of the 12 canonical keys or Automatic key focus, and Foundation, Intermediate, or Jazz difficulty. The initial ready state SHALL be Chord Forge in C at Foundation in Practice. Settings changed during a standalone drill apply to future prompts and SHALL NOT reinterpret its current answer.

#### Scenario: Automatic key selection uses practice history
- **WHEN** a standalone prompt uses Automatic key focus
- **THEN** sample the canonical keys, favoring lower exposure and weaker first-try accuracy, and avoid an immediate root repeat when possible
- **AND** the key weight is `1 + 5/(1+attempts) + 4×errorRate`, using 0.4 for error rate with no attempts

#### Scenario: Fixed focus keeps the chosen center
- **WHEN** a learner changes a standalone drill to fixed F while answering a C prompt
- **THEN** the shown C prompt keeps its answer and next prompts use F as their key or tonal center

### Requirement: Preserve the standalone banks
The eight standalone modes SHALL use the following generation banks. Difficulty changes eligible music rather than changing scored answer rules. Curriculum drills use their own recipes regardless of the previous standalone setting.

#### Scenario: Generate a challenge from the selected bank
- **WHEN** a standalone drill generates its next challenge at the selected key and difficulty
- **THEN** choose only from the following banks, using the corresponding curriculum vocabulary

| Mode | Foundation | Intermediate | Jazz |
|---|---|---|---|
| `notes` | One of the seven major-scale degrees; any octave | Same | Same |
| `intervals` | Root is any major-scale degree; distances `2,3,4,5,7` | Same roots; distances `1–10` | Same roots; distances `1–12` |
| `scales` | Major | Major, natural minor, Dorian, Mixolydian | All six formulas, including harmonic and ascending melodic minor |
| `chords` | Major-scale diatonic triads: major, minor, minor, major, major, minor, diminished | Diatonic sevenths: maj7, m7, m7, maj7, dom7, m7, halfdim | Same as Intermediate |
| `inversions` | Diatonic triad; root, first, or second inversion | Same | Same |
| `guides` | Major ii–V–I; third and seventh per stage | Same | Same |
| `voicings` | Minor or dominant shell | Three rootless ninth/thirteenth options | Intermediate pool plus altered dominant |
| `cadence` | Full major ii–V–I | Same | Same |

### Requirement: Surface catalog practice status without locking Free Play
The learning path and Free Play catalog SHALL identify the active lesson and key and distinguish admitted focus, review, and upcoming material. The catalog SHALL expose its section, lesson, and spelled-key scores. Zero history or an upcoming guided status SHALL not disable a Free Play action.

#### Scenario: Inspect a section's progress
- **WHEN** a learner expands Scales and then Natural minor
- **THEN** show its lesson score, separate scores for all 17 spellings, and the section score as the mean of its member lesson scores, rounded to one decimal
- **AND** the root currently prompted is identifiable without relying on color
