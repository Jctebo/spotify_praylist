import datetime
import os
import sys
from typing import List, Dict

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from jobs.novena.generate_daily_novena_prayer import (
    NOTION_DATABASE_ID,
    NOTION_SAINT_BACKGROUND_PROPERTY,
    NOTION_SAINT_CELEBRATION_PROPERTY,
    NOTION_SAINT_DATABASE_ID,
    NOTION_SAINT_DATABASE_NAME,
    NOTION_SAINT_FEAST_DAY_PROPERTY,
    NOTION_SAINT_PRECEDENCE_PROPERTY,
    NOTION_SAINT_RADAR_ENABLED,
    NOTION_SAINT_TITLE_PROPERTY,
    ROMCAL_CALENDAR,
    ROMCAL_LOCALE,
    collect_calendar_days_window,
    int_env,
    local_today,
    notion_find_database_id,
    notion_find_database_id_by_name,
    notion_get_all_pages,
    notion_call,
    notion_page_is_archived,
    page_date,
    page_title,
    require_env,
    sync_saint_radar,
)

LITURGICAL_CALENDAR_DATABASE_ID = "LITURGICAL_CALENDAR_DATABASE_ID"  # optional explicit liturgical calendar db id
LITURGICAL_CALENDAR_DATABASE_NAME = "LITURGICAL_CALENDAR_DATABASE_NAME"  # optional explicit liturgical calendar db name
LITURGICAL_SYNC_START_DATE = "LITURGICAL_SYNC_START_DATE"  # optional YYYY-MM-DD
LITURGICAL_SYNC_END_DATE = "LITURGICAL_SYNC_END_DATE"  # optional YYYY-MM-DD
LITURGICAL_SYNC_TARGET_YEAR = "LITURGICAL_SYNC_TARGET_YEAR"  # optional YYYY
LITURGICAL_SYNC_END_YEAR = "LITURGICAL_SYNC_END_YEAR"  # optional YYYY
LITURGICAL_DEDUPE_EXACT = "LITURGICAL_DEDUPE_EXACT"  # default true


def bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


def parse_date(name: str) -> datetime.date:
    raw = os.getenv(name, "").strip()
    if not raw:
        raise RuntimeError(f"Missing required date env: {name}")
    try:
        return datetime.date.fromisoformat(raw)
    except Exception:
        raise RuntimeError(f"Invalid {name} '{raw}'. Use YYYY-MM-DD.")


def optional_date(name: str) -> datetime.date | None:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        return datetime.date.fromisoformat(raw)
    except Exception:
        raise RuntimeError(f"Invalid {name} '{raw}'. Use YYYY-MM-DD.")


def compute_range(today: datetime.date) -> tuple[datetime.date, datetime.date]:
    start_date = optional_date(LITURGICAL_SYNC_START_DATE)
    end_date = optional_date(LITURGICAL_SYNC_END_DATE)
    target_year = int_env(LITURGICAL_SYNC_TARGET_YEAR, default=0, min_value=1900, max_value=2100)
    end_year = int_env(LITURGICAL_SYNC_END_YEAR, default=0, min_value=1900, max_value=2100)

    if target_year:
        start = datetime.date(target_year, 1, 1)
        end = datetime.date(target_year, 12, 31)
        return start, end

    if start_date is None and end_date is None and not end_year:
        # Yearly Jan 1 schedule path: sync full next year.
        next_year = today.year + 1
        return datetime.date(next_year, 1, 1), datetime.date(next_year, 12, 31)

    start = start_date or today
    if end_date is not None:
        end = end_date
    elif end_year:
        end = datetime.date(end_year, 12, 31)
    else:
        end = datetime.date(start.year, 12, 31)

    if end < start:
        raise RuntimeError(f"Invalid sync range: end {end.isoformat()} is before start {start.isoformat()}.")
    return start, end


