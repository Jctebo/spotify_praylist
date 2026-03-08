import datetime
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from jobs.novena.generate_daily_novena_prayer import (  # noqa: E402
    NOTION_SAINT_CELEBRATION_PROPERTY,
    NOTION_SAINT_DATABASE_ID,
    NOTION_SAINT_DATABASE_NAME,
    NOTION_SAINT_FEAST_DAY_PROPERTY,
    NOTION_SAINT_PRECEDENCE_PROPERTY,
    NOTION_SAINT_TITLE_PROPERTY,
    notion_find_database_id_by_name,
    notion_get_all_pages,
    page_date,
    page_title,
    require_env,
)


NOTION_TOKEN = "NOTION_TOKEN"
LITURGICAL_ICS_OUTPUT = "LITURGICAL_ICS_OUTPUT"  # default docs/liturgical.ics
LITURGICAL_ICS_TZ = "LITURGICAL_ICS_TZ"  # default UTC


def page_property_scalar(page: Dict[str, Any], property_name: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(property_name) or {}
    ptype = str(prop.get("type", "")).strip()
    if ptype == "select":
        sel = prop.get("select") or {}
        return str(sel.get("name", "")).strip()
    if ptype == "rich_text":
        vals = prop.get("rich_text") or []
        parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)]
        return " ".join(p for p in parts if p).strip()
    if ptype == "title":
        vals = prop.get("title") or []
        parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)]
        return " ".join(p for p in parts if p).strip()
    if ptype == "multi_select":
        vals = prop.get("multi_select") or []
        parts = [str(v.get("name", "")).strip() for v in vals if isinstance(v, dict)]
        return ", ".join(p for p in parts if p).strip()
    if ptype == "formula":
        formula = prop.get("formula") or {}
        ftype = str(formula.get("type", "")).strip()
        if ftype == "string":
            return str(formula.get("string", "")).strip()
        if ftype == "number":
            num = formula.get("number")
            return "" if num is None else str(num)
    return ""


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", str(text or "").strip().lower())
    return re.sub(r"-+", "-", cleaned).strip("-") or "event"


def ics_escape(text: str) -> str:
    value = str(text or "")
    value = value.replace("\\", "\\\\")
    value = value.replace(";", r"\;").replace(",", r"\,")
    value = value.replace("\r\n", "\n").replace("\r", "\n").replace("\n", r"\n")
    return value


def fold_ics_line(line: str, limit: int = 75) -> List[str]:
    if len(line) <= limit:
        return [line]
    out = [line[:limit]]
    remainder = line[limit:]
    while remainder:
        out.append(" " + remainder[: limit - 1])
        remainder = remainder[limit - 1 :]
    return out


def parse_date(value: str) -> Optional[datetime.date]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.date.fromisoformat(text[:10])
    except Exception:
        return None


def render_ics(rows: List[Dict[str, str]]) -> str:
    now = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines: List[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//spotify_praylist//Liturgical Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Liturgical Calendar",
    ]
    for row in rows:
        date_obj = parse_date(row.get("date", ""))
        name = str(row.get("name", "")).strip()
        if not date_obj or not name:
            continue
        day = date_obj.strftime("%Y%m%d")
        day_end = (date_obj + datetime.timedelta(days=1)).strftime("%Y%m%d")
        rank = str(row.get("rank", "")).strip()
        precedence = str(row.get("precedence", "")).strip()
        description_parts = []
        if rank:
            description_parts.append(f"Celebration Rank: {rank}")
        if precedence:
            description_parts.append(f"Precedence: {precedence}")
        description = "\n".join(description_parts).strip()
        uid = f"{date_obj.isoformat()}-{slugify(name)}@spotify-praylist"

        event_lines = [
            "BEGIN:VEVENT",
            f"UID:{ics_escape(uid)}",
            f"DTSTAMP:{now}",
            f"DTSTART;VALUE=DATE:{day}",
            f"DTEND;VALUE=DATE:{day_end}",
            f"SUMMARY:{ics_escape(name)}",
        ]
        if description:
            event_lines.append(f"DESCRIPTION:{ics_escape(description)}")
        event_lines.append("END:VEVENT")

        for event_line in event_lines:
            lines.extend(fold_ics_line(event_line))

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def main() -> int:
    try:
        notion_token = require_env(NOTION_TOKEN)
        saint_db_id = os.getenv(NOTION_SAINT_DATABASE_ID, "").strip()
        if not saint_db_id:
            saint_db_name = os.getenv(NOTION_SAINT_DATABASE_NAME, "Liturgical Calendar").strip() or "Liturgical Calendar"
            saint_db_id = notion_find_database_id_by_name(notion_token, saint_db_name) or ""
        if not saint_db_id:
            raise RuntimeError("Liturgical Calendar database not found. Set NOTION_SAINT_DATABASE_ID or NOTION_SAINT_DATABASE_NAME.")

        title_property = os.getenv(NOTION_SAINT_TITLE_PROPERTY, "Name").strip() or "Name"
        feast_property = os.getenv(NOTION_SAINT_FEAST_DAY_PROPERTY, "Feast Day").strip() or "Feast Day"
        rank_property = os.getenv(NOTION_SAINT_CELEBRATION_PROPERTY, "Celebration Rank").strip() or "Celebration Rank"
        precedence_property = os.getenv(NOTION_SAINT_PRECEDENCE_PROPERTY, "Precedence").strip() or "Precedence"

        pages = notion_get_all_pages(saint_db_id, notion_token)
        rows: List[Dict[str, str]] = []
        for page in pages:
            day = page_date(page, feast_property).strip()
            name = page_title(page, title_property).strip()
            if not day or not name:
                continue
            rows.append(
                {
                    "date": day,
                    "name": name,
                    "rank": page_property_scalar(page, rank_property),
                    "precedence": page_property_scalar(page, precedence_property),
                }
            )

        rows.sort(key=lambda r: (str(r.get("date", "")), str(r.get("name", "")).lower()))
        ics_text = render_ics(rows)

        output_path = Path(os.getenv(LITURGICAL_ICS_OUTPUT, "docs/liturgical.ics").strip() or "docs/liturgical.ics")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(ics_text, encoding="utf-8")
        print(f"SUMMARY db={saint_db_id} rows={len(rows)} output={output_path}")
        return 0
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
