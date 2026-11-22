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

## Practice

Just Practice mixes recently introduced material with adaptive review. The curriculum sidebar supports individual root drills and complete branches. Scores, response timing, progress history and voice clips are saved in the browser. Export progress from the sidebar for a JSON backup.

Voice generation runs locally in a Web Worker after model download. Instrument audio comes from your piano.
