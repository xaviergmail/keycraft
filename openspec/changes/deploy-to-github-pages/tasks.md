# Tasks

## 1. Build and publish

- [x] 1.1 Add the build job in `.github/workflows/pages.yml`. Check out the event SHA without persisting credentials, set up Python 3.12, clear only generated hashes on the runner, run `python3 scripts/build-assets.py`, and stage and upload the four current site files. In a disposable checkout with stale hashes, run the build and staging commands; verify the exact artifact contents and confirm that a missing worker or a root-relative asset link makes preparation fail before upload.
- [x] 1.2 Limit the workflow to pushes to `main` and add the `github-pages` deploy job behind the successful artifact upload. Pin the official actions to release SHAs and configure job-level permissions, Pages concurrency, and the deployment URL. Run `actionlint` and check that only `main` branch pushes match, that deployments cannot overlap, and that a failed build or upload blocks the deploy job.
- [x] 1.3 Document the one-time GitHub Actions Pages source and environment setup, run and deployment URL, and origin-local progress in `README.md`; document the CI publishing path alongside the existing local build instructions in `AGENTS.md`. Verify the instructions agree with the workflow and leave ChatGPT Sites and local serving unchanged.

## 2. Integration check

- [x] 2.1 Serve the staged artifact beneath `/keycraft/` in a disposable local server. Open it in a browser, answer one drill with the on-screen piano, and verify the stylesheet, bundle, and referenced hashed worker are reachable under that path.

## Workflow follow-up

- A repository administrator selects **GitHub Actions** as the Pages source and confirms the `github-pages` environment allows `main`. On the first authorized push to `main`, check that the build and deploy jobs succeed for that SHA, then smoke-test the HTTPS URL shown by the deploy job. Do not enable Pages or push as part of local verification.
