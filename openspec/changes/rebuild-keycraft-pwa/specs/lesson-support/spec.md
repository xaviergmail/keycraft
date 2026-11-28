# Spec Delta

## Purpose

Explain the theory behind a challenge, provide a safe place to work through an example, and distinguish aided practice from independent recall.

## ADDED Requirements

### Requirement: Teach new concepts with a playable example
A curriculum lesson SHALL offer a worked introduction at first exposure, per lesson for non-scales and per spelled lesson/key for scales. Its first guided admission SHALL also receive an introduction if the lesson was only seen in Free Play. Show the rule, the named notes or stages, and a playable example with a Continue option.

#### Scenario: Play through or dismiss a first-exposure example
- **WHEN** a learner opens an unintroduced scale key
- **THEN** the teaching dialog shows the scale formula and a playable ordered octave
- **AND** either correct example play or Continue (including keyboard dismissal) closes it and starts the scored prompt's normal input and narration lifecycle
- **AND** the example itself awards nothing, and the subsequent scored answer to that displayed example is classified as assisted if free of errors

### Requirement: Offer a refresher when a prior concept has faded
A curriculum lesson/key with recorded material SHALL receive a refresher when an answer postdates its last explanation, at least 24 hours have elapsed since the explanation, at least two of its last eight recalled results were misses, and retention is below 0.25. Persist the new explanation time so the same trigger does not immediately repeat.

#### Scenario: Repeated struggles after a break get a refresher
- **WHEN** a due D minor key meets every refresher condition
- **THEN** show a labeled refresher for that key, not a fresh lesson enrollment or an independent attempt
- **AND** a different scale key uses its own evidence; mere elapsed time without the required missed recalls is insufficient

### Requirement: Keep manual and timed help explicit
Every scored challenge SHALL allow Show hint and Hide hint. Showing a hint SHALL explain the construction rule and expose its labeled worked notes or example, including a scale diagram. Track a manual reveal even if hidden later. Unscheduled rounds SHALL show the automatic hint after six seconds of inactivity; scheduled scored rounds SHALL never reveal an answer on a timer.

#### Scenario: Use a hint without earning mastery
- **WHEN** the learner opens and closes a manual hint, or an automatic answer hint appears in Free Play, then clears the prompt
- **THEN** the answer is assisted for mastery; a manual reveal also carries the shown points/XP discount
- **AND** a scheduled learner who waits more than six seconds without requesting help still has an independent recall opportunity

### Requirement: Explain the active idea in the Theory Lens
The Theory Lens SHALL show a concise concept explanation for the actual current prompt using the catalog's teaching focus: interval distance, scalar steps, chord degrees and inversion, chord function, or guide tones and extensions. Keep exact worked answers separate until a hint, worked example, or scored feedback intentionally reveals them.

#### Scenario: Show theory without leaking the next answer
- **WHEN** a live interval prompt asks for C plus a perfect fourth before a reveal
- **THEN** the lens explains five semitones or one above a major third, rather than printing the target F as the worked result
- **AND** a revealed answer can show the derivation and F; the next unassisted round does not inherit the previous reveal
