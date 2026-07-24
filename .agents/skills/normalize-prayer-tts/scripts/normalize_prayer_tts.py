#!/usr/bin/env python3
"""Preview prayer text as structured, TTS-safe segments."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


ROLE_MARKER_RE = re.compile(
    r"(?im)(?P<prefix>^|\r?\n\s*|(?<=[.!?])\s+)"
    r"(?P<label>Versicle\s*:|Response\s*:|[VR](?:\.|:))\s*"
)
ANY_SHORT_ROLE_RE = re.compile(r"(?i)\b[VR]\.\s+")
INTENTION_RE = re.compile(
    r"""(?ix)
    \(?\s*
    (?:
        pause\s+(?:here\s+)?(?:to\s+(?:mention|state|offer)\s+(?:your|the)\s+
            (?:request|intention)s?|for\s+(?:your|a\s+personal|personal)\s+intentions?)
        |
        mention\s+your\s+(?:request|intention)s?\s+here
    )
    \s*\)?[.!]?
    """
)
SAINTS_RE = re.compile(r"(?i)\b(?:STS|Sts)\.?(?=\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*)")
SAINT_RE = re.compile(r"(?i)\bSt\.(?=\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*)")
CLERGY_PATTERNS: Sequence[Tuple[re.Pattern[str], str, str]] = (
    (re.compile(r"\bFr\.(?=\s+[A-Z])"), "Father", "expand-fr"),
    (re.compile(r"\bRev\.(?=\s+[A-Z])"), "Reverend", "expand-rev"),
    (re.compile(r"\bBp\.(?=\s+[A-Z])"), "Bishop", "expand-bp"),
    (re.compile(r"\bMsgr\.(?=\s+[A-Z])"), "Monsignor", "expand-msgr"),
)
REPEAT_RE = re.compile(
    r"(?i)(?<!\w)(?:x\s*\d+|\d+\s+times|repeat\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+times)\b"
)
EDITORIAL_LINE_RE = re.compile(
    r"(?im)^\s*(?:Note|Source|Copyright|Optional|Instructions?)\s*:\s*.+$"
)
CONTACT_RE = re.compile(
    r"(?i)(?:https?://\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"
    r"|\bP\.?\s*O\.?\s+Box\b|\b\d{1,6}\s+[A-Z][\w.'’-]+(?:\s+[A-Z][\w.'’-]+){0,4}\s+"
    r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Plaza|Lane|Ln)\b)"
)
RUBRIC_RE = re.compile(
    r"(?i)(?:\[[^\]]*\b(?:pause|silence|bell|leader|all|repeat|optional|priest only)\b[^\]]*\]"
    r"|\([^)]*\b(?:pause|silence|bell|leader|all|repeat|optional|priest only)\b[^)]*\))"
)
LIKELY_SPOKEN_KEYS = {"text", "content", "body", "prayer", "spoken_text", "narration"}


@dataclass(frozen=True)
class NormalizationOptions:
    include_bell: bool = True
    intention_pause_ms: int = 5000
    expand_clergy: bool = True


def _clean_text(text: str) -> str:
    value = str(text or "").replace("\u00a0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r" *\r?\n *", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _diagnostic(
    rule: str,
    *,
    original: str,
    action: str,
    severity: str = "info",
    replacement: Optional[str] = None,
    review_required: bool = False,
) -> Dict[str, Any]:
    item: Dict[str, Any] = {
        "rule": rule,
        "severity": severity,
        "action": action,
        "original": original,
        "review_required": review_required,
    }
    if replacement is not None:
        item["replacement"] = replacement
    return item


def _expand_abbreviations(text: str, diagnostics: List[Dict[str, Any]], options: NormalizationOptions) -> str:
    def replace_saints(match: re.Match[str]) -> str:
        diagnostics.append(
            _diagnostic("expand-saints", original=match.group(0), action="expand", replacement="Saints")
        )
        return "Saints"

    value = SAINTS_RE.sub(replace_saints, text)

    def replace_saint(match: re.Match[str]) -> str:
        prefix = value[max(0, match.start() - 16) : match.start()]
        if re.search(r"\d+\s*$", prefix):
            diagnostics.append(
                _diagnostic(
                    "ambiguous-street-or-saint",
                    original=match.group(0),
                    action="preserve",
                    severity="review",
                    review_required=True,
                )
            )
            return match.group(0)
        diagnostics.append(
            _diagnostic("expand-saint", original=match.group(0), action="expand", replacement="Saint")
        )
        return "Saint"

    value = SAINT_RE.sub(replace_saint, value)
    if options.expand_clergy:
        for pattern, replacement, rule in CLERGY_PATTERNS:
            def replace_clergy(match: re.Match[str], *, word: str = replacement, rule_id: str = rule) -> str:
                diagnostics.append(
                    _diagnostic(rule_id, original=match.group(0), action="expand", replacement=word)
                )
                return word

            value = pattern.sub(replace_clergy, value)
    return value


def _artifact_diagnostics(text: str, diagnostics: List[Dict[str, Any]]) -> None:
    rules: Sequence[Tuple[re.Pattern[str], str, str]] = (
        (REPEAT_RE, "repeat-notation", "convert-to-structured-repeat"),
        (EDITORIAL_LINE_RE, "editorial-line", "review-for-removal"),
        (CONTACT_RE, "contact-or-provenance", "review-for-removal"),
        (RUBRIC_RE, "rubric-or-stage-direction", "review-for-structure-or-removal"),
    )
    for pattern, rule, action in rules:
        for match in pattern.finditer(text):
            diagnostics.append(
                _diagnostic(
                    rule,
                    original=match.group(0).strip(),
                    action=action,
                    severity="review",
                    review_required=True,
                )
            )
    for match in ANY_SHORT_ROLE_RE.finditer(text):
        diagnostics.append(
            _diagnostic(
                "ambiguous-role-marker",
                original=match.group(0).strip(),
                action="preserve",
                severity="review",
                review_required=True,
            )
        )


def _attach_source_locations(source: str, diagnostics: List[Dict[str, Any]]) -> None:
    cursors: Dict[str, int] = {}
    source_lower = source.lower()
    for item in diagnostics:
        original = str(item.get("original", ""))
        if not original:
            continue
        key = original.lower()
        cursor = cursors.get(key, 0)
        offset = source.find(original, cursor)
        if offset < 0:
            offset = source_lower.find(key, cursor)
        if offset < 0:
            offset = source.find(original)
        if offset < 0:
            offset = source_lower.find(key)
        if offset < 0:
            continue
        cursors[key] = offset + len(original)
        line_start = source.rfind("\n", 0, offset)
        item["offset"] = offset
        item["line"] = source.count("\n", 0, offset) + 1
        item["column"] = offset - line_start


def _append_speech(
    segments: List[Dict[str, Any]],
    text: str,
    role: Optional[str],
    diagnostics: List[Dict[str, Any]],
    options: NormalizationOptions,
) -> None:
    cursor = 0
    for match in INTENTION_RE.finditer(text):
        before = _clean_text(text[cursor : match.start()])
        if before:
            before = _expand_abbreviations(before, diagnostics, options)
            segment: Dict[str, Any] = {"kind": "speech", "text": before}
            if role:
                segment["audio_role"] = role
            segments.append(segment)
        phrase = match.group(0).strip()
        diagnostics.append(
            _diagnostic(
                "personal-intention-pause",
                original=phrase,
                action="replace-with-cue-and-pause" if options.include_bell else "replace-with-pause",
            )
        )
        if options.include_bell:
            segments.append({"kind": "audio_cue", "cue": "sacred_bell"})
        segments.append(
            {
                "kind": "pause",
                "purpose": "personal_intention",
                "duration_ms": options.intention_pause_ms,
            }
        )
        cursor = match.end()
    after = _clean_text(text[cursor:])
    if after:
        after = _expand_abbreviations(after, diagnostics, options)
        segment = {"kind": "speech", "text": after}
        if role:
            segment["audio_role"] = role
        segments.append(segment)


def normalize_text(text: Any, options: Optional[NormalizationOptions] = None) -> Dict[str, Any]:
    config = options or NormalizationOptions()
    if config.intention_pause_ms < 1 or config.intention_pause_ms > 120000:
        raise ValueError("intention_pause_ms must be from 1 through 120000")
    source = _clean_text(str(text or ""))
    segments: List[Dict[str, Any]] = []
    diagnostics: List[Dict[str, Any]] = []
    markers = list(ROLE_MARKER_RE.finditer(source))

    if markers:
        preamble = _clean_text(source[: markers[0].start()])
        if preamble:
            _append_speech(segments, preamble, None, diagnostics, config)
        for index, marker in enumerate(markers):
            label = marker.group("label")
            role = "versicle" if label.lstrip().lower().startswith("v") else "response"
            diagnostics.append(
                _diagnostic(
                    "role-marker",
                    original=label.strip(),
                    action="assign-audio-role",
                    replacement=role,
                )
            )
            end = markers[index + 1].start() if index + 1 < len(markers) else len(source)
            _append_speech(segments, source[marker.end() : end], role, diagnostics, config)
    elif source:
        _append_speech(segments, source, None, diagnostics, config)

    for segment in segments:
        if segment.get("kind") == "speech":
            _artifact_diagnostics(str(segment.get("text", "")), diagnostics)
    _attach_source_locations(source, diagnostics)

    summary = {
        "segments": len(segments),
        "speech": sum(segment.get("kind") == "speech" for segment in segments),
        "cues": sum(segment.get("kind") == "audio_cue" for segment in segments),
        "pauses": sum(segment.get("kind") == "pause" for segment in segments),
        "diagnostics": len(diagnostics),
        "review_required": sum(bool(item.get("review_required")) for item in diagnostics),
    }
    return {"segments": segments, "diagnostics": diagnostics, "summary": summary}


def _json_path(parent: str, key: Any, *, index: bool = False) -> str:
    if index:
        return f"{parent}[{key}]"
    key_text = str(key)
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key_text):
        return f"{parent}.{key_text}"
    return f"{parent}[{json.dumps(key_text)}]"


def audit_json(value: Any, source: str = "<json>", options: Optional[NormalizationOptions] = None) -> Dict[str, Any]:
    results: List[Dict[str, Any]] = []

    def walk(item: Any, path: str, key_name: Optional[str] = None) -> None:
        if isinstance(item, dict):
            for key, child in item.items():
                walk(child, _json_path(path, key), str(key).lower())
        elif isinstance(item, list):
            for index, child in enumerate(item):
                walk(child, _json_path(path, index, index=True), key_name)
        elif isinstance(item, str) and key_name in LIKELY_SPOKEN_KEYS:
            normalized = normalize_text(item, options)
            if normalized["segments"] or normalized["diagnostics"]:
                for diagnostic in normalized["diagnostics"]:
                    diagnostic["source_path"] = path
                results.append({"path": path, "input": item, **normalized})

    walk(value, "$")
    return {
        "source": source,
        "kind": "json",
        "results": results,
        "summary": {
            "fields_scanned": len(results),
            "diagnostics": sum(row["summary"]["diagnostics"] for row in results),
            "review_required": sum(row["summary"]["review_required"] for row in results),
        },
    }


def _read_input(path_text: str) -> Tuple[str, str]:
    if path_text == "-":
        return sys.stdin.read(), "<stdin>"
    path = Path(path_text)
    return path.read_text(encoding="utf-8"), str(path)


def _parse_args(argv: Optional[Sequence[str]]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", help="UTF-8 text/JSON file, or - for stdin")
    parser.add_argument("--format", choices=("auto", "text", "json"), default="auto", dest="input_format")
    parser.add_argument("--no-bell", action="store_true", help="Emit an intention pause without a sacred-bell cue")
    parser.add_argument("--pause-ms", type=int, default=5000, help="Personal-intention pause duration")
    parser.add_argument("--strict", action="store_true", help="Exit 1 when review findings remain")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(argv)
    try:
        raw, source = _read_input(args.path)
        input_format = args.input_format
        if input_format == "auto":
            input_format = "json" if source.lower().endswith(".json") else "text"
        options = NormalizationOptions(
            include_bell=not args.no_bell,
            intention_pause_ms=args.pause_ms,
        )
        if input_format == "json":
            payload = audit_json(json.loads(raw), source, options)
        else:
            result = normalize_text(raw, options)
            for diagnostic in result["diagnostics"]:
                diagnostic["source_path"] = source
            payload = {"source": source, "kind": "text", **result}
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print(json.dumps(payload, indent=2, ensure_ascii=False))
    review_count = int(payload.get("summary", {}).get("review_required", 0))
    return 1 if args.strict and review_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
