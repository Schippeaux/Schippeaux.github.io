"""Generate the public site from data/site.json and data/public.json.

  python tools/build.py

Runs on GitHub Actions after every push (see .github/workflows/pages.yml), so the
generated pages are not committed. data/public.json is written by the editor and only
ever contains public photos.

Writes index.html, <group>/index.html, <group>/<section>/index.html and
<group>/<section>/<chapter>/index.html. A section with a single chapter links straight
to that chapter.
"""
import json, shutil
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data" / "site.json").read_text(encoding="utf-8"))
PUBLIC = json.loads((ROOT / "data" / "public.json").read_text(encoding="utf-8"))
WIDTHS = (800, 1400, 2000, 2800)
MONTHS = "January February March April May June July August September October November December".split()
IMAGE_BASE = SITE.get("image_base", "https://lh3.googleusercontent.com/d").rstrip("/")


def img_url(file_id, w):
    return f"{IMAGE_BASE}/{file_id}=w{w}"


def img(photo, sizes, cls="", eager=False):
    srcset = ", ".join(f"{img_url(photo['id'], w)} {w}w" for w in WIDTHS)
    return (f'<img class="{cls}" src="{img_url(photo["id"], 2000)}" srcset="{srcset}" sizes="{sizes}" '
            f'width="{photo["w"]}" height="{photo["h"]}" alt="" '
            f'loading="{"eager" if eager else "lazy"}" decoding="async">')


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


def paragraphs(text):
    return "".join(f"<p>{escape(p.strip())}</p>" for p in text.split("\n\n") if p.strip())


def page(title, body, extra_head="", body_class=""):
    full = f"{title} — {SITE['title']}" if title else f"{SITE['title']} — {SITE['tagline']}"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(full)}</title>
  <meta name="description" content="{escape(SITE['tagline'])}">
  <meta name="image-base" content="{escape(IMAGE_BASE)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="{escape(IMAGE_BASE.rsplit('/', 1)[0] if IMAGE_BASE.endswith('/d') else IMAGE_BASE)}">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Inter:wght@300;400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/style.css">{extra_head}
</head>
<body class="{body_class}">
  <nav class="topbar">
    <a href="/" class="wordmark">{escape(SITE['title'])}</a>
    <div class="links">{''.join(f'<a href="/{g["slug"]}/">{escape(g["title"])}</a>' for g in SITE['groups'])}</div>
  </nav>
{body}
  <footer class="site-footer">
    <span>© {date.today().year} {escape(SITE['title'])}</span>
    <span>{escape(SITE['camera'])}</span>
  </footer>
  <script src="/assets/viewer.js" defer></script>
  <script src="/assets/site.js" defer></script>
