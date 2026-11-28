# Design

## Context

`dist/` contains both editable sources and generated assets. `scripts/build-assets.py` hashes the bundle, CSS, and worker, rewrites `dist/index.html`, and leaves older hashes on disk. The HTML and worker URLs are already relative. `.openai/hosting.json` uses `dist/` directly for a separate ChatGPT Sites deployment. The GitHub remote is `xaviergmail/keycraft`, with `main` as default; its public repository metadata reports Pages is not enabled.

## Goals / Non-Goals

**Goals:** Build the exact pushed revision, publish a self-contained static artifact, and confine deployment permissions to the publish job.

**Non-Goals:** Change how the local builder works, add Jekyll or a package manager, or have CI commit compiled assets back to GitHub.

## Decisions

### 1. Build on a push to main

Use `.github/workflows/pages.yml` with a `push` trigger limited to `main`, without a path filter. Check out the event SHA, not the branch tip at job start; disable checkout credential persistence. Use a GitHub-hosted Ubuntu runner and Python 3.12 with the existing standard-library builder. A custom workflow is preferable to branch-based Pages publishing: it runs the actual builder and needs no `gh-pages` branch.

### 2. Stage only the fresh build

In the disposable runner checkout, remove old `keycraft.<hash>.js`, `keycraft.<hash>.css`, and `voice-worker.<hash>.js` outputs from `dist/` before running `python3 scripts/build-assets.py`. Leave the checked-in HTML and editable sources in place. Stage `index.html` and the single newly generated file of each kind in a clean directory under the runner's temporary directory. Check that the stylesheet and deferred script links name the staged files and that the bundle references the staged hashed worker. Reject missing or mismatched files and non-relative local asset links before upload. Upload the staging directory with the HTML at its root, not a `dist/` wrapper. This avoids publishing raw source and superseded hashes without changing the local or ChatGPT Sites build.

### 3. Put the deployment behind a successful build

Use official GitHub actions pinned to full release SHAs with version comments: checkout and setup-python, `configure-pages` for configuration discovery, `upload-pages-artifact` for packaging, and `deploy-pages` for publication. The build job needs `contents: read` and `pages: read`; the dependent deploy job needs `pages: write` and `id-token: write`. Use the default `github-pages` artifact and environment; set its deployment URL from `deploy-pages`'s `page_url` output. Use the built-in token and OIDC, with no PAT or deployment branch. Do not use automatic Pages enablement in the workflow.

Use workflow-level `pages` concurrency with `cancel-in-progress: false`. Do not interrupt an active deployment; GitHub can coalesce queued pushes. The deploy job depends on the build and does not run after a build or upload failure. Artifact selection is limited to the current run. See GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Risks / Trade-offs

- Pages is not configured yet → the repository administrator selects **Settings → Pages → Source → GitHub Actions** before the first deployment and verifies the `github-pages` environment allows `main`. Use [GitHub's setup instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).
- Asset URLs that start at the domain root break on a project site → retain the existing relative URLs and test the staged files under a `/keycraft/` subpath, including the worker URL.
- Existing saves do not follow users to a new origin → note the difference in the README and leave existing hosting and storage keys intact.

## Migration Plan

Review the workflow and test a clean staging build locally before rollout. After the administrator enables the Pages source, the first authorized push to `main` runs build and deploy. Use the deployment URL shown by the job (expected `https://xaviergmail.github.io/keycraft/`) for the browser smoke test. If setup was missing when the workflow ran, fix it and rerun only if that revision is still the intended release. Roll back faulty app changes by reverting them on `main` and letting CI publish the resulting revision; disabling the workflow stops future Pages deployments without changing ChatGPT Sites.
