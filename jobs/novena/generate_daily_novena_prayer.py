import datetime
import os
import re
import sys
from functools import lru_cache
from typing import Any, Dict, List, Optional, Sequence

import requests
from openai import OpenAI
from romcal import Romcal, get_bundled_calendar_definitions, get_bundled_resources

NOTION_VERSION = "2022-06-28"
DEFAULT_UTC_OFFSET = "-06:00"

ROMCAL_CALENDAR = "ROMCAL_CALENDAR"  # default general_roman
ROMCAL_LOCALE = "ROMCAL_LOCALE"  # default en
ROMCAL_WINDOW_DAYS = "ROMCAL_WINDOW_DAYS"  # default 9
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"  # optional override like -06:00

OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"  # default https://api.openai.com/v1
OAI_MODEL = "OAI_MODEL"  # default gpt-4.1-mini

NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"  # fallback, default Opus Dei
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"  # default Name
NOTION_NOVENA_ROW_TITLE = "NOTION_NOVENA_ROW_TITLE"  # default Daily Novena Prayer
NOTION_NOVENA_PROPERTY = "NOTION_NOVENA_PROPERTY"  # optional rich_text property for prayer text


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def int_env(name: str, default: int, min_value: int, max_value: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except Exception:
        return default
    return max(min_value, min(max_value, value))


def parse_utc_offset(offset_text: str) -> datetime.timezone:
    text = (offset_text or "").strip()
    match = re.fullmatch(r"([+-])(\d{1,2})(?::?(\d{2}))?", text)
    if not match:
        raise RuntimeError(f"Invalid utc offset '{offset_text}'. Use format like -06:00 or +05:30.")
    sign = -1 if match.group(1) == "-" else 1
    hours = int(match.group(2))
    minutes = int(match.group(3) or "0")
    if hours > 14 or minutes > 59:
        raise RuntimeError(f"Invalid utc offset '{offset_text}'.")
    delta = datetime.timedelta(hours=hours, minutes=minutes) * sign
    return datetime.timezone(delta)


def local_today() -> datetime.date:
    raw_offset = os.getenv(JOB_UTC_OFFSET, "").strip() or DEFAULT_UTC_OFFSET
    now_local = datetime.datetime.now(parse_utc_offset(raw_offset))
    return now_local.date()


def notion_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }


def notion_call(method: str, url: str, token: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    response = requests.request(method, url, headers=notion_headers(token), json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected Notion API response format.")
    return data


def notion_find_database_id(token: str) -> str:
    db_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if db_id:
        return db_id
    db_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
    body = {"query": db_name, "filter": {"value": "database", "property": "object"}}
    data = notion_call("POST", "https://api.notion.com/v1/search", token, body)
    results = data.get("results") or []
    for item in results:
        if not isinstance(item, dict):
            continue
        title_parts = item.get("title") or []
        title = ""
        if isinstance(title_parts, list) and title_parts:
            title = str((title_parts[0] or {}).get("plain_text", "")).strip()
        if title.lower() == db_name.lower():
            found = str(item.get("id", "")).strip()
            if found:
                return found
    for item in results:
        if not isinstance(item, dict):
            continue
        found = str(item.get("id", "")).strip()
        if found:
            return found
    raise RuntimeError("Could not find Notion database. Set NOTION_DATABASE_ID or check NOTION_DATABASE_NAME + sharing.")


def notion_get_all_pages(database_id: str, token: str) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if next_cursor:
            body["start_cursor"] = next_cursor
        data = notion_call("POST", f"https://api.notion.com/v1/databases/{database_id}/query", token, body)
        for result in data.get("results") or []:
            if isinstance(result, dict):
                pages.append(result)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return pages


def page_title(page: Dict[str, Any], title_property: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(title_property) or {}
    vals = prop.get("title") or []
    if not isinstance(vals, list):
        return ""
    parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)]
    return " ".join(p for p in parts if p).strip()


def split_text_chunks(text: str, max_len: int = 1800) -> List[str]:
    cleaned = str(text or "").strip()
    if not cleaned:
        return []
    out: List[str] = []
    remaining = cleaned
    while remaining:
        if len(remaining) <= max_len:
            out.append(remaining)
            break
        cut = remaining.rfind("\n", 0, max_len + 1)
        if cut < max_len // 2:
            cut = remaining.rfind(" ", 0, max_len + 1)
        if cut < max_len // 2:
            cut = max_len
        out.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()
    return [c for c in out if c]


def notion_update_rich_text_property(page_id: str, property_name: str, text: str, token: str) -> None:
    chunks = split_text_chunks(text, 1900)
    rich_text = [{"type": "text", "text": {"content": chunk}} for chunk in chunks] if chunks else []
    body = {"properties": {property_name: {"rich_text": rich_text}}}
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)


