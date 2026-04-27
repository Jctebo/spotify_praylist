import importlib.util
import os
import subprocess
import uuid
from contextlib import contextmanager
from pathlib import Path
import tempfile

import imageio_ffmpeg


ROOT = Path(__file__).resolve().parents[1]


def load_module(rel_path: str):
    module_path = ROOT / rel_path
    module_name = f"test_module_{module_path.stem}_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@contextmanager
def temp_env(values):
    original = {}
    for key, value in values.items():
        if key in os.environ:
            original[key] = os.environ[key]
        os.environ[key] = value
    try:
        yield
    finally:
        for key in values:
            if key in original:
                os.environ[key] = original[key]
            else:
                os.environ.pop(key, None)


def make_test_mp3_bytes(*, duration_seconds: float = 0.12, frequency: int = 440) -> bytes:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    tmp_dir = ROOT / "artifacts" / "test_audio"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=tmp_dir) as temp_dir:
        output_path = Path(temp_dir) / "test.mp3"
        completed = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-f",
                "lavfi",
                "-i",
                f"sine=frequency={frequency}:duration={duration_seconds}",
                "-q:a",
                "0",
                str(output_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            stderr = str(completed.stderr or "").strip()
            raise RuntimeError(stderr or f"ffmpeg failed with exit code {completed.returncode}.")
        return output_path.read_bytes()
