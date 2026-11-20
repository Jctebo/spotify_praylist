#!/usr/bin/env python3
"""Build the offline saint-source dataset for the Daily Reflection witness
ladder (John, 2026-11-05): per month-day, the 1962 calendar's sanctoral
observance and the Roman Martyrology's lead commemoration + eulogy.

Sources (all pre-conciliar, public domain):
  * English Martyrology + Sancti files from Divinum Officium
    (github.com/DivinumOfficium/divinum-officium, web/www/horas/English) —
    the classic English Roman Martyrology text read with the old office.
  * Kalendaria delta tables (web/www/Tabulae/Kalendaria: 1954, 1955, 1960)
    applied over the base Sancti names to land on the 1962 (Rubrics 1960)
    sanctoral: 'r' (reduced) Sancti variants win where they exist, XXXXX
    delta entries suppress, octave-day offices abolished in 1955 drop out
    (Christmas-octave days keep their own treatment via OVERRIDES1962).

The lead-name heuristic and the 1962 derivation are reviewed day by day;
corrections live in OVERRIDES below so a rebuild reproduces the reviewed
dataset exactly.

Usage:
  python3 scripts/build_martyrology_dataset.py --divinum <checkout root> \
      [--out config/publish/offline/martyrology-1962.json] [--review]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

MONTHS = ["", "jan", "feb", "mar", "apr", "may", "jun",
          "jul", "aug", "sep", "oct", "nov", "dec"]

# ---------------------------------------------------------------------------
# Reviewed overrides. Lead-name fixes where the heuristic mangles the name,
# and 1962-observance fixes where the derivation misleads. Filled from the
# day-by-day review of the generated table.
# ---------------------------------------------------------------------------
LEAD_OVERRIDES: dict[str, str] = {
    # The old text leads with the five named martyrs; the Church knows the
    # group, and the 1962 feast, as the Four Crowned Martyrs.
    "11-08": "the Four Crowned Martyrs",
    "01-02": "the many holy martyrs of Rome",
    "01-03": "Pope Saint Anterus",
    "01-05": "Pope Saint Telesphorus",
    "01-07": "Saint Lucian of Antioch",
    "01-08": "Saints Lucian, Maximian, and Julian",
    "01-09": "Saints Julian and Basilissa",
    "01-10": "Blessed Nicanor",
    "01-11": "Pope Saint Hyginus",
    "01-13": "the Forty Holy Soldiers of Rome",
    "01-16": "Pope Saint Marcellus I",
    "01-26": "Saint Theogenes and his thirty-six companions",
    "01-29": "Saints Papias and Maurus",
    "01-30": "Blessed Hippolytus",
    "02-13": "the Prophet Agabus",
    "02-16": "Blessed Onesimus",
    "02-19": "Saint Gavin",
    "02-21": "the seventy-nine holy martyrs of Sicily",
    "02-25": "the holy martyrs Victorinus, Victor, Nicephorus, Claudian, Dioscorus, Serapion, and Papias",
    "02-27": "the holy martyrs Alexander, Abundius, Antigonus, and Fortunatus",
    "02-28": "the holy martyrs Macarius, Rufinus, Justus, and Theophilus",
    "03-01": "the two hundred and sixty holy martyrs of Rome",
    "03-03": "Saints Marinus and Asterius",
    "03-07": "Saint Thomas Aquinas",
    "03-12": "Pope Saint Gregory the Great",
    "03-13": "Saints Macedonius, Patricia, and Modesta",
    "03-23": "Saint Victorian and his companions",
    "03-30": "Blessed Quirinus",
    "03-31": "the Prophet Amos",
    "04-05": "Saint Vincent Ferrer",
    "04-10": "the Prophet Ezekiel",
    "04-11": "Saint Antipas",
    "04-14": "the holy martyrs Tiburtius, Valerian, and Maximus",
    "04-15": "Saints Basilissa and Anastasia",
    "04-17": "Pope Saint Anicetus",
    "04-18": "Saint Apollonius",
    "04-22": "Pope Saint Soter",
    "04-24": "Saint Fidelis of Sigmaringen",
    "04-25": "Saint Mark the Evangelist",
    "04-26": "Pope Saint Cletus",
    "04-27": "Saint Egbert",
    "04-29": "Saint Peter of Verona",
    "05-01": "Saints Philip and James, Apostles",
    "05-03": "the Finding of the Holy Cross",
    "05-08": "Saint Michael the Archangel",
    "05-09": "Saint Gregory Nazianzen",
    "05-13": "the Dedication of the Church of Saint Mary and All the Martyrs",
    "05-15": "Saint Torquatus and his companions",
    "05-16": "Saint Simon Stock",
    "05-17": "Saint Paschal Baylon",
    "05-19": "Pope Saint Celestine V",
    "05-20": "Saint Bernardine of Siena",
    "05-22": "the holy martyrs Faustinus, Timothy, and Venustus",
    "05-24": "Saint Manahen",
    "05-25": "Pope Saint Gregory VII",
    "05-27": "Pope Saint John I",
    "05-30": "Pope Saint Felix",
    "06-02": "Saints Marcellinus and Peter",
    "06-04": "Saint Francis Caracciolo",
    "06-07": "Saint Paul of Constantinople",
    "06-08": "Saint Maximin",
    "06-12": "Saint John of Sahagun",
    "06-13": "Saint Anthony of Padua",
    "06-14": "the Prophet Elisha",
    "06-20": "Pope Saint Silverius",
    "06-24": "the many holy martyrs of Rome under Nero",
    "06-29": "Saints Peter and Paul, Apostles",
    "06-30": "Saint Martial",
    "07-04": "the Prophets Hosea and Haggai",
    "07-06": "the Prophet Isaiah",
    "07-07": "Saint Claudius and his companions",
    "07-10": "the Seven Holy Brothers, sons of Saint Felicity",
    "07-11": "Pope Saint Pius I",
    "07-12": "Saint John Gualbert",
    "07-13": "Pope Saint Anacletus",
    "07-15": "Saint Henry II",
    "07-17": "Saint Alexis",
    "07-22": "Saint Mary Magdalene",
    "07-28": "Pope Saint Victor I",
    "08-03": "the Finding of the Body of Saint Stephen",
    "08-07": "Saint Cajetan",
    "08-08": "Saint Cyriacus and his companions",
    "08-10": "Saint Lawrence",
    "08-17": "Saint Liberatus and his companions",
    "08-20": "Saint Bernard of Clairvaux",
    "08-23": "Saint Restitutus and his companions",
    "08-26": "Pope Saint Zephyrinus",
    "09-04": "the Prophet Moses",
    "09-06": "the Prophet Zachariah",
    "09-12": "the Holy Name of the Blessed Virgin Mary",
    "09-14": "the Exaltation of the Holy Cross",
    "09-15": "Our Lady of Sorrows",
    "09-19": "Saint Januarius and his companions",
    "09-20": "Saint Eustace and his family",
    "09-23": "Pope Saint Linus",
    "09-24": "Saints Andochius, Thyrsus, and Felix",
    "09-28": "Saint Wenceslaus",
    "10-01": "Saint Remigius",
    "10-02": "Saint Eleutherius and his companions",
    "10-03": "Saint Candidus",
    "10-05": "Saint Placidus and his companions",
    "10-07": "Pope Saint Mark",
    "10-08": "Saint Bridget of Sweden",
    "10-09": "Saint Denis and his companions",
    "10-14": "Pope Saint Callistus I",
    "10-16": "the two hundred and seventy holy martyrs of Africa",
    "10-17": "Saint Heron",
    "10-18": "Saint Luke the Evangelist",
    "10-22": "Saint Mark of Jerusalem",
    "10-24": "Saint Felix and his companions",
    "10-26": "Pope Saint Evaristus",
    "10-28": "Saints Simon and Jude, Apostles",
    "10-30": "the two hundred and twenty holy martyrs of Africa",
    "11-07": "Saint Prosdocimus",
    "11-10": "Saint Andrew Avellino",
    "11-11": "Saint Martin of Tours",
    "11-13": "Saint Didacus",
    "11-19": "Saint Elizabeth of Hungary",
    "11-23": "Pope Saint Clement I",
    "11-27": "Saint Basileus and his companions",
    "11-29": "Saint Saturninus",
    "12-01": "the Prophet Nahum",
    "12-03": "Saint Francis Xavier",
    "12-05": "Saint Sabbas",
    "12-06": "Saint Nicholas",
    "12-11": "Pope Saint Damasus I",
    "12-16": "Saint Eusebius of Vercelli",
    "12-20": "the holy martyrs Liberatus, Bajulus, Ammon, Zeno, Ptolemy, Ingenes, and Theophilus",
    "12-21": "Saint Thomas the Apostle",
    "12-22": "the thirty holy martyrs of Rome",
    "12-24": "the forty holy virgins and martyrs of Antioch",
    "12-28": "the Holy Innocents",
    "12-30": "Pope Saint Felix I",
    "12-31": "Pope Saint Sylvester I",
}

# Eulogies where the parsed first entry is not the lead saint's own text
# (12-16: the Eusebius text sits in a rubrica-variant announcement section).
EULOGY_OVERRIDES: dict[str, str] = {
    "12-16": (
        "On the morrow we keep the feast of the holy martyr Eusebius, Bishop "
        "of Vercelli, of whom mention is made also upon the 1st day of "
        "August, when he died between the years 370 and 375."
    ),
}

OBS1962_OVERRIDES: dict[str, str] = {
    # 1960 Code of Rubrics: Jan 1 is the Octave Day of the Nativity
    # (the Circumcision title was dropped).
    "01-01": "the Octave Day of the Nativity of Our Lord",
    "11-02": "All Souls' Day — the Commemoration of All the Faithful Departed",
}

DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def first_sentences(text: str, max_sentences: int = 2, max_chars: int = 430) -> str:
    text = clean(text)
    parts = re.split(r"(?<=[.!?])\s+", text)
    out = ""
    for part in parts:
        if not part:
            continue
        candidate = f"{out} {part}".strip() if out else part
        if len(candidate) > max_chars and out:
            break
        out = candidate
        if len(out) >= 150 or out.count(".") >= max_sentences:
            break
    if len(out) > max_chars:
        out = out[:max_chars].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return out


EPITHET_RE = re.compile(
    r"(the birthday of|the dedication of|the feast of|the commemoration of|"
    r"the finding|the invention of|the apparition of|the translation of|"
    r"Saint |St\. |holy |blessed |the holy|the Saints|the most holy|Our Lady|"
    r"the Blessed Virgin|the Apostle(?!s)|the Evangelist)",
    re.I,
)

ANNOUNCEMENT_RE = re.compile(
    r"^(The morrow is|On the morrow|Tomorrow is|Tomorrow we keep|In the year \d)",
    re.I,
)

# Days whose martyrology opens with a great-feast announcement that IS the
# day's headline commemoration (name, eulogy from the announcement itself).
ANNOUNCEMENT_LEADS: dict[str, str] = {
    "01-06": "the Epiphany of the Lord",
    "09-08": "the Nativity of the Blessed Virgin Mary",
    "12-25": "the Nativity of Our Lord Jesus Christ",
}

_DESCRIPTOR = (
    r"(?:martyr|martyrs|virgin|confessor|bishop|bishops|pope|apostle|apostles|"
    r"evangelist|widow|hermit|abbot|abbess|priest|priests|deacon|deacons|"
    r"brethren|king|queen|emperor|doctor|soldier|soldiers|tribune|centurion|levite|"
    r"monk|nun|recluse|subdeacon|acolyte|matron|youth|child|maiden|anchorite|"
    r"stylite|fool|prophet|prophets|archbishop)"
)
_DESCRIPTOR_CHAIN = rf"(?:{_DESCRIPTOR}(?:\s+and\s+{_DESCRIPTOR})?\s+)?"


_TRAILING_DESCR = (
    r"(bishop|archbishop|pope|priest|deacon|abbot|abbess|confessor|sister|"
    r"brother|father|mother|wife|husband|spouse|disciple|founder|son|daughter|"
    r"king|queen|virgin|martyr|hermit|monk|nun|pastor|levite|soldier|tribune|"
    r"famous|renowned|distinguished|illustrious|celebrated|eminent|surnamed|"
    r"an eminent|the husband|the wife|the disciple|the founder|the mother|"
    r"the father|the sister|the brother|the son|the daughter)"
)


def normalize_name(name: str) -> str:
    name = name.strip().rstrip(",.").strip()
    name = re.sub(r"^the birthday of\s+", "", name, flags=re.I)
    name = re.sub(r"^the feast of\s+", "", name, flags=re.I)
    name = re.sub(r"^the commemoration of\s+", "", name, flags=re.I)
    # Collective martyrs keep their collective form.
    if re.match(r"^(the\s+)?holy martyrs\b", name, flags=re.I):
        return re.sub(r"^holy martyrs", "the holy martyrs", name, flags=re.I)
    if re.match(r"^(the\s+)?blessed martyrs\b", name, flags=re.I):
        return "the holy martyrs" + name[name.lower().index("martyrs") + len("martyrs"):]
    if re.match(r"^the Saints\b", name):
        return name
    # Trailing descriptive clause after a comma is not part of the name.
    name = re.sub(rf",\s+(?:{_TRAILING_DESCR})\b.*$", "", name, flags=re.I)
    name = re.sub(r",\s+the first\b.*$", "", name, flags=re.I)
    name = re.sub(r",?\s+of the Order of\b.*$", "", name, flags=re.I)
    name = re.sub(r",?\s+of the Society of Jesus\b.*$", "", name, flags=re.I)
    name = re.sub(r"\s+founder of\b.*$", "", name, flags=re.I)
    # Singular: strip descriptor chains -> "Saint X" / "Blessed X".
    m = re.match(
        rf"^(the\s+)?(holy|blessed|saint|st\.)\s+{_DESCRIPTOR_CHAIN}(of\s+)?(.+)$",
        name,
        flags=re.I,
    )
    if m:
        kind = (m.group(2) or "").lower()
        prefix = "Blessed " if kind == "blessed" else "Saint "
        rest = ((m.group(3) or "") + m.group(4)).strip()
        if rest:
            return prefix + rest[0].upper() + rest[1:]
    name = re.sub(r"^holy\s+", "Saint ", name)
    name = re.sub(r"^the holy\s+", "Saint ", name)
    name = re.sub(r"^blessed\s+", "Blessed ", name)
    return name.strip()


def extract_lead_name(lead_text: str) -> str:
    """Heuristic: name phrase of the lead martyrology entry."""
    text = clean(lead_text)
    text = re.sub(r"\[[^\]]*\]", "", text)  # editorial [in the year ...] spans
    text = re.sub(r"\([^)]*\)", "", text)  # parenthetical asides
    text = re.sub(r"\s+", " ", text).strip()
    m = EPITHET_RE.search(text)
    if not m:
        return ""
    frag = text[m.start():]
    # A sentence end shortly after the epithet closes the name phrase
    # ("... the holy Virgin Apollonia. The persecutors ..."). Skip "St."
    # abbreviations.
    for pm in re.finditer(r"\.\s", frag):
        if pm.start() > 4 and not frag[:pm.start()].rstrip().endswith(("St", "St.")):
            frag = frag[:pm.start()]
            break
    # Cut at the first clause boundary that ends a name phrase.
    cut = re.search(
        r"(,\s+who\b|,\s+whence\b|,\s+in the year\b|,\s+about the year\b|"
        r"\s+they were\b|\s+he was\b|\s+she was\b|\s+was born\b|"
        r",\s+under the\b|,\s+in the persecution\b|,\s+whose\b)",
        frag,
        flags=re.I,
    )
    if cut:
        frag = frag[:cut.start()]
    else:
        # No clause boundary: stop at the second comma for place-heavy texts,
        # unless it is a name list (commas followed by capitalized names).
        commas = [mm.start() for mm in re.finditer(r",", frag)]
        if len(commas) >= 2:
            frag = frag[:commas[1]]
        elif commas:
            frag = frag[:commas[0]]
    return normalize_name(frag)


def parse_martyrology(path: Path, mmdd: str) -> tuple[str, str]:
    """Return (lead_name_candidate, eulogy) from one MM-DD.txt file.

    The martyrology is read anticipated: many files open with a solemnity
    announcement section ("The morrow is ...") before the first saint
    commemoration. Announcements are skipped unless the date is one of the
    great feasts whose announcement is itself the headline (ANNOUNCEMENT_LEADS).
    """
    raw = path.read_text(encoding="utf-8", errors="replace")
    sections = re.split(
        r"^\[([^\]]+)\](?:\s*\(rubrica[^)]*\))?\s*$", raw, flags=re.M
    )
    # sections: [prefix, tag, body, tag, body, ...]
    entries: list[str] = []
    for i in range(1, len(sections) - 1, 2):
        tag, body = sections[i], clean(sections[i + 1])
        if tag in {"Titulus", "Separatio", "Bissextili"}:
            continue
        if not body or body == "_" or body.startswith("@:") or body.startswith("/:"):
            continue
        entries.append(body)
    if not entries:
        return "", ""
    if ANNOUNCEMENT_RE.match(entries[0]):
        if mmdd in ANNOUNCEMENT_LEADS:
            return ANNOUNCEMENT_LEADS[mmdd], first_sentences(entries[0])
        entries = entries[1:]
        if not entries:
            return "", ""
    lead = entries[0]
    return extract_lead_name(lead), first_sentences(lead)


def sancti_name(path: Path) -> str:
    if not path.exists():
        return ""
    raw = path.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"\[(?:Rank|Officium)\]\s*\n([^\n]+)", raw)
    if not m:
        return ""
    return clean(m.group(1).split(";;")[0].split(";")[0])


def parse_delta(path: Path) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        parts = [p.strip() for p in line.split("=")]
        if re.fullmatch(r"\d{2}-\d{2}", parts[0]):
            out[parts[0]] = parts[1:]
    return out


def observance_1962(mmdd: str, sancti_dir: Path, deltas: list[dict]) -> str:
    base = sancti_dir / f"{mmdd}.txt"
    reduced = sancti_dir / f"{mmdd}r.txt"
    name = sancti_name(reduced) or sancti_name(base)
    suppressed = False
    for delta in deltas:  # applied in order 1954 -> 1955 -> 1960
        if mmdd not in delta:
            continue
        parts = delta[mmdd]
        file_field = parts[0] if parts else ""
        if file_field == "XXXXX":
            suppressed = True
            name = ""
            continue
        suppressed = False
        # File variants named by the delta (e.g. 05-03r, 08-09t~08-09cc).
        for variant in file_field.split("~"):
            vname = sancti_name(sancti_dir / f"{variant}.txt")
            if vname:
                name = vname
                break
    if suppressed:
        return ""
    if name and re.search(r"octave|infra octavam", name, flags=re.I):
        # Octaves other than Christmas were abolished in 1955; a bare
        # octave-day office in the sanctoral is not a 1962 observance.
        if mmdd not in {"12-29", "12-30", "12-31"}:
            return ""
    return name


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--divinum", required=True, help="Divinum Officium checkout root")
    parser.add_argument("--out", default="config/publish/offline/martyrology-1962.json")
    parser.add_argument("--review", action="store_true", help="Print the full day table")
    args = parser.parse_args()

    root = Path(args.divinum)
    mart_dir = root / "web/www/horas/English/Martyrologium"
    sancti_dir = root / "web/www/horas/English/Sancti"
    kal_dir = root / "web/www/Tabulae/Kalendaria"
    deltas = [parse_delta(kal_dir / f"{year}.txt") for year in ("1954", "1955", "1960")]

    entries: dict[str, dict] = {}
    gaps: list[str] = []
    for month in range(1, 13):
        for day in range(1, DAYS_IN_MONTH[month] + 1):
            mmdd = f"{month:02d}-{day:02d}"
            mart_file = mart_dir / f"{mmdd}.txt"
            if not mart_file.exists():
                gaps.append(mmdd)
                continue
            lead, eulogy = parse_martyrology(mart_file, mmdd)
            if mmdd in LEAD_OVERRIDES:
                lead = LEAD_OVERRIDES[mmdd]
            if mmdd in EULOGY_OVERRIDES:
                eulogy = EULOGY_OVERRIDES[mmdd]
            obs = observance_1962(mmdd, sancti_dir, deltas)
            if mmdd in OBS1962_OVERRIDES:
                obs = OBS1962_OVERRIDES[mmdd]
            entries[mmdd] = {
                "martyrology_lead": lead,
                "martyrology_text": eulogy,
                "calendar_1962": obs,
                "martyrology_url": f"http://laudatedominum.net/martyrology/{MONTHS[month]}.php",
            }
            if not lead:
                gaps.append(f"{mmdd} (no lead name extracted)")

    payload = {
        "source": (
            "Roman Martyrology lead commemoration + eulogy: pre-conciliar English "
            "Martyrology (public domain), Divinum Officium English/Martyrologium "
            "files. 1962 observance: Divinum Officium English/Sancti names with "
            "the Kalendaria 1954/1955/1960 delta tables applied (Rubrics 1960)."
        ),
        "entries": entries,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {out_path}: {len(entries)} month-days; gaps: {gaps or 'none'}")
    if args.review:
        for mmdd in sorted(entries):
            e = entries[mmdd]
            print(f"{mmdd} | 1962: {e['calendar_1962'] or '-'} | LEAD: {e['martyrology_lead'] or '-'} | {e['martyrology_text'][:80]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
