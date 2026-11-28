# Spec Delta

## Purpose

Define the complete KeyCraft curriculum and the musical vocabulary needed to generate its lessons without the legacy application source.

## ADDED Requirements

### Requirement: Preserve the ordered lesson catalog
The app SHALL provide the 39 lessons below in ten ordered sections. IDs are case-sensitive, stable across builds, and independent of labels. The mode and recipe identify each lesson's challenge family, not its UI presentation. Starter keys order initial guided practice; they do not limit key coverage.

#### Scenario: Enumerate the curriculum
- **WHEN** the learner opens the learning path or Free Play catalog
- **THEN** it contains exactly the following lessons in the listed order with their stated musical content

| Section | Lesson ID | Lesson | Mode | Recipe and teaching focus |
|---|---|---|---|---|
| 1. Find your way around the keyboard | `notes` | Find a note by name | `notes` | Named tonic; groups of two and three black keys, C anchor, sharps and flats |
| 2. Intervals | `m2` | Minor second | `intervals` | 1 semitone, degree 2; adjacent keys |
| 2 | `M2` | Major second | `intervals` | 2 semitones, degree 2; whole step |
| 2 | `m3` | Minor third | `intervals` | 3 semitones, degree 3; whole step plus half step |
| 2 | `M3` | Major third | `intervals` | 4 semitones, degree 3; two whole steps |
| 2 | `P4` | Perfect fourth | `intervals` | 5 semitones, degree 4; one half step beyond major third |
| 2 | `P5` | Perfect fifth | `intervals` | 7 semitones, degree 5; whole step beyond perfect fourth |
| 3. Chords - Triads | `major-triad` | Major triad | `chords` | `major`; stacked major then minor third |
| 3 | `minor-triad` | Minor triad | `chords` | `minor`; lower the third of the major triad |
| 4. Scales | `major` | Major scale | `scales` | `major`, starter C; whole/half-step pattern |
| 4 | `natural-minor` | Natural minor scale | `scales` | `minor`, starter A; low 3, 6, and 7 versus major |
| 4 | `harmonic-minor` | Harmonic minor scale | `scales` | `harmonic`, starter A; raise natural minor's 7 |
| 4 | `melodic-minor` | Ascending melodic minor | `scales` | `melodic`, starter A; raise natural minor's 6 and 7 |
| 5. Suspended chords and inversions | `diminished` | Diminished triad | `chords` | `diminished`; lower minor's fifth |
| 5 | `sus2` | Suspended second | `chords` | `sus2`; replace the third with degree 2 |
| 5 | `sus4` | Suspended fourth | `chords` | `sus4`; replace the third with degree 4 |
| 5 | `inversion-1` | First inversion | `inversions` | Major, minor, or diminished triad; its third must be lowest |
| 5 | `inversion-2` | Second inversion | `inversions` | Major, minor, or diminished triad; its fifth must be lowest |
| 6. Extended intervals | `P8` | Octave | `intervals` | 12 semitones, degree 8; same pitch class in next octave |
| 6 | `A4` | Tritone | `intervals` | 6 semitones, degree 4; halfway to octave |
| 6 | `m6` | Minor sixth | `intervals` | 8 semitones, degree 6; fifth plus half step |
| 6 | `M6` | Major sixth | `intervals` | 9 semitones, degree 6; fifth plus whole step |
| 6 | `m7-interval` | Minor seventh | `intervals` | 10 semitones, degree 7; whole step below octave |
| 6 | `M7` | Major seventh | `intervals` | 11 semitones, degree 7; half step below octave |
| 7. Seventh chords and cadences | `major-seventh` | Major seventh chord | `chords` | `maj7`; major triad plus major seventh |
| 7 | `minor-seventh` | Minor seventh chord | `chords` | `m7`; minor triad plus minor seventh |
| 7 | `dominant-seventh` | Dominant seventh chord | `chords` | `dom7`; major triad plus minor seventh, tritone tension |
| 7 | `half-diminished` | Half-diminished seventh chord | `chords` | `halfdim`; diminished triad plus minor seventh |
| 7 | `cadence` | Connect a major two–five–one | `cadence` | Major ii–V–I; complete chords |
| 7 | `guides` | Lead two voices through a cadence | `guides` | Major ii–V–I; only thirds and sevenths, retain common tones |
| 8. Phrase over changing harmony | `dorian` | Dorian over a minor seventh | `scales` | `dorian`, starter D; minor with natural sixth |
| 8 | `mixolydian` | Mixolydian over a dominant seventh | `scales` | `mixolydian`, starter G; major with flat seventh |
| 8 | `targets` | Land a phrase on a guide tone | `notes` | Third or seventh of ii, V, or I; the target pitch only is assessed |
| 9. Voice an advanced jazz cadence | `shells` | Comp with guide-tone shells | `voicings` | Dominant and minor shells; omit root |
| 9 | `rootless` | Add ninths and thirteenths | `voicings` | Rootless dominant 13, minor 9, or major 9 |
| 9 | `altered` | Create tension on an altered dominant | `voicings` | Rootless altered dominant; flat ninth and flat thirteenth |
| 10. Apply harmony to a jazz progression | `minor-cadence` | Resolve a minor two–five–one | `cadence` | Minor ii–V–i; resolve to a minor triad |
| 10 | `turnaround` | Connect a one–six–two–five turnaround | `cadence` | Imaj7–VI7–iim7–V7 |
| 10 | `tritone-sub` | Resolve a tritone substitute | `cadence` | ii–♭II7–Imaj7; substitute shares dominant guide-tone pitch classes |

