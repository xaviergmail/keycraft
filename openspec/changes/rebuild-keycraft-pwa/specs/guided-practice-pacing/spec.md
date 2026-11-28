# Spec Delta

## ADDED Requirements

### Requirement: Admit concepts in curriculum order
Just Practice and Start suggested drill SHALL share an ordered guided path. A new learner starts with note recognition only. The next admission SHALL be the next lesson in catalog order, and is possible only when every already-admitted lesson is currently mastered. Roots and variants of an admitted lesson are practice within that concept, not new admissions.

#### Scenario: An early streak does not unlock harmony
- **GIVEN** a fresh path and four unaided note-recognition answers in starter spellings
- **WHEN** the learner reaches an exercise continuation
- **THEN** the learner continues note recognition; four answers cannot unlock the next lesson, and there is no round-40 guarantee for major triads

#### Scenario: A scale begins in its starter key and expands before advancement
- **WHEN** the learner admits Major scale and has not yet practiced it
- **THEN** its first focus is C major; the guided scheduler supplies the other required spellings while Major scale is admitted
- **AND** the next lesson is A natural minor only after full-path mastery, including Major scale in all supported spellings

#### Scenario: Direct practice of a locked concept does not enroll it
- **WHEN** a learner plays Tritone substitute in Free Play before it is admitted
- **THEN** the results are tracked but that lesson does not appear as guided material, raise the current gate, or move the guided frontier
- **AND** independently earned evidence can be used once that lesson is admitted normally

### Requirement: Check full mastery for each lesson and key
A lesson SHALL require a lesson score of at least 80/100, at least 18 unaided successes in its most recent 20 classified mastery outcomes (at least 20 required), and four consecutive unaided successes in each of the 17 spelled-key histories. The gate SHALL use current evidence, never a latched status, timer, speed threshold, or XP total. Admission already earned is not revoked.

#### Scenario: One missing key blocks the offer
- **GIVEN** every admitted lesson would qualify except that G♯ natural minor has only three successive unaided successes
- **WHEN** the learner reaches the next-offer boundary
- **THEN** no new concept is offered; one more qualifying G♯ natural minor success can satisfy that root condition, but an A♭ natural minor success cannot

#### Scenario: Earlier material can fall below the gate
- **GIVEN** the latest lesson is mastered but a later missed review of an earlier lesson broke one root's required streak
- **WHEN** the learner finishes the current exercise and preview
- **THEN** the next exercise reinforces admitted material until the earlier evidence is repaired; the earlier lesson remains available

## MODIFIED Requirements

### Requirement: Readiness uses unaided attempts
The path SHALL use the independent outcome classification in curriculum scoring. A qualifying result is correct on the first try without answer assistance. Clean results from scored focus, review, and explicit lesson drills use the same lesson/key evidence. Response speed SHALL NOT affect mastery.

#### Scenario: Assistance does not count as independent recall
- **WHEN** a worked introduction or hint is shown, a first error commits a miss, or a round is skipped without a clean result
- **THEN** that round cannot supply a qualifying result or count as more than one mastery outcome
- **AND** playing the unscored example or abandoning an untouched round adds no outcome

#### Scenario: Slow recall is not penalized
- **WHEN** a learner takes longer than six seconds on a scheduled scored round and answers correctly without help
- **THEN** no answer is automatically revealed, and the result qualifies on the same terms as a faster one

#### Scenario: Transposition evidence reflects different notes
- **WHEN** all of the learner's non-scale successes use the same pitch class, even under multiple spellings
- **THEN** they leave the other required root histories unmastered
- **AND** C♯ and D♭ each need evidence assigned to their own displayed prompt

### Requirement: Focus practice leaves room for review
Scheduled runs SHALL choose each round from admitted material. While a lesson needs work, schedule focus, focus, review in blocks of three, using focus for the review slot only if no distinct review pair is available. Prioritize unfinished key streaks in focus slots and offer every required spelling. When all admitted lessons are mastered, choose review while no new concept is accepted.

#### Scenario: Fresh acquisition and recovery
- **WHEN** a learner has a new lesson or broken mastery on an admitted lesson
- **THEN** focus goes to the newest admission while it needs work, otherwise to the earliest admitted unmastered lesson
- **AND** a first unpracticed scale focus starts in its starter key; thereafter prioritize keys with deficient streaks by least recent presentation, with catalog key order breaking ties; if all streaks pass but the lesson still needs work, rotate its keys in the same least-recent order
- **AND** if there is no distinct admitted review candidate, use the slot for focus instead of introducing a different lesson

#### Scenario: All entries have been introduced
- **WHEN** the last catalog lesson has been admitted
- **THEN** incomplete entries can still receive focus and mastered entries receive review, but the path does not offer a nonexistent lesson

### Requirement: Review prioritizes material due after a delay
A review turn SHALL use previously presented, admitted lesson/key pairs, distinct from the pair that would be used for focus when focus is needed. Prioritize entries answered at least one estimated half-life ago, oldest presentation first. If none are due, favor higher recall need. Use the per-key history and do not require a waiting period before practice or advancement.

#### Scenario: Overdue content returns after a break
- **GIVEN** an admitted scale key is overdue and another review candidate was answered recently and is not due
- **WHEN** the learner returns after a reload and reaches a review turn
- **THEN** the overdue key is selected first; advancing the guided frontier does not remove it from review

#### Scenario: Ties and unseen practice
- **WHEN** due candidates have the same last presentation or equal recall weights compete without a due candidate
- **THEN** resolve ties by curriculum and key order; a key of an admitted lesson with no observations remains eligible for focus

### Requirement: Learner chooses the next focus
Both guided entry points SHALL use the same gate and distinguish focus from review. After a finished exercise and its continuation action, offer at most one next admission if the gate passes. Advance only after acceptance and rechecking eligibility. Declining SHALL retain the path, resume practice, and suppress the offer for ten minutes across reloads.

#### Scenario: Accept the next lesson
- **WHEN** the learner accepts an eligible offer after a completed exercise
- **THEN** the next lesson becomes the new focus, starts a new scheduled drill, and receives a worked first-exposure teaching aid before its first independent recall

#### Scenario: Keep practicing instead
- **WHEN** the learner chooses to continue practicing or dismisses the eligible offer
- **THEN** the path and shared history remain intact, and no offer reappears during the saved ten-minute cooldown

### Requirement: Existing learning history remains usable
The path SHALL restore admitted lessons, focus, and key on reload and preserve legacy progress under the local-progress migration rules. Legacy exposure and early-readiness flags SHALL NOT manufacture independent full-mastery evidence. Free Play remains independently scoped and never advances the guided frontier.

#### Scenario: Continue a saved course
- **GIVEN** a same-origin save with a valid guided focus and separate earlier or later Free Play records
- **WHEN** the rebuilt app loads the save
- **THEN** it restores a valid focus within the migrated path and preserves all scores, item/key histories, and export data
- **AND** unrelated Free Play history stays visible without unlocking or blocking a guided admission

## REMOVED Requirements

### Requirement: Core lessons precede full key coverage
**Reason**: The rebuild explicitly requires full learned-path mastery, not introductory fluency, before introducing another concept. This removes the round-40 guarantee and the separate post-core scale expansion gate.

**Migration**: Retain all 39 lessons and every saved key record. Use starter keys as first exposures within a lesson, and complete the other spellings before the next admission. Existing mastery evidence is handled by the new scoring and save contracts.
