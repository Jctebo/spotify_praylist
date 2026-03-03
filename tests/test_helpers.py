import importlib.util
import os
import uuid
from contextlib import contextmanager
from pathlib import Path


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
