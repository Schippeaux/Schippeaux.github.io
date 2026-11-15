# prompts

A searchable library of reusable prompts. Lives at `schippeaux.github.io/prompts/`.

## Files
- `index.html` — the public page. Fetches `prompts.json` and renders a searchable, tag-filterable list. Click a card to expand it and reveal a "Copy prompt" button.
- `prompts.json` — the data. One object per prompt:
  ```
  {
    "id": "kebab-case-slug",       // unique, used as a stable reference
    "title": "Short descriptive title",
    "tags": ["lowercase", "tags"],
    "added": "YYYY-MM-DD",
    "body": "The full prompt text, as a single string with \n for line breaks."
  }
  ```
- `settings.html` — draft-only Settings page (gear icon, top right of the header). Global typography/size/spacing/look-and-feel controls, presets, a "Copy settings" button, and a type specimen. Not linked from the public nav.
- `theme.css` / `theme.js` — the shared theming foundation both pages consume. Every colour/font/size/spacing choice is a CSS custom property; `theme.js` reads/writes `localStorage['prompts.settings.v1']` and applies it. `window.PromptsTheme` exposes the font list, presets, and load/save/apply helpers — `settings.js` drives the Settings page controls through it.
- `claude-panel.js` — the Claude dev panel (small Claude icon next to the gear, on every page). Slides a pane out from the side; shows the current build version, a newest-first list of previous builds (from `builds.json`), and a notes box. Saving notes commits `dev-notes.json` straight to this repo via the GitHub Contents API, using a fine-grained token kept only in this browser's `localStorage` (`prompts.devnotes.token`) — never committed.
- `dev-notes.json` — the current review notes (plain text in a JSON wrapper). Read it directly when asked to "read the notes and build the next version."
- `version.json` — `{ version, date }` for the current build. Shown in the Settings header, the footer, and the Claude panel.
- `builds.json` — append-only log, oldest first: `{ version, date, notes }` per release.
- `Build History/` — archived copies of previous `index.html` builds (`index_v<version>_<date>.html`), with asset paths rewritten to work from that subfolder. Empty until there's a second release.

## Adding a new prompt

There's no in-browser editor for prompts — add one by asking Claude in chat
(paste the prompt, or describe what to add/change); Claude commits the
updated `prompts.json`. Order in the file doesn't matter — the site
sorts/filters client-side.

## Releasing a new build

1. Make the change (to `index.html`, `settings.html`, `theme.css`/`theme.js`, etc).
2. Before overwriting `index.html`, copy the *current* one into `Build History/index_v<old-version>_<old-date>.html` and fix its relative asset paths to climb up one level (`../theme.css`, `../prompts.json`, …).
3. Bump the version in `version.json` and append an entry to `builds.json`.
4. `git add prompts && git commit -m "prompts: vX.Y.Z — <summary>" && git push`.

No build step, no GitHub Action for this folder — plain static files, live within GitHub Pages' usual propagation delay (~10 min for the edge cache).