</body>
</html>
"""


def write(path, html):
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")


def load_section(group, section):
    pub = PUBLIC.get("sections", {}).get(section["slug"], {})
    chapters = [c for c in pub.get("chapters", []) if c["photos"]]
    photos = [p for c in chapters for p in c["photos"]]
    s = {**section, "group": group["slug"], "chapters": chapters, "photos": photos,
         "cover_photo": find(photos, pub.get("cover")) if photos else None,
         "planned": section.get("planned", [])}
    s["base"] = f"/{group['slug']}/{section['slug']}/"
    s["url"] = f"{s['base']}{chapters[0]['slug']}/" if len(chapters) == 1 else s["base"]
    return s


def section_meta(s):
    bits = [s["place"], s["year"]]
    if len(s["chapters"]) > 1:
        bits.append(f"{len(s['chapters'])} chapters")
    return " · ".join(escape(b) for b in bits)


def section_list(sections):
    rows = []
    for i, s in enumerate(sections, 1):
        thumb = (img(s["cover_photo"], "(max-width: 700px) 100vw, 40vw", "thumb")
                 if s["cover_photo"] else '<div class="thumb placeholder"><span>In preparation</span></div>')
        rows.append(f"""
    <a class="trip-row{'' if s['chapters'] else ' pending'}" href="{s['url']}">
      <span class="num">{i:02d}</span>
      <div class="trip-text">
        <h3>{escape(s['title'])}</h3>
        <p class="meta">{section_meta(s)}</p>
      </div>
      <div class="trip-thumb">{thumb}</div>
    </a>""")
    return f'<div class="trip-list">{"".join(rows)}\n  </div>'


def build_home(groups):
    all_photos = [p for g in groups for s in g["sections"] for p in s["photos"]]
    hero_photo = next((p for p in all_photos if p["id"] == PUBLIC.get("home_cover")), None)
    if not hero_photo:  # no homepage cover chosen: use the first section's cover
        hero_photo = next((s["cover_photo"] for g in groups for s in g["sections"] if s["cover_photo"]), None)
    hero = img(hero_photo, "100vw", "hero-img", eager=True) if hero_photo else ""
    blocks = "".join(f"""
  <section class="index-section">
    <header class="section-head">
      <p class="eyebrow">{len(g['sections'])} sections</p>
      <h2><a href="/{g['slug']}/">{escape(g['title'])}</a></h2>
    </header>
    {section_list(g['sections'])}
  </section>""" for g in groups)
    body = f"""  <header class="hero">
    {hero}
    <div class="hero-text">
      <p class="eyebrow">{escape(SITE['tagline'])}</p>
      <h1>{escape(SITE['title'])}</h1>
    </div>
  </header>
{blocks}"""
    write("index.html", page("", body))


def build_group(g):
    body = f"""  <header class="page-head">
    <p class="eyebrow">{len(g['sections'])} sections</p>
    <h1>{escape(g['title'])}</h1>
  </header>
  <section class="index-section">
    {section_list(g['sections'])}
  </section>"""
    write(f"{g['slug']}/index.html", page(g["title"], body))


def build_section(s):
    path = f"{s['group']}/{s['slug']}/index.html"
    if len(s["chapters"]) == 1:
        # Single-chapter sections go straight into the chapter
        write(path, f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url={s["url"]}">'
                    f'<link rel="canonical" href="{s["url"]}"><a href="{s["url"]}">{escape(s["title"])}</a>\n')
        return
    if s["cover_photo"]:
        head = f"""  <header class="hero">
    {img(s['cover_photo'], '100vw', 'hero-img', eager=True)}
    <div class="hero-text">
      <p class="eyebrow">{escape(s['place'])} · {escape(s['year'])}</p>
      <h1>{escape(s['title'])}</h1>
    </div>
  </header>"""
    else:
        head = f"""  <header class="page-head">
    <p class="eyebrow">{escape(s['place'])} · {escape(s['year'])}</p>
    <h1>{escape(s['title'])}</h1>
    <p class="status">In preparation</p>
  </header>"""
    if s["chapters"]:
        rows = "".join(f"""
      <li><a href="{s['base']}{c['slug']}/">
        <span class="num">{c['number']:02d}</span>
        <span class="ch-title">{escape(c['title'])}</span>
        <span class="ch-meta">{date_range(c['photos'])}<span class="count">{len(c['photos'])}</span></span>
        <span class="ch-thumb">{img(find(c['photos'], c.get('cover')), '240px')}</span>
      </a></li>""" for c in s["chapters"])
    else:
        rows = "".join(f"""
      <li class="pending"><span class="num">{i:02d}</span><span class="ch-title">{escape(name)}</span><span class="ch-meta">Forthcoming</span></li>"""
                       for i, name in enumerate(s["planned"], 1))
    toc = f'<p class="eyebrow">Contents</p>\n    <ol class="toc">{rows}\n    </ol>' if rows else ""
    body = f"""{head}
  <section class="contents">
    {toc}
  </section>"""
    write(path, page(s["title"], body))


def build_chapter(s, idx):
    c = s["chapters"][idx]
    photos = [{k: p.get(k) for k in ("id", "w", "h", "desc")} for p in c["photos"]]
    data = json.dumps(photos, ensure_ascii=False).replace("</", "<\\/")
    single = len(s["chapters"]) == 1
    prev_c = s["chapters"][idx - 1] if idx > 0 else None
    next_c = s["chapters"][idx + 1] if idx + 1 < len(s["chapters"]) else None
    nav = ""
    if not single:
        back = f'<a class="{{cls}}" href="{s["base"]}"><span class="eyebrow">Back to</span>Contents</a>'
        nav = f"""
    <nav class="chapter-nav">
      {f'<a class="prev" href="{s["base"]}{prev_c["slug"]}/"><span class="eyebrow">Previous</span>{escape(prev_c["title"])}</a>' if prev_c else back.format(cls="prev")}
      {f'<a class="next" href="{s["base"]}{next_c["slug"]}/"><span class="eyebrow">Next</span>{escape(next_c["title"])}</a>' if next_c else back.format(cls="next")}
    </nav>"""
    crumb = (f'<a href="{s["base"]}">{escape(s["title"])}</a> · Chapter {c["number"]:02d}' if not single
             else f'{escape(s["place"])} · {escape(s["year"])}')
    title = s["title"] if single else c["title"]
    text = paragraphs(c.get("text") or "")
    info = (f"""
  <section class="chapter-info">
    {f'<div class="chapter-text">{text}</div>' if text else ''}{nav}
  </section>""" if text or nav else "")
    body = f"""  <div class="chapter-top">
    <header class="chapter-bar">
      <div class="chapter-name">
        <p class="eyebrow">{crumb}</p>
        <h1>{escape(title)}</h1>
      </div>
      <p class="meta">{date_range(c['photos'])} · {len(photos)} photographs</p>
    </header>
    <main class="viewer" id="viewer"></main>
  </div>
  <script type="application/json" id="photos">{data}</script>{info}"""
    write(f"{s['group']}/{s['slug']}/{c['slug']}/index.html",
          page(title if single else f"{c['title']} · {s['title']}", body, body_class="chapter"))


def prune(directory, keep):
    if directory.exists():
        for d in directory.iterdir():
            if d.is_dir() and d.name not in keep:
                shutil.rmtree(d)


def main():
    groups = [{**g, "sections": [load_section(g, s) for s in g["sections"]]} for g in SITE["groups"]]
    build_home(groups)
    for g in groups:
        build_group(g)
        prune(ROOT / g["slug"], {s["slug"] for s in g["sections"]})
        for s in g["sections"]:
            build_section(s)
            prune(ROOT / g["slug"] / s["slug"], {c["slug"] for c in s["chapters"]})
            for i in range(len(s["chapters"])):
                build_chapter(s, i)
            print(f"{g['slug']}/{s['slug']}: {len(s['chapters'])} chapters, {len(s['photos'])} photos")


if __name__ == "__main__":
    main()
