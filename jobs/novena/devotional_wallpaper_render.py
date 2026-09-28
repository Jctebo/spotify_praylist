"""Independent devotional phone and watch rendering with deterministic text."""

from __future__ import annotations

import base64
import io
import json
import os
import re
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
) -> bytes:
    reference_path = _reference_for(variant)
    encoded = base64.b64encode(reference_path.read_bytes()).decode("ascii")
    reference_mime = "image/jpeg"
    prompt = build_art_prompt(spec, variant, variation)
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

    lines = _wrap_lines(draw, text, font, min(max_width, allowed_at(top, font.getbbox("Ag")[3] - font.getbbox("Ag")[1] + 8)))
    while base_size > 20:
        line_h = max(font.getbbox(line)[3] - font.getbbox(line)[1] for line in lines) + 8
        invalid = len(lines) > 2 or any(
            draw.textlength(line, font=font) > allowed_at(top + index * line_h, line_h)
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
        text_width = sum(widths) + tracking * (len(line) - 1)
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
        # A subtle top vignette supports small text while preserving a full square painting.
        _safe_fade(image, 0, int(image.height * 0.34), opacity=95)
        draw = ImageDraw.Draw(image)
        title_top = int(image.height * 0.095)
        title_size = int(image.width * 0.077)
        title_width = int(image.width * 0.78)
        circular = True
    title_h, _ = _draw_centered_label(
        draw, image, spec.title, top=title_top, base_size=title_size,
        max_width=title_width, circular=circular, tracking=0.2,
    )
    subtitle = spec.image_subtitle
    subtitle_top = title_top + title_h + int(image.height * (0.012 if variant == "phone" else 0.025))
    subtitle_size = int(image.width * (0.027 if variant == "phone" else 0.042))
    subtitle_width = int(image.width * (0.84 if variant == "phone" else 0.70))
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
            crop = image.crop((0, 0, width, round(height * (0.36 if width == height else 0.28))))
        raw = pytesseract.image_to_data(crop, config="--psm 6", output_type=pytesseract.Output.DATAFRAME)
        text = " ".join(str(word).strip() for word in raw["text"].dropna() if str(word).strip())
        # The overlay puts the title and subtitle on consecutive lines; preserve split for contract checks.
        line_groups = []
        for _, group in raw.dropna(subset=["text"]).groupby(["block_num", "par_num", "line_num"]):
            value = " ".join(str(word).strip() for word in group["text"] if str(word).strip())
            if value:
                line_groups.append(value)
        return text, "\n".join(line_groups)
    except Exception as exc:
        raise RuntimeError(f"Local wallpaper OCR failed ({type(exc).__name__})") from None


def _normalize_ocr(value: str) -> str:
    value = value.upper().replace("&", "AND")
    return re.sub(r"[^A-Z0-9]+", " ", value).strip()


def vision_qa(client: Any, image_bytes: bytes, spec: DailyImageSpec, variant: str, *, model: str) -> dict[str, Any]:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    prompt = (
        "Inspect this finished Catholic devotional wallpaper. Return JSON only: "
        "{\"approved\": boolean, \"issues\": [string]}. Check that the scene depicts the named subject respectfully, "
        "anatomy and iconography are coherent, there is no unwanted lettering/logo/device UI, and composition suits "
        f"a {variant} wallpaper. The image already contains exact locally overlaid text: title {spec.title!r}; "
        f"required subtitle {spec.image_subtitle!r}. Do not reject stylized lettering unless clearly wrong or clipped."
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
    if expected_title not in ocr_all:
        issues.append("OCR did not confirm the exact title")
    if expected_subtitle not in ocr_all:
        issues.append("OCR did not confirm the exact classification/subtitle")
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
) -> tuple[bytes, dict[str, Any]]:
    raw = generate_artwork(
        client, spec, variant, caller_model=caller_model, image_model=image_model, variation=variation,
    )
    final = overlay_wallpaper_text(raw, spec, variant)
    local = validate_local_qa(final, spec, variant, recognize=lambda data: ocr_text(data, tesseract_cmd=tesseract_cmd))
    if not local.approved:
        raise RuntimeError("Wallpaper local QA failed: " + "; ".join(local.issues))
    vision = vision_qa(client, final, spec, variant, model=qa_model)
    if not vision["approved"]:
        raise RuntimeError("Wallpaper vision QA failed: " + "; ".join(vision["issues"] or ["unapproved image"]))
    return final, {
        "approved": True,
        "local_qa": asdict(local),
        "vision_qa": vision,
        "render_version": RENDER_VERSION,
        "dimensions": list(_output_size(variant)),
    }
