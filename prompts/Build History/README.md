# Build History

Archived copies of previous `prompts/index.html` builds, named
`index_v<version>_<date>.html` (e.g. `index_v0.1.0_2026-11-15.html`).

Before `prompts/index.html` is overwritten for a new release:
1. Copy the current `index.html` here under that name.
2. Rewrite its relative asset paths (`theme.css`, `theme.js`, `claude-panel.js`,
   `prompts.json`, `version.json`, `builds.json`) to climb back up one level
   (`../theme.css`, etc.) so the archived copy still works from this folder.
3. Log the new version in `../builds.json`.

Nothing is archived here yet — v0.1.0 is the first versioned build.
