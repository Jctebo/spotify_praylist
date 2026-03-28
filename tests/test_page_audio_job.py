import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tests.test_helpers import load_module, temp_env


def _base_custom_tts_contract(*, path: str, enabled: bool = True, key: str = "morning-prayer") -> dict:
    return {
        "key": key,
        "title": "Morning Prayer",
        "target_row": "Morning Prayer",
        "status": "enabled",
        "output_type": "page_audio",
        "path": path,
        "enabled": enabled,
        "header": {
            "builder": "morning_prayer_v1",
            "model": "gpt-4o-mini-tts",
            "render_policy": "strict",
            "page_id": "0e8a66b1-2be7-4ea0-8a92-39695f930ecd",
        },
        "resolvers": [
            {
                "key": "random-intention",
                "kind": "code_driven",
                "resolver": "random_intention_v1",
                "order": 1,
                "title": "Random Intention",
                "targets": ["page_content", "audio"],
            }
        ],
    }


class TestPageAudioJob(unittest.TestCase):
    def setUp(self):
        self.page_audio = load_module("jobs/notion/generate_page_audio.py")
        self.prayer = load_module("jobs/notion/generate_prayer.py")

    def test_direct_script_import_bootstraps_repo_root_without_pythonpath(self):
        script_path = Path("jobs/notion/generate_page_audio.py").resolve()
        code = (
            "import importlib.util; "
            f"spec = importlib.util.spec_from_file_location('page_audio_bootstrap', r'{script_path}'); "
            "module = importlib.util.module_from_spec(spec); "
            "spec.loader.exec_module(module)"
        )

        env = {key: value for key, value in os.environ.items() if key != "PYTHONPATH"}
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=tempfile.gettempdir(),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, msg=f"stdout={result.stdout}\nstderr={result.stderr}")

    def test_load_custom_tts_contracts_from_dir_returns_only_enabled_contracts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config_dir = root / "config" / "custom_tts"
            config_dir.mkdir(parents=True, exist_ok=True)

            enabled_path = config_dir / "morning-prayer.json"
            disabled_path = config_dir / "evening-prayer.json"
            enabled_contract = _base_custom_tts_contract(path="config/custom_tts/morning-prayer.json", enabled=True)
            disabled_contract = _base_custom_tts_contract(
                path="config/custom_tts/evening-prayer.json",
                enabled=False,
                key="evening-prayer",
            )
            enabled_path.write_text(json.dumps(enabled_contract, indent=2), encoding="utf-8")
            disabled_path.write_text(json.dumps(disabled_contract, indent=2), encoding="utf-8")

            with mock.patch.object(self.page_audio, "ROOT", root):
                contracts = self.page_audio.load_custom_tts_contracts_from_dir(config_dir)

        self.assertIn("morning-prayer", contracts)
        self.assertNotIn("evening-prayer", contracts)
        self.assertTrue(contracts["morning-prayer"]["enabled"])
        self.assertEqual(contracts["morning-prayer"]["output_type"], "page_audio")
        self.assertEqual(contracts["morning-prayer"]["path"], "config/custom_tts/morning-prayer.json")

    def test_load_page_audio_config_from_file_ignores_legacy_page_audio_contracts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            custom_dir = root / "config" / "custom_tts"
            legacy_dir = root / "config" / "legacy" / "page_audio"
            custom_dir.mkdir(parents=True, exist_ok=True)
            legacy_dir.mkdir(parents=True, exist_ok=True)

            enabled_path = custom_dir / "morning-prayer.json"
            legacy_path = legacy_dir / "broken.json"
            enabled_contract = _base_custom_tts_contract(path="config/custom_tts/morning-prayer.json", enabled=True)
            enabled_path.write_text(json.dumps(enabled_contract, indent=2), encoding="utf-8")
            legacy_path.write_text(json.dumps({"not": "a runnable contract"}, indent=2), encoding="utf-8")

            with mock.patch.object(self.page_audio, "ROOT", root), temp_env({"PAGE_AUDIO_CONFIG_FILE": str(legacy_path)}):
                payload = self.page_audio.load_page_audio_config_from_file()

        self.assertEqual(set(payload.keys()), {"configs"})
        self.assertEqual(set(payload["configs"].keys()), {"morning-prayer", "MORNING-PRAYER"})

    def test_load_custom_tts_contracts_from_dir_requires_output_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_dir = Path(tmpdir) / "config" / "custom_tts"
            config_dir.mkdir(parents=True, exist_ok=True)
            broken_path = config_dir / "broken.json"
            broken_contract = {
                "key": "broken",
                "title": "Broken",
                "target_row": "Broken",
                "status": "enabled",
                "header": {
                    "builder": "morning_prayer_v1",
                    "model": "gpt-4o-mini-tts",
                    "render_policy": "strict",
                    "page_id": "0e8a66b1-2be7-4ea0-8a92-39695f930ecd",
                },
                "resolvers": [
                    {
                        "key": "random-intention",
                        "kind": "code_driven",
                        "resolver": "random_intention_v1",
                        "order": 1,
                        "title": "Random Intention",
                        "targets": ["page_content", "audio"],
                    }
                ],
            }
            broken_path.write_text(json.dumps(broken_contract, indent=2), encoding="utf-8")

            with mock.patch.object(self.page_audio, "ROOT", Path(tmpdir)), self.assertRaises(RuntimeError) as ctx:
                self.page_audio.load_custom_tts_contracts_from_dir(config_dir)

        self.assertIn("missing 'output_type'", str(ctx.exception))

    def test_load_morning_prayer_contract_from_file_uses_custom_tts_default(self):
        with temp_env({self.page_audio.MORNING_PRAYER_CONTRACT_FILE: ""}):
            contract = self.page_audio.load_morning_prayer_contract_from_file()

        self.assertEqual(contract["key"], "morning-prayer")
        self.assertEqual(contract["output_type"], "page_audio")
        self.assertEqual(contract["path"], "config/custom_tts/morning-prayer.json")
        self.assertTrue(contract["enabled"])

    def test_load_prayer_config_from_file_uses_custom_tts_default(self):
        with temp_env({self.prayer.PRAYER_CONFIG_FILE: ""}):
            contract = self.prayer.load_prayer_config_from_file()

        self.assertEqual(contract["key"], "morning-prayer")
        self.assertEqual(contract["output_type"], "page_audio")
        self.assertEqual(contract["path"], "config/custom_tts/morning-prayer.json")
        self.assertTrue(contract["enabled"])


if __name__ == "__main__":
    unittest.main()
