# Design

## Context

`dist/curriculum.js` currently uses `proficient()` both to mark mastery and to gate `advancement()`. The scheduler reserves focus turns, but its weighted review pool can select the focus again and treats multiple scale keys as one review choice. `dist/app.js` also plans the next round before the learner answers the current one, so a schedule based on the latest outcome must choose later.

## Goals / Non-Goals

**Goals:** Separate readiness to try new material from longer-term proficiency; use the current browser-local history for delayed review; keep all path choices deterministic under a fixed clock and random stream.

**Non-Goals:** Recalibrate the memory model or treat correct MIDI pitches as evidence of piano technique, musical expression, or all-key mastery.

## Decisions

### 1. Use a short core path, then expand keys

Build the core order from `CURRICULUM` with one entry per lesson. Store the scale starter key with lesson metadata: C major, A natural minor, A harmonic minor, A jazz melodic minor, D Dorian, G Mixolydian. From the active focus, offer the next unintroduced core lesson, wrapping to an earlier unseen core lesson before entering scale expansion. A lesson already presented in Free Play belongs in review rather than being offered again as new. After the core, offer unseen scale spellings in existing `COURSE_KEYS` order within each scale lesson. Previously visited scale keys can appear in review as soon as there is a trace for them.

Non-scale focus prompts use the existing starter roots (natural notes for note finding; C, F, G, A otherwise) while acquiring readiness. Favor a contrasting root or tonal center when the qualifying window would otherwise cover only one pitch class. Reuse normal item and root ranking for review, including its broader key pool. Keep `proficient()` and all-root scoring as measures of breadth, not admission gates. This is simpler than adding a second visible track or reducing the existing catalog.

### 2. Record actual unaided recall separately

Record one pacing outcome per finished scheduled focus round at the existing `recordRound()` boundary. Keep at most four outcomes; distinguish an unaided first-try finish and its `statRoot` from a miss, skip, or assisted finish. Flag a round as assisted if its worked introduction or refresher was shown or its hint was opened, even if the hint was hidden later. A worked play-through is unscored; a scored replay of that same teaching round is practice, not readiness evidence. Do not auto-show hints in scheduled scored rounds; keep explicit hints, examples, and corrective feedback. None of this changes the existing XP, score, timing, or retention updates.

With three qualifying outcomes in the window and a qualifying latest result, offer the next lesson if the key-coverage condition in the spec also holds. That is an acquisition threshold, not a delayed-retention check. [Rawson and Dunlosky (2011)](https://pubmed.ncbi.nlm.nih.gov/21707204/) found that a few initial recalls plus later relearning were efficient for conceptual material. Three is a starting product choice for this app, not a validated criterion for learning to play piano.

### 3. Make review a real turn, with a priority for overdue entries

Use a repeating focus–focus–review block while the learner is still acquiring the focus and focus–review–review once ready and still practicing. If there is no distinct review entry, keep practicing the focus; once the final focus is ready, use review only. Review one introduced non-scale lesson or one introduced scale key; exclude the current focus from mixed review when there is another choice. A review entry with an answered trace is due after one current half-life. Choose the least recently presented among due entries, breaking ties in curriculum order; otherwise use the existing practice weight. Starting a new lesson does not require waiting out that delay. Use the real wall clock between sittings and keep the existing response timer separate.

[Latimier et al. (2021)](https://doi.org/10.1007/s10648-020-09572-8) found better retention with spaced than massed retrieval and no general advantage for expanding over uniform intervals. The review rule reuses KeyCraft's existing estimate rather than adding a new spacing model. [Carter and Grahn (2016)](https://doi.org/10.3389/fpsyg.2016.01251) found some next-day benefits of interleaving in a small clarinet study, with results varying by rater. [Wiseheart et al. (2017)](https://doi.org/10.1371/journal.pone.0182986) found no spacing benefit in their short-lag piano task. These results support trying spaced recall and measured mixing, not claiming the block ratios, half-life, or piano outcomes are empirically calibrated.

### 4. Keep progression at the existing session boundaries

Pass the selected lesson, key, and focus/review role into `planChallenge()` for scheduled runs only. Pick scheduled rounds at presentation rather than using a next-round prompt chosen before the previous answer. Keep in-prompt stage preparation, the audio cache, and existing identity checks; unscheduled runs keep their existing prompt preparation. Use the role in the active drill and guided panel so a review prompt is not labeled a new lesson. Keep accept, stay, and the existing cooldown. Show advancement offers only on the scheduled path; Free Play still contributes its normal shared traces.

## Risks / Trade-offs

- Early progress could feel like mastery. Call the state ready to try more, keep review active after advancement, and preserve visible proficiency scores. Additional scale spellings are a second pass, not deleted; direct root drills are still available earlier.
- A fresh neural voice clip may start later without a speculative scheduled prompt. Keep the existing cache, stage prefetch, and fallback; verify that narration follows the actual selected prompt.
- Faster access is measurable with a fixed-clock simulation; better retention is not. To evaluate the learning hypothesis with learners, compare practice attempts before first harmony and first-try recall of previously practiced material the next day under comparable practice time. Check performance in an unpracticed key separately from retention. No telemetry or learner experiment is needed to ship the scheduling behavior.

## Migration Plan

Add the bounded pacing focus under `progress.curriculum.courseV2`, separate from its legacy focus counter. Initialize from a valid saved focus and key; if none, use the most recently presented valid lesson and its recorded scale key, or the first lesson for a fresh save. Keep old traces, IDs, scores, the storage key, and the saved cooldown. Start the new evidence window empty on migration; older rounds cannot reliably distinguish assisted recall. Persist the active focus and window on normal progress writes. Rebuild the static assets for rollout; rolling back to the prior bundle leaves legacy traces readable and ignores the new pacing state.
