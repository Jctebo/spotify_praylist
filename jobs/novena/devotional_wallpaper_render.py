"""Independent devotional phone and watch rendering with deterministic text."""

from __future__ import annotations

import base64
from difflib import SequenceMatcher
import io
import json
import os
import re
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from jobs.novena.devotional_image_contract import DailyImageSpec, PHONE_RENDER_SIZE, PHONE_SIZE, WATCH_SIZE, build_art_prompt


REPO_ROOT = Path(__file__).resolve().parents[2]
FONT_PATH = REPO_ROOT / "config" / "devotional_images" / "fonts" / "EBGaramond-Regular.ttf"
REFERENCE_DIR = REPO_ROOT / "config" / "devotional_images" / "references"
RENDER_VERSION = "wallpaper-v1"
OUTPUT_FORMAT = "JPEG"
JPEG_QUALITY = 95
WATCH_SAFE_RADIUS = 460


@dataclass(frozen=True)
class QAResult:
    approved: bool
    issues: tuple[str, ...]
    ocr_title: str
    ocr_subtitle: str


def _extract_output_image(response: Any) -> bytes:
    for item in getattr(response, "output", None) or []:
        kind = getattr(item, "type", "") or (item.get("type", "") if isinstance(item, dict) else "")
        if kind not in {"image_generation_call", "image_generation"}:
            continue
        result = getattr(item, "result", "") or (item.get("result", "") if isinstance(item, dict) else "")
        if result:
            return base64.b64decode(result, validate=True)
    raise RuntimeError("Image-generation response did not contain image bytes")


def _output_size(variant: str) -> tuple[int, int]:
    if variant == "watch":
        return WATCH_SIZE
    if variant == "phone":
        return PHONE_SIZE
    raise ValueError(f"Unsupported wallpaper variant: {variant}")


def image_tool(*, variant: str, model: str, quality: str = "high") -> dict[str, Any]:
    if variant not in {"phone", "watch"}:
        raise ValueError(f"Unsupported wallpaper variant: {variant}")
    size = "1024x1024" if variant == "watch" else "1152x2048"
    return {
        "type": "image_generation",
        "model": model,
        "size": size,
        "quality": quality,
        "output_format": "png",
        "background": "opaque",
    }


def _reference_for(variant: str) -> Path:
    name = "holy-eucharist-square.jpg" if variant == "watch" else "our-lady-of-sorrows-phone.jpg"
    path = REFERENCE_DIR / name
    if not path.is_file():
        raise RuntimeError(f"Missing devotional wallpaper style reference: {name}")
    return path


def generate_artwork(
    client: Any,
    spec: DailyImageSpec,
    variant: str,
    *,
    caller_model: str,
    image_model: str,
    quality: str = "high",
    variation: str = "",
    qa_feedback: str = "",
) -> bytes:
    reference_path = _reference_for(variant)
    encoded = base64.b64encode(reference_path.read_bytes()).decode("ascii")
    reference_mime = "image/jpeg"
    prompt = build_art_prompt(spec, variant, variation)
    if qa_feedback:
        prompt += "\nCorrect these image-review findings in this new artwork: " + qa_feedback
    response = client.responses.create(
        model=caller_model,
        input=[{
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": f"data:{reference_mime};base64,{encoded}"},
            ],
        }],
        tools=[image_tool(variant=variant, model=image_model, quality=quality)],
    )
    return _extract_output_image(response)


def _font(size: int) -> ImageFont.FreeTypeFont:
    if not FONT_PATH.is_file():
        raise RuntimeError(f"Pinned EB Garamond font is missing: {FONT_PATH}")
    return ImageFont.truetype(str(FONT_PATH), size=size)


def _wrap_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and draw.textlength(candidate, font=font) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def _circular_chord_width(y: float, center_y: float, radius: float) -> float:
    dy = y - center_y
    if abs(dy) >= radius:
        return 0
    return 2 * (radius * radius - dy * dy) ** 0.5


