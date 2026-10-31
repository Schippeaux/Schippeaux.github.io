"""Generate the static site from data/site.json and data/trips/*.json.

  python tools/build.py

Writes index.html, travel/index.html, travel/<trip>/index.html and
travel/<trip>/<chapter>/index.html. Pages for trips or chapters that no longer
exist in the data are removed.
"""
import json, shutil
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data" / "site.json").read_text(encoding="utf-8"))
WIDTHS = (800, 1400, 2000, 2800)
MONTHS = "January February March April May June July August September October November December".split()


def img_url(file_id, w):
    return f"https://lh3.googleusercontent.com/d/{file_id}=w{w}"


def img(photo, sizes, cls="", eager=False, index=None):
    srcset = ", ".join(f"{img_url(photo['id'], w)} {w}w" for w in WIDTHS)
    attrs = f' data-index="{index}"' if index is not None else ""
    return (f'<img class="{cls}" src="{img_url(photo["id"], 2000)}" srcset="{srcset}" sizes="{sizes}" '
            f'width="{photo["w"]}" height="{photo["h"]}" alt="" '
            f'loading="{"eager" if eager else "lazy"}" decoding="async"{attrs}>')


def date_range(photos):
    dates = sorted(p["date"] for p in photos if p.get("date"))
    if not dates:
        return ""
    a, b = date.fromisoformat(dates[0]), date.fromisoformat(dates[-1])
    if (a.year, a.month) == (b.year, b.month):
        return f"{MONTHS[a.month - 1]} {a.year}"
    if a.year == b.year:
        return f"{MONTHS[a.month - 1]} – {MONTHS[b.month - 1]} {a.year}"
    return f"{MONTHS[a.month - 1][:3]} {a.year} – {MONTHS[b.month - 1][:3]} {b.year}"


def find(photos, file_id):
    return next((p for p in photos if p["id"] == file_id), photos[0])


def page(title, body, description=""):
    full = f"{title} — {SITE['title']}" if title else f"{SITE['title']} — {SITE['tagline']}"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(full)}</title>
  <meta name="description" content="{escape(description or SITE['tagline'])}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://lh3.googleusercontent.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Inter:wght@300;400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <nav class="topbar">
    <a href="/" class="wordmark">{escape(SITE['title'])}</a>
    <div class="links">{''.join(f'<a href="/{s["slug"]}/">{escape(s["title"])}</a>' for s in SITE['sections'])}</div>
  </nav>
{body}
  <footer class="site-footer">
    <span>© {date.today().year} {escape(SITE['title'])}</span>
    <span>{escape(SITE['camera'])}</span>
  </footer>
  <script src="/assets/site.js" defer></script>
