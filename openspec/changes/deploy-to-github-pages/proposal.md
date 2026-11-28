# Proposal

## Why

KeyCraft's assets are rebuilt locally today, and pushing to GitHub does not publish the app. Building and deploying from the same `main` revision makes the public release repeatable without a manual asset upload or deployment branch.

## What Changes

- A push to `main` triggers a GitHub Actions build using the existing Python asset builder, then publishes that run's successful build to GitHub Pages.
- Deploy only the generated site: `index.html` and its matching hashed stylesheet, JavaScript bundle, and voice worker. Keep the asset URLs relative so the app works under `/keycraft/`.
- A failed build or artifact check must not replace the live site. Pushes to other branches, tags, and pull requests do not deploy.
- Document the one-time Pages setup and how to find and verify the deployment URL from an Actions run.

**Out of scope:** A custom domain, PR previews, removing tracked assets, changing ChatGPT Sites hosting, or migrating progress between browser origins.

## Capabilities

### New Capabilities

- `github-pages-deployment`: Builds and publishes the static KeyCraft site to GitHub Pages from `main`.

### Modified Capabilities

## Impact

- Adds `.github/workflows/pages.yml` and updates the deployment guidance in `README.md` and `AGENTS.md`.
- Uses GitHub's Pages environment and built-in Actions token. The repository administrator sets Pages to use GitHub Actions before the first deployment.
- Local builds, browser behavior, and `.openai/hosting.json` remain unchanged. The new Pages origin will not see existing saves on localhost or ChatGPT Sites.
