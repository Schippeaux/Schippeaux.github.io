# 46 Stanley Street — fit-out schedule

Live: https://schippeaux.github.io/46-stanley-schedule/

Single-file static page (`index.html`), styled like the New Home schedule but
organised **by fixture type** (Lighting, Plumbing, Finishes, Doors & Windows,
Hardware, Appliances, Electrical & Data, HVAC & Energy, Bath Accessories,
External & Structure, Window Furnishings) instead of by room. Every item has a
level (Ground / First / External / Whole house / TBC) and a room tag; the page
filters by level and by status (Undecided → Shortlisted → Specified → Quoted →
Ordered → Installed).

## Where things live

- `index.html` — the catalogue (`CATS` in the script) plus all UI. Placeholder
  items are `P(name, level, room, estimateAUD)`; sourced products are plain
  objects with `price`, `currency`, `url`, `img`, etc. Estimates are rough
  planning allowances, not quotes.
- `lights/` — product photos for sourced items (referenced as `lights/<file>.jpg`).
- `state.json` — synced state: statuses, removed items, edits to built-in items,
  and items added in the page. Written by the page via the GitHub contents API
  (commit message "Update schedule state"); don't hand-edit unless fixing something.

## Sync

Uses the shared `github-token` in localStorage (entered on the home page). The
token needs Contents read/write on `Schippeaux/Schippeaux.github.io`. Without it
the page works per-browser only. Sync is a 3-way merge against the last confirmed
GitHub copy (`46stanley:sync-base`) so a change on one device isn't lost when
another device pushes first — the base is only ever advanced from confirmed
GitHub content, never from an unpushed merge.

Each state push is a commit to `main`, which triggers the Pages deploy workflow.

## Adding products

Download the photo into `lights/` (or a sensible folder) and add the item to the
right group in `CATS`, or add it in the page with **+ Add item** (image URL can
be a remote URL or a repo path). Items with a price/URL/image render as full
cards; the rest stay dashed placeholders.

## Tabs

The page has two top-level tabs: **Roadmap** (`#roadmap`) and **Schedules** (`#<category-id>`, the
catalogue described above). The Roadmap is a data-driven view: `PATHWAYS`, `PHASES` (phase → workstream → task)
and `SOURCES` live in the second `<script>` block at the bottom of `index.html`. Each task lists who owns it
under pathway A (you lead), B (builder-led) or C (hybrid); `"-"` means not part of that pathway. The selected
pathway is kept in `localStorage` (`46stanley:pathway`). Tasks can link into a Schedules category via `link:`.
The Roadmap has no status tracking and nothing is synced to `state.json`.

## Roadmap and Scope Matrix behaviour (v0.4)

- The sticky bar at the top of Roadmap (pathway switch + phases 0-9) is the main navigation; one phase panel shows at a time (`#roadmap/N`).
- Everything is collapsed by default; Expand all / Collapse all act on the visible view.
- Tasks whose `who` entry is `"-"` for the selected pathway are hidden (and empty workstreams with them).
- The Scope Matrix tab appears only when Pathway C is selected; `#scope-matrix` redirects to the Roadmap otherwise. Tabs renumber accordingly.
- Copy is third person ("Architect", "Owner", "Builder"); avoid "you/your".

- **Budget & Fees tab** (`#budget-fees`, `view-budget`): shown for every pathway. Own A/B/C switch, kept in sync with the Roadmap through the `stanley:pathway` event and `46stanley:pathway` in localStorage. Fee amounts are typed per pathway and saved in this browser only (`46stanley:fees`); they are not synced to `state.json`.
