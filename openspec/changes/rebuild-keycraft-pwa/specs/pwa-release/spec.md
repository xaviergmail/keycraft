# Spec Delta

## Purpose

Build and publish the complete rebuilt static PWA without risking a partial release or changing the app's public hosting paths. At rebuild cutover, this replaces the legacy Python/four-file packaging contract; the legacy release remains described by its historical change.

## ADDED Requirements

### Requirement: Build one complete static release
The rebuild SHALL produce a self-contained site artifact from a clean source checkout. Include its HTML, current JS/CSS and workers, the manifest, icons, and offline asset closure. Keep local asset references valid under `/keycraft/` and at the standalone root. Do not package raw sources, stale build hashes, private files, or mandatory neural model downloads.

#### Scenario: Missing an offline or runtime asset fails preparation
- **WHEN** the build manifest, worker, or offline manifest refers to a missing or out-of-scope local asset
- **THEN** fail artifact preparation before upload rather than omit that file or fall back to an old build
- **AND** a stale asset left in a developer checkout cannot leak into the newly built release

### Requirement: Deploy the exact tested main revision to Pages
On a push to `main`, CI SHALL build that revision and deploy only the successful artifact from the same run, using the existing GitHub Actions Pages environment. Do not deploy from tags, other branches, or pull requests. Serialize deployments, keep the previous site on build or upload failure, and expose the HTTPS deployment URL.

#### Scenario: Build a source-only change and publish the checked output
- **WHEN** a source-only update is pushed to configured Pages on `main`
- **THEN** CI builds that commit without relying on tracked output; the resulting site, app assets, offline worker, and install entry all resolve under the Pages project path

#### Scenario: Failed or overlapping builds do not replace a healthy site
- **WHEN** a build or validation step fails, or another authorized main push arrives during deployment
- **THEN** the failed run does not deploy, and concurrent runs cannot overlap live deployments

### Requirement: Preserve an independent static ChatGPT Sites path
The same rebuild SHALL be buildable and servable locally and publishable as static files to ChatGPT Sites without coupling that deployment to a push on GitHub. A release SHALL not move either host to a new origin without a separate decision. Pages and ChatGPT Sites MUST each receive a complete build appropriate to their site path.

#### Scenario: Keep browser progress at the current URL
- **WHEN** the rebuild replaces the legacy files on an existing host at its current origin
- **THEN** that origin continues to serve the app and its same-origin migration can read local saves; it does not automatically share data with the other host