### Requirement: Distinguish note spelling from sounding pitch
The curriculum SHALL expose 17 spelled roots for each lesson, with separate histories for enharmonic spellings. Spell by named musical degree before converting to pitch class. From tonic letter, advance degree minus one letters cyclically and choose the nearest signed accidental that yields tonic pitch plus the recipe's offset. Compare sounding pitches, not spelling, in the input evaluator.

#### Scenario: Enumerate note names and key order
- **WHEN** a lesson lists its keys
- **THEN** the ordered set is `C C# D D# E F F# G G# A A# B Db Eb Gb Ab Bb` (C = 0; the first twelve are chromatic; flats map to `1 3 6 8 10` respectively)
- **AND** standalone difficulty modes and unscoped continuation use the 12 canonical centers in order `C G D A E B F# Db Ab Eb Bb F`

#### Scenario: Play a correctly spelled enharmonic scale
- **WHEN** a G♯ major scale is requested
- **THEN** its displayed tones are G♯, A♯, B♯, C♯, D♯, E♯, F𝄪, G♯; B♯ and F𝄪 accept physical C and G keys at the requisite octaves
- **AND** no result is written into the A♭ major record

### Requirement: Define octave scale and chord formulas
The app SHALL use these relative semitone offsets for scales and degree-offset pairs for chord tones. Scale steps include the closing tonic. Use offsets for octave-specific melodies and their pitch classes for stacked harmonies.

#### Scenario: Evaluate every scale formula
- **WHEN** a scale chart or prompt is generated
- **THEN** it uses the corresponding ascending formula below, where the position in the sequence is degree 1 through 8

| Formula | Semitones from tonic |
|---|---|
| `major` | `0 2 4 5 7 9 11 12` |
| `minor` | `0 2 3 5 7 8 10 12` |
| `dorian` | `0 2 3 5 7 9 10 12` |
| `mixolydian` | `0 2 4 5 7 9 10 12` |
| `harmonic` | `0 2 3 5 7 8 11 12` |
| `melodic` | `0 2 3 5 7 9 11 12` |

#### Scenario: Evaluate every chord quality
- **WHEN** a chord is requested or used as a progression stage
- **THEN** it uses the corresponding symbol suffix and ordered `degree:semitones` recipe below

| Quality ID | Suffix | Tone pairs |
|---|---|---|
| `major` | (none) | `1:0 3:4 5:7` |
| `minor` | `m` | `1:0 3:3 5:7` |
| `sus2` | `sus2` | `1:0 2:2 5:7` |
| `sus4` | `sus4` | `1:0 4:5 5:7` |
| `diminished` | `dim` | `1:0 3:3 5:6` |
| `maj7` | `maj7` | `1:0 3:4 5:7 7:11` |
| `m7` | `m7` | `1:0 3:3 5:7 7:10` |
| `dom7` | `7` | `1:0 3:4 5:7 7:10` |
| `halfdim` | `m7♭5` | `1:0 3:3 5:6 7:10` |

### Requirement: Define progression and rootless recipes
The app SHALL use the ordered progression stages and voicing entries below. Progression roots are spelled from the center's degree and offset, then stage tones from the chord's root. In guide-tone progressions play only the stage's third and seventh; in cadence lessons play the whole stage.

#### Scenario: Generate progressions in C and transpose them
- **WHEN** the progression is generated in any center
- **THEN** use its ordered `degree:semitones:quality` recipe; at center C the chord labels match the examples below

| Recipe | Stage definitions | C example |
|---|---|---|
| Major ii–V–I (`cadence`, `guides`, `targets` source) | `2:2:m7 5:7:dom7 1:0:maj7` | Dm7 → G7 → Cmaj7 |
| `minor-cadence` | `2:2:halfdim 5:7:dom7 1:0:minor` | Dm7♭5 → G7 → Cm |
| `turnaround` | `1:0:maj7 6:9:dom7 2:2:m7 5:7:dom7` | Cmaj7 → A7 → Dm7 → G7 |
| `tritone-sub` | `2:2:m7 2:1:dom7 1:0:maj7` | Dm7 → D♭7 → Cmaj7 |

#### Scenario: Generate shell, extension, and altered voicings
- **WHEN** a voicing shape is selected
- **THEN** the following roots (degree of the major center) and `degree:semitones` pairs determine its sounding notes without the root

| Shape | Root degree | Tone pairs | C-center note names |
|---|---:|---|---|
| Dominant shell | 5 | `3:4 7:10` | B, F |
| Minor shell | 2 | `3:3 7:10` | F, C |
| Rootless dominant 13 | 5 | `3:4 7:10 9:14 13:21` | B, F, A, E |
| Rootless minor 9 | 2 | `3:3 7:10 9:14 5:7` | F, C, E, A |
| Rootless major 9 | 1 | `3:4 7:11 9:14 5:7` | E, B, D, G |
| Rootless altered dominant | 5 | `3:4 7:10 9:13 13:20` | B, F, A♭, E♭ |

### Requirement: Retain eight standalone mode identities
The app SHALL retain the eight named standalone modes. Lessons reuse those scoring categories; a chord quality, selected scale, or difficulty does not create a new standalone mode.

#### Scenario: List the standalone modes
- **WHEN** a learner chooses a standalone drill
- **THEN** the choices are Note Dash (`notes`), Interval Hunter (`intervals`), Scale Sprint (`scales`), Chord Forge (`chords`), Inversion Lab (`inversions`), Guide-Tone Glide (`guides`), Voicing Studio (`voicings`), and Cadence Quest (`cadence`)
