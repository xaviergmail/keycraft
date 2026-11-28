# Spec Delta

## Purpose

Make it clear what to play, what the app heard, and what happened without depending on visual styling, audio, or pointing alone.

## ADDED Requirements

### Requirement: Make the current prompt and progress legible
The active drill SHALL identify the mode, lesson and key where applicable, requested action, round index and total, and when applicable the stage, budget, and remaining lives. Show current score and combo. Display progress through a scale or chord sequence without revealing unplayed scale notes before a hint.

#### Scenario: Track scale and cadence progress
- **WHEN** the learner correctly plays the first two notes of a scale without help
- **THEN** identify the played degrees and next position while unreached notes remain represented by step numbers
- **AND** on a cadence show the ordered chord/stage labels and current and completed stages

### Requirement: Reflect live notes and useful error feedback
The app SHALL show the last played note, currently held notes with absolute octave names, active input availability, and wrong-note or wrong-bass feedback where applicable. A scale restart, interval root/offset mistake, wrong inversion, skip, and clean or recovered completion SHALL produce distinct, readable outcomes.

#### Scenario: Explain a bass error and a recovery
- **WHEN** the learner plays the correct pitch classes with the wrong lowest pitch, then corrects the bass
- **THEN** explain that the bass, not the notes, is wrong and report recovery rather than an unaided clear
- **AND** clearing the round shows the actual points, XP, and scoped curriculum score where one was affected

#### Scenario: Inspect global key accuracy
- **WHEN** the learner opens Accuracy by key
- **THEN** show each canonical key's first-try numerator, attempts, and rounded percentage, or not yet practiced, separately from lesson-by-key scores
- **AND** identify a strong key at four or more attempts and at least 80% first-try accuracy without using color as the only signal

### Requirement: Make controls diagrams and dialogs accessible
Use focusable, named controls for drill actions, settings, virtual keys, and example keys. Expose latch or pressed state, current step, and progress in text or accessible semantics. Teaching and advancement dialogs SHALL be operable by keyboard, expose their purpose, allow the documented dismissal, and restore useful focus when closed. Status announcements SHALL avoid reading every note update as a new prompt.

#### Scenario: Complete the flow without color or speech
- **WHEN** a keyboard or screen-reader user opens an example, dismisses or plays it, and proceeds to a scored challenge
- **THEN** they can identify its notes/formula, chosen controls, errors, and result without using color, spoken narration, or pointer-only interactions
- **AND** chart values are available as readable data even when the visual chart is inaccessible
