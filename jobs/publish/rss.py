from __future__ import annotations

import datetime as _dt
from email.utils import format_datetime
import sys
import xml.etree.ElementTree as ET
from textwrap import dedent
from pathlib import Path
from typing import Any, Dict, List, Sequence
import requests

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.audio import github_pages_base_url, podcast_cover_art_public_url
from jobs.publish.formatting import episode_date_from_episode_id

RSS_CHANNEL_TITLE = "Ora Pro Nobis"
RSS_CHANNEL_DESCRIPTION = dedent(
    """
    Ora Pro Nobis is a daily Catholic prayer podcast rooted in the life and tradition of the Church. Each episode offers a simple, structured time of prayer, featuring traditional Catholic prayers, guided novenas to the saints, and reflections drawn from Scripture and the liturgical calendar.

    Whether you are beginning your morning, commuting, or setting aside quiet time, Ora Pro Nobis helps you enter into a consistent rhythm of prayer. Through the Communion of Saints and the rich devotional life of the Church, this podcast invites you to deepen your faith, grow in discipline, and remain attentive to God throughout the day.

    Pray with the Church. Walk with the saints. Ora pro nobis - pray for us.
    """
).strip()
RSS_CHANNEL_LANGUAGE = "en-us"
RSS_AUDIO_MIME = "audio/mpeg"
RSS_ITUNES_NAMESPACE = "http://www.itunes.com/dtds/podcast-1.0.dtd"
RSS_CHANNEL_AUTHOR = "John Thibeaux"
RSS_CHANNEL_EMAIL = "john.thibeaux@gmail.com"
RSS_CHANNEL_SUMMARY = (
    "Daily Catholic prayer podcast featuring traditional prayers, guided novenas, and reflections rooted in Scripture and the Communion of Saints. "
    "Pray with the Church and walk with the saints - Ora pro nobis."
)
RSS_CHANNEL_EXPLICIT = "no"


ET.register_namespace("itunes", RSS_ITUNES_NAMESPACE)



def _audio_length_bytes(path_text: str) -> int:
    path = Path(path_text)
    if not path.exists():
        return 0
    return path.stat().st_size


def _published_at(job: Dict[str, Any]) -> _dt.datetime:
    raw = str(job.get("published_date", "")).strip()
    if not raw:
        raise RuntimeError(f"RSS job is missing required published_date: {job!r}")
    date_value = _dt.date.fromisoformat(raw)
    return _dt.datetime.combine(date_value, _dt.time(12, 0, tzinfo=_dt.timezone.utc))


def _job_from_rss_item(item: ET.Element, *, feed_path: Path) -> Dict[str, Any] | None:
    episode_id = str(item.findtext("guid", "") or "").strip()
    if not episode_id:
        link = str(item.findtext("link", "") or "").strip()
        if link:
            episode_id = Path(link).stem.strip()
    if not episode_id:
        return None
    raw_pub_date = str(item.findtext("pubDate", "") or "").strip()
    published_date = ""
    if raw_pub_date:
        try:
            from email.utils import parsedate_to_datetime

            published_date = parsedate_to_datetime(raw_pub_date).date().isoformat()
        except Exception:
            published_date = ""
    else:
        parsed_date = episode_date_from_episode_id(episode_id)
        if parsed_date is not None:
            published_date = parsed_date.isoformat()
    if not published_date:
        audio_path = feed_path.parent / "audio" / f"{episode_id}.mp3"
        if audio_path.exists():
            try:
                published_date = _dt.datetime.fromtimestamp(audio_path.stat().st_mtime, tz=_dt.timezone.utc).date().isoformat()
            except Exception:
                published_date = ""
    if not published_date:
        return None
    return {
        "entry_id": episode_id,
        "episode_id": episode_id,
        "title": str(item.findtext("title", "") or "").strip() or episode_id,
        "description": str(item.findtext("description", "") or "").strip(),
        "published_date": published_date,
        "audio_path": str(feed_path.parent / "audio" / f"{episode_id}.mp3"),
        "audio_url": str(item.findtext("link", "") or "").strip(),
    }


def load_podcast_feed_jobs(feed_path: Path, *, base_url: str | None = None) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    seen_episode_ids: set[str] = set()

    def _append_items(root: ET.Element) -> None:
        for item in root.findall("./channel/item"):
            job = _job_from_rss_item(item, feed_path=feed_path)
            if job is None:
                continue
            episode_id = str(job.get("episode_id", "")).strip()
            if not episode_id or episode_id in seen_episode_ids:
                continue
            seen_episode_ids.add(episode_id)
            jobs.append(job)

    if feed_path.exists():
        try:
            _append_items(ET.fromstring(feed_path.read_text(encoding="utf-8")))
        except Exception:
            pass

    remote_base = str(base_url or "").strip().rstrip("/")
    if remote_base:
        remote_feed_url = f"{remote_base}/podcast.xml"
        try:
            response = requests.get(remote_feed_url, timeout=20)
            if response.ok:
                _append_items(ET.fromstring(response.text))
        except Exception:
            pass

    return jobs