def _draw_centered_label(
    draw: ImageDraw.ImageDraw,
    image: Image.Image,
    text: str,
    *,
    top: int,
    base_size: int,
    max_width: int,
    circular: bool,
    fill: tuple[int, int, int, int] = (255, 250, 237, 255),
    tracking: float = 1.0,
) -> tuple[int, int]:
    font = _font(base_size)

    def allowed_at(y: float, height: float) -> int:
        if not circular:
            return max_width
        chord = _circular_chord_width(y + height / 2, 512, WATCH_SAFE_RADIUS)
        return max(0, min(max_width, int(chord) - 24))

    def rendered_width(line: str, active_font: ImageFont.FreeTypeFont) -> float:
        # Drawing advances each glyph separately to apply letter spacing, so use
        # those same advances when deciding whether a line fits the circle.
        widths = [draw.textlength(char, font=active_font) for char in line]
        return sum(widths) + tracking * max(0, len(line) - 1)

    lines = _wrap_lines(draw, text, font, min(max_width, allowed_at(top, font.getbbox("Ag")[3] - font.getbbox("Ag")[1] + 8)))
    while base_size > 20:
        line_h = max(font.getbbox(line)[3] - font.getbbox(line)[1] for line in lines) + 8
        invalid = len(lines) > 2 or any(
            rendered_width(line, font) > allowed_at(top + index * line_h, line_h)
            for index, line in enumerate(lines)
        )
        if not invalid:
            break
        base_size -= 2
        font = _font(base_size)
        line_h = font.getbbox("Ag")[3] - font.getbbox("Ag")[1] + 8
        lines = _wrap_lines(draw, text, font, min(max_width, allowed_at(top, line_h)))
    if len(lines) > 2:
        raise RuntimeError("Wallpaper title/subtitle cannot fit in two lines")
    line_h = max(font.getbbox(line)[3] - font.getbbox(line)[1] for line in lines) + 8
    overall_h = len(lines) * line_h
    for index, line in enumerate(lines):
        y = top + index * line_h
        widths = [draw.textlength(char, font=font) for char in line]
        text_width = rendered_width(line, font)
        allowed_width = allowed_at(y, line_h)
        if text_width > allowed_width:
            raise RuntimeError("Wallpaper text does not fit its device safe area")
        x = (image.width - text_width) / 2
        # A quiet translucent shadow follows the text silhouette without placing a banner over the art.
        stroke = max(1, round(base_size / 42))
        cursor = x
        for char, advance in zip(line, widths):
            draw.text((cursor, y + 2), char, font=font, fill=(0, 0, 0, 210), stroke_width=stroke + 1, stroke_fill=(0, 0, 0, 160))
            draw.text((cursor, y), char, font=font, fill=fill, stroke_width=stroke, stroke_fill=(20, 22, 30, 150))
            cursor += advance + tracking
    return overall_h, base_size


def _safe_fade(image: Image.Image, top: int, bottom: int, opacity: int = 85) -> None:
    if bottom <= top:
        return
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    height = bottom - top
    for y in range(top, bottom):
        alpha = round(opacity * min(1, (y - top + 1) / max(1, height * 0.22), (bottom - y) / max(1, height * 0.18)))
        draw.line((0, y, image.width, y), fill=(8, 11, 20, alpha))
    image.alpha_composite(layer)


def overlay_wallpaper_text(
    artwork: bytes,
    spec: DailyImageSpec,
    variant: str,
    *,
    phone_size: tuple[int, int] = PHONE_SIZE,
    watch_size: tuple[int, int] = WATCH_SIZE,
) -> bytes:
    final_size = watch_size if variant == "watch" else phone_size if variant == "phone" else None
    if final_size is None:
        raise ValueError(f"Unsupported wallpaper variant: {variant}")
    try:
        with Image.open(io.BytesIO(artwork)) as source:
            source.load()
            image = ImageOps.fit(source.convert("RGB"), final_size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)).convert("RGBA")
    except Exception as exc:
        raise RuntimeError(f"Generated art is not a valid image ({type(exc).__name__})") from None
    draw = ImageDraw.Draw(image)
    if variant == "phone":
        # Keep a quiet overlay-safe title band; all generated UI overlays remain absent.
        _safe_fade(image, 0, int(image.height * 0.24), opacity=82)
        draw = ImageDraw.Draw(image)
        title_top = int(image.height * 0.045)
        title_size = int(image.width * 0.053)
        title_width = int(image.width * 0.88)
        circular = False
    else:
        # A top vignette gives the larger, safely placed circular label enough contrast.
        _safe_fade(image, 0, int(image.height * 0.40), opacity=150)
        draw = ImageDraw.Draw(image)
        title_top = int(image.height * 0.16)
        title_size = int(image.width * 0.077)
        title_width = int(image.width * 0.86)
        circular = True
    title_h, _ = _draw_centered_label(
        draw, image, spec.title, top=title_top, base_size=title_size,
        max_width=title_width, circular=circular, tracking=0.2,
    )
    subtitle = spec.image_subtitle
    subtitle_top = title_top + title_h + int(image.height * (0.012 if variant == "phone" else 0.025))
    subtitle_size = int(image.width * (0.027 if variant == "phone" else 0.042))
    subtitle_width = int(image.width * (0.84 if variant == "phone" else 0.78))
    _draw_centered_label(
        draw, image, subtitle, top=subtitle_top, base_size=subtitle_size,
        max_width=subtitle_width, circular=circular, tracking=0.35,
    )
    flattened = Image.new("RGB", image.size, (0, 0, 0))
    flattened.paste(image, mask=image.getchannel("A"))
    output = io.BytesIO()
    flattened.save(output, format=OUTPUT_FORMAT, quality=JPEG_QUALITY, optimize=True, subsampling=0, progressive=True)
    return output.getvalue()


