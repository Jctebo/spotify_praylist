import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tests.test_helpers import load_module, temp_env


def _base_custom_tts_contract(
    *,
    path: str,
    enabled: bool = True,
    key: str = "morning-prayer",
    output_path: str = "C:/Users/jcteb/OneDrive/Praylist Audio/Playlist Audio/Morning",
) -> dict:
    return {
        "key": key,
        "title": "Morning Prayer",
        "target_row": "Morning Prayer",
        "status": "enabled",
        "output_type": "page_audio",
        "path": path,
        "output_path": output_path,
        "enabled": enabled,
        "header": {
            "builder": "morning_prayer_v1",
            "model": "gpt-4o-mini-tts",
            "render_policy": "strict",
            "page_id": "0e8a66b1-2be7-4ea0-8a92-39695f930ecd",
        },
        "resolvers": [
            {
                "key": "morning-offering",
                "kind": "file",
                "path": "config/content/morning-prayer/content/morning-offering.txt",
                "order": 1,
                "title": "Morning Offering",
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
        self.assertEqual(
            contracts["morning-prayer"]["output_path"],
            "C:/Users/jcteb/OneDrive/Praylist Audio/Playlist Audio/Morning",
        )
        self.assertEqual(contracts["morning-prayer"]["output_folder"], "Morning")
        self.assertEqual(contracts["morning-prayer"]["tts"]["model"], "gpt-4o-mini-tts")
        self.assertEqual(contracts["morning-prayer"]["tts"]["voice"], "alloy")
        self.assertEqual(contracts["morning-prayer"]["tts"]["format"], "mp3")
        self.assertEqual(contracts["morning-prayer"]["tts"]["speed"], 1.0)

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
                        "key": "morning-offering",
                        "kind": "file",
                        "path": "config/content/morning-prayer/content/morning-offering.txt",
                        "order": 1,
                        "title": "Morning Offering",
                        "targets": ["page_content", "audio"],
                    }
                ],
            }
            broken_path.write_text(json.dumps(broken_contract, indent=2), encoding="utf-8")

            with mock.patch.object(self.page_audio, "ROOT", Path(tmpdir)), self.assertRaises(RuntimeError) as ctx:
                self.page_audio.load_custom_tts_contracts_from_dir(config_dir)

        self.assertIn("missing 'output_type'", str(ctx.exception))

    def test_load_page_audio_config_from_file_ignores_legacy_page_audio_contracts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            custom_dir = root / "config" / "custom_tts"
            legacy_dir = root / "config" / "legacy" / "page_audio"
            custom_dir.mkdir(parents=True, exist_ok=True)
            legacy_dir.mkdir(parents=True, exist_ok=True)

            morning_path = custom_dir / "morning-prayer.json"
            legacy_path = legacy_dir / "legacy-page-audio.json"
            morning_contract = _base_custom_tts_contract(path="config/custom_tts/morning-prayer.json", enabled=True)
            legacy_contract = _base_custom_tts_contract(
                path="config/legacy/page_audio/legacy-page-audio.json",
                enabled=True,
                key="legacy-page-audio",
            )
            morning_path.write_text(json.dumps(morning_contract, indent=2), encoding="utf-8")
            legacy_path.write_text(json.dumps(legacy_contract, indent=2), encoding="utf-8")

            with mock.patch.object(self.page_audio, "ROOT", root):
                payload = self.page_audio.load_page_audio_config_from_file()

        self.assertEqual(set(payload.keys()), {"configs", "morning_prayer_contract"})
        self.assertEqual(set(payload["configs"].keys()), {"morning-prayer", "MORNING-PRAYER"})
        self.assertNotIn("legacy-page-audio", payload["configs"])
        self.assertNotIn("LEGACY-PAGE-AUDIO", payload["configs"])
        self.assertEqual(payload["configs"]["morning-prayer"]["output_folder"], "Morning")

    def test_load_page_audio_config_from_file_rejects_legacy_override_path(self):
        legacy_path = Path.cwd() / "config" / "legacy" / "page_audio_config.json"
        with temp_env({self.page_audio.PAGE_AUDIO_CONFIG_FILE: str(legacy_path)}), self.assertRaises(RuntimeError) as ctx:
            self.page_audio.load_page_audio_config_from_file()

        self.assertIn("Legacy page audio contract files are no longer runnable", str(ctx.exception))

    def test_load_morning_prayer_contract_from_file_uses_custom_tts_default(self):
        with temp_env({self.page_audio.MORNING_PRAYER_CONTRACT_FILE: ""}):
            contract = self.page_audio.load_morning_prayer_contract_from_file()

        self.assertEqual(contract["key"], "morning-prayer")
        self.assertEqual(contract["output_type"], "page_audio")
        self.assertEqual(contract["path"], "config/custom_tts/morning-prayer.json")
        self.assertEqual(
            contract["output_path"],
            "C:/Users/jcteb/OneDrive/Praylist Audio/Playlist Audio/Morning",
        )
        self.assertEqual(contract["output_folder"], "Morning")
        self.assertEqual(contract["tts"]["model"], "gpt-4o-mini-tts")
        self.assertTrue(contract["enabled"])

    def test_load_morning_prayer_contract_from_file_omits_random_intention_resolver(self):
        with temp_env({self.page_audio.MORNING_PRAYER_CONTRACT_FILE: ""}):
            contract = self.page_audio.load_morning_prayer_contract_from_file()

        resolver_keys = [
            str(resolver.get("key", "")).strip()
            for resolver in contract.get("resolvers", [])
            if isinstance(resolver, dict)
        ]
        self.assertGreater(len(resolver_keys), 0)
        self.assertNotIn("random-intention", resolver_keys)
        self.assertEqual(resolver_keys[0], "morning-offering")

    def test_load_morning_prayer_contract_from_file_rejects_legacy_override(self):
        legacy_path = Path.cwd() / "config" / "legacy" / "morning-prayer.json"
        with temp_env({self.page_audio.MORNING_PRAYER_CONTRACT_FILE: str(legacy_path)}), self.assertRaises(RuntimeError) as ctx:
            self.page_audio.load_morning_prayer_contract_from_file()

        self.assertIn("Legacy Morning Prayer contract paths are no longer runnable", str(ctx.exception))

    def test_load_prayer_config_from_file_uses_custom_tts_default(self):
        with temp_env({self.prayer.PRAYER_CONFIG_FILE: ""}):
            contract = self.prayer.load_prayer_config_from_file()

        self.assertEqual(contract["key"], "morning-prayer")
        self.assertEqual(contract["output_type"], "page_audio")
        self.assertEqual(contract["path"], "config/custom_tts/morning-prayer.json")
        self.assertEqual(
            contract["output_path"],
            "C:/Users/jcteb/OneDrive/Praylist Audio/Playlist Audio/Morning",
        )
        self.assertTrue(contract["enabled"])

    def test_prayer_runtime_config_uses_contract_output_path(self):
        contract = _base_custom_tts_contract(
            path="config/custom_tts/morning-prayer.json",
            output_path="C:/Users/jcteb/OneDrive/Praylist Audio/Playlist Audio/Morning Prayer Library",
        )

        runtime_config = self.prayer.prayer_runtime_config(contract)

        self.assertEqual(runtime_config["output_folder"], "Morning Prayer Library")

    def test_truncate_managed_page_audio_outputs_clears_stale_library_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            managed_folder = root / "Morning"
            managed_folder.mkdir(parents=True, exist_ok=True)
            stale_audio = managed_folder / "obsolete.mp3"
            stale_meta = managed_folder / "obsolete.json"
            keep_note = managed_folder / "keep.txt"
            stale_audio.write_bytes(b"stale-audio")
            stale_meta.write_text("{}", encoding="utf-8")
            keep_note.write_text("keep", encoding="utf-8")

            metadata = self.page_audio.PageAudioExportMetadata(
                folder_name="Morning",
                entry_name="Morning Prayer",
                order_value=1.0,
                order_display="1",
                file_stem="1 - Morning - Morning Prayer",
                audio_extension="mp3",
            )

            with mock.patch.object(self.page_audio, "page_audio_library_dir", return_value=root):
                removed = self.page_audio.truncate_managed_page_audio_outputs([("Morning Prayer", metadata)])

            self.assertEqual(removed, 2)
            self.assertFalse(stale_audio.exists())
            self.assertFalse(stale_meta.exists())
            self.assertTrue(keep_note.exists())

    def test_main_truncates_managed_page_audio_outputs_before_regeneration(self):
        page = {
            "id": "page-1",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"type": "text", "plain_text": "Morning Prayer"}],
                },
                "Order": {"type": "number", "number": 1},
            },
        }
        contract = _base_custom_tts_contract(path="config/custom_tts/morning-prayer.json", enabled=True)
        contract["output_folder"] = "Morning"
        contract["tts"] = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}
        payload = {"configs": {"morning-prayer": contract}}

        with tempfile.TemporaryDirectory() as tmpdir, temp_env(
            {
                "OPENAI_API_KEY": "test-key",
                "NOTION_TOKEN": "test-token",
                "PAGE_AUDIO_LIBRARY_DIR": tmpdir,
                "PAGE_AUDIO_TRUNCATE_MANAGED_OUTPUTS": "true",
            }
        ):
            root = Path(tmpdir)
            managed_folder = root / "Morning"
            managed_folder.mkdir(parents=True, exist_ok=True)
            stale_audio = managed_folder / "obsolete.mp3"
            stale_meta = managed_folder / "obsolete.json"
            stale_audio.write_bytes(b"stale-audio")
            stale_meta.write_text("{}", encoding="utf-8")

            plan = self.page_audio.PageAudioPlan(
                fragments=[
                    self.page_audio.PageAudioFragment(kind="text", label="Test Fragment", hash_value="hash-1")
                ]
            )

            with mock.patch.object(self.page_audio.shared, "notion_find_database_id", return_value="db-id"), mock.patch.object(
                self.page_audio.shared,
                "notion_get_all_pages",
                return_value=[page],
            ), mock.patch.object(self.page_audio, "load_page_audio_config", return_value=payload), mock.patch.object(
                self.page_audio,
                "find_page_for_audio_config",
                return_value=page,
            ), mock.patch.object(self.page_audio, "build_page_audio_plan", return_value=plan), mock.patch.object(
                self.page_audio,
                "render_page_audio_for_config",
                return_value="attached:mp3:gpt-4o-mini-tts:alloy:hash=hash-1",
            ), mock.patch.object(
                self.page_audio,
                "truncate_managed_page_audio_outputs",
                wraps=self.page_audio.truncate_managed_page_audio_outputs,
            ) as truncate_mock:
                rc = self.page_audio.main()

        self.assertEqual(rc, 0)
        truncate_mock.assert_called_once()
        self.assertFalse(stale_audio.exists())
        self.assertFalse(stale_meta.exists())

    def test_load_prayer_config_from_file_rejects_legacy_override_path(self):
        legacy_path = Path.cwd() / "config" / "legacy" / "morning-prayer.json"
        with temp_env({self.prayer.PRAYER_CONFIG_FILE: str(legacy_path)}), self.assertRaises(RuntimeError) as ctx:
            self.prayer.load_prayer_config_from_file()

        self.assertIn("Legacy prayer config paths are no longer runnable", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
