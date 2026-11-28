# KEYCRAFT

Adaptive piano theory practice with Web MIDI, browser-local progress, and optional Kokoro voice prompts.

## Run locally

Use Node.js 24 or later:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. KeyCraft requests Web MIDI access automatically where supported. You can also play with the on-screen piano or the computer keyboard; the octave controls shift the computer keys' range.

## Verify and build

```sh
npm run check
npm test
npm run build
node tools/verify-site.mjs dist
npm run preview
```

`dist/` is generated static output. Use the production preview to verify installation, offline practice, and updates; the development server does not register a service worker.

## Publish to GitHub Pages

1. A repository administrator sets **Settings → Pages → Build and deployment → Source** to **GitHub Actions** and makes sure the `github-pages` environment allows deployments from `main`.
2. Push to `main`. The [Pages workflow](.github/workflows/pages.yml) rebuilds that commit and publishes only after the build and upload succeed. No local rebuild is needed for Pages.
3. Open **Actions → Deploy to GitHub Pages** and select the run for that commit. Open the URL shown by the `deploy` job (normally `https://xaviergmail.github.io/keycraft/`) and answer a drill to confirm the site works.

GitHub Pages uses separate browser storage. Progress and cached voice clips from localhost or ChatGPT Sites won't appear there.

To publish to ChatGPT Sites, build and verify `dist/` locally, then publish that directory separately. Neither host needs a backend.

## Practice

**Just Practice** and **Start suggested drill** mix focus practice with earlier material that is due for review. A new lesson is offered after every admitted lesson meets the mastery gate, including four consecutive unaided clears in each of its 17 spelled keys. Hints and worked examples help you learn but don't count toward independent recall.

**Free Play** lets you choose a key, lesson, or full section without advancing the guided path. Lesson scores keep enharmonic spellings such as G♯ and A♭ separate. **Export progress** downloads a JSON backup; there is no in-app import. Saved progress migrates automatically on the same origin.

Kokoro prepares spoken prompts in the background after a model download. If a clip isn't ready, KeyCraft tries browser speech without waiting for synthesis. Once offline practice is ready, you can reload and train without downloading the model. Instrument audio comes from your piano.