def notion_list_block_children(block_id: str, token: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        params = "page_size=100"
        if next_cursor:
            params += f"&start_cursor={next_cursor}"
        url = f"https://api.notion.com/v1/blocks/{block_id}/children?{params}"
        data = notion_call("GET", url, token)
        for row in data.get("results") or []:
            if isinstance(row, dict):
                out.append(row)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return out


def notion_archive_block(block_id: str, token: str) -> None:
    notion_call("PATCH", f"https://api.notion.com/v1/blocks/{block_id}", token, {"archived": True})


def notion_append_children(parent_id: str, children: Sequence[Dict[str, Any]], token: str) -> None:
    if not children:
        return
    for idx in range(0, len(children), 100):
        batch = list(children[idx : idx + 100])
        notion_call("PATCH", f"https://api.notion.com/v1/blocks/{parent_id}/children", token, {"children": batch})


def prayer_to_paragraph_blocks(text: str) -> List[Dict[str, Any]]:
    stanzas = [s.strip() for s in re.split(r"\n\s*\n", str(text or "").strip()) if s.strip()]
    blocks: List[Dict[str, Any]] = []
    for stanza in stanzas:
        for chunk in split_text_chunks(stanza, 1800):
            blocks.append(
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]},
                }
            )
    if not blocks:
        blocks.append(
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": "No prayer content generated."}}]},
            }
        )
    return blocks


def notion_replace_page_content(page_id: str, text: str, token: str) -> None:
    children = notion_list_block_children(page_id, token)
    for block in children:
        block_id = str(block.get("id", "")).strip()
        if block_id:
            notion_archive_block(block_id, token)
    notion_append_children(page_id, prayer_to_paragraph_blocks(text), token)


def normalize_romcal_calendar(calendar: str) -> str:
    value = str(calendar or "").strip().lower()
    aliases = {
        "general": "general_roman",
        "roman": "general_roman",
    }
    return aliases.get(value, value or "general_roman")


@lru_cache(maxsize=8)
def build_romcal(calendar: str, locale: str) -> Romcal:
    return Romcal(
        calendar=normalize_romcal_calendar(calendar),
        locale=(str(locale or "").strip() or "en"),
        resources=get_bundled_resources(),
        calendar_definitions=get_bundled_calendar_definitions(),
    )


@lru_cache(maxsize=16)
def romcal_year_calendar(calendar: str, locale: str, year: int) -> Dict[str, List[Any]]:
    romcal = build_romcal(calendar, locale)
    data = romcal.liturgical_calendar(year)
    if not isinstance(data, dict):
        raise RuntimeError("Romcal returned unexpected calendar format.")
    return data


def celebration_name(event: Dict[str, Any]) -> str:
    for key in ("name", "title", "localName", "commonName", "fullname", "id"):
        value = str(event.get(key, "")).strip()
        if value:
            return value
    return ""


def entity_is_saint(entity: Dict[str, Any]) -> bool:
    level = str(entity.get("canonization_level", "")).strip().lower()
    return level in {"saint", "blessed"}


def looks_like_saint(event: Dict[str, Any], name: str) -> bool:
    if bool(event.get("isSaint")):
        return True
    entities = event.get("entities")
    if isinstance(entities, list):
        for entity in entities:
            if isinstance(entity, dict) and entity_is_saint(entity):
                return True
    saint_terms = (
        "saint",
        "st.",
        "martyr",
        "apostle",
        "virgin",
        "bishop",
        "doctor",
        "holy",
        "confessor",
    )
    haystack = " ".join(
        [
            str(name or ""),
            str(event.get("type", "")),
            str(event.get("category", "")),
            str(event.get("group", "")),
            str(event.get("gradeName", "")),
            str(event.get("rank", "")),
            str(event.get("liturgicalCategory", "")),
        ]
    ).lower()
    if any(term in haystack for term in saint_terms):
        return True
    tags = event.get("tags")
    if isinstance(tags, list):
        tags_text = " ".join(str(x).lower() for x in tags)
        if any(term in tags_text for term in saint_terms):
            return True
    return False


