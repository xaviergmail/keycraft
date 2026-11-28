# Spec Delta

## Purpose

Publish a reproducible KeyCraft build from `main` to GitHub Pages without relying on a contributor's local build output.

## ADDED Requirements

### Requirement: Publish from main pushes
Once Pages is configured for GitHub Actions, a push to `main` SHALL schedule a CI build from the pushed revision. A deployment SHALL use the successful artifact from the same run and expose its HTTPS site URL in GitHub Actions. Pushes to other branches, tag pushes, and pull request activity SHALL NOT deploy.

#### Scenario: Source-only change on main
- **WHEN** an edit to the app's source is pushed to `main` without rebuilding assets locally
- **THEN** the workflow builds the edit and deploys that run's output to the reported Pages URL

#### Scenario: Non-main activity
- **WHEN** a branch other than `main` is pushed, a tag is pushed, or a pull request is opened or updated without a push to `main`
- **THEN** no Pages deployment is triggered

#### Scenario: Pushes arrive close together
- **WHEN** another `main` push schedules a run while a Pages deployment is in progress
- **THEN** the workflow does not run overlapping Pages deployments

### Requirement: A failed build cannot publish
The workflow SHALL block deployment if the build or artifact preparation fails. It SHALL NOT publish an older or incomplete artifact in place of the failed run's output.

#### Scenario: Build or artifact preparation fails
- **GIVEN** a previously successful deployment
- **WHEN** the Python build fails or its generated page points to a missing asset
- **THEN** the new run fails before deployment and the previously published site remains live

### Requirement: Publish a self-contained project site
The Pages artifact SHALL contain the generated HTML entry point and only its current hashed JavaScript bundle, stylesheet, and voice worker. The local asset URLs SHALL resolve beneath the Pages project path without changing KeyCraft's existing local and ChatGPT Sites build and serving behavior.

#### Scenario: Serve the built app at the project path
- **WHEN** a visitor opens the published HTTPS project URL under `/keycraft/`
- **THEN** the page and its referenced JavaScript and CSS load, the on-screen piano can answer a drill, and the bundle's voice worker URL resolves beneath the same path

#### Scenario: Older assets exist in the checkout
- **WHEN** the checkout contains old generated assets as well as the editable sources
- **THEN** the Pages artifact contains only the files for the new build, not superseded hashes, raw source files, or repository documentation
