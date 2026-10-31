"""Send photos from a Drive section folder to the editor as an encrypted batch.

Reads Drive file IDs from Drive for desktop's local metadata database (a copy, never the
live file) and image size/orientation/date from the photo headers on the G: drive, then
writes data/inbox/<section>-<time>.json, encrypted with the editor's public key
(data/inbox-key.pem) so hidden photo IDs never appear in the public repo. The editor
merges the batch on next login: new photos are added, existing ones keep their
public/hidden state, order, descriptions and Instagram picks.

  python tools/drive_index.py usa-2025 "G:\\My Drive\\02_PHOTOS\\2025\\USA Bikepacking" --include 3 4 5
  python tools/drive_index.py usa-2025 "<path>" --include 1 --title "1=Seattle & Olympic National Park"

New photos arrive hidden unless --public is given.
"""
import argparse, base64, json, os, re, shutil, sqlite3, tempfile, time
from pathlib import Path
from PIL import Image
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parent.parent
DRIVEFS = Path(os.environ["LOCALAPPDATA"]) / "Google" / "DriveFS"
WEB_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


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


def encrypt_for_editor(payload):
    pem = ROOT / "data" / "inbox-key.pem"
    if not pem.exists():
        raise SystemExit("data/inbox-key.pem not found: set up the editor at /edit/ first, then git pull")
    public_key = serialization.load_pem_public_key(pem.read_bytes())
    key = AESGCM.generate_key(bit_length=256)
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(payload).encode(), None)
    ek = public_key.encrypt(key, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    b64 = lambda b: base64.b64encode(b).decode()
    return {"v": 1, "ek": b64(ek), "iv": b64(iv), "ct": b64(ct)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("section", help="section slug from data/site.json, e.g. usa-2025")
    ap.add_argument("local_path")
    ap.add_argument("--include", nargs="*", type=int, help="chapter numbers to send (default: all)")
    ap.add_argument("--public", action="store_true", help="new photos start public instead of hidden")
    ap.add_argument("--title", action="append", default=[], metavar='N="Title"', help="chapter title for new chapters")
    ap.add_argument("--cover", help="Drive file ID for the section cover, if it has none yet")
    args = ap.parse_args()
    titles = {int(k): v for k, v in (t.split("=", 1) for t in args.title)}

    db = open_db()
    folders = [c for c in children(db, find_folder(db, args.local_path)) if c[3]]
    chapters, slugs = [], set()
    for sid, folder_id, name, _ in sorted(folders, key=lambda f: (chapter_number(f[2]) or 0, f[2])):
        num = chapter_number(name)
        if num is None or name.startswith("00"):
            continue  # skips "00 - Best Shots" and unnumbered folders
        title = titles.get(num) or clean_title(name)
        # Chapter addresses must be unique within a section (two folders can share a name).
        # Worked out over every folder, so they stay the same whichever chapters a run sends.
        slug = slugify(title)
        if slug in slugs:
            slug = f"{slug}-{num}"
        slugs.add(slug)
        if args.include is not None and num not in args.include:
            continue
        photos = []
        for _, file_id, fname, is_folder in sorted(children(db, sid), key=lambda c: sequence_key(c[2])):
            if is_folder or Path(fname).suffix.lower() not in WEB_IMAGE_EXT:
                continue
            w, h, date = photo_meta(Path(args.local_path) / name / fname)
            photos.append({"id": file_id, "w": w, "h": h, "date": date})
        chapters.append({"folder_id": folder_id, "folder": name, "number": num,
                         "title": title, "slug": slug, "photos": photos})
        print(f"{num:>3}  {title:<50} {len(photos):>3} photos")

    batch = {"section": args.section, "default_public": args.public, "cover": args.cover, "chapters": chapters}
    out = ROOT / "data" / "inbox" / f"{args.section}-{time.strftime('%Y%m%d-%H%M%S')}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(encrypt_for_editor(batch)) + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT)} (encrypted) - the editor merges it on next login")


if __name__ == "__main__":
    main()
