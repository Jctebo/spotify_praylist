from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.audio import github_pages_base_url

RSS_CHANNEL_TITLE = "Spotify Praylist"
RSS_CHANNEL_DESCRIPTION = "Generated prayer audio from repo-owned publish contracts."
RSS_CHANNEL_LANGUAGE = "en-us"
RSS_AUDIO_MIME = "audio/mpeg"



def _audio_length_bytes(path_text: str) -> int:
    path = Path(path_text)
    if not path.exists():
        return 0
    return path.stat().st_size



def build_rss_feed(jobs: Sequence[Dict[str, Any]], *, base_url: str | None = None) -> str:
    root = ET.Element("rss", version="2.0")
    channel = ET.SubElement(root, "channel")
    ET.SubElement(channel, "title").text = RSS_CHANNEL_TITLE
    ET.SubElement(channel, "link").text = (base_url or github_pages_base_url()).rstrip("/")
    ET.SubElement(channel, "description").text = RSS_CHANNEL_DESCRIPTION
    ET.SubElement(channel, "language").text = RSS_CHANNEL_LANGUAGE

    sorted_jobs = sorted(jobs, key=lambda job: (str(job.get("contract_id", "")), str(job.get("entry_id", ""))))
    for job in sorted_jobs:
        item = ET.SubElement(channel, "item")
        title = str(job.get("title", "")).strip() or str(job.get("entry_id", "")).strip() or "Prayer Audio"
        ET.SubElement(item, "title").text = title
        ET.SubElement(item, "guid", isPermaLink="false").text = str(job.get("entry_id", "")).strip()
        ET.SubElement(item, "link").text = str(job.get("audio_url", "")).strip()
        ET.SubElement(item, "description").text = str(job.get("text", "")).strip()
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
