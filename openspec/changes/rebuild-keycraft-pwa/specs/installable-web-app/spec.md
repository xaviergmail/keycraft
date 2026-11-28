# Spec Delta

## Purpose

Run KeyCraft as an installable, offline-capable static web app on the existing hosts without requiring a model download, sign-in, or a server API to practice.

## ADDED Requirements

### Requirement: Install within the actual site path
The rebuilt app SHALL provide an installable web manifest with the KeyCraft identity, appropriate icons, standalone launch behavior, and a start URL inside the deployment path. Its offline control scope and app-owned caches SHALL be limited to that site. Browsers that do not offer installation SHALL still be able to use the normal page.

#### Scenario: Install the project site from Pages
- **WHEN** a supported browser visits the HTTPS app under `/keycraft/` and the learner installs it
- **THEN** opening the installed app launches that same practice app under `/keycraft/`, reads the same origin's progress, and does not take control of unrelated sites or apps

### Requirement: Keep core practice available offline
After the learner has loaded a complete release online and its offline assets are ready, the app SHALL reload and launch offline with the full catalog, all available input routes, practice and Arcade, local scoring, history, and export. The core offline install SHALL NOT depend on fetching Kokoro's runtime, model, or voices at first launch.

#### Scenario: Play and save offline after initial setup
- **GIVEN** the app reports its required offline assets are ready
- **WHEN** the learner goes offline and reloads from the standalone icon or site URL
- **THEN** they can finish a drill, replay the summary, save and export results, and continue using supported local inputs
- **AND** reuse cached clips if possible; missing clips use available browser speech or text without blocking play or downloading a model while offline

#### Scenario: First visit cannot load offline
- **WHEN** no complete release has been saved on the device and the site cannot be reached
- **THEN** do not claim offline readiness or a migrated save; on a subsequent successful load provide the normal path to offline setup

### Requirement: Switch generations only after a complete update
The app SHALL never mix partial build asset generations. Make a complete update available at a safe boundary rather than force-reloading an active drill, teaching dialog, or summary. Retain a usable release through a failed update and preserve browser-local progress, including valid voice clips.

#### Scenario: Update during a progression
- **WHEN** a new release becomes available while a chord progression is being played
- **THEN** the old round remains playable to completion; activation occurs on a later safe launch or an explicit safe update action
- **AND** a failed shell download leaves the previous working release usable offline and does not wipe save or voice storage

#### Scenario: Update with another exercise open
- **GIVEN** a second tab is still running a drill from the prior release
- **WHEN** the learner opens the verified update in a different tab
- **THEN** keep the older drill and its assets usable until that client reaches its own safe update boundary
