# prompts

A searchable library of reusable prompts. Lives at `schippeaux.github.io/prompts/`.

## Files
- `index.html` — the public page. A left sidebar categorises prompts (from each entry's `category`); the main column has a search box and tag filter over the currently-selected category. Click a card to expand it and reveal a "Copy prompt" button.
- `prompts.json` — the data. One object per prompt:
  ```
  {
    "id": "kebab-case-slug",       // unique, used as a stable reference
    "title": "Short descriptive title",
    "category": "Websites",        // single primary grouping, shown in the left sidebar
    "tags": ["lowercase", "tags"], // finer-grained, multi-select filter
    "added": "YYYY-MM-DD",
    "body": "The full prompt text, as a single string with \n for line breaks."
  }
  ```
- `theme.css` / `theme.js` — the shared theming foundation every page consumes. Every colour/font/size/spacing choice is a CSS custom property; `theme.js` reads/writes `localStorage['prompts.settings.v1']` and applies it live. `window.PromptsTheme` exposes the font list, presets, device list (`DEVICES`, for "view as mobile"), and load/save/apply helpers.
- `settings-panel.js` — the Settings panel (gear icon in the header, on every page). Slides in from the **right**. Typography/size/spacing/look-and-feel controls, presets, "Copy settings", a type specimen, a Preview group (mobile-device picker), and draft toggles. Not part of the public nav.
- `claude-panel.js` — the Claude dev panel (small Claude icon next to the gear, on every page). Also slides in from the **right**. Shows the current build version, a newest-first list of previous builds (from `builds.json`), and a notes box. Saving notes commits `dev-notes.json` straight to this repo via the GitHub Contents API, using a fine-grained token kept only in this browser's `localStorage` (`prompts.devnotes.token`) — never committed.
- Settings and Claude share that right edge and are **mutually exclusive** — opening one closes the other (`prompts:panel-opening` custom event, listened for by both). Neither dims or blocks the rest of the page — the site underneath stays fully interactive, so Settings changes apply live and can be tuned while watching the result. Close a panel with its own × button, its icon again, or Esc — not by clicking elsewhere on the page.
- `mobile-mode.js` — the phone/desktop toggle icon, left of the gear. Not an overlay or an iframe: it narrows `index.html`'s own `.shell` element (which has `container-type: inline-size`) to a chosen device's real width, so the page's `@container`-based responsive rules fire for real and the page stays fully interactive — a genuine reflow of the live page, not a screenshot. The icon swaps to a desktop glyph while active; clicking it again restores full width. The device is the same persisted `previewDevice` setting as the Settings panel's Preview group. This toggle is independent of the Settings/Claude mutual exclusion — it's a standing layout state, not a transient panel.
- `dev-notes.json` — the current review notes (plain text in a JSON wrapper). Read it directly when asked to "read the notes and build the next version." Cleared back to `""` once its notes have been acted on.
- `version.json` — `{ version, date }` for the current build. Shown in the Settings panel, the footer, and the Claude panel.
- `builds.json` — append-only log, oldest first: `{ version, date, notes }` per release.
- `Build History/` — archived copies of previous `index.html` builds (`index_v<version>_<date>.html`), with asset paths rewritten to work from that subfolder.

## Adding a new prompt

There's no in-browser editor for prompts — add one by asking Claude in chat
(paste the prompt, or describe what to add/change, and which category it
belongs under); Claude commits the updated `prompts.json`. Order in the file
doesn't matter — the site sorts/filters client-side.

## Releasing a new build

1. Make the change (to `index.html`, the panel scripts, `theme.css`/`theme.js`, etc).
2. Before overwriting `index.html`, copy the *current* one into `Build History/index_v<old-version>_<old-date>.html` and fix its relative asset paths to climb up one level (`../theme.css`, `../prompts.json`, …).
3. Bump the version in `version.json` and append an entry to `builds.json`.
4. `git add prompts && git commit -m "prompts: vX.Y.Z — <summary>" && git push`.

No build step, no GitHub Action for this folder — plain static files, live within GitHub Pages' usual propagation delay (~10 min for the edge cache).