def romcal_fetch_day(calendar: str, locale: str, dt: datetime.date) -> List[Dict[str, Any]]:
    try:
        cal = romcal_year_calendar(calendar, locale, dt.year)
        events = cal.get(dt.isoformat(), []) or []
    except Exception as exc:
        raise RuntimeError(
            f"Failed to fetch Romcal data for {dt.isoformat()} (calendar={normalize_romcal_calendar(calendar)}, locale={locale})"
        ) from exc

    out: List[Dict[str, Any]] = []
    for event in events:
        if hasattr(event, "model_dump"):
            dumped = event.model_dump()
            if isinstance(dumped, dict):
                out.append(dumped)
        elif isinstance(event, dict):
            out.append(event)
    return out


def collect_saints_window(
    calendar: str,
    locale: str,
    start_date: datetime.date,
    days: int,
) -> List[Dict[str, str]]:
    saints: List[Dict[str, str]] = []
    fallback_names: List[Dict[str, str]] = []
    seen = set()

    for offset in range(days):
        dt = start_date + datetime.timedelta(days=offset)
        events = romcal_fetch_day(calendar, locale, dt)
        for event in events:
            if not isinstance(event, dict):
                continue
            name = celebration_name(event)
            if not name:
                continue
            key = (dt.isoformat(), name.lower())
            if key in seen:
                continue
            seen.add(key)
            row = {"date": dt.isoformat(), "name": name}
            fallback_names.append(row)
            if looks_like_saint(event, name):
                saints.append(row)

    if saints:
        return saints
    return fallback_names


def format_saints_for_prompt(saints: Sequence[Dict[str, str]]) -> str:
    rows = []
    for row in saints:
        rows.append(f"{row.get('date', '').strip()} - {row.get('name', '').strip()}")
    return "\n".join(rows)


def call_openai_litany(
    api_key: str,
    base_url: str,
    model: str,
    saints: Sequence[Dict[str, str]],
    start_date: datetime.date,
    end_date: datetime.date,
) -> str:
    saint_list = format_saints_for_prompt(saints)
    system_prompt = (
        "ROLE\n"
        "You are a Catholic devotional writer who creates concise daily prayers based on the liturgical calendar."
    )
    user_prompt = (
        "TASK\n"
        "Generate a short Rolling Novena prayer that honors saints whose feast days fall within the next 9 days. "
        "The focus should be on the saint whose feast day is today, while future saints are mentioned briefly to prepare "
        "the faithful for their upcoming feasts.\n\n"
        "INPUTS\n"
        f"Current Date: {start_date.isoformat()}\n\n"
        "Upcoming Saints (within the next 9 days):\n"
        "[List in format: Date - Saint Name - Title or brief identifier]\n"
        f"{saint_list}\n\n"
        "INSTRUCTIONS\n"
        "1. Begin with a short 1-2 sentence introduction explaining that this prayer prepares the faithful for the saints whose feast days are approaching.\n"
        "2. Identify the saint whose feast day is TODAY.\n"
        "3. Create a section for the saint whose feast is today with the following format:\n"
        "Saint: [Name]\n"
        "Feast Day: [Date]\n\n"
        "Write a short 1-2 sentence description of the saint explaining:\n"
        "- Who they were\n"
        "- Their significance to the Church\n\n"
        "Then include:\n\n"
        "Prayer\n"
        "A short 2-3 line intercession prayer asking for the saint's help.\n\n"
        "Feast Day Prayer\n"
        "A brief prayer thanking God for the saint and asking for the grace to imitate their virtue.\n\n"
        "4. Create a section titled:\n"
        "Upcoming Saints\n\n"
        "List each future saint in this format:\n"
        "Date - Saint Name\n"
        "One short sentence describing who the saint was or their key virtue.\n\n"
        "Do NOT include individual prayers for these future saints.\n\n"
        "5. End with:\n"
        "Rolling Novena Prayer\n\n"
        "A short communal prayer that:\n"
        "- Mentions the saints collectively\n"
        "- Asks for their intercession as their feast days approach\n"
        "- Ends with 'Through Christ our Lord. Amen.'\n\n"
        "6. End with a short section:\n"
        "Reflection\n\n"
        "Include 2-3 brief reflection questions about imitating the saints' virtues.\n\n"
        "STYLE\n"
        "- Concise and devotional\n"
        "- Faithful to Catholic teaching\n"
        "- Suitable for daily prayer\n"
        "- Future saints should be summarized briefly (one sentence each)\n"
    )
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))

    try:
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
                {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
            ],
        )
        text = str(getattr(response, "output_text", "") or "").strip()
        if text:
            return text
    except Exception:
        # Fall through to chat-completions for compatibility if responses/model isn't available.
        pass

    chat = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    choices = getattr(chat, "choices", None) or []
    if not choices:
        raise RuntimeError("OpenAI SDK returned no choices.")
    message = getattr(choices[0], "message", None)
    content = str(getattr(message, "content", "") or "").strip()
    if not content:
        raise RuntimeError("OpenAI SDK returned empty content.")
    return content


