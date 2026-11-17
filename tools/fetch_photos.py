#!/usr/bin/env python3
"""Fetch one real photo per specimen from Wikipedia / Wikimedia Commons.

Usage:
  python3 tools/fetch_photos.py            # fetch everything missing
  python3 tools/fetch_photos.py id1 id2    # (re)fetch specific ids

Sources come from tools/photo_sources.json: {id: "Wikipedia article title"}.
To pin an exact Commons file instead of an article's lead image, use
{id: "File:Some file name.jpg"}.

Outputs:
  img/s/<id>.jpg         resized photo (max 900px on the long side)
  js/credits.js          author + license for every photo (required by CC licenses)
"""
import io
import json
import re
import subprocess
import sys
import time
import html
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "photo_sources.json"
OUT = ROOT / "img" / "s"
THUMBS = ROOT / "img" / "t"
CREDITS_JSON = ROOT / "tools" / "credits.json"
CREDITS_JS = ROOT / "js" / "credits.js"
UA = "RockCollectorPWA/1.0 (personal educational project)"
MAX_SIDE = 900
THUMB = 300


def make_thumb(sid):
    """Square, center-cropped thumbnail for the collection grid."""
    im = Image.open(OUT / f"{sid}.jpg")
    w, h = im.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    im = im.crop((left, top, left + side, top + side)).resize((THUMB, THUMB), Image.LANCZOS)
    THUMBS.mkdir(parents=True, exist_ok=True)
    im.save(THUMBS / f"{sid}.jpg", "JPEG", quality=72, optimize=True)


def get(url, binary=False, tries=4):
    last = None
    for i in range(tries):
        try:
            if binary:
                # Image files: curl is throttled far less by Wikimedia than urllib.
                r = subprocess.run(["curl", "-sS", "-f", "-L", "-m", "60", "-A", UA, url],
                                   capture_output=True, check=False)
                if r.returncode != 0:
                    raise RuntimeError(r.stderr.decode(errors="replace").strip() or f"curl exit {r.returncode}")
                return r.stdout
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read())
        except Exception as e:  # noqa: BLE001
            last = e
            # Wikimedia rate-limits bursts (HTTP 429); back off generously.
            time.sleep(20 + i * 20 if "429" in str(e) else 3 + i * 3)
    raise last


def api(host, **params):
    params.update(format="json", formatversion="2")
    return get(f"https://{host}/w/api.php?" + urllib.parse.urlencode(params))


def lead_image(title):
    d = api("en.wikipedia.org", action="query", titles=title, prop="pageimages",
            piprop="name", redirects="1")
    pages = d.get("query", {}).get("pages", [])
    if not pages or "pageimage" not in pages[0]:
        return None
    return "File:" + pages[0]["pageimage"]


def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def file_info(file_title):
    for host in ("commons.wikimedia.org", "en.wikipedia.org"):
        ii = None
        # Ask for a standard scaled size. Wikimedia throttles full-size originals hard,
        # so for small originals step down until we get a real /thumb/ URL.
        for width in ("960", "500", "330", "250"):
            d = api(host, action="query", titles=file_title, prop="imageinfo",
                    iiprop="url|extmetadata|mime|size", iiurlwidth=width)
            pages = d.get("query", {}).get("pages", [])
            if not (pages and pages[0].get("imageinfo")):
                break
            ii = pages[0]["imageinfo"][0]
            if "/thumb/" in ii.get("thumburl", ""):
                break
        if ii:
            em = ii.get("extmetadata", {})
            artist = strip_tags(em.get("Artist", {}).get("value", "")) or "Author listed on the source page"
            if len(artist) > 90:
                artist = artist[:87] + "..."
            return {
                "file": file_title,
                "thumb": ii.get("thumburl") or ii["url"],
                "page": ii.get("descriptionurl", ""),
                "artist": artist,
                "license": strip_tags(em.get("LicenseShortName", {}).get("value", "")) or "See source",
                "mime": ii.get("mime", ""),
            }
    return None


def fetch_one(sid, source, credits):
    file_title = source if source.startswith("File:") else lead_image(source)
    if not file_title:
        print(f"!! {sid}: no lead image for '{source}'")
        return False
    info = file_info(file_title)
    if not info:
        print(f"!! {sid}: no file info for {file_title}")
        return False
    if "svg" in info["mime"]:
        print(f"!! {sid}: lead image is an SVG diagram ({file_title})")
        return False
    raw = get(info["thumb"], binary=True)
    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / f"{sid}.jpg", "JPEG", quality=78, optimize=True, progressive=True)
    make_thumb(sid)
    credits[sid] = {k: info[k] for k in ("file", "artist", "license", "page")}
    print(f"ok {sid}: {file_title} [{info['license']}] {im.size}")
    return True


def main():
    sources = json.loads(SRC.read_text())
    credits = json.loads(CREDITS_JSON.read_text()) if CREDITS_JSON.exists() else {}
    wanted = sys.argv[1:] or [s for s in sources if not (OUT / f"{s}.jpg").exists()]
    failed = []
    for sid in wanted:
        try:
            if not fetch_one(sid, sources[sid], credits):
                failed.append(sid)
        except Exception as e:  # noqa: BLE001
            print(f"!! {sid}: {e}")
            failed.append(sid)
        CREDITS_JSON.write_text(json.dumps(credits, indent=1, ensure_ascii=False))
        time.sleep(6)
    for sid in sources:
        if (OUT / f"{sid}.jpg").exists() and not (THUMBS / f"{sid}.jpg").exists():
            make_thumb(sid)
    CREDITS_JS.parent.mkdir(parents=True, exist_ok=True)
    CREDITS_JS.write_text(
        "// Generated by tools/fetch_photos.py - photo author + license for each specimen.\n"
        "export const CREDITS = " + json.dumps(credits, indent=1, ensure_ascii=False) + ";\n")
    print(f"\n{len(credits)} photos credited. Failed: {failed or 'none'}")


if __name__ == "__main__":
    main()
