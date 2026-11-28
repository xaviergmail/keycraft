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

**Just Practice** and **Start suggested drill** give you time with a focus lesson and mix in earlier material when it's due. After a few unaided answers in starter keys you can try the next lesson or keep practicing. Use **Show hint** whenever you need help; assisted answers don't count toward advancing. All-key fluency stays a separate practice goal.

Use the **Free Play** sidebar to choose a root, lesson, or full branch without moving your guided focus. Scores, response timing, progress history, and voice clips stay in the browser. Use **Export progress** for a JSON backup.

Voice generation runs locally in a Web Worker after model download. Instrument audio comes from your piano.