def build_rss_feed(
    jobs: Sequence[Dict[str, Any]],
    *,
    base_url: str | None = None,
    author: str | None = None,
    email: str | None = None,
    cover_art_url: str | None = None,
) -> str:
    root = ET.Element("rss", version="2.0")
    channel = ET.SubElement(root, "channel")
    link = (base_url or github_pages_base_url()).rstrip("/")
    author_name = str(author or RSS_CHANNEL_AUTHOR).strip() or RSS_CHANNEL_AUTHOR
    author_email = str(email or RSS_CHANNEL_EMAIL).strip() or RSS_CHANNEL_EMAIL
    image_url = str(cover_art_url or podcast_cover_art_public_url(base_url=link)).strip()
    ET.SubElement(channel, "title").text = RSS_CHANNEL_TITLE
    ET.SubElement(channel, "link").text = link
    ET.SubElement(channel, "description").text = RSS_CHANNEL_DESCRIPTION
    ET.SubElement(channel, "language").text = RSS_CHANNEL_LANGUAGE
    ET.SubElement(channel, "author").text = f"{author_email} ({author_name})"
    ET.SubElement(channel, "managingEditor").text = f"{author_email} ({author_name})"
    ET.SubElement(channel, "webMaster").text = f"{author_email} ({author_name})"
    ET.SubElement(channel, f"{{{RSS_ITUNES_NAMESPACE}}}author").text = author_name
    ET.SubElement(channel, f"{{{RSS_ITUNES_NAMESPACE}}}summary").text = RSS_CHANNEL_SUMMARY
    ET.SubElement(channel, f"{{{RSS_ITUNES_NAMESPACE}}}explicit").text = RSS_CHANNEL_EXPLICIT
    owner = ET.SubElement(channel, f"{{{RSS_ITUNES_NAMESPACE}}}owner")
    ET.SubElement(owner, f"{{{RSS_ITUNES_NAMESPACE}}}name").text = author_name
    ET.SubElement(owner, f"{{{RSS_ITUNES_NAMESPACE}}}email").text = author_email
    ET.SubElement(channel, f"{{{RSS_ITUNES_NAMESPACE}}}image", href=image_url)
    image = ET.SubElement(channel, "image")
    ET.SubElement(image, "url").text = image_url
    ET.SubElement(image, "title").text = RSS_CHANNEL_TITLE
    ET.SubElement(image, "link").text = link

    unique_jobs: List[Dict[str, Any]] = []
    seen_episode_ids: set[str] = set()
    for job in jobs:
        episode_id = str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        if not episode_id or episode_id in seen_episode_ids:
            continue
        seen_episode_ids.add(episode_id)
        unique_jobs.append(dict(job))

    sorted_jobs = sorted(
        unique_jobs,
        key=lambda job: (
            _published_at(job),
            str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip(),
        ),
        reverse=True,
    )
    for job in sorted_jobs:
        item = ET.SubElement(channel, "item")
        title = str(job.get("title", "")).strip() or str(job.get("entry_id", "")).strip() or "Prayer Audio"
        ET.SubElement(item, "title").text = title
        episode_id = str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        ET.SubElement(item, "guid", isPermaLink="false").text = episode_id
        ET.SubElement(item, "link").text = str(job.get("audio_url", "")).strip()
        ET.SubElement(item, "description").text = str(job.get("description", "")).strip() or str(job.get("text", "")).strip()
        ET.SubElement(item, "pubDate").text = format_datetime(_published_at(job))
        ET.SubElement(item, "author").text = f"{author_email} ({author_name})"
        ET.SubElement(item, f"{{{RSS_ITUNES_NAMESPACE}}}author").text = author_name
        audio_path = str(job.get("audio_path", "")).strip()
        enclosure_url = str(job.get("audio_url", "")).strip()
        enclosure = ET.SubElement(
            item,
            "enclosure",
            url=enclosure_url,
            length=str(_audio_length_bytes(audio_path)),
            type=RSS_AUDIO_MIME,
        )
        if not enclosure.get("url"):
            enclosure.set("url", enclosure_url)

    return ET.tostring(root, encoding="unicode")



def write_podcast_feed(feed_xml: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    tree = ET.ElementTree(ET.fromstring(feed_xml))
    tree.write(path, encoding="utf-8", xml_declaration=True)
    return path
