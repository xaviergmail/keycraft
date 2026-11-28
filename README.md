# KEYCRAFT

Adaptive piano theory practice with Web MIDI, browser-local progress, and optional Kokoro voice prompts.

## Run locally

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Approve MIDI access to use your instrument, or use the on-screen piano.

## Rebuild after editing source

```sh
python3 scripts/build-assets.py
```

This combines lessons.js, curriculum.js, neural-voice.js and app.js into a content-hashed script and updates dist/index.html. Serve dist/ as a static site.

## Publish to GitHub Pages

1. A repository administrator sets **Settings → Pages → Build and deployment → Source** to **GitHub Actions** and makes sure the `github-pages` environment allows deployments from `main`.
2. Push to `main`. The [Pages workflow](.github/workflows/pages.yml) rebuilds that commit and publishes only after the build and upload succeed. No local rebuild is needed for Pages.
3. Open **Actions → Deploy to GitHub Pages** and select the run for that commit. Open the URL shown by the `deploy` job (normally `https://xaviergmail.github.io/keycraft/`) and answer a drill to confirm the site works.

GitHub Pages uses separate browser storage. Progress and cached voice clips from localhost or ChatGPT Sites won't appear there.

## Practice

**Just Practice** and **Start suggested drill** give you time with a focus lesson and mix in earlier material when it's due. After a few unaided answers in starter keys you can try the next lesson or keep practicing. Use **Show hint** whenever you need help; assisted answers don't count toward advancing. All-key fluency stays a separate practice goal.

Use the **Free Play** sidebar to choose a root, lesson, or full branch without moving your guided focus. Scores, response timing, progress history, and voice clips stay in the browser. Use **Export progress** for a JSON backup.

Voice generation runs locally in a Web Worker after model download. Instrument audio comes from your piano.
