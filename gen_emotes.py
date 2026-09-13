# -*- coding: utf-8 -*-
"""Generate final emotes.js:
- EVO_EMOTES / NORMAL_EMOTES: kept verbatim from current file (reference names + lovable images)
- RARE_EMOTES: everything else scraped from freefirehub (id + official icon), names html-unescaped
"""
import os
import re
import json
import html as htmlmod

BASE = os.path.dirname(os.path.abspath(__file__))

current = open(os.path.join(BASE, "emotes.js"), "r", encoding="utf-8").read()

def extract_array(text, marker):
    start = text.index(marker)
    end = text.index("];", start) + 2
    return text[start:end]

evo_src = extract_array(current, "var EVO_EMOTES = [")
normal_src = extract_array(current, "var NORMAL_EMOTES = [")

tmp = json.loads(open(os.path.join(BASE, "emotes.json.tmp"), "r", encoding="utf-8").read())
rare = []
for item in tmp["more"]:
    rare.append({
        "id": item["id"],
        "name": htmlmod.unescape(item["name"]).strip() or item["id"],
        "image": item["image"],
    })
# sort rare by id numeric
rare.sort(key=lambda i: int(i["id"]))

def js_array(name, items):
    out = [name + " = ["]
    for it in items:
        out.append('  { id: %s, name: %s, image: %s },' % (
            json.dumps(it["id"]), json.dumps(it["name"]), json.dumps(it["image"])))
    out.append("];")
    return "\n".join(out)

header = """// XG THUNDER EMOTE — Free Fire emote catalogue
// EVO / NORMAL: reference EXE dashboard sets. RARE: all other Free Fire emotes.
"""

lines = [header, evo_src, "", normal_src, "", js_array("var RARE_EMOTES", rare), ""]
open(os.path.join(BASE, "emotes.js"), "w", encoding="utf-8").write("\n".join(lines))

print("EVO entries:", len(re.findall(r"id:\s*\"9090", evo_src)))
print("NORMAL entries:", len(re.findall(r"id:\s*\"9090", normal_src)))
print("RARE entries:", len(rare))