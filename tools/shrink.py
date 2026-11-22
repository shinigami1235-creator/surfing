"""Shrink uploaded photos and record their sizes.

Runs on GitHub before each deploy. For every image in media/:
  - turns it the right way up, removes camera and GPS data,
  - scales it down to 2400 px on the long side (JPEG quality 82),
  - writes a 1000 px copy to media/thumbs/ for the photo grid,
  - records width and height in media/_sizes.json so the grid can line up
    rows before the photos have loaded.

A photo already at or under 2400 px with no camera data is left as it is,
so running this twice changes nothing.

    python tools/shrink.py            # process media/
    python tools/shrink.py some/dir   # process another folder (for testing)
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

FULL = 2400
THUMB = 1000
QUALITY = 82
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def save(im, path, fmt):
    if fmt == "JPEG":
        im.convert("RGB").save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    elif fmt == "WEBP":
        im.save(path, "WEBP", quality=QUALITY, method=5)
    else:
        im.save(path, "PNG", optimize=True)


def process(root):
    media = Path(root)
    thumbs = media / "thumbs"
    thumbs.mkdir(parents=True, exist_ok=True)
    manifest_path = media / "_sizes.json"
    try:
        old = json.loads(manifest_path.read_text())
    except (OSError, ValueError):
        old = {}
    # keep entries for outside images (the Unsplash placeholders)
    sizes = {k: v for k, v in old.items() if k.startswith("http")}
    changed = 0

    for f in sorted(media.rglob("*")):
        if not f.is_file() or f.suffix.lower() not in EXTS or thumbs in f.parents:
            continue
        with Image.open(f) as src:
            fmt = src.format or "JPEG"
            has_exif = bool(src.getexif())
            im = ImageOps.exif_transpose(src)
            im.load()
        if max(im.size) > FULL or has_exif:
            im.thumbnail((FULL, FULL), Image.LANCZOS)
            save(im, f, fmt)
            changed += 1
        t = thumbs / f.relative_to(media)
        t.parent.mkdir(parents=True, exist_ok=True)
        if not t.exists() or t.stat().st_mtime < f.stat().st_mtime:
            th = im.copy()
            th.thumbnail((THUMB, THUMB), Image.LANCZOS)
            save(th, t, fmt)
        key = f"{media.name}/{f.relative_to(media).as_posix()}"
        sizes[key] = [im.width, im.height, 1]

    # drop thumbnails whose photo was deleted
    for t in sorted(thumbs.rglob("*")):
        if t.is_file() and not (media / t.relative_to(thumbs)).exists():
            t.unlink()

    manifest_path.write_text(json.dumps(sizes, indent=1, sort_keys=True) + "\n")
    print(f"{len(sizes)} photos recorded, {changed} shrunk")


if __name__ == "__main__":
    process(sys.argv[1] if len(sys.argv) > 1 else "media")
