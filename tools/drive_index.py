"""Index a trip folder from Google Drive for desktop into data/trips/<slug>.json.

Reads Drive file IDs from Drive for desktop's local metadata database (a copy, never the
live file) and image size/orientation/date from the photo headers on the G: drive.
Hand-edited fields in an existing JSON (trip/chapter titles, intros, covers, hidden photos)
are kept on re-run.

  python tools/drive_index.py usa-2025 "G:\\My Drive\\02_PHOTOS\\2025\\USA Bikepacking" --include 0 1 2
"""
import argparse, json, os, re, shutil, sqlite3, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DRIVEFS = Path(os.environ["LOCALAPPDATA"]) / "Google" / "DriveFS"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
WEB_IMAGE_EXT = IMAGE_EXT - {".heic"}  # heic won't render in most browsers


def open_db():
    accounts = [p for p in DRIVEFS.iterdir() if (p / "metadata_sqlite_db").exists()]
    if len(accounts) != 1:
        raise SystemExit(f"Expected one Drive account in {DRIVEFS}, found {len(accounts)}")
    tmp = Path(tempfile.mkdtemp(prefix="drivefs-"))
    for suffix in ("", "-wal"):
        src = accounts[0] / f"metadata_sqlite_db{suffix}"
        if src.exists():
            shutil.copy2(src, tmp / src.name)
    return sqlite3.connect(tmp / "metadata_sqlite_db")


def children(db, stable_id):
    return db.execute(
        """select i.stable_id, i.id, i.local_title, i.is_folder from stable_parents p
           join items i on i.stable_id = p.item_stable_id
           where p.parent_stable_id = ? and i.trashed = 0 and i.is_tombstone = 0""",
        (stable_id,),
    ).fetchall()


def find_folder(db, local_path):
    """Walk the local path's components down from 'My Drive' to the folder's stable_id."""
    parts = Path(local_path).parts
    i = parts.index("My Drive")
    sid = db.execute("select stable_id from items where local_title='My Drive' and is_folder=1").fetchone()[0]
    for name in parts[i + 1:]:
        match = [c for c in children(db, sid) if c[2] == name and c[3]]
        if not match:
            raise SystemExit(f"Folder not found in Drive index: {name}")
        sid = match[0][0]
    return sid


def chapter_number(name):
    m = re.match(r"\s*(\d+)\s*-", name)
    return int(m.group(1)) if m else None


def clean_title(name):
    return re.sub(r"^\s*\d+\s*-\s*", "", name).strip()


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def photo_meta(path):
    with Image.open(path) as im:
        w, h = im.size
        exif = im.getexif()
        if exif.get(274) in (5, 6, 7, 8):  # EXIF orientation: rotated 90°
            w, h = h, w
        taken = exif.get_ifd(0x8769).get(36867) or exif.get(306)
    date = taken[:10].replace(":", "-") if taken else None
    return w, h, date


def sequence_key(name):
    m = re.search(r"(\d+)\s+of\s+\d+", name)
    return (int(m.group(1)) if m else 10**6, name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("local_path")
    ap.add_argument("--include", nargs="*", type=int, help="chapter numbers to index (default: all)")
    args = ap.parse_args()

    out = ROOT / "data" / "trips" / f"{args.slug}.json"
    old = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    old_chapters = {c["folder_id"]: c for c in old.get("chapters", [])}

    db = open_db()
    folders = [c for c in children(db, find_folder(db, args.local_path)) if c[3]]
    chapters = []
    for sid, folder_id, name, _ in sorted(folders, key=lambda f: (chapter_number(f[2]) or 0, f[2])):
        num = chapter_number(name)
        if num is None or name.startswith("00"):
            continue  # skips "00 - Best Shots" and unnumbered folders
        if args.include is not None and num not in args.include:
            continue
        prev = old_chapters.get(folder_id, {})
        hidden = set(prev.get("hidden", []))
        photos, skipped = [], 0
        for _, file_id, fname, is_folder in sorted(children(db, sid), key=lambda c: sequence_key(c[2])):
            ext = Path(fname).suffix.lower()
            if is_folder or ext not in WEB_IMAGE_EXT or file_id in hidden:
                skipped += not is_folder and file_id not in hidden
                continue
            w, h, date = photo_meta(Path(args.local_path) / name / fname)
            photos.append({"id": file_id, "w": w, "h": h, "date": date})
        title = prev.get("title") or clean_title(name)
        chapters.append({
            "folder_id": folder_id,
            "folder": name,
            "number": num,
            "slug": prev.get("slug") or slugify(title),
            "title": title,
            "intro": prev.get("intro", ""),
            "cover": prev.get("cover") or (photos[0]["id"] if photos else None),
            "hidden": sorted(hidden),
            "photos": photos,
        })
        print(f"{num:>3}  {title:<50} {len(photos):>3} photos" + (f"  ({skipped} non-image skipped)" if skipped else ""))

    # Keep previously indexed chapters that weren't part of this run
    indexed = {c["folder_id"] for c in chapters}
    chapters += [c for fid, c in old_chapters.items() if fid not in indexed]
    chapters.sort(key=lambda c: c["number"])

    data = {k: v for k, v in old.items() if k != "chapters"}
    data["chapters"] = chapters
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
