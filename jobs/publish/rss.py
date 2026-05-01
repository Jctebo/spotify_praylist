from __future__ import annotations

import datetime as _dt
import logging
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
from jobs.publish.formatting import compose_rss_guid, episode_date_from_episode_id, split_rss_guid

logger = logging.getLogger(__name__)

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



def _coerce_audio_length(value: Any) -> int:
    try:
        length = int(value)
    except Exception:
        return 0
    return length if length > 0 else 0


def _audio_length_bytes(path_text: str, *, fallback: Any = None) -> int:
    fallback_length = _coerce_audio_length(fallback)
    path = Path(path_text)
    if path.exists():
        try:
            size = path.stat().st_size
            if size > 0:
                return size
        except Exception:
            pass
    return fallback_length


def _episode_id_list(jobs: Sequence[Dict[str, Any]], *, limit: int = 8) -> str:
    episode_ids = [
        str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        for job in jobs
        if str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
    ]
    if not episode_ids:
        return "-"
    if len(episode_ids) <= limit:
        return ",".join(episode_ids)
    remaining = len(episode_ids) - limit
    return f"{','.join(episode_ids[:limit])},...(+{remaining} more)"


def _published_at(job: Dict[str, Any]) -> _dt.datetime:
    raw = str(job.get("published_date", "")).strip()
    if not raw:
        raise RuntimeError(f"RSS job is missing required published_date: {job!r}")
    date_value = _dt.date.fromisoformat(raw)
    return _dt.datetime.combine(date_value, _dt.time(12, 0, tzinfo=_dt.timezone.utc))


def _job_from_rss_item(item: ET.Element, *, feed_path: Path) -> Dict[str, Any] | None:
    rss_guid = str(item.findtext("guid", "") or "").strip()
    episode_id, _revision = split_rss_guid(rss_guid)
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
    enclosure = item.find("enclosure")
    audio_length = _coerce_audio_length(enclosure.get("length") if enclosure is not None else 0)
    return {
        "entry_id": episode_id,
        "episode_id": episode_id,
        "rss_guid": rss_guid or episode_id,
        "title": str(item.findtext("title", "") or "").strip() or episode_id,
        "description": str(item.findtext("description", "") or "").strip(),
        "published_date": published_date,
        "audio_path": str(feed_path.parent / "audio" / f"{episode_id}.mp3"),
        "audio_url": str(item.findtext("link", "") or "").strip(),
        "audio_length": audio_length,
    }


def _jobs_from_rss_root(root: ET.Element, *, feed_path: Path) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    for item in root.findall("./channel/item"):
        job = _job_from_rss_item(item, feed_path=feed_path)
        if job is not None:
            jobs.append(job)
    return jobs


def _merge_jobs(target: List[Dict[str, Any]], source_jobs: Sequence[Dict[str, Any]], *, source_label: str, feed_ref: str) -> None:
    accepted: List[Dict[str, Any]] = []
    seen_episode_ids = {str(job.get("episode_id", "")).strip() for job in target if str(job.get("episode_id", "")).strip()}
    for job in source_jobs:
        episode_id = str(job.get("episode_id", "")).strip()
        if not episode_id or episode_id in seen_episode_ids:
            continue
        seen_episode_ids.add(episode_id)
        job_copy = dict(job)
        target.append(job_copy)
        accepted.append(job_copy)
    logger.info(
        "rss_load source=%s ref=%s items=%d accepted=%d episode_ids=%s",
        source_label,
        feed_ref,
        len(source_jobs),
        len(accepted),
        _episode_id_list(accepted),
    )


def load_podcast_feed_jobs(
    feed_path: Path,
    *,
    base_url: str | None = None,
    remote_feed_url: str | None = None,
    include_local: bool = True,
    require_remote: bool = False,
) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    remote_ref = str(remote_feed_url or "").strip()
    if not remote_ref:
        remote_base = str(base_url or "").strip().rstrip("/")
        remote_ref = f"{remote_base}/podcast.xml" if remote_base else ""
    logger.info(
        "rss_load start feed_path=%s base_url=%s remote_feed_url=%s include_local=%s require_remote=%s",
        feed_path,
        str(base_url or "").strip() or "-",
        remote_ref or "-",
        include_local,
        require_remote,
    )

    if include_local and feed_path.exists():
        try:
            local_jobs = _jobs_from_rss_root(ET.fromstring(feed_path.read_text(encoding="utf-8")), feed_path=feed_path)
            _merge_jobs(jobs, local_jobs, source_label="local", feed_ref=str(feed_path))
        except Exception as exc:
            logger.warning("rss_load source=local ref=%s status=error error=%s", feed_path, exc)
    elif include_local:
        logger.info("rss_load source=local ref=%s status=missing", feed_path)
    else:
        logger.info("rss_load source=local status=skipped")

    remote_jobs: List[Dict[str, Any]] = []
    if remote_ref:
        try:
            response = requests.get(remote_ref, timeout=20)
        except Exception as exc:
            logger.warning("rss_load source=remote ref=%s status=error error=%s", remote_ref, exc)
        else:
            if response.ok:
                try:
                    remote_jobs = _jobs_from_rss_root(ET.fromstring(response.text), feed_path=feed_path)
                    _merge_jobs(jobs, remote_jobs, source_label="remote", feed_ref=remote_ref)
                except Exception as exc:
                    logger.warning("rss_load source=remote ref=%s status=parse_error error=%s", remote_ref, exc)
            else:
                logger.warning(
                    "rss_load source=remote ref=%s status=http_error code=%s",
                    remote_ref,
                    response.status_code,
                )
    else:
        logger.info("rss_load source=remote status=skipped")

    logger.info("rss_load merged ref=%s items=%d episode_ids=%s", feed_path, len(jobs), _episode_id_list(jobs))

    if require_remote and not remote_jobs:
        raise RuntimeError(f"Unable to recover podcast archive from remote feed: {remote_ref or 'unconfigured'}")

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
    logger.info(
        "rss_build base_url=%s incoming=%d unique=%d deduped=%d episode_ids=%s",
        link,
        len(jobs),
        len(unique_jobs),
        len(jobs) - len(unique_jobs),
        _episode_id_list(sorted_jobs),
    )
    for job in sorted_jobs:
        item = ET.SubElement(channel, "item")
        title = str(job.get("title", "")).strip() or str(job.get("entry_id", "")).strip() or "Prayer Audio"
        ET.SubElement(item, "title").text = title
        episode_id = str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        rss_guid = str(job.get("rss_guid", "")).strip() or compose_rss_guid(episode_id, job.get("content_hash"))
        ET.SubElement(item, "guid", isPermaLink="false").text = rss_guid
        ET.SubElement(item, "link").text = str(job.get("audio_url", "")).strip()
        ET.SubElement(item, "description").text = str(job.get("description", "")).strip() or str(job.get("text", "")).strip()
        ET.SubElement(item, "pubDate").text = format_datetime(_published_at(job))
        ET.SubElement(item, "author").text = f"{author_email} ({author_name})"
        ET.SubElement(item, f"{{{RSS_ITUNES_NAMESPACE}}}author").text = author_name
        audio_path = str(job.get("audio_path", "")).strip()
        enclosure_url = str(job.get("audio_url", "")).strip()
        audio_length = _audio_length_bytes(audio_path, fallback=job.get("audio_length"))
        enclosure = ET.SubElement(
            item,
            "enclosure",
            url=enclosure_url,
            length=str(audio_length),
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
