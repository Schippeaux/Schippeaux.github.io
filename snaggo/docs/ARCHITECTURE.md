# Snaggo — architecture

## What it is

A single-page web app (no backend) for recording and tracking defects
room-by-room / area-by-area during a site visit, with the dictation-to-notes
step handed off to a PC script.

## Why it's shaped this way

- **All project data lives in the browser (IndexedDB)**, on whatever device
  you recorded it on. There is no server, no account, no sync service — one
  less thing to go wrong on-site, and your data never leaves the device
  except when you explicitly export it.
- **The app itself needs to be served over HTTPS** (GitHub Pages, Netlify,
  etc.) purely because browsers refuse microphone access (`MediaRecorder` /
  `getUserMedia`) outside a secure context. This has nothing to do with your
  data being online — nothing is ever uploaded by the app itself. Camera
  photo capture doesn't have this restriction (it's just the OS file/camera
  picker), so that would work even opened as a local file.
- **A PWA shell (`manifest.webmanifest` + `sw.js`)** caches the app so it
  still opens with no signal on-site. All the actual project data is local
  anyway (IndexedDB), so this is just about the shell (HTML/CSS/JS/fonts)
  being available offline too.
- **Export produces a `.zip`, not a live sync.** Since devices vary
  (iOS/Android) and a backend was explicitly out of scope, the zip is the
  one portable, inspectable artifact that moves data between the field
  device and your PC/server by whatever manual means is convenient
  (AirDrop, cable, OneDrive, email).
- **CSV only appears once, deliberately** — as the review checkpoint between
  raw dictation and a permanent record. Everything else (the live project
  data) is JSON inside the zip, because it has to carry binary blobs and a
  nested structure CSV can't represent cleanly. CSV earns its place
  specifically because you'll want to eyeball/edit the AI's notes in Excel
  before they go into a defect's Comments.

## Data model (IndexedDB stores, mirrored in the export manifest)

```
meta        { key: 'project', name, description, createdAt }
drawings    { id, name, blob, createdAt }
areas       { id, kind: 'external' | 'internal', name, order, createdAt }
defects     { id (human code, e.g. INT-BATH2-03), areaId, seq, title,
              description, comments, status: 'Incomplete' | 'Defect',
              complete: bool, createdAt, updatedAt }
photos      { id, defectId, blob, order, createdAt }
audio       { id, defectId, blob, mimeType,
              transcriptRaw, transcriptPolished, transcriptStatus,
              createdAt }
```

**Defect IDs double as filenames.** `INT-BATH2-03` = Internal, area slug
`BATH2`, 3rd defect added in that area. Export writes photos/audio as
`photos/INT-BATH2-03_1.jpg`, `audio/INT-BATH2-03_1.webm`, etc. — so even
someone just browsing the unzipped folder on the server can tell what
belongs where without opening `manifest.json`.

## End-to-end flow

```
┌─────────────────────┐   Export (.zip)    ┌──────────────────────────┐
│ Snaggo in the        │ ─────────────────▶ │ Your work server,        │
│ browser, on whatever │   (AirDrop/USB/    │ per-project Snaggo folder│
│ phone/tablet is to   │    OneDrive/email  │                          │
│ hand that day        │    — however you   └──────────────┬───────────┘
│ (IndexedDB)          │    move files today)               │
└─────────┬────────────┘                                    │ run manually
          ▲                                                 ▼
          │                                     scripts/transcribe.py
          │ Import (.csv)                       (unzips, transcribes each
          │ via "Import transcriptions"         audio/*, asks Claude/Gemini
          │ button — matches defect_id,         to polish into a professional
          │ appends to Comments                 note)
          │                                                 │
          └─────────────────────── transcriptions.csv ◀─────┘
                                   (you review/edit in Excel
                                    before importing back)
```

## Shipping a change — don't forget the version bump

Every deploy, bump `SNAGGO_VERSION` in `js/version.js`. That one edit does
two things: it's what shows in the home page footer so you can tell at a
glance whether a device has actually picked up the new version, and —
because `sw.js` `importScripts()`s it into its cache name — it's also what
makes the browser notice the service worker changed and fetch everything
fresh. Skip it and a device that already has Snaggo open can keep serving
its old cached JS indefinitely, which looks exactly like "the change didn't
go live" even though the deploy succeeded. `sw.js` is network-first for the
app's own files regardless, so this mostly matters for the one edge case of
a tab that's been open since before the deploy, or a PWA opened while fully
offline.

## Open items / decisions deferred on purpose

- **Which model transcribes** (Claude vs Gemini) — `scripts/transcribe.py`
  has both call sites stubbed with the exact code to drop in once you
  decide; nothing else changes either way, since the CSV format is the
  same regardless.
- **Hosting** — any static host works (GitHub Pages is the free, zero-config
  option). The app is 100% static files; there's nothing to configure
  server-side.
- **Multi-defect photo/audio ordering, project templates, a defect "status"
  beyond Incomplete/Defect** — not built yet; the data model has room for
  it (`order`, `seq` fields) if it turns out to matter in practice.
