# Schippeaux — Ciarán's photography website

Repo: `Schippeaux/Schippeaux.github.io` (GitHub) — clone locally as
`/home/claude/schippeaux.github.io` (or wherever you've cloned it; `add_repo` +
`register_repo_root` if starting fresh). Push access is expected.

**This repo is a monorepo.** The root is a hand-authored splash page
(`index.html`, a phone-home-screen icon grid) linking out to each of Ciarán's
sites, one per top-level folder (`photography/`, and in time `strummy/`,
`flippy/`, `vueltita/`, `new-home/`, `snaggo/`). This file documents the
`photography/` site specifically — everything below lives under that folder
unless said otherwise. There's a separate "GitHub Pages Site Runbook" doc
(Claude Docs artifact) covering the monorepo-wide process for moving or
adding a site; read that before touching the repo root or another site's
folder.

Live site: https://schippeaux.github.io/photography/
(repo root https://schippeaux.github.io/ is the splash page, not this site)

## How it's built and deployed

- **Static site, generated at deploy time.** `photography/tools/build.py`
  reads the data files and writes the actual HTML pages
  (`photography/index.html`, `photography/travel/**/index.html`, etc.). The
  generated HTML is **not committed to git** — only the generator, assets,
  and data are. Don't hand-edit generated HTML; edit `build.py` or the data
  instead and let the pipeline regenerate it.
- **Absolute paths carry a `/photography` prefix.** The site is mounted
  under `/photography/`, not the domain root, so `build.py` has a
  `SITE_BASE = "/photography"` constant and every absolute `href`/`src`
  it writes is prefixed with it (see `asset()`, `page()`'s nav, and
  `load_section()`'s `s["base"]`). If you add a new absolute "/..." link
  anywhere in generated HTML, route it through `SITE_BASE` the same way —
  a bare `/assets/...` or `/travel/...` will resolve one level too high
  once GitHub Pages serves it. The same applies by hand in
  `photography/edit/index.html` and `photography/edit/editor.js` (their
  fetch URLs and script/link tags are literally `/photography/...`).
- **GitHub Actions** (`.github/workflows/pages.yml`) runs
  `python photography/tools/build.py` on every push to `main` and deploys
  the whole repo (splash page + every site folder, `upload-pages-artifact`
  with `path: .`) to GitHub Pages.
- **Caching gotcha (important):** GitHub Pages' edge cache can serve stale
  content for up to ~10 minutes after a deploy, compounding with the
  browser's own cache. If Ciarán reports something "not showing up" within a
  couple of minutes of a save, the most likely explanation is propagation
  delay, not a real bug — verify against the live HTML/JS directly (curl the
  production URL, diff hashes against local assets) before assuming the code
  is broken. Suggest a hard refresh (Cmd/Ctrl+Shift+R).

## Editing content

There are two ways content changes, and they can happen concurrently:

1. **Ciarán edits live, through the password-protected editor** at
   `/photography/edit/` (`photography/edit/index.html` + `editor.js` +
   `editor.css`). This writes an AES-GCM encrypted
   `photography/data/private.json` (full data, including hidden/unpublished
   photos) directly from the browser and commits it via the GitHub API — **you
   have no password/key and cannot decrypt or directly edit `private.json`.**
   The editor also derives and writes the plaintext
   `photography/data/public.json` (what's actually safe to publish) via a
   function called `publicData()` inside `editor.js`.
2. **You edit `photography/data/public.json` by hand** when needed (e.g. to
   fix something without going through the editor UI). This is safe *as long
   as the result matches what `publicData()` in `editor.js` would itself
   produce* — same filtering rules (only `public === true` chapters/photos,
   etc.). Read `publicData()` first if you're not sure what shape is expected.

**Concurrent-edit workflow — always do this before pushing:**
```
git fetch origin main
```
Check for new commits (they'll typically be titled "Edit photos" — that's
Ciarán's live editor autosaving/committing). Rebase before pushing:
```
git rebase origin/main
```
If `photography/data/public.json` has changed unexpectedly on disk from a fetch/pull,
treat it as the current deliberate state (Ciarán's own save) rather than
reverting it — unless the content actually looks wrong, in which case say so
rather than silently overwriting it.

## Data model

`photography/data/public.json` / the decrypted shape of `private.json`:
```
sections[slug] = {
  cover, text,            // "text" is the journey/section description
  chapters: [
    { folder_id, folder, number, title, slug, text, cover, public,
      insta: [...],        // chapter-scoped, max 10 — the "Instagram" sidebar picks
      photos: [ { id, w, h, date, public, desc }, ... ] }
  ],
  best_of: [ photoId, ... ] // journey-scoped, ordered, can span multiple chapters
}
```
- A **section** (internally still called "section" in code/data, informally
  called a **"Journey"** in UI copy) is a trip/collection; it may or may not
  have **chapters**.
- A chapter is only public if `public === true` (opt-in, not opt-out —
  this was deliberately flipped from opt-out at Ciarán's request).
- `best_of` is filtered at publish time to only photo IDs that are actually
  public (see `publicData()` in `editor.js`).

## Shared viewer component

`photography/assets/viewer.js` defines a single `Viewer` class used both on
the public site and inside the editor (large photo + arrows + filmstrip
reel). Options: `{ hash, fullscreenClick, decorateThumb, onShow,
onThumbClick, autoplay }`. The journey "best-of" hero slideshow at the top
of a journey's contents page uses this same class with
`fullscreenClick: false, autoplay: 5000` and CSS hides its reel/desc box
(`.hero-slideshow .reel, .hero-slideshow .desc { display: none; }` in
`photography/assets/style.css`).

## Testing the editor without the password

The editor is password/crypto-gated, which makes it awkward to test changes
headlessly. Past approach: make a **throwaway copy** of `editor.js` (served
from a temporary directory, never committed) with a `location.search.includes('debug=1')`
branch that bypasses the GitHub/crypto unlock and injects synthetic
`state.site` / `state.data`, then drive it with Playwright. Delete the
debug copy entirely before committing anything for real.

## Useful specifics

- Drag-reorder UI everywhere (filmstrip reel, chapter arrange grid,
  insta-list, best-of list, best-of arrange grid) uses Sortable.js from CDN
  (`sortablejs@1.15.2`).
- `.bestof-slideshow .frame .main { object-fit: cover; }` relies on a CSS
  specificity trick (3 classes) to override the shared 2-class
  `.frame .main { object-fit: contain; }` rule used elsewhere.
- Mobile photo sizing: the viewer uses `object-fit: contain` with
  `width:100%;height:100%` — don't revert to `width:auto;height:auto` +
  `max-width/max-height`, which only ever shrinks and never grows to fill
  the tighter axis (this was a real bug, already fixed).