def ocr_text(image_bytes: bytes, *, tesseract_cmd: Optional[str] = None) -> tuple[str, str]:
    try:
        import pytesseract
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            width, height = image.size
            if width == height:
                margin = round(width * 0.05)
                crop = image.crop((margin, round(height * 0.12), width - margin, round(height * 0.46)))
                subtitle_crop = image.crop((round(width * 0.08), round(height * 0.26), round(width * 0.92), round(height * 0.40)))
            else:
                crop = image.crop((0, 0, width, round(height * 0.30)))
                subtitle_crop = None
        enlarged = ImageOps.autocontrast(ImageOps.grayscale(crop)).resize(
            (crop.width * 2, crop.height * 2), Image.Resampling.LANCZOS,
        )
        focused_subtitle = None
        if subtitle_crop is not None:
            focused_subtitle = ImageOps.autocontrast(ImageOps.grayscale(subtitle_crop)).resize(
                (subtitle_crop.width * 3, subtitle_crop.height * 3), Image.Resampling.LANCZOS,
            )
            focused_subtitle_threshold = focused_subtitle.point(lambda value: 255 if value > 160 else 0)
        # Keep a normal pass for crisp text, then retry harder backgrounds at higher
        # resolution with both block and sparse-text layouts. A separate watch
        # subtitle band helps recognize short labels when the title dominates the
        # full safe-area crop.
        candidates = (
            (crop, "--psm 6"),
            (enlarged, "--psm 6"),
            (enlarged, "--psm 11"),
            (enlarged, "--psm 12"),
        )
        if focused_subtitle is not None:
            candidates += ((focused_subtitle, "--psm 6"), (focused_subtitle_threshold, "--psm 7"))
        all_lines: list[str] = []
        for candidate, config in candidates:
            raw = pytesseract.image_to_data(candidate, config=config, output_type=pytesseract.Output.DICT)
            line_groups: dict[tuple[Any, Any, Any], list[str]] = {}
            for index, word in enumerate(raw.get("text", [])):
                value = str(word).strip()
                if not value:
                    continue
                line = (raw["block_num"][index], raw["par_num"][index], raw["line_num"][index])
                line_groups.setdefault(line, []).append(value)
            all_lines.extend(" ".join(group) for group in line_groups.values())
        # Keep candidate line breaks and remove identical repeats across OCR passes.
        lines = list(dict.fromkeys(line for line in all_lines if line))
        all_words = [word for line in lines for word in line.split()]
        return " ".join(all_words), "\n".join(lines)
    except Exception as exc:
        raise RuntimeError(f"Local wallpaper OCR failed ({type(exc).__name__})") from None


def _normalize_ocr(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.upper().replace("&", "AND"))
    value = "".join(character for character in value if not unicodedata.combining(character))
    return re.sub(r"[^A-Z0-9]+", " ", value).strip()


def _ocr_confirms_words(expected: str, observed: str, *, allow_joined_sequence_number: bool = False) -> bool:
    expected_words = _normalize_ocr(expected).split()
    observed_words = _normalize_ocr(observed).split()
    if not expected_words or not observed_words:
        return False
    # Decorative all-caps lettering is often merged by Tesseract (e.g. "DAY 2"
    # becomes "DAY2"). Check ordinary tokens and normalized adjacent-token runs.
    observed_runs = observed_words + [
        "".join(observed_words[start:end])
        for start in range(len(observed_words))
        for end in range(start + 2, min(len(observed_words), start + 4) + 1)
    ]
    observed_compact = " ".join(observed_words)
    for expected_word in expected_words:
        if allow_joined_sequence_number and expected_word == "DAY" and re.search(r"\bDAY\d+\b", observed_compact):
            continue
        if allow_joined_sequence_number and expected_word.isdigit() and any(
            expected_word in word and word[:-len(expected_word)].endswith("DAY")
            for word in observed_runs
        ):
            continue
        threshold = 1.0 if len(expected_word) <= 3 else 0.78 if len(expected_word) <= 5 else 0.82
        if not any(
            SequenceMatcher(None, expected_word, observed_word).ratio() >= threshold
            for observed_word in observed_runs
        ):
            return False
    return True