def dedupe_exact_rows(database_id: str, token: str, start: datetime.date, end: datetime.date) -> tuple[int, int]:
    pages = notion_get_all_pages(database_id, token)
    buckets: dict[tuple[str, str], list[dict]] = {}
    for p in pages:
        if notion_page_is_archived(p):
            continue
        day = page_date(p, "Feast Day").strip()
        if not day:
            continue
        if day < start.isoformat() or day > end.isoformat():
            continue
        name = page_title(p, "Name").strip().lower()
        if not name:
            continue
        buckets.setdefault((day, name), []).append(p)
    keys = 0
    archived = 0
    for _, rows in buckets.items():
        if len(rows) <= 1:
            continue
        keys += 1
        rows = sorted(rows, key=lambda p: (str(p.get("created_time", "")), str(p.get("id", ""))))
        for drop in rows[1:]:
            pid = str(drop.get("id", "")).strip()
            if not pid:
                continue
            notion_call("PATCH", f"https://api.notion.com/v1/pages/{pid}", token, {"archived": True})
            archived += 1
    return keys, archived


def main() -> int:
    try:
        notion_token = require_env("NOTION_TOKEN")
        parent_database_id = notion_find_database_id(notion_token)
        romcal_calendar = os.getenv(ROMCAL_CALENDAR, "general_roman").strip() or "general_roman"
        romcal_locale = os.getenv(ROMCAL_LOCALE, "en").strip() or "en"

        # Ensure calendar DB defaults are explicit for this job.
        liturgical_db_id = (
            os.getenv(LITURGICAL_CALENDAR_DATABASE_ID, "").strip()
            or os.getenv(NOTION_SAINT_DATABASE_ID, "").strip()
        )
        liturgical_db_name = (
            os.getenv(LITURGICAL_CALENDAR_DATABASE_NAME, "").strip()
            or os.getenv(NOTION_SAINT_DATABASE_NAME, "").strip()
            or "Liturgical Calendar"
        )
        if not liturgical_db_id:
            liturgical_db_id = notion_find_database_id_by_name(notion_token, liturgical_db_name) or ""
        if liturgical_db_id:
            os.environ[NOTION_SAINT_DATABASE_ID] = liturgical_db_id
        os.environ[NOTION_SAINT_DATABASE_NAME] = liturgical_db_name
        os.environ[NOTION_SAINT_RADAR_ENABLED] = "true"
        os.environ.setdefault(NOTION_SAINT_TITLE_PROPERTY, "Name")
        os.environ.setdefault(NOTION_SAINT_FEAST_DAY_PROPERTY, "Feast Day")
        os.environ.setdefault(NOTION_SAINT_CELEBRATION_PROPERTY, "Celebration Rank")
        os.environ.setdefault(NOTION_SAINT_PRECEDENCE_PROPERTY, "Precedence")
        os.environ.setdefault(NOTION_SAINT_BACKGROUND_PROPERTY, "Background")

        today = local_today()
        start_date, end_date = compute_range(today)
        days = (end_date - start_date).days + 1
        if days <= 0:
            raise RuntimeError("No days to sync.")

        rows: List[Dict[str, str]] = collect_calendar_days_window(
            romcal_calendar, romcal_locale, start_date, days
        )
        if not rows:
            raise RuntimeError("No liturgical calendar rows collected from Romcal.")

        mode = sync_saint_radar(
            notion_token=notion_token,
            default_parent_database_id=parent_database_id,
            default_parent_page_id="",
            saints=rows,
            openai_key="",
            oai_base_url="https://api.openai.com/v1",
            oai_model="gpt-4.1-mini",
        )
        dedupe_mode = "skipped"
        if bool_env(LITURGICAL_DEDUPE_EXACT, default=True):
            keys, archived = dedupe_exact_rows(
                database_id=liturgical_db_id or parent_database_id,
                token=notion_token,
                start=start_date,
                end=end_date,
            )
            dedupe_mode = f"keys={keys}:archived={archived}"
        saint_db_id = liturgical_db_id or "resolved_in_mode"
        print(
            f"SUMMARY liturgical_db={saint_db_id} rows={len(rows)} "
            f"window_start={start_date.isoformat()} window_end={end_date.isoformat()} mode={mode} dedupe={dedupe_mode}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
