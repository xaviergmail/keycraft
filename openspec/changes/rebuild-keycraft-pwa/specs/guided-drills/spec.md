# Spec Delta

## Purpose

Generate playable, correctly spelled music challenges from a practice scope and evaluate them the same way on every supported input.

## ADDED Requirements

### Requirement: Generate playable drills without a prepared list
Starting a drill SHALL select and present challenges from its lesson, spelled key, branch, or standalone settings. It SHALL derive targets, instructions, diagram, answer feedback, and narrated text from the same selection. The scheduler SHALL use committed outcomes when choosing a guided round and SHALL keep the target stable while it is being answered.

#### Scenario: Honor the selected scope
- **WHEN** a learner launches a D natural minor lesson/key drill
- **THEN** the app generates successive D natural minor ascending scales, with the D spelling used for score attribution; it never substitutes D major or another minor key to avoid repetition

#### Scenario: Vary available challenges
- **WHEN** a drill scope permits more than one equivalent next root or target
- **THEN** avoid repeating the immediate root or target where a legal alternative of comparable scheduling priority exists
- **AND** choose from the recipe's variants, favoring less-tested items when priorities otherwise match; repeat when fixed scope or required coverage makes it appropriate

#### Scenario: Narrate the prompt that actually won scheduling
- **WHEN** the just-completed result changes what the current guided policy selects next
- **THEN** show and score the newly selected prompt and never narrate a discarded speculative prompt

### Requirement: Generate the correct family for each lesson
The app SHALL generate note, interval, scale, simultaneous stack, and multi-stage stack challenges from the catalog. A prompt SHALL identify the root or harmonic context and the requested operation without exposing unplayed answers through its ordinary prompt. The explicit teaching, hint, and continuation surfaces can reveal answers.

#### Scenario: Match a named note or a harmonic target
- **WHEN** the lesson is note recognition, request the named tonic
- **THEN** a note of that pitch class in any playable octave clears it
- **AND** for `targets`, select a chord from the major ii–V–I at the selected center and ask for either its third or seventh; the correct pitch clears it without requiring a timed phrase or progression performance

#### Scenario: Generate inversion and rootless variants
- **WHEN** an inversion lesson is selected
- **THEN** choose from major, minor, and diminished triads at its selected root, require the lesson's specified bass, and label the inversion
- **AND** shell, rootless, and altered lessons select only their respective catalog shapes, with the requested chord root omitted from the answer

### Requirement: Check anchored intervals by absolute distance
An interval round SHALL accept a valid root in any usable octave, then its exact upper semitone distance, either sequentially or held together. An upper note that cannot be an anchor gets 100 ms to pair with the correct root while still held. Replaying an accepted anchor is not an error. For an octave, striking the lower note while an upper anchor is held can also pass.

#### Scenario: Grace for simultaneous interval attacks
- **WHEN** the prompt is C plus a major third, E4 is pressed first, and C4 arrives within 100 ms while E4 is still held
- **THEN** accept the pair; if the grace expires or the exact high note is not held, give root guidance rather than accepting only a matching pitch class

#### Scenario: Exact octave and attainable anchors
- **WHEN** the prompt is D plus an octave
- **THEN** D4 followed by D5 passes; D4 followed by D6 does not
- **AND** holding D5 and then striking D4 passes the two-note octave; an anchor with no attainable higher partner gets explicit register guidance unless it completes a valid held octave pair

### Requirement: Check an ascending octave from one anchor
A scale round SHALL accept the tonic in any octave that leaves room for the full scale, then require the exact ordered absolute offsets through the next tonic. A wrong note or impossible starting register SHALL reset only that scale to its tonic and explain where to restart.

#### Scenario: Mid-scale octave changes do not pass
- **WHEN** C4, D4, and E5 are played for C major
- **THEN** E5 is not the expected E4; the learner restarts on C
- **AND** C4, D4, E4, F4, G4, A4, B4, C5 clears it

### Requirement: Check complete stacks and bass where required
A chord or voicing stage SHALL require the held pitch-class set to equal its expected set, including no extras. Octave doublings SHALL be accepted. An inversion SHALL also require that the lowest absolute held note matches its requested bass pitch class. A fresh attack outside the set is a mistake; an incomplete set alone is not. Recheck the held set on release.

#### Scenario: Bass determines the inversion
- **WHEN** the prompt requires first-inversion C major
- **THEN** E3, G3, C4 passes; C4, E4, G4 gets wrong-bass feedback despite the correct classes
- **AND** repeated checks of the identical wrong configuration do not count additional mistakes

#### Scenario: Rootless means no extra root
- **WHEN** a rootless dominant 13 over G is requested
- **THEN** B, F, A, E held at any suitable octaves passes; adding G or omitting E does not

#### Scenario: Release an incorrect extra pitch
- **WHEN** the learner has assembled the requested stack with one newly struck non-member
- **THEN** that attack is a mistake, and removing the extra can clear the now-correct stack as a recovery without restriking its members

### Requirement: Check progressions stage by stage
A multi-stage round SHALL require every ordered stage and score one round only after the final stage. Notes carried from an accepted stage SHALL be eligible if shared with the next stage; prior held extras must be released before acceptance, without charging an error solely for the transition. Playable examples and live stages SHALL apply the same musical rules.

#### Scenario: Hold a guide tone through a change
- **WHEN** the C-center Dm7 guide stage is cleared with C4 and F4, then C4 is released and B3 is played while F4 remains held
- **THEN** the G7 guide stage clears with F4 and B3; no F restrike is required
- **AND** the final Cmaj7 stage needs E and B; the drill does not measure voice distance or phrase timing

#### Scenario: Close a minor cadence on a minor triad
- **WHEN** the app generates a C minor ii–V–i drill
- **THEN** it waits for Dm7♭5, G7, and Cm in order; adding B♭ to the Cm triad is not its final answer
