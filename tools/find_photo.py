#!/usr/bin/env python3
"""Search Wikimedia Commons for candidate photos.

  python3 tools/find_photo.py "schorl crystal" [out_dir]

Prints the top File: results (with license) and, if out_dir is given, saves small
previews there so you can pick one. Then pin your choice in tools/photo_sources.json
as  "id": "File:Exact name.jpg"  and run  python3 tools/fetch_photos.py id
"""
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_photos import get, strip_tags  # noqa: E402

query = sys.argv[1]
out = Path(sys.argv[2]) if len(sys.argv) > 2 else None
params = dict(action="query", format="json", formatversion="2", generator="search",
              gsrsearch=f"{query} filetype:bitmap", gsrnamespace="6", gsrlimit="8",
              prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth="330")
d = get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params))
pages = sorted(d.get("query", {}).get("pages", []), key=lambda p: p.get("index", 0))
for i, p in enumerate(pages):
    ii = p["imageinfo"][0]
    lic = strip_tags(ii["extmetadata"].get("LicenseShortName", {}).get("value", ""))
    print(f"{i}: {p['title']}  [{lic}] {ii['width']}x{ii['height']}")
    if out:
        out.mkdir(parents=True, exist_ok=True)
        try:
            (out / f"{i}.jpg").write_bytes(get(ii["thumburl"], binary=True, tries=2))
        except Exception as e:  # noqa: BLE001
            print("   preview failed:", e)
        time.sleep(1.5)
