import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

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

    def test_env_helpers_cover_boolean_integer_and_required_values(self):
        with temp_env({"HELPER_BOOL": "yes", "HELPER_INT": "7"}):
            self.assertTrue(self.mod.bool_env("HELPER_BOOL", False))
            self.assertEqual(self.mod.int_env("HELPER_INT", default=3, min_value=1, max_value=10), 7)
            self.assertEqual(self.mod.require_env("HELPER_BOOL"), "yes")

        with self.assertRaises(RuntimeError):
            self.mod.require_env("HELPER_MISSING")
