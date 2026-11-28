# Spec Delta

## Purpose

Show what happened in the completed exercise and how the tested curriculum groups have changed across recent exercises.

## ADDED Requirements

### Requirement: Summarize each finished run exactly once
A finished exercise SHALL show clears out of planned rounds, best combo, run points, XP earned in scored rounds, and accuracy. Accuracy is the rounded percentage `clears/(clears+errors)`, or zero with no judgments. If eligible timed rounds exist, show average response time in seconds to two decimals and its sample count. Persist the best run score for its scope.

#### Scenario: Show a mixed result
- **WHEN** a run finishes with eight clears, two mistakes or skips, and eligible timings of 800 ms and 1,200 ms
- **THEN** show 80% accuracy and a 1.00-second average across two timed rounds, along with actual score, combo, and earned XP
- **AND** one run finishing event creates one summary; an unfinished abandonment does not create one
- **AND** the error count includes each judged mistake and skip, including mistakes in a round that ultimately cleared; preview actions do not count

#### Scenario: Compare scores in their existing scope
- **WHEN** a learner finishes a standalone, curriculum, or branch exercise
- **THEN** retain the greatest score for its scope; use distinct Practice and Arcade scores for standalone modes, lesson identity for curriculum runs and branch identity for branch runs
- **AND** a scheduled drill uses its starting focus for its best-score scope, even when other lessons are reviewed; chart series still reflect the lessons actually presented

### Requirement: Persist chart snapshots rather than recomputing the past
Each finished exercise SHALL append a consecutively numbered row with its scope label, accuracy, a snapshot of every curriculum lesson's score, and the lesson IDs presented during the run. Keep the latest ten, oldest to newest. Missing legacy snapshot data SHALL not be invented or rewritten after later practice.

#### Scenario: New practice cannot change old points on the chart
- **WHEN** exercise 11 finishes after exercises 1–10 were saved
- **THEN** history contains ordered exercises 2–11 with the prior nine snapshots unchanged, including after reload

### Requirement: Show tested group series and accessible values
The history chart SHALL show only the curriculum groups represented by lessons in the most recently completed exercise. For each retained snapshot, plot each selected group's mean member lesson score, treating an unpracticed member as zero and rounding to one decimal. Provide equivalent numbered values in accessible text. Show an explicit no-tested-group state when appropriate.

#### Scenario: Choose labeled series from the latest exercise
- **WHEN** the most recent exercise presented `sus4` and `guides` and no other lessons
- **THEN** draw Suspended chords and Cadence only, use the same values in the readable chart details, and omit rows without a saved score snapshot
- **AND** a standalone run that tested no catalog lesson shows the empty group state, not misleading zero-valued series

#### Scenario: Use the existing analytical groups
- **WHEN** mapping tested lesson IDs to chart series
- **THEN** use the following named groups and member IDs

| Group | Lesson IDs |
|---|---|
| Note recognition | `notes` |
| Intervals | `m2 M2 m3 M3 P4 P5` |
| Major triads | `major-triad` |
| Minor triads | `minor-triad` |
| Major scale | `major` |
| Natural minor scale | `natural-minor` |
| Harmonic minor scale | `harmonic-minor` |
| Melodic minor | `melodic-minor` |
| Diminished triads | `diminished` |
| Suspended chords | `sus2 sus4` |
| Chord inversions | `inversion-1 inversion-2` |
| Extended intervals | `P8 A4 m6 M6 m7-interval M7` |
| Seventh chords | `major-seventh minor-seventh dominant-seventh half-diminished` |
| Cadence | `cadence guides` |
| Phrasing | `dorian mixolydian targets` |
| Advanced voicing | `shells rootless altered` |
| Jazz harmony | `minor-cadence turnaround tritone-sub` |