</body>
</html>
"""


def write(path, html):
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")


def load_trip(trip):
    f = ROOT / "data" / "trips" / f"{trip['slug']}.json"
    data = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    chapters = [c for c in data.get("chapters", []) if c["photos"]]
    all_photos = [p for c in chapters for p in c["photos"]]
    cover = None
    if all_photos:
        cover = find(all_photos, data.get("cover") or chapters[0]["cover"])
    return {**trip, **{k: v for k, v in data.items() if k != "chapters"},
            "chapters": chapters, "photos": all_photos, "cover_photo": cover,
            "planned": trip.get("chapters", [])}


def trip_meta(trip):
    bits = [trip["place"], trip["year"]]
    if trip["chapters"]:
        bits.append(f"{len(trip['chapters'])} chapters")
    return " · ".join(escape(b) for b in bits)


def trip_list(trips, section):
    rows = []
    for i, t in enumerate(trips, 1):
        thumb = (img(t["cover_photo"], "(max-width: 700px) 100vw, 40vw", "thumb")
                 if t["cover_photo"] else '<div class="thumb placeholder"><span>In preparation</span></div>')
        rows.append(f"""
    <a class="trip-row{'' if t['chapters'] else ' pending'}" href="/{section}/{t['slug']}/">
      <span class="num">{i:02d}</span>
      <div class="trip-text">
        <h3>{escape(t['title'])}</h3>
        <p class="meta">{trip_meta(t)}</p>
      </div>
      <div class="trip-thumb">{thumb}</div>
    </a>""")
    return f'<div class="trip-list">{"".join(rows)}\n  </div>'


def build_home(sections):
    hero_trip = next((t for s in sections for t in s["trips"] if t["cover_photo"]), None)
    hero = (img(hero_trip["cover_photo"], "100vw", "hero-img", eager=True) if hero_trip else "")
    blocks = "".join(f"""
  <section class="index-section">
    <header class="section-head">
      <p class="eyebrow">Section {i:02d}</p>
      <h2><a href="/{s['slug']}/">{escape(s['title'])}</a></h2>
    </header>
    {trip_list(s['trips'], s['slug'])}
  </section>""" for i, s in enumerate(sections, 1))
    body = f"""  <header class="hero">
    {hero}
    <div class="hero-text">
      <p class="eyebrow">{escape(SITE['tagline'])}</p>
      <h1>{escape(SITE['title'])}</h1>
    </div>
  </header>
{blocks}"""
    write("index.html", page("", body))


def build_section(s):
    body = f"""  <header class="page-head">
    <p class="eyebrow">{len(s['trips'])} journeys</p>
    <h1>{escape(s['title'])}</h1>
  </header>
  <section class="index-section">
    {trip_list(s['trips'], s['slug'])}
  </section>"""
    write(f"{s['slug']}/index.html", page(s["title"], body))


def build_trip(s, t):
    base = f"/{s['slug']}/{t['slug']}/"
    if t["cover_photo"]:
        head = f"""  <header class="hero">
    {img(t['cover_photo'], '100vw', 'hero-img', eager=True)}
    <div class="hero-text">
      <p class="eyebrow">{escape(t['place'])} · {escape(t['year'])}</p>
      <h1>{escape(t['title'])}</h1>
    </div>
  </header>"""
    else:
        head = f"""  <header class="page-head">
    <p class="eyebrow">{escape(t['place'])} · {escape(t['year'])}</p>
    <h1>{escape(t['title'])}</h1>
    <p class="status">In preparation</p>
  </header>"""
    intro = f'<p class="intro">{escape(t["intro"])}</p>' if t.get("intro") else ""
    if t["chapters"]:
        rows = "".join(f"""
      <li><a href="{base}{c['slug']}/">
        <span class="num">{c['number']:02d}</span>
        <span class="ch-title">{escape(c['title'])}</span>
        <span class="ch-meta">{date_range(c['photos'])}<span class="count">{len(c['photos'])}</span></span>
        <span class="ch-thumb">{img(find(c['photos'], c['cover']), '240px')}</span>
      </a></li>""" for c in t["chapters"])
        toc = f'<ol class="toc">{rows}\n    </ol>'
    elif t["planned"]:
        rows = "".join(f"""
      <li class="pending"><span class="num">{i:02d}</span><span class="ch-title">{escape(name)}</span><span class="ch-meta">Forthcoming</span></li>"""
                       for i, name in enumerate(t["planned"], 1))
        toc = f'<ol class="toc">{rows}\n    </ol>'
    else:
        toc = ""
    body = f"""{head}
  <section class="contents">
    {intro}
    <p class="eyebrow">Contents</p>
    {toc}
  </section>"""
    write(f"{s['slug']}/{t['slug']}/index.html", page(t["title"], body))


def layout(photos):
    """Group photos into editorial rows: bleed, wide, portrait, or a pair of portraits."""
    rows, landscapes, i = [], 0, 0
    while i < len(photos):
        p = photos[i]
        if p["h"] > p["w"]:
            nxt = photos[i + 1] if i + 1 < len(photos) else None
            if nxt and nxt["h"] > nxt["w"]:
                rows.append(("pair", [(i, p), (i + 1, nxt)]))
                i += 2
                continue
            rows.append(("portrait", [(i, p)]))
        else:
            rows.append(("bleed" if landscapes % 3 == 0 else "wide", [(i, p)]))
            landscapes += 1
        i += 1
    return rows


def build_chapter(s, t, idx):
    c = t["chapters"][idx]
    total = len(c["photos"])
    sizes = {"bleed": "100vw", "wide": "(max-width: 700px) 100vw, 80vw",
             "portrait": "(max-width: 700px) 100vw, 50vw", "pair": "(max-width: 700px) 100vw, 42vw"}
    figs = []
    for kind, items in layout(c["photos"]):
        imgs = "".join(f'<div class="frame">{img(p, sizes[kind], index=n)}</div>' for n, p in items)
        label = " – ".join(f"{n + 1:02d}" for n, _ in items)
        figs.append(f"""
    <figure class="{kind}">
      {imgs}
      <figcaption><span>{label}</span><span>/ {total:02d}</span></figcaption>
    </figure>""")
    prev_c = t["chapters"][idx - 1] if idx > 0 else None
    next_c = t["chapters"][idx + 1] if idx + 1 < len(t["chapters"]) else None
    base = f"/{s['slug']}/{t['slug']}/"
    nav = []
    nav.append(f'<a class="prev" href="{base}{prev_c["slug"]}/"><span class="eyebrow">Previous</span>{escape(prev_c["title"])}</a>'
               if prev_c else f'<a class="prev" href="{base}"><span class="eyebrow">Back to</span>Contents</a>')
    nav.append(f'<a class="next" href="{base}{next_c["slug"]}/"><span class="eyebrow">Next</span>{escape(next_c["title"])}</a>'
               if next_c else f'<a class="next" href="{base}"><span class="eyebrow">Back to</span>Contents</a>')
    intro = f'<p class="intro">{escape(c["intro"])}</p>' if c.get("intro") else ""
    body = f"""  <header class="chapter-head">
    <p class="eyebrow"><a href="{base}">{escape(t['title'])}</a> · Chapter {c['number']:02d}</p>
    <h1>{escape(c['title'])}</h1>
    <p class="meta">{date_range(c['photos'])} · {total} photographs</p>
    {intro}
  </header>
  <main class="sequence">{''.join(figs)}
  </main>
  <nav class="chapter-nav">
    {nav[0]}
    {nav[1]}
  </nav>"""
    write(f"{s['slug']}/{t['slug']}/{c['slug']}/index.html", page(f"{c['title']} · {t['title']}", body))


def prune(directory, keep):
    if directory.exists():
        for d in directory.iterdir():
            if d.is_dir() and d.name not in keep:
                shutil.rmtree(d)


def main():
    sections = [{**s, "trips": [load_trip(t) for t in s["trips"]]} for s in SITE["sections"]]
    build_home(sections)
    for s in sections:
        build_section(s)
        prune(ROOT / s["slug"], {t["slug"] for t in s["trips"]})
        for t in s["trips"]:
            build_trip(s, t)
            prune(ROOT / s["slug"] / t["slug"], {c["slug"] for c in t["chapters"]})
            for i in range(len(t["chapters"])):
                build_chapter(s, t, i)
            print(f"{s['slug']}/{t['slug']}: {len(t['chapters'])} chapters, {len(t['photos'])} photos")


if __name__ == "__main__":
    main()
