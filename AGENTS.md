# Repository Guidelines

## Project Overview

KeyCraft is a browser-only adaptive piano theory trainer for notes, intervals, scales, chords, and jazz harmony. Play with Web MIDI, the on-screen piano, or a computer keyboard. Progress stays in the browser; spoken prompts are optional.

## Architecture & Data Flow

- `dist/lessons.js` defines `CURRICULUM` with lesson factories. Give new lessons a stable ID and reuse an existing `MODES` entry from `dist/app.js` so they share its generator and evaluators (e.g. `major-triad` uses `chords`). `dist/curriculum.js` schedules new material and review using skill, item, and spelled-root histories in `progress.curriculum.courseV2`.
- `dist/app.js` starts at `initialize()`. `planChallenge()` and `generateChallenge()` create prompts; `onNoteOn()` / `onNoteOff()` funnel all input into shared evaluators. `recordRound()` updates scores and curriculum progress; `persist()` saves progress and `render*()` updates the DOM. The shared `state` separates the active `session` from persisted `progress`.
- `dist/neural-voice.js` serializes synthesis requests and caches versioned audio clips in IndexedDB. `dist/neural-voice-worker.js` loads Kokoro and synthesizes clips off the main thread. Browser speech is a separate engine and can handle neural failures when available.

## Key Directories

- `dist/` is both the editable source tree and the publish root. Edit unhashed JS/CSS and HTML; never hand-edit tracked `keycraft.<hash>.js`, `keycraft.<hash>.css`, or `voice-worker.<hash>.js`.
- `scripts/` holds build tooling. `docs/initial-chat.md` is a historical handoff, not a spec; check its claims against current code.
- `openspec/` holds accepted specs in `specs/` and proposals in `changes/`. OMP discovers the workflow skills in `.agents/skills/`; use `/skill:openspec-explore` to investigate or `/skill:openspec-propose` to draft a change.

## Development Commands

Run from the repository root:

```sh
python3 scripts/build-assets.py                # Rebuild after editing JS, worker, or CSS sources
python3 -m http.server 8000 --directory dist   # Open http://localhost:8000
node --check dist/app.js                      # Optional syntax-only check; use the changed JS path
```

Keep updated HTML references and the corresponding generated files together. The builder does not remove superseded hashes.

## Code Conventions & Common Patterns

- Match existing JS: two spaces, single quotes, semicolons, `camelCase` functions, `UPPER_SNAKE_CASE` constants, and kebab-case DOM IDs/classes. Use `$` / `$$` for DOM lookups and preserve selector, focus, and ARIA behavior when changing markup.
- In CSS, reuse `:root` tokens and match the formatting of neighboring rules; leave unrelated compact blocks alone.
- Use shared state only where needed; pass explicit values and callbacks to helpers rather than introducing a DI layer. Keep session and prompt identity checks around delayed work so stale timers or voice jobs cannot affect the next round. Use `performance.now()` for elapsed response time and `Date.now()` for persisted timestamps.
- Preserve saved progress: keep `keycraft-midi-arcade-v1` and stable lesson IDs. Add new persisted top-level fields to the `loadProgress()` whitelist. Unavailable storage must not stop a run. Keep spelled keys for curriculum history distinct from pitch classes used to evaluate notes.

## Important Files

- `dist/index.html` is the entry point and DOM contract; `dist/styles.css` holds theme tokens and layout. Preserve the single deferred bundle tag and stylesheet link that the builder rewrites.
- `scripts/build-assets.py` concatenates classic scripts in order: lessons, curriculum, neural voice, app. They share one scope; do not add module imports/exports to them. Preserve the literal `'neural-voice-worker.js'` URL in the voice wrapper: the builder substitutes the hashed worker filename.
- `README.md` is the quickstart. `.openai/hosting.json` points ChatGPT Sites at `dist/`; publishing is separate from pushing to GitHub.

## Runtime/Tooling Preferences

Use Python 3's standard library for build and local serving. Node is optional for local checks only; no Bun, package manager, or backend is needed. Web MIDI needs a supported browser (e.g. Chrome or Edge), HTTPS or localhost, and permission. Neural voice fetches pinned `kokoro-js` and model assets on first use and runs inference in browser WASM.

## Testing & QA

No test framework, lint command, CI checks, or coverage target is configured. Use the syntax check above and, for isolated logic, a focused Node `vm` script with minimal DOM stubs. Neither replaces a browser check.

After rebuilding, smoke-test the affected behavior: start **Just Practice** or a sidebar drill, answer using the on-screen keyboard, and check the relevant hint, skip, or completion path. For persistence changes, reload and check progress and **Export progress**. For MIDI or voice changes, verify with a real instrument or audible playback.
