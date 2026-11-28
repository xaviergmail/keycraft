# Spec Delta

## Purpose

Measure progress for every lesson and its transpositions independently, without conflating run points, lifetime XP, and evidence of unaided recall.

## ADDED Requirements

### Requirement: Track scores at lesson key and item scope
Every curriculum-tagged attempt SHALL address a stable lesson ID, a spelled practice key, and a stable exact challenge variant. Use the tonic for scales and other tonic exercises, the named pitch for note recognition, and the tonal center for progressions, guide tones, targets, and voicings. Item identity SHALL also distinguish answer-affecting variants; display or speech wording SHALL NOT change it.

#### Scenario: Minor scale scores stay independent
- **WHEN** a clean C natural minor attempt is followed by a miss on D natural minor and a clean attempt on G♯ natural minor
- **THEN** show and save separate C, D, and G♯ results under `natural-minor`, including attempts and first-try accuracy
- **AND** G♯ and A♭ are separate records although their piano pitches match; Natural, harmonic, and ascending melodic minor are separate lessons

#### Scenario: Different answers in the same key do not collapse
- **WHEN** a learner plays C-center cadence, first-inversion major and minor triads in C, or the third versus seventh of Dm7 in a target drill
- **THEN** record the center/root and lesson plus a distinct item for each different interval, scale, target chord/degree, voicing, or ordered chord sequence and bass requirement
- **AND** voicing octave doublings do not invent a new item ID

### Requirement: Separate visible scores from practice estimates
Curriculum lesson and spelled-key scores SHALL be bounded 0–100, start at zero for new entries, increase by 2 for an unaided success and decrease by 6 for the first miss in a round. Assistance alone changes neither score nor retention inputs. Showing a score SHALL not multiply it by elapsed-time retention. A standalone mode without a curriculum lesson updates only its general run and accuracy totals.

#### Scenario: Update one key without touching another
- **GIVEN** the Natural minor lesson score is 82, its C record is 40 and its D record is 30
- **WHEN** a C prompt gets an unaided pass and a D prompt then gets a first miss
- **THEN** C is 42, D is 24, the lesson is 78, and all other root scores are unchanged

#### Scenario: Leave progress visible after time away
- **WHEN** a learner returns after a long break without playing anything
- **THEN** visible scores remain unchanged even if those entries now have higher review priority

### Requirement: Classify a curriculum round once for mastery
For curriculum-tagged rounds, the app SHALL record at most one mastery outcome per round: unaided success, miss, or assisted. The first error, skip, timeout, or loss of the last heart commits a miss; a recovery does not replace it. An error-free finish after answer assistance is assisted. Only a first-try unassisted finish is a qualifying success.

#### Scenario: Hint or example prevents independent credit
- **WHEN** a learner clears a scored round after a worked introduction, after showing and hiding a manual hint, or after a timed answer diagram appeared
- **THEN** record one assisted outcome, not an unaided success, even if the answer had no errors
- **AND** assisted and missed outcomes break a consecutive unaided streak; no unscored example has an outcome

#### Scenario: Miss and recovery cannot duplicate a penalty
- **WHEN** a learner plays several wrong notes in a curriculum round and eventually completes it, skips it, or leaves it
- **THEN** there is one mastery miss and one curriculum deduction, with no gain for recovery
- **AND** finished-round attempt and completion totals change at most once; abandoning an untouched round creates no outcome or attempt

### Requirement: Award run points and XP independently
Each mode SHALL have its own base award. A first-try clear grants points and XP; a recovered clear counts as a completion but grants neither. The first error or skip in a round SHALL deduct four times that prompt mode's base points once, may make run points negative, and SHALL not deduct lifetime XP. Errors and skips reset combo.

#### Scenario: Compute awards and combo from the round
- **WHEN** a first-try round clears
- **THEN** increment combo and award rounded points `base × min(2, 1 + floor((combo−1)/3) × 0.2) × hint × arcadePoints` and rounded XP `(12 + 0.25 × base) × hint × arcadeXp`
- **AND** `hint` is 0.5 if Show hint was used and 1 otherwise; Arcade multipliers are 1.35 points and 1.25 XP; both are 1 in Practice
- **AND** mode bases are `notes:40`, `intervals:55`, `scales:80`, `chords:65`, `inversions:75`, `guides:95`, `voicings:88`, `cadence:108`

#### Scenario: Hinted perfect and recovered clears differ
- **WHEN** the first round of an untimed Note Dash run is answered on the first try with a manual hint, and the next round is cleared after two mistakes
- **THEN** the first earns 20 points and 11 XP; the second earns zero, incurs one 160-point penalty, and resets the combo
- **AND** the two completed rounds contribute two clears; only the first is a first-try clear for key accuracy, and neither is unaided curriculum mastery evidence

### Requirement: Count general accuracy and milestones separately
A finished round SHALL add one attempt and, if cleared, one completion to the lifetime and mode totals. The key total SHALL count one attempt and count a success only if cleared without mistakes. Manual hints affect award and unaided evidence, not first-try accuracy. Run counters and history SHALL distinguish completions, mistakes, skips, and best combo.

#### Scenario: Recovering does not inflate first-try accuracy
- **WHEN** a learner completes a scale after restarting it because of a wrong note
- **THEN** the run and scale mode count a clear, but the prompted key's first-try numerator does not increase
- **AND** attribute global accuracy to the selected drill key or center, not to a different diatonic target inside it; retain the stored key spelling

### Requirement: Measure only eligible response samples
Timing SHALL be measured on a monotonic clock, excluding narration and transitions. A first-try unaided result with valid focus and samples can update response history; mistimed, hinted, interrupted, hidden or backgrounded, and recovered attempts SHALL not train the latency estimate. Timing SHALL not decide mastery or change awards.

#### Scenario: Reject an unreliable timing without rejecting the answer
- **WHEN** a learner switches tabs during a round, returns, and answers correctly on the first try without a hint
- **THEN** the result still earns ordinary awards and can qualify for mastery, but no latency sample is stored

#### Scenario: Keep bounded response histories
- **WHEN** latency is eligible
- **THEN** accept total single-note samples at 100–8,000 ms, total interval samples at 100–12,000 ms, item first-response samples at 100–10,000 ms, and per-note samples at 0–15,000 ms
- **AND** use elapsed time to the final accepted note for single-note and interval totals, time to the first attack for other catalog items, and time since the previous attack (or prompt start) for per-note samples
- **AND** for a sample key with at least five values, reject a new one above `max(4,000 ms, 3 × median)`; retain at most 25 samples per measurement key and 21 timings per curriculum trace
- **AND** for compatibility, total keys are `mode:target:targetPc` for single notes and `interval:rootPc:semitones` for intervals; per-note keys are `mode:note:notePc`, and first-response keys are stable item IDs

### Requirement: Retain distinct recall estimates for scheduling
The app SHALL track presentation time and eligible recall for each lesson, spelled-key pair, and exact item. Retain the last 20 mastery outcomes and, separately, the last 20 recall observations. Unanswered entries start with a 45-minute half-life. Only unaided successes and misses update recall time, modeled strength, and half-life. Visible scores do not decay with modeled recall.

#### Scenario: Use estimated recall rather than visible percentage alone
- **WHEN** ranking reviews at a fixed wall clock
- **THEN** estimated recall is zero before an answer, otherwise `2^(−max(0, now−lastAnswered)/halfLife)`; an entry is due once elapsed time reaches its half-life
- **AND** among non-due entries use higher `need / (1 + strength × recall / 50)`, where `need = 0.2 + 2 × (1−recall) + 2 × missRate(last 5) + slowing + 0.2 × (latencyMultiplier−1)`; miss rate is the fraction of the last five available recall observations that were misses, and an empty trace uses need 1.4

#### Scenario: Repeated recall updates the modeled strength
- **WHEN** an already-answered trace gets an unaided success or miss
- **THEN** success updates strength by `+2 + 4 × (1−recall)` and multiplies half-life by `1.005 + 0.7 × (1−recall) × speed`; a miss changes strength to `max(0, 0.85 × strength−6)` and multiplies half-life by 0.52
- **AND** clamp the resulting half-life between 5 minutes and 180 days; uncalibrated speed is 1, otherwise clamp `baseline/responseMs` to 0.4–1.2
- **AND** for a trace's first remembered outcome apply the same strength update and set the answer timestamp, but retain the initial half-life; seed strength at zero for new traces, or from legacy `solidified` (falling back to the migrated score)

#### Scenario: Slow recent answers affect review without changing mastery
- **WHEN** usable timing exists with at least three concept samples
- **THEN** take its sorted timing at index `floor(count/3)` as baseline, and use `min(2, max(0, median(last 3 timings)/baseline−1))` as slowing, or zero without samples
- **AND** use latency multiplier `min(5, max(0.05, recall)^(−slope))`, with initial slope 1.75 and, on a timed result with prior answer and recall in `(0.05, 0.9)`, blend 75% old slope with 25% of `clamp(log(responseMs/baseline)/−log(recall), 0, 3)`
- **AND** when using a median for timing, select the sorted sample at zero-based index `floor(count/2)`; with fewer than three usable samples no baseline or latency calibration is available
