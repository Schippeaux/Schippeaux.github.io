# Snaggo

A defects list for an architect — room by room, area by area.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the data, media
and transcription pipeline fit together.

## Running it

Photos work straight away even opened as a local file, but **dictation
(microphone recording) only works when the app is served over HTTPS or
localhost** — that's a browser security rule, not a Snaggo one. Easiest
options:

- **Deploy to GitHub Pages** (free, permanent HTTPS URL, works on any
  phone/tablet): push this folder to a repo, enable Pages on it, open the
  resulting URL on your device, and optionally "Add to Home Screen" for a
  PWA-style icon.
- **Local testing on your PC**: run a static server from this folder, e.g.
  `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Project structure

```
index.html              app shell
css/styles.css          styling (weco.au-inspired: forest green, off-white, IBM Plex Sans)
js/db.js                IndexedDB data layer (projects, areas, defects, photos, audio)
js/media.js             camera capture + dictation recording
js/export.js            project .zip export/import, transcriptions .csv import
js/app.js               routing + all screen rendering
manifest.webmanifest    PWA manifest (installable, themed)
sw.js                   offline cache for the app shell
scripts/transcribe.py   PC-side: unzip an export, transcribe dictations, write transcriptions.csv
docs/ARCHITECTURE.md    the full architecture writeup
```

## Workflow, in short

1. On-site, open Snaggo on your phone/tablet, work through External/Internal
   → rooms/areas → defects, adding photos and dictating notes as you go.
2. Back at your desk, hit **Export project (.zip)** and move the file to
   this project's Snaggo folder on the work server however you normally
   move files.
3. Run `scripts/transcribe.py` against that zip (once the Claude/Gemini call
   is wired up — see the TODOs in that file) to get `transcriptions.csv`.
4. Open that CSV in Excel, check/edit the AI's notes.
5. Back in Snaggo, **Import transcriptions (.csv)** — it matches rows to
   defects by ID and drops the polished note into that defect's Comments.
