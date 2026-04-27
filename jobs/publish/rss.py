from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.audio import github_pages_base_url, podcast_cover_art_public_url

RSS_CHANNEL_TITLE = "Spotify Praylist"
RSS_CHANNEL_DESCRIPTION = "Generated prayer audio from repo-owned publish contracts."
RSS_CHANNEL_LANGUAGE = "en-us"
RSS_AUDIO_MIME = "audio/mpeg"
RSS_ITUNES_NAMESPACE = "http://www.itunes.com/dtds/podcast-1.0.dtd"
RSS_CHANNEL_AUTHOR = "John Thibeaux"
RSS_CHANNEL_EMAIL = "john.thibeaux@gmail.com"
RSS_CHANNEL_SUMMARY = RSS_CHANNEL_DESCRIPTION
RSS_CHANNEL_EXPLICIT = "no"


ET.register_namespace("itunes", RSS_ITUNES_NAMESPACE)



def _audio_length_bytes(path_text: str) -> int:
    path = Path(path_text)
    if not path.exists():
        return 0
    return path.stat().st_size



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

    sorted_jobs = sorted(jobs, key=lambda job: (str(job.get("contract_id", "")), str(job.get("entry_id", ""))))
    for job in sorted_jobs:
        item = ET.SubElement(channel, "item")
        title = str(job.get("title", "")).strip() or str(job.get("entry_id", "")).strip() or "Prayer Audio"
        ET.SubElement(item, "title").text = title
        ET.SubElement(item, "guid", isPermaLink="false").text = str(job.get("entry_id", "")).strip()
        ET.SubElement(item, "link").text = str(job.get("audio_url", "")).strip()
        ET.SubElement(item, "description").text = str(job.get("text", "")).strip()
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
