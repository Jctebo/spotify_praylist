"""Validate and merge reviewed offline lectionary and Bible cache JSON files."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jobs.publish.offline_lectionary import canonical_reference


READINGS_API = "https://cpbjr.github.io/catholic-readings-api/readings/{year}/{month_day}.json"
DOUAY_API = "https://thedouayrheims.com/api/chapter/{book}/{chapter}"
BOOK_SLUGS = {
    "Genesis": "genesis", "Exodus": "exodus", "Leviticus": "leviticus", "Numbers": "numbers",
    "Deuteronomy": "deuteronomy", "Josue": "josue", "Joshua": "josue", "Judges": "judges", "Ruth": "ruth",
    "1 Samuel": "1-kings", "2 Samuel": "2-kings", "1 Kings": "3-kings", "2 Kings": "4-kings",
    "1 Chronicles": "1-paralipomenon", "2 Chronicles": "2-paralipomenon", "Ezra": "1-esdras", "Nehemiah": "2-esdras",
    "Tobit": "tobias", "Tobias": "tobias", "Judith": "judith", "Esther": "esther", "1 Maccabees": "1-machabees", "2 Maccabees": "2-machabees",
    "Job": "job", "Psalm": "psalms", "Psalms": "psalms", "Proverbs": "proverbs", "Ecclesiastes": "ecclesiastes",
    "Song of Songs": "canticle-of-canticles", "Wisdom": "wisdom", "Sirach": "ecclesiasticus", "Sirarch": "ecclesiasticus", "Ecclesiasticus": "ecclesiasticus",
    "Isaiah": "isaie", "Jeremiah": "jeremie", "Lamentations": "lamentations", "Baruch": "baruch", "Ezekiel": "ezechiel",
    "Daniel": "daniel", "Hosea": "osee", "Joel": "joel", "Amos": "amos", "Obadiah": "abdias", "Jonah": "jonas", "Micah": "micheas",
    "Nahum": "nahum", "Habakkuk": "habacuc", "Zephaniah": "sophonias", "Haggai": "aggeus", "Zechariah": "zacharias", "Malachi": "malachie",
    "Matthew": "matthew", "Mark": "mark", "Luke": "luke", "John": "john", "Acts": "acts", "Romans": "romans",
    "1 Corinthians": "1-corinthians", "2 Corinthians": "2-corinthians", "Galatians": "galatians", "Ephesians": "ephesians",
    "Philippians": "philippians", "Phiippians": "philippians", "Colossians": "colossians", "1 Thessalonians": "1-thessalonians", "2 Thessalonians": "2-thessalonians",
    "1 Timothy": "1-timothy", "2 Timothy": "2-timothy", "Titus": "titus", "Philemon": "philemon", "Hebrews": "hebrews",
    "James": "james", "1 Peter": "1-peter", "2 Peter": "2-peter", "1 John": "1-john", "2 John": "2-john", "3 John": "3-john", "Jude": "jude", "Revelation": "apocalypse", "Apocalypse": "apocalypse",
}
SINGLE_CHAPTER_BOOKS = {"Obadiah", "Philemon", "2 John", "3 John", "Jude"}


def load_object(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def validate(lectionary: dict, bible: dict) -> None:
    entries = lectionary.get("entries")
    passages = bible.get("passages")
    if not isinstance(entries, dict) or not isinstance(passages, dict):
        raise ValueError("Both inputs must contain object-valued entries/passages")
    seen_dates = set()
    for date_key, entry in entries.items():
        if date_key in seen_dates:
            raise ValueError(f"Duplicate lectionary date: {date_key}")
        seen_dates.add(date_key)
        if not isinstance(entry, dict):
            raise ValueError(f"Entry {date_key} must be an object")
        citation = canonical_reference(entry.get("gospel") or (entry.get("readings") or {}).get("gospel"))
        if not citation:
            raise ValueError(f"Entry {date_key} has no Gospel citation")
        if not str(passages.get(citation, "")).strip():
            raise ValueError(f"Missing Bible passage for {date_key}: {citation}")


def _citation_parts(citation: str) -> list[tuple[str, int, int, int | None]]:
    normalized = canonical_reference(citation)
    match = re.match(r"^(.+?)\s+(\d+|[A-F]):(.+)$", normalized)
    if not match:
        for single_book in SINGLE_CHAPTER_BOOKS:
            prefix = f"{single_book} "
            if normalized.startswith(prefix):
                match = (single_book, "1", normalized[len(prefix):])
                break
    if not match:
        raise ValueError(f"Unsupported Bible citation: {citation}")
    book, chapter_text, verses_text = match if isinstance(match, tuple) else match.groups()
    if book not in BOOK_SLUGS:
        raise ValueError(f"Unsupported Douay-Rheims book mapping: {book}")
    chapter = int(chapter_text) if chapter_text.isdigit() else 10 + ord(chapter_text) - ord("A") + 1
    parts: list[tuple[str, int, int, int | None]] = []
    for part in re.split(r"[,;]", verses_text):
        segment = part.strip()
        explicit_chapter = re.match(r"^(\d+):(.+)$", segment)
        segment_chapter = chapter
        if explicit_chapter:
            segment_chapter = int(explicit_chapter.group(1))
            segment = explicit_chapter.group(2).strip()
        numbers = [int(value) for value in re.findall(r"\d+", segment)]
        if not numbers:
            continue
        start = numbers[0]
        if "-" not in segment:
            parts.append((BOOK_SLUGS[book], segment_chapter, start, start))
            continue
        right = segment.split("-", 1)[1].strip()
        right_match = re.match(r"^(\d+):(\d+)", right)
        if right_match:
            end_chapter, end_verse = (int(value) for value in right_match.groups())
            parts.append((BOOK_SLUGS[book], segment_chapter, start, None))
            parts.append((BOOK_SLUGS[book], end_chapter, 1, end_verse))
        else:
            parts.append((BOOK_SLUGS[book], segment_chapter, start, numbers[-1]))
    if not parts:
        raise ValueError(f"Citation contains no verses: {citation}")
    return parts


def _fetch_json(session: requests.Session, url: str) -> dict:
    for attempt in range(3):
        response = session.get(url, timeout=30)
        if response.status_code >= 500 and attempt < 2:
            time.sleep(2**attempt)
            continue
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"Expected JSON object from {url}")
        return payload
    raise RuntimeError(f"Unable to fetch {url}")


def _douay_parts(citation: str) -> list[tuple[str, int, int, int | None]]:
    parts = _citation_parts(citation)
    mapped: list[tuple[str, int, int, int | None]] = []
    for book, chapter, start_verse, end_verse in parts:
        if book == "psalms" and chapter == 147:
            if start_verse <= 11:
                mapped.append((book, 146, start_verse, min(end_verse or 11, 11)))
            if end_verse is None or end_verse > 11:
                mapped.append((book, 147, 1 if start_verse <= 11 else start_verse - 11, None if end_verse is None else end_verse - 11))
        elif book == "psalms" and 11 <= chapter <= 113:
            mapped.append((book, chapter - 1, start_verse, end_verse))
        elif book == "psalms" and 117 <= chapter <= 145:
            mapped.append((book, chapter - 1, start_verse, end_verse))
        elif book == "joel" and chapter == 4:
            mapped.append((book, 3, start_verse, end_verse))
        elif book == "psalms" and chapter == 116:
            if start_verse <= 9:
                mapped.append((book, 114, start_verse, min(end_verse or 9, 9)))
            if end_verse is None or end_verse > 9:
                mapped.append((book, 115, 1 if start_verse <= 9 else start_verse - 9, None if end_verse is None else end_verse - 9))
        else:
            mapped.append((book, chapter, start_verse, end_verse))
    return mapped


def populate_years(start_year: int, end_year: int) -> tuple[dict, dict]:
    if end_year < start_year:
        raise ValueError("end year must be greater than or equal to start year")
    entries: dict[str, dict] = {}
    passages: dict[str, str] = {}
    chapters: dict[tuple[str, int], dict] = {}
    with requests.Session() as session:
        day = dt.date(start_year, 1, 1)
        end = dt.date(end_year, 12, 31)
        while day <= end:
            month_day = day.strftime("%m-%d")
            payload = _fetch_json(session, READINGS_API.format(year=day.year, month_day=month_day))
            raw_readings = payload.get("readings")
            if not isinstance(raw_readings, dict) or not raw_readings.get("gospel"):
                raise ValueError(f"No Gospel citation returned for {day.isoformat()}")
            readings = {}
            for key, value in raw_readings.items():
                if not str(value).strip():
                    continue
                citation = canonical_reference(value)
                if str(key).lower() == "psalm" and re.match(r"^\d+:", citation):
                    citation = f"Psalm {citation}"
                readings[str(key)] = citation
            entries[day.isoformat()] = {
                "mass_title": str(payload.get("season") or "Daily Mass Readings").strip(),
                "readings": readings,
                "gospel": readings["gospel"],
                "source_url": str(payload.get("usccbLink") or "").strip(),
            }
            for citation in readings.values():
                text_parts: list[str] = []
                for book, chapter, start_verse, end_verse in _douay_parts(citation):
                    key = (book, chapter)
                    if key not in chapters:
                        chapters[key] = _fetch_json(session, DOUAY_API.format(book=book, chapter=chapter))
                    verse_map = {
                        int(row["verse"]): str(row.get("text") or "").strip()
                        for row in chapters[key].get("verses", [])
                        if isinstance(row, dict)
                    }
                    selected = [
                        verse_map[number]
                        for number in sorted(verse_map)
                        if number >= start_verse and (end_verse is None or number <= end_verse) and verse_map[number]
                    ]
                    if not selected:
                        selected = [text for number, text in sorted(verse_map.items()) if text]
                    text_parts.extend(selected)
                if not text_parts:
                    raise ValueError(f"No Douay-Rheims text returned for {citation}")
                passages[citation] = " ".join(text_parts)
            day += dt.timedelta(days=1)
    return (
        {"version": f"offline-lectionary-v1-{start_year}-{end_year}", "calendar": "general_roman", "locale": "en", "entries": entries},
        {"version": "douay-rheims-odr-v1", "translation": "Original Douay-Rheims", "license": "CC0/public-domain text; preserve source attribution", "passages": passages},
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lectionary", type=Path)
    parser.add_argument("bible", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--populate-years", nargs=2, type=int, metavar=("START", "END"), help="Fetch and write a reviewed multi-year cache.")
    args = parser.parse_args()
    if args.populate_years:
        lectionary, bible = populate_years(*args.populate_years)
        args.lectionary.write_text(json.dumps(lectionary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        args.bible.write_text(json.dumps(bible, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    else:
        lectionary = load_object(args.lectionary)
        bible = load_object(args.bible)
    validate(lectionary, bible)
    if args.output:
        payload = {"lectionary": lectionary, "bible": bible}
        args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Validated {len(lectionary['entries'])} lectionary entries and {len(bible['passages'])} Bible passages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
