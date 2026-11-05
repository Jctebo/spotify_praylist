"""Church bell synthesis — the ONE bell recipe for every render path.

History: synthesis v2 was three sine partials (392/784/1176 Hz) with long
linear fades; it read as a soft fading sine pad, not a bell. Synthesis v3
(John, 2026-11-05 — "a more resonant bell, like one that you hear outside")
models a struck tower bell:

- an inharmonic partial stack around the 392 Hz strike note — hum (0.5x),
  prime (1x), tierce (1.19x), quint (1.5x), nominal (2x), superquint
  (2.74x) and decaying upper partials (3.36x, 4.2x), plus two fast clang
  partials (5.43x, 6.79x) that exist only at the strike;
- per-partial EXPONENTIAL decay: the clang and upper partials die in tens
  of milliseconds to a few hundred, the tierce/quint in about a second,
  and the hum and prime sustain for seconds, so the strike blooms into a
  low, carrying ring;
- a short band-passed noise burst at the onset (the clapper hit).

Invariants kept from v2 on purpose: the total length is still exactly
4.8 s (the runner concatenates the bell as a timed part, so its length is
episode timing), the strike pitch is unchanged, and BELL_GAIN was tuned
by measurement so the finished bell's overall RMS equals the v2 bell's
(-30.5 dBFS) — episodes keep the same bell-to-voice balance. The limiter
runs with auto-level off and never engages at this gain (peak ~0.24); it
is only a guard against a future gain retune clipping.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Sequence, Tuple

BELL_SYNTH_VERSION = 3
BELL_DURATION_SECONDS = 4.8
STRIKE_FREQUENCY_HZ = 392.0

# (ratio to the strike note, gain, exponential decay tau in seconds)
BELL_PARTIALS: Tuple[Tuple[float, float, float], ...] = (
    (0.50, 0.55, 2.30),  # hum — the long carrying tail
    (1.00, 0.85, 1.70),  # prime
    (1.19, 0.48, 1.10),  # tierce (minor third — the bell's dark color)
    (1.50, 0.34, 0.90),  # quint
    (2.00, 0.60, 1.30),  # nominal
    (2.74, 0.26, 0.50),  # superquint
    (3.36, 0.18, 0.34),  # upper partial
    (4.20, 0.11, 0.22),  # upper partial
    (5.43, 0.12, 0.06),  # clang — strike only
    (6.79, 0.07, 0.04),  # clang — strike only
)

# Tuned by measurement against the v2 bell: finished-bell RMS -30.46 dBFS,
# identical to v2; onset carries the strike, the tail is hum + prime.
BELL_GAIN = 0.0788
STRIKE_NOISE_GAIN = 0.1734  # 2.2 * BELL_GAIN
STRIKE_NOISE_SECONDS = 0.07
TAIL_FADE_START_SECONDS = 4.62  # inaudible guard fade so the file ends at zero


def church_bell_expression() -> str:
    """The partial stack as one ffmpeg aevalsrc expression in `t` (seconds)."""
    return "+".join(
        f"{gain}*exp(-t/{tau})*sin(2*PI*{STRIKE_FREQUENCY_HZ * ratio:.2f}*t)"
        for ratio, gain, tau in BELL_PARTIALS
    )


def church_bell_ffmpeg_args(
    output_path: Path,
    sample_rate: int,
    output_args: Sequence[str],
) -> List[str]:
    """ffmpeg arguments (everything after the binary) rendering the bell.

    `output_args` are the caller's own output options (codec / rate /
    channels), so each render path keeps its existing output contract.
    """
    return [
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"aevalsrc={church_bell_expression()}:duration={BELL_DURATION_SECONDS}:sample_rate={sample_rate}",
        "-f",
        "lavfi",
        "-i",
        f"anoisesrc=duration={STRIKE_NOISE_SECONDS}:sample_rate={sample_rate}:color=white:seed=11",
        "-filter_complex",
        (
            f"[0:a]volume={BELL_GAIN}[body];"
            f"[1:a]bandpass=f=3000:width_type=h:w=2600,"
            f"afade=t=out:st=0:d={STRIKE_NOISE_SECONDS}:curve=exp,"
            f"volume={STRIKE_NOISE_GAIN}[hit];"
            f"[body][hit]amix=inputs=2:normalize=0,"
            f"afade=t=out:st={TAIL_FADE_START_SECONDS}:d={BELL_DURATION_SECONDS - TAIL_FADE_START_SECONDS:.2f},"
            f"alimiter=limit=0.88:level=false[bell]"
        ),
        "-map",
        "[bell]",
        "-vn",
        *[str(arg) for arg in output_args],
        str(output_path),
    ]
