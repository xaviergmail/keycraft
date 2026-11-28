# Spec Delta

## Purpose

Help learners encounter new piano theory sooner while continuing to retrieve earlier concepts after a delay. Initial readiness adds to the curriculum; it does not certify all-key proficiency.

## ADDED Requirements

### Requirement: Core lessons precede full key coverage
The guided path SHALL introduce existing lessons in curriculum order without requiring all-key proficiency. Each scale lesson SHALL enter the core path in one starter key. Unseen scale spellings SHALL remain available in Free Play and as guided expansion after the core lessons have been introduced.

#### Scenario: Fresh learner reaches major triads promptly
- **GIVEN** an empty save on the main guided path
- **WHEN** the learner completes each round correctly on the first try without requesting a hint and accepts each next lesson
- **THEN** the first major-triad round is presented by the 40th scored round, without a time delay or any requirement to complete all 17 spellings

#### Scenario: The first scales are paired
- **WHEN** a learner reaches scales for the first time in curriculum order and demonstrates readiness on C major
- **THEN** A natural minor is the next offer, even if no other major scale key has been played

#### Scenario: Transposition remains available
- **WHEN** the last core focus is ready and there are scale spellings the learner has not yet played
- **THEN** the guided path offers those as further practice without blocking earlier concepts
- **AND** a learner can select any of those spellings directly in Free Play before then

### Requirement: Readiness uses unaided attempts
The path SHALL consider a focus ready when the latest finished focus round is qualifying and at least three of the most recent four (or fewer if fewer have finished) qualify. A qualifying round is correct on the first try without assistance. For non-scale lessons the qualifying results SHALL span two distinct root or tonal-center pitch classes; for scales they SHALL use the focus key. Response speed SHALL NOT affect readiness.

#### Scenario: Assistance does not count as independent recall
- **WHEN** the learner views a worked example for a round, requests a hint, makes a mistake before completing, or skips a focus round
- **THEN** that round cannot supply a qualifying result or count as more than one outcome
- **AND** unscored examples and abandoned rounds do not count as attempts

#### Scenario: Slow recall is not penalized
- **WHEN** a learner takes longer than the old hint timer and then answers correctly without help
- **THEN** no answer is automatically revealed on the guided recall round, and the answer qualifies on the same terms as a faster one

#### Scenario: Transposition evidence reflects different notes
- **WHEN** the learner's correct results on a non-scale focus use only one root pitch class, including enharmonic spellings of that root
- **THEN** those results do not make the focus ready until the qualifying window includes a different root pitch class

### Requirement: Focus practice leaves room for review
While working on a focus in a scheduled run, the path SHALL reserve more practice for an unready focus than a ready one. Each full block of three rounds SHALL contain at least one focus round and one distinct review round when both are available. Review SHALL use introduced material rather than introducing an unaccepted lesson.

#### Scenario: Fresh acquisition and recovery
- **WHEN** a lesson is new or recent mistakes leave the learner short of readiness
- **THEN** the upcoming block favors the focus without starving review of older material
- **AND** if nothing else has been introduced, the learner can keep practicing without waiting

#### Scenario: All entries have been introduced
- **WHEN** there is no next entry to introduce and the current focus is ready
- **THEN** the path continues adaptive review without offering a nonexistent lesson

### Requirement: Review prioritizes material due after a delay
On a review turn, the path SHALL prioritize introduced material whose next recall is due based on the time since it was last answered and its existing retention estimate. Review SHALL use per-key memory for scales and SHALL NOT require the learner to wait between sessions or repeat a whole lesson to continue.

#### Scenario: Overdue content returns after a break
- **GIVEN** an introduced scale key is due for review and another introduced review entry was recently answered and is not due
- **WHEN** the learner returns after a reload and reaches a review turn
- **THEN** the overdue key is selected before the recently answered entry
- **AND** advancing the focus does not remove the scale key from review

### Requirement: Learner chooses the next focus
The guided path SHALL offer one next entry when the current focus is ready and SHALL change the focus only after acceptance. Declining SHALL keep practice going and suppress the offer for the existing ten-minute cooldown. Both scheduled entry points SHALL follow the same rules and distinguish focus practice from review.

#### Scenario: Accept the next lesson
- **WHEN** the learner accepts the next lesson offer
- **THEN** that lesson becomes the focus and gets the existing first-exposure teaching aid before independent recall

#### Scenario: Keep practicing instead
- **WHEN** the learner chooses to keep practicing
- **THEN** the current focus and review continue without another offer during the cooldown

### Requirement: Existing learning history remains usable
The path SHALL preserve existing scores, lesson identities, per-item and per-spelling histories, and retention inputs. A valid saved focus SHALL resume across reload. Direct Free Play SHALL keep its chosen lesson, root, or branch scope and shared history without changing the guided focus.

#### Scenario: Continue a saved course
- **GIVEN** an existing save with a valid focus, scored roots, and a started later lesson
- **WHEN** the learner opens the updated app and starts the guided path
- **THEN** the saved focus and its applicable key resume, progress remains visible and exportable, and started lessons remain eligible for review
- **AND** legacy scores or exposure alone do not manufacture unaided readiness evidence
