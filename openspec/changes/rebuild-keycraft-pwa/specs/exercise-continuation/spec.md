# Spec Delta

## Purpose

Let a learner play a short, unscored example from the run summary to move into the next exercise without returning to the start screen.

## ADDED Requirements

### Requirement: Show a playable prompt below the score chart
Every finished exercise SHALL show one randomly selected playable “Play [item] to continue” prompt below its history chart, alongside a Continue action. Show its formula or sequence, note names, and interactive piano diagram, and distinguish it from the scored exercise above. The prompt SHALL stay fixed until acted on.

#### Scenario: Demonstrate a scale or chord after ordinary Free Play
- **WHEN** an even-numbered non-scheduled exercise ends
- **THEN** its continuation is an ascending scale randomly selected from the six scale recipes and 12 canonical keys; show direction, notes, and steps
- **AND** for an odd-numbered non-scheduled exercise choose one of the nine chord qualities in a canonical key and show the stack and formula

#### Scenario: Preview only admitted content in a scheduled run
- **GIVEN** the guided path has admitted only note recognition, or a wider set of lessons
- **WHEN** a guided exercise ends
- **THEN** choose a random playable example from admitted material, preferring the even-scale/odd-chord alternation when those families are admitted
- **AND** when the preferred family is not available, use another admitted exercise, including a single named note on a fresh path; do not expose an unopened lesson through the preview

### Requirement: Continue by playing or by explicit action
The continuation SHALL accept the same supported input sources and musical rules as its example, including keyboard or pointer activation of the diagram. Wrong or incomplete playing can show how to retry but SHALL not change any points, mastery, timing, daily progress, or history. Continue SHALL bypass playing and take the same route as a correct completion.

#### Scenario: Continue from an example after a slip
- **WHEN** the learner makes a mistake on an unscored continuation then completes the example on the on-screen or MIDI piano, or clicks Continue
- **THEN** continue exactly once without recording a new attempt or modifying the saved prior summary
- **AND** stale completion callbacks and input held in the old exercise cannot answer the first new scored round

### Requirement: Advance without leaving the practice scope
After continuation, the app SHALL keep the previous run family. A scheduled run SHALL offer the next lesson only when the full-mastery policy allows it; otherwise generate another scheduled drill. A direct lesson/key or branch SHALL repeat that scope. A standalone run SHALL continue the selected mode and next-run settings.

#### Scenario: Continue either guided entry point
- **WHEN** a learner completes the preview after Just Practice or Start suggested drill
- **THEN** the next scheduled drill stays in that same entry mode and uses current evidence; if an eligible admission is offered, start the new or existing path according to the learner's choice

#### Scenario: Continue a selected root or branch
- **WHEN** a G♯ natural minor drill or a full branch is continued from its summary
- **THEN** repeat that exact root scope or regenerate the same branch rotation respectively, regardless of which continuation example was shown
