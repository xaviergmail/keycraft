# Repository Guidelines

## Project Overview

KeyCraft is a browser-only adaptive piano theory trainer for notes, intervals, scales, chords, and jazz harmony. Play with Web MIDI, the on-screen piano, or a computer keyboard. Progress stays in the browser; spoken prompts are optional.

## Architecture & Data Flow

- `src/catalog.ts` owns stable lesson IDs and musical recipes. `src/prompts.ts` generates stable, spelled prompts for practice, worked examples, and continuation. Keep pitch classes for judging separate from spelled keys for scoring.
- `src/game.ts` owns the active exercise and clocks; `src/evaluate.ts` judges scope-local notes from `src/input.ts`. Keep teaching and continuation unscored and release old latched input without erasing other owners. `src/schedule.ts` gates admission on full-path mastery and chooses focus and review.
- `src/record.ts` and `src/results.ts` commit and summarize outcomes; `src/storage.ts` migrates and persists `keycraft-midi-arcade-v1`. `src/voice.ts` separates playback from optional Kokoro synthesis in `src/voice-worker.ts`.

## Key Directories

- `src/` is the editable Svelte/TypeScript app; `tests/` contains focused Node tests. `public/` contains install assets; `tools/` builds and verifies the static release.
- `dist/` is generated output and the publish root. Do not put editable source or checked-in assets there. `docs/initial-chat.md` is a historical handoff, not a spec.
- `openspec/` holds accepted specs in `specs/` and proposals in `changes/`. OMP discovers the workflow skills in `.agents/skills/`; use `/skill:openspec-explore` to investigate or `/skill:openspec-propose` to draft a change.

## Development Commands

Run from the repository root:

```sh
npm ci
npm run dev
npm run check
node --test tests/game.test.ts                 # Example of a focused check
npm run build && node tools/verify-site.mjs dist
npm run preview                               # Serve the production app and worker
```

The Vite build uses relative asset URLs for both `/` and `/keycraft/`. Do not change the default base or rewrite generated references by hand.

`.github/workflows/pages.yml` rebuilds the pushed commit on `main` and publishes only the fresh site files to GitHub Pages. No local rebuild is needed for that deployment. ChatGPT Sites still publishes `dist/` separately.

## Code Conventions & Common Patterns

- Match existing TypeScript: two spaces, single quotes, semicolons, `camelCase` functions, `UPPER_SNAKE_CASE` constants, kebab-case DOM IDs/classes, and `.ts` extensions on TypeScript imports used by Node tests. Preserve focus and ARIA behavior.
- In CSS, reuse `:root` tokens and match the formatting of neighboring rules; leave unrelated compact blocks alone.
- Use shared state only where needed; pass explicit values and callbacks to helpers rather than introducing a DI layer. Keep session and prompt identity checks around delayed work so stale timers or voice jobs cannot affect the next round. Use `performance.now()` for elapsed response time and `Date.now()` for persisted timestamps.
- Keep the existing storage key, lesson IDs, raw legacy records, and separate `curriculum.courseV3` mastery evidence. A failed migration must not overwrite the original save. Unavailable storage must not stop a run.

## Important Files

- `index.html`, `src/main.ts`, and `src/App.svelte` are the app entry and Svelte surface; `src/style.css` contains shared theme and layout rules.
- `vite.config.ts` and `tools/pwa.mjs` produce the release. `public/manifest.webmanifest` and the generated worker control only their deployment path. Keep previous assets usable while an older client is still playing.
- `README.md` covers local use and Pages setup. `.openai/hosting.json` keeps `dist/` as the ChatGPT Sites publish root.

## Runtime/Tooling Preferences

Use Node.js 24 or later and npm with the checked-in lockfile; no backend. Web MIDI needs a supported browser, HTTPS or localhost, and permission. Kokoro fetches pinned optional runtime/model assets and synthesizes in a module worker, never on the main thread.

## Testing & QA

Use `npm run check` and the relevant `node --test tests/*.test.ts` files. Use the synthetic acceptance and legacy-save fixtures in `openspec/changes/rebuild-keycraft-pwa/fixtures/`; the old browser bundle is not a test dependency.

Verify actual input, dialogs, summaries, and export in a browser. Serve a production build below `/keycraft/` to check the release; verify offline reload and safe update activation on a disposable origin. For voice/MIDI, distinguish simulated failures and device input from real audio and hardware checks.
