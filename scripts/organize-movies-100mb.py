#!/usr/bin/env python3
"""
One-off migration: promote the 42 catalog entries backing local media files
over 100MB into the Movies section (movieTitle + level:"movie"), with
cleaned-up titles (typos, awkward casing, redundant suffixes, and
nationality/religion/military framing normalized to neutral titles).

Safe by construction: only touches these 42 ids, only adds/overwrites
title, desc, movieTitle, level on those exact entries. Writes a .bak first.
"""
import re
import shutil

CATALOG = "src/shared/catalog-videos.js"

# id -> new title (only where a rename is needed; omitted ids keep title)
RENAMES = {
    1224: "Sultry Confession",
    2021: "Uniform Duty",
    2437: "Studio Session",
    3539: "Silver Screen Fantasy",
    3580: "The Punk Ass",
    4108: "Fiery Redhead Beauty",
    4114: "Barbi Slut: Big Natural",
    4118: "Busty Pink",
    4117: "Cumshot Compilation",
    4131: "Curvy MILF Beauty",
    4201: "Sexy AI Girls Love To Give Blowjob",
    4840: "New Sex Encounter",
    4853: "Redhead Getting Fucked",
    5044: "Best Friends, Best Ass",
    5045: "Absolutely Amazing Beauty II",
    5068: "Chocolate Dreams",
    5084: "Oil Dance II",
    5091: "Big Natural Beauty",
}

# All 42 ids that qualify (over 100MB locally) — these all get movieTitle+level:"movie"
ALL_IDS = [
    1224, 1541, 2021, 2437, 3468, 3484, 3540, 3539, 3580, 4108, 4113, 4115,
    4114, 4116, 4118, 4117, 4123, 4122, 4127, 4129, 4130, 4131, 4201, 4453,
    4840, 4853, 4902, 5044, 5045, 5047, 5068, 5083, 5084, 5085, 5086, 5087,
    5088, 5089, 5090, 5091, 5092, 5094,
]

def main():
    shutil.copy(CATALOG, CATALOG + ".bak")
    with open(CATALOG, "r", encoding="utf-8") as f:
        text = f.read()

    entries = re.findall(r"\{id:\d+.*?\},\n", text)
    by_id = {}
    for e in entries:
        m = re.search(r"id:(\d+)", e)
        if m:
            by_id[int(m.group(1))] = e

    changed = 0
    for vid in ALL_IDS:
        if vid not in by_id:
            print(f"MISSING id {vid}, skipping")
            continue
        entry = by_id[vid]
        original = entry

        new_title = RENAMES.get(vid)
        if new_title:
            # Replace title:"..."
            entry = re.sub(r'title:"[^"]*"', f'title:"{new_title}"', entry, count=1)
            # Replace desc's leading "Watch X — " video-name reference too
            entry = re.sub(
                r'desc:"Watch [^—]*—',
                f'desc:"Watch {new_title} —',
                entry,
                count=1,
            )
            movie_title = new_title
        else:
            m = re.search(r'title:"([^"]*)"', entry)
            movie_title = m.group(1) if m else f"Video {vid}"

        # Add/overwrite movieTitle + level right after id:N,
        if "movieTitle:" in entry:
            entry = re.sub(r'movieTitle:"[^"]*"', f'movieTitle:"{movie_title}"', entry)
        else:
            entry = re.sub(r"(\{id:\d+,)", rf'\1movieTitle:"{movie_title}",', entry, count=1)

        if "level:" in entry:
            entry = re.sub(r'level:"[^"]*"', 'level:"movie"', entry)
        else:
            entry = re.sub(r"(movieTitle:\"[^\"]*\",)", r'\1level:"movie",', entry, count=1)

        if entry != original:
            text = text.replace(original, entry, 1)
            changed += 1

    with open(CATALOG, "w", encoding="utf-8") as f:
        f.write(text)

    print(f"Updated {changed} entries. Backup at {CATALOG}.bak")

if __name__ == "__main__":
    main()
