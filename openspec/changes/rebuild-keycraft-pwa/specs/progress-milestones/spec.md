# Spec Delta

## Purpose

Recognize progress with levels, achievements, and daily practice goals without making any reward a substitute for curriculum mastery.

## ADDED Requirements

### Requirement: Derive level and rank from XP
Lifetime XP SHALL determine level `floor(XP/500)+1`, next-level progress `XP mod 500`, and rank index `min(7, floor((level−1)/2))`. Show lifetime XP, total clears, rank, and next-level progress. Reward progress SHALL be independent of run points and the guided admission gate.

#### Scenario: Change rank at the right level
- **WHEN** lifetime XP reaches 1,000
- **THEN** show level 3 and Foundation Builder, with zero progress toward the next 500 XP
- **AND** use the ordered ranks Novice, Foundation Builder, Chord Explorer, Harmony Seeker, Jazz Apprentice, Voicing Architect, Jazz Navigator, Improviser

### Requirement: Award achievements once per stable ID
The app SHALL persist achievement IDs and award 100 XP once when a previously unearned badge's predicate holds, including qualifying legacy totals on load. The learner SHALL be able to see which badges are earned and what they require.

#### Scenario: Check all milestone predicates
- **WHEN** a result or restored save satisfies a predicate below for a missing ID
- **THEN** grant that badge and 100 XP once; repeat checks, replay, and reload do not reaward it

| ID | Achievement | Predicate |
|---|---|---|
| `first` | First Contact | At least 1 cleared challenge |
| `streak` | On a Roll | Best combo at least 8 |
| `scales` | Scale Explorer | At least 10 scale-mode clears |
| `jazz` | Jazz Apprentice | At least 10 guide-tone plus voicing clears |
| `keys` | Circle Complete | At least one first-try clear in each of the 12 canonical key records |
| `century` | Centurion | At least 100 cleared challenges |

### Requirement: Track and claim daily goals once per day
The app SHALL track local-date progress toward 6 clear rounds, 30 played note attacks, and 2 clears in guides, voicings, or cadence. Progress SHALL reset when the local date changes, even if the app remained open. An explicit claim SHALL award 200 XP only when all three targets are met and not yet claimed for that day.

#### Scenario: Count real playing and not preview actions
- **WHEN** a learner strikes notes in ordinary play, clears a chord, and later plays teaching or continuation diagrams
- **THEN** each distinct ordinary note attack counts once; repeated key events and unscored example notes do not count
- **AND** the clear increases the round goal; it increases the jazz goal only for the listed jazz modes

#### Scenario: Claim persists and rolls over
- **WHEN** the learner meets the targets, claims the reward, and reloads the same date
- **THEN** retain the claimed state with no second award
- **AND** a subsequent local date starts unclaimed with zero counters while lifetime XP is preserved
