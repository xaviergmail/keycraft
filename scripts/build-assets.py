import hashlib
import logging
import re
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / "dist"


def fingerprint(name, content):
    digest = hashlib.sha256(content).hexdigest()[:16]
    path = Path(name)
    filename = f"{path.stem}.{digest}{path.suffix}"
    (DIST / filename).write_bytes(content)
    return filename


def main():
    worker = fingerprint("voice-worker.js", (DIST / "neural-voice-worker.js").read_bytes())
    sources = [(DIST / name).read_text() for name in
               ("lessons.js", "curriculum.js", "neural-voice.js", "app.js")]
    bundle = "\n;\n".join(sources).replace("'neural-voice-worker.js'", repr(worker))
    script = fingerprint("keycraft.js", bundle.encode())
    style = fingerprint("keycraft.css", (DIST / "styles.css").read_bytes())
    page = DIST / "index.html"
    html = re.sub(r'(<script src=")[^"]+(" defer></script>)', lambda m: m[1] + script + m[2],
                  page.read_text(), count=1)
    html = re.sub(r'  <script src="(?:curriculum|neural-voice|app)\.js" defer></script>\n', '', html)
    page.write_text(re.sub(r'(<link rel="stylesheet" href=")[^"]+', lambda m: m[1] + style, html))
    logging.info("Built %s", script)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
