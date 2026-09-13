# -*- coding: utf-8 -*-
"""Scrape all Free Fire emotes (id + name) from freefirehub,
download official icons, and regenerate emotes.js with every emote."""
import os
import re
import json
import requests

BASE = os.path.dirname(os.path.abspath(__file__))
ICON_DIR = os.path.join(BASE, "assets", "emote-icons")
ICON_URL = "https://raw.githubusercontent.com/ashqking/FF-Items/main/ICONS/{}.png"
CATALOG_URL = "https://freefirehub.com/cosmetics/emotes"

os.makedirs(ICON_DIR, exist_ok=True)

items = {}
for page in range(1, 8):
    url = CATALOG_URL if page == 1 else CATALOG_URL + "?page=%d" % page
    for attempt in range(3):
        try:
            html = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30).text
            break
        except Exception:
            html = ""
    if not html:
        print("FAILED page", page)
        continue
    imgs = re.findall(r"<img[^>]*>", html)
    for tag in imgs:
        m_src = re.search(r'src="[^"]*ICONS/(\d+)\.png"', tag)
        if not m_src:
            continue
        emote_id = m_src.group(1)
        m_alt = re.search(r'alt="([^"]*)"', tag)
        name = m_alt.group(1).strip() if m_alt else emote_id
        items[emote_id] = name
    print("page", page, "parsed", len(imgs), "imgs, total ids", len(items))

print("Total emotes found:", len(items))

# EMOTE ID sets for the reference EXE dashboard sections
EVO_IDS = ["909035012","909000085","909035007","909042008","909049010","909041005",
           "909000063","909039011","909000081","909040010","909000098","909000075",
           "909000068","909000090","909033002","909038010","909033001"]
NORMAL_IDS = ["909000010","909000014","909042007","909000071","909000034","909049012",
              "909000046","909000002","909000039","909000045","909000055","909000074",
              "909000032","909000048","909000086","909000088","909000012","909000052",
              "909000040","909000036","909000038","909000056","909000060","909000064",
              "909000066","909000067","909000069","909000073","909000077","909000078",
              "909000080","909000087","909000091","909000093","909000094","909000095",
              "909000096","909000121","909000125","909000124","909000079"]

def ensure_icon(emote_id):
    path = os.path.join(ICON_DIR, emote_id + ".png")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    try:
        r = requests.get(ICON_URL.format(emote_id), timeout=40)
        if r.status_code == 200 and len(r.content) > 100:
            with open(path, "wb") as f:
                f.write(r.content)
            return True
    except Exception:
        pass
    return False

evos, normals, more = [], [], []
missing = []
for eid in sorted(items.keys(), key=lambda x: int(x)):
    name = items[eid]
    if not ensure_icon(eid):
        missing.append(eid)
        continue
    image = "assets/emote-icons/%s.png" % eid
    obj = {"id": eid, "name": name, "image": image}
    if eid in EVO_IDS:
        evos.append(obj)
    elif eid in NORMAL_IDS:
        normals.append(obj)
    else:
        more.append(obj)

print("EVO:", len(evos), "NORMAL:", len(normals), "MORE:", len(more))
print("Missing icons:", len(missing), missing[:20])

with open(os.path.join(BASE, "./emotes.json.tmp"), "w", encoding="utf-8") as f:
    json.dump({"evos": evos, "normals": normals, "more": more}, f, ensure_ascii=False, indent=1)
print("DONE -> emotes.json.tmp")