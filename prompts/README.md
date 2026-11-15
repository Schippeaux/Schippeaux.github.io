# prompts

A searchable library of reusable prompts. Lives at `schippeaux.github.io/prompts/`.

## Files
- `index.html` — the whole site, self-contained (no build step). Fetches `prompts.json` and renders a searchable, tag-filterable list. Click a card to expand it and reveal a "Copy prompt" button.
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

## Adding a new prompt

This site has no in-browser editor — prompts are added by asking Claude in chat
to add one (paste the prompt, or describe what to add/change), then committing
the updated `prompts.json`. Keep entries sorted newest-first isn't required;
the site sorts/filters client-side.

## Releasing a change

```
git add prompts && git commit -m "prompts: add <title>" && git push
```
No build step, no GitHub Action for this folder — plain static files, live within GitHub Pages' usual propagation delay (~10 min for the edge cache).
