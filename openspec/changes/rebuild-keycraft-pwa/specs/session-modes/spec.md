# Spec Delta

## Purpose

Define how scored exercises start, run, time out, stop, and finish independently of the musical content selected for their rounds.

## ADDED Requirements

### Requirement: Run normal practice without a clock
Standard standalone, fixed-key, and scheduled exercises SHALL plan ten scored rounds, with a fresh target state for each round; lesson and section branch tours use their complete rotation. Practice SHALL have no answer deadline or life limit. Scheduled and branch runs SHALL remain untimed regardless of the prior Arcade selection.

#### Scenario: Practice is not a test of speed
- **WHEN** the learner takes longer than the Arcade budget in an untimed round
- **THEN** the prompt stays playable, without losing a heart, generating a miss, or skipping because of elapsed time

### Requirement: Run Arcade with three hearts and per-round deadlines
Arcade SHALL be available for standalone modes and fixed lesson/key drills. Start with three hearts. Each mistake or skip costs one heart; an expired timer is one skip. End the run when the last heart is lost or all planned rounds finish. A mid-run Practice/Arcade selection SHALL affect the next eligible run, not the active timer or score.

#### Scenario: Budget varies by prompt family
- **WHEN** an Arcade round starts
- **THEN** allocate 20 seconds for a single-note prompt, 52 seconds for an octave scale or multi-stage progression, and 35 seconds for other intervals or stacks
- **AND** share that one budget across the stages of a progression, counting only active playing time, not narration, teaching, app transitions, or hidden-tab intervals

#### Scenario: A fatal timeout is processed once
- **GIVEN** one heart remains in Arcade
- **WHEN** the timer expires while Skip is also activated
- **THEN** record one failed round and at most one round penalty; show one finished summary and no later live round from that exercise

### Requirement: Allow skip and recover within a round
During a scored round, the learner SHALL be able to skip. Show the missed material while progressing to the next round or the final summary. Wrong answers SHALL permit another attempt within the same round unless Arcade exhausts its hearts. Recovery clears the prompt but is not a first-try success.

#### Scenario: Skip a partially played scale
- **WHEN** the learner skips an unfinished scale
- **THEN** the run does not count it as cleared, it shows the expected scale, and the next prompt begins with no inherited scale anchor

### Requirement: Cancel obsolete session work when leaving
Stopping Just Practice, selecting another mode or scope, or starting a new run SHALL retire the old session and cancel or ignore its delayed checks, note state, pending score completion, and narration. Already committed outcomes stay saved. An abandoned run SHALL not append a finished exercise row.

#### Scenario: Change drills while a transition is pending
- **WHEN** the learner starts a new drill during an old success transition
- **THEN** the old committed result remains, but its timer cannot skip, advance, or finish the newer drill

#### Scenario: Exit continuous practice
- **WHEN** the learner activates Stop practice before continuing a Just Practice run
- **THEN** exit continuous mode without losing the saved path, without restarting automatically, and without mislabeling the next explicitly scheduled drill
