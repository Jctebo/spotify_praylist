import datetime
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


class TestLiturgicalHelpers(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/novena/liturgical_helpers.py")

    def test_direct_script_import_bootstraps_repo_root_without_pythonpath(self):
        script_path = Path("jobs/novena/liturgical_helpers.py").resolve()
        code = (
            "import importlib.util; "
            f"spec = importlib.util.spec_from_file_location('liturgical_helpers_bootstrap', r'{script_path}'); "
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

        self.assertEqual(
            result.returncode,
            0,
            msg=f"stdout={result.stdout}\nstderr={result.stderr}",
        )

    def test_devotional_output_is_eligible_filters_expected_cases(self):
        self.assertTrue(
            self.mod.devotional_output_is_eligible(
                "solemnity",
                "Precedence.proper_of_time_solemnity_2",
            )
        )
        self.assertTrue(
            self.mod.devotional_output_is_eligible(
                "optional_memorial",
                "Precedence.optional_memorial_12",
            )
        )
        self.assertFalse(
            self.mod.devotional_output_is_eligible(
                "solemnity",
                "Precedence.weekday_of_easter_octave_2",
            )
        )
        self.assertFalse(
            self.mod.devotional_output_is_eligible(
                "weekday",
                "Precedence.ferial_day_13",
            )
        )

    def test_is_easter_season_for_date_detects_easter_and_ordinary_time(self):
        self.assertTrue(
            self.mod.is_easter_season_for_date(
                "general_roman",
                "en",
                datetime.date(2026, 4, 5),
            )
        )
        self.assertFalse(
            self.mod.is_easter_season_for_date(
                "general_roman",
                "en",
                datetime.date(2026, 6, 7),
            )
        )

    def test_is_easter_season_for_date_fails_closed_when_season_missing(self):
        with patch.object(self.mod, "romcal_fetch_day", return_value=[{"id": "mystery"}]):
            with self.assertRaisesRegex(RuntimeError, "Unable to determine Romcal season"):
                self.mod.is_easter_season_for_date(
                    "general_roman",
                    "en",
                    datetime.date(2026, 6, 7),
                )

    def test_resolve_liturgical_music_season_maps_major_seasons(self):
        cases = {
            datetime.date(2026, 11, 29): "advent",
            datetime.date(2026, 12, 25): "christmas",
            datetime.date(2026, 6, 8): "ordinary_time",
            datetime.date(2026, 3, 10): "lent",
            datetime.date(2026, 3, 29): "holy_week",
            datetime.date(2026, 3, 30): "holy_week",
            datetime.date(2026, 4, 5): "easter",
        }
        for date_value, expected in cases.items():
            with self.subTest(date_value=date_value):
                self.assertEqual(
                    self.mod.resolve_liturgical_music_season("general_roman", "en", date_value),
                    expected,
                )

    def test_resolve_liturgical_music_season_maps_triduum_to_holy_week(self):
        for date_value in (
            datetime.date(2026, 4, 2),
            datetime.date(2026, 4, 3),
            datetime.date(2026, 4, 4),
        ):
            with self.subTest(date_value=date_value):
                self.assertEqual(
                    self.mod.resolve_liturgical_music_season("general_roman", "en", date_value),
                    "holy_week",
                )

    def test_env_helpers_cover_boolean_integer_and_required_values(self):
        with temp_env({"HELPER_BOOL": "yes", "HELPER_INT": "7"}):
            self.assertTrue(self.mod.bool_env("HELPER_BOOL", False))
            self.assertEqual(self.mod.int_env("HELPER_INT", default=3, min_value=1, max_value=10), 7)
            self.assertEqual(self.mod.require_env("HELPER_BOOL"), "yes")

        with self.assertRaises(RuntimeError):
            self.mod.require_env("HELPER_MISSING")