def find_target_notion_page(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    target_title: str,
) -> Dict[str, Any]:
    target_norm = target_title.strip().lower()
    for page in pages:
        if not isinstance(page, dict):
            continue
        title = page_title(page, title_property).strip().lower()
        if title == target_norm:
            return page
    raise RuntimeError(
        f"Could not find Notion page titled '{target_title}' using title property '{title_property}'."
    )


def write_prayer_to_notion_page(page: Dict[str, Any], prayer_text: str, token: str) -> str:
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target Notion page has no id.")

    output_property = os.getenv(NOTION_NOVENA_PROPERTY, "").strip()
    if output_property:
        prop = (page.get("properties") or {}).get(output_property) or {}
        ptype = str(prop.get("type", "")).strip()
        if ptype == "rich_text":
            notion_update_rich_text_property(page_id, output_property, prayer_text, token)
            return f"property:{output_property}"

    notion_replace_page_content(page_id, prayer_text, token)
    return "page_content"


def main() -> int:
    try:
        romcal_calendar = os.getenv(ROMCAL_CALENDAR, "general_roman").strip() or "general_roman"
        romcal_locale = os.getenv(ROMCAL_LOCALE, "en").strip() or "en"
        window_days = int_env(ROMCAL_WINDOW_DAYS, default=9, min_value=1, max_value=30)

        openai_key = require_env(OPENAI_API_KEY)
        oai_base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"
        oai_model = os.getenv(OAI_MODEL, "gpt-4.1-mini").strip() or "gpt-4.1-mini"

        notion_token = require_env(NOTION_TOKEN)
        notion_db_id = notion_find_database_id(notion_token)
        title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
        target_row_title = os.getenv(NOTION_NOVENA_ROW_TITLE, "Daily Novena Prayer").strip() or "Daily Novena Prayer"

        start_date = local_today()
        end_date = start_date + datetime.timedelta(days=window_days - 1)
        saints = collect_saints_window(romcal_calendar, romcal_locale, start_date, window_days)
        if not saints:
            raise RuntimeError("No celebrations found from Romcal for requested date window.")

        prayer_text = call_openai_litany(openai_key, oai_base_url, oai_model, saints, start_date, end_date)
        if not prayer_text.strip():
            raise RuntimeError("Generated prayer is empty.")

        pages = notion_get_all_pages(notion_db_id, notion_token)
        target_page = find_target_notion_page(pages, title_property, target_row_title)
        write_mode = write_prayer_to_notion_page(target_page, prayer_text, notion_token)

        print(
            f"SUMMARY notion_db={notion_db_id} target_title={target_row_title} "
            f"saints_count={len(saints)} window_days={window_days} write_mode={write_mode}"
        )
        print(
            f"INFO romcal_calendar={romcal_calendar} locale={romcal_locale} "
            f"window_start={start_date.isoformat()} window_end={end_date.isoformat()}"
        )
        return 0
    except requests.HTTPError as exc:
        detail = ""
        try:
            detail = f" response={exc.response.text[:500]}"
        except Exception:
            detail = ""
        print(f"ERROR HTTP failure: {exc}{detail}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