def vision_qa(client: Any, image_bytes: bytes, spec: DailyImageSpec, variant: str, *, model: str) -> dict[str, Any]:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    prompt = (
        "Inspect this finished Catholic devotional wallpaper. Return JSON only: "
        "{\"approved\": boolean, \"issues\": [string]}. Check that the scene depicts the named subject respectfully, "
        "anatomy and iconography are coherent, there is no unwanted lettering/logo/device UI, and composition suits "
        f"a {variant} wallpaper. The title/subtitle region must not overlap any face, head, halo, hair, or identity-defining "
        f"part of the subject; for phone images the top 32% is text-only background. Explicitly inspect overlap and reject it. "
        f"Verify the exact spelling of locally overlaid title {spec.title!r} and subtitle "
        f"{spec.image_subtitle!r}. Do not reject stylized lettering unless the text is wrong, unclear, or clipped."
    )
    response = client.responses.create(
        model=model,
        input=[{"role": "user", "content": [
            {"type": "input_text", "text": prompt},
            {"type": "input_image", "image_url": f"data:image/jpeg;base64,{encoded}"},
        ]}],
    )
    text = str(getattr(response, "output_text", "") or "").strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Wallpaper vision QA response must be JSON") from exc
    if not isinstance(value, dict) or not isinstance(value.get("approved"), bool):
        raise RuntimeError("Wallpaper vision QA requires a boolean approved field")
    issues = value.get("issues") or []
    if not isinstance(issues, list):
        raise RuntimeError("Wallpaper vision QA issues must be a list")
    return {"approved": value["approved"], "issues": [str(v).strip() for v in issues if str(v).strip()]}


def validate_local_qa(
    image_bytes: bytes,
    spec: DailyImageSpec,
    variant: str,
    *,
    recognize: Callable[..., tuple[str, str]] = ocr_text,
) -> QAResult:
    expected_size = _output_size(variant)
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            if image.format != "JPEG" or image.size != expected_size:
                raise RuntimeError(f"Final {variant} wallpaper must be {expected_size[0]}x{expected_size[1]} JPEG")
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Final {variant} wallpaper is not a valid image ({type(exc).__name__})") from None
    _, lines = recognize(image_bytes)
    observed = [_normalize_ocr(line) for line in lines.splitlines() if line.strip()]
    expected_title = _normalize_ocr(spec.title)
    expected_subtitle = _normalize_ocr(spec.image_subtitle)
    ocr_all = " ".join(observed)
    issues: list[str] = []
    if not _ocr_confirms_words(spec.title, ocr_all):
        issues.append(f"OCR did not confirm the exact title; observed {ocr_all[:240]!r}")
    if not _ocr_confirms_words(
        spec.image_subtitle,
        ocr_all,
        allow_joined_sequence_number=bool(spec.sequence_kind),
    ):
        issues.append(
            f"OCR did not confirm subtitle {spec.image_subtitle!r}; observed {ocr_all[:240]!r}"
        )
    if variant == "watch":
        # Text draw-time geometry is checked against the circular chord in _draw_centered_label.
        with Image.open(io.BytesIO(image_bytes)) as image:
            if image.size != WATCH_SIZE:
                issues.append("watch dimensions are not square")
    return QAResult(not issues, tuple(issues), expected_title, expected_subtitle)


def render_variant(
    client: Any,
    spec: DailyImageSpec,
    variant: str,
    *,
    caller_model: str,
    image_model: str,
    qa_model: str,
    tesseract_cmd: Optional[str] = None,
    variation: str = "",
    rejected_path: Optional[Path] = None,
) -> tuple[bytes, dict[str, Any]]:
    feedback = ""
    last_final = b""
    for attempt in range(3):
        raw = generate_artwork(
            client, spec, variant, caller_model=caller_model, image_model=image_model,
            variation=variation, qa_feedback=feedback,
        )
        final = overlay_wallpaper_text(raw, spec, variant)
        last_final = final
        local = validate_local_qa(final, spec, variant, recognize=lambda data: ocr_text(data, tesseract_cmd=tesseract_cmd))
        if not local.approved:
            feedback = "; ".join(local.issues)
            if attempt < 2:
                continue
            issues = feedback
            break
        vision = vision_qa(client, final, spec, variant, model=qa_model)
        if not vision["approved"]:
            feedback = "; ".join(vision["issues"] or ["unapproved image"])
            if attempt < 2:
                continue
            issues = feedback
            break
        return final, {
            "approved": True,
            "local_qa": asdict(local),
            "vision_qa": vision,
            "render_attempts": attempt + 1,
            "render_version": RENDER_VERSION,
            "dimensions": list(_output_size(variant)),
        }
    if rejected_path is not None:
        rejected_path.parent.mkdir(parents=True, exist_ok=True)
        rejected_path.write_bytes(last_final)
    raise RuntimeError("Wallpaper QA rejected all three renders: " + issues)
