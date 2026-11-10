# rig

Design brief and research notes for the solo performance system. Lives at `schippeaux.github.io/rig/`.

## Files
- `index.html` — the whole site, self-contained (fonts from Google Fonts).
- `version.json` — read by the "Check for updates" button in Settings.

## Releasing a change
1. Edit `index.html`.
2. Bump `APP_VERSION` and `APP_DATE` near the top of the `<script>` block.
3. Set the same version, date and a one-line note in `version.json`.
4. `git add rig && git commit -m "rig: vX.Y.Z" && git push`.

The site compares its embedded `APP_VERSION` against `version.json` (fetched with a cache-buster). "Hard refresh" clears any caches and reloads with a fresh query string.

Settings (theme, accent, fonts, sizes) are stored in `localStorage` under `rig.settings.v1`.
