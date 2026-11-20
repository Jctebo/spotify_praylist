#!/usr/bin/env python3
"""oracle-leg-v337 — the Python-side parity evidence for harness-v337
legs 10/11 (the jobs/externals_resolver.py oracle picks on the same
fixture feeds the harness serves) and the leg-13 join-rule unit
checks on jobs/compose_app_audio.py's intro_text.

Usage: oracle-leg-v337.py <dge.xml> <saint.xml> <saint-bad.xml> <YYYY-MM-DD>
Prints ORACLE lines the harness asserts on:
  ORACLE dge=<enclosure url or ->
  ORACLE saint=<enclosure url or ->
  ORACLE saint_bad=<enclosure url or ->
  ORACLE intro1=<text>  ORACLE intro2=<text>
"""
import datetime
import importlib.util
import sys
from pathlib import Path
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

fork = Path(__file__).resolve().parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


resolver = load("externals_resolver", fork / "jobs/externals_resolver.py")
compose = load("compose_app_audio", fork / "jobs/compose_app_audio.py")


def items(xml_path):
    root = ET.parse(xml_path).getroot()
    out = []
    for it in root.iter("item"):
        enc = it.find("enclosure")
        pd = it.findtext("pubDate")
        out.append({
            "title": (it.findtext("title") or "").strip(),
            "pubdate": parsedate_to_datetime(pd) if pd else None,
            "url": enc.get("url") if enc is not None else "",
        })
    return out


def main():
    dge_xml, saint_xml, saint_bad_xml, date_s = sys.argv[1:5]
    target = datetime.date.fromisoformat(date_s)
    dge = resolver.match_gospel_exegesis(items(dge_xml), target)
    saint = resolver.match_saint_of_the_day(items(saint_xml), target)
    saint_bad = resolver.match_saint_of_the_day(items(saint_bad_xml), target)
    print("ORACLE dge=" + (dge["url"] if dge else "-"))
    print("ORACLE saint=" + (saint["url"] if saint else "-"))
    print("ORACLE saint_bad=" + (saint_bad["url"] if saint_bad else "-"))
    print("ORACLE intro1=" + compose.intro_text("For the fixture join rule"))
    print("ORACLE intro2=" + compose.intro_text("perseverance in prayer"))
    print("ORACLE pair-antiphon=" + str(compose.pairing_for("marian-antiphon-angelus")))
    print("ORACLE pair-novena=" + str(compose.pairing_for("novena-st-jude")))
    print("ORACLE pair-none=" + str(compose.pairing_for("some-unpaired-track")))


if __name__ == "__main__":
    main()
