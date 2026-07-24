from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("normalize_prayer_tts.py")
SPEC = importlib.util.spec_from_file_location("normalize_prayer_tts", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class NormalizePrayerTtsTests(unittest.TestCase):
    def test_empty_text(self):
        result = MODULE.normalize_text("")
        self.assertEqual(result["segments"], [])
        self.assertEqual(result["summary"]["diagnostics"], 0)

    def test_multiline_versicle_and_response_roles(self):
        result = MODULE.normalize_text("V. O God, come to my assistance.\nR. O Lord, make haste to help me.")
        self.assertEqual(
            result["segments"],
            [
                {"kind": "speech", "text": "O God, come to my assistance.", "audio_role": "versicle"},
                {"kind": "speech", "text": "O Lord, make haste to help me.", "audio_role": "response"},
            ],
        )
        role_diagnostics = [item for item in result["diagnostics"] if item["rule"] == "role-marker"]
        self.assertEqual([(item["line"], item["column"]) for item in role_diagnostics], [(1, 1), (2, 1)])

    def test_inline_alternating_roles(self):
        result = MODULE.normalize_text("V. The Lord be with you. R. And with your spirit. V. Let us pray.")
        self.assertEqual([row["audio_role"] for row in result["segments"]], ["versicle", "response", "versicle"])
        self.assertNotIn("V.", json.dumps(result["segments"]))
        self.assertNotIn("R.", json.dumps(result["segments"]))

    def test_long_role_labels(self):
        result = MODULE.normalize_text("Versicle: Lift up your hearts.\nResponse: We lift them up to the Lord.")
        self.assertEqual(result["segments"][0]["audio_role"], "versicle")
        self.assertEqual(result["segments"][1]["audio_role"], "response")

    def test_ambiguous_role_initial_is_preserved_and_flagged(self):
        result = MODULE.normalize_text("The author was R. Smith and the prayer continued.")
        self.assertIn("R. Smith", result["segments"][0]["text"])
        self.assertIn("ambiguous-role-marker", {item["rule"] for item in result["diagnostics"]})

    def test_intention_prompt_becomes_bell_and_pause(self):
        result = MODULE.normalize_text("We entrust this need to you. Pause here to mention your request. Hear us, Lord.")
        self.assertEqual([row["kind"] for row in result["segments"]], ["speech", "audio_cue", "pause", "speech"])
        self.assertEqual(result["segments"][1]["cue"], "sacred_bell")
        self.assertEqual(result["segments"][2]["duration_ms"], 5000)
        self.assertNotIn("Pause here", json.dumps(result["segments"]))

    def test_intention_prompt_can_omit_bell(self):
        options = MODULE.NormalizationOptions(include_bell=False, intention_pause_ms=7000)
        result = MODULE.normalize_text("Pause for your intention.", options)
        self.assertEqual(result["segments"], [{"kind": "pause", "purpose": "personal_intention", "duration_ms": 7000}])

    def test_multiple_intention_prompts_preserve_order(self):
        result = MODULE.normalize_text("First. Pause for your intention. Second. Pause here to mention your request. Third.")
        self.assertEqual([row["kind"] for row in result["segments"]], ["speech", "audio_cue", "pause", "speech", "audio_cue", "pause", "speech"])

    def test_saint_and_clergy_expansion(self):
        result = MODULE.normalize_text("STS Peter and Paul, St. Joseph, and Fr. Michael, pray for us.")
        self.assertEqual(
            result["segments"][0]["text"],
            "Saints Peter and Paul, Saint Joseph, and Father Michael, pray for us.",
        )

    def test_street_context_is_preserved(self):
        result = MODULE.normalize_text("Send the letter to 123 St. Paul Street.")
        self.assertIn("123 St. Paul Street", result["segments"][0]["text"])
        self.assertIn("ambiguous-street-or-saint", {item["rule"] for item in result["diagnostics"]})

    def test_repeat_notation_is_review_finding(self):
        for value in ("x1 Pray.", "x3 Pray.", "Pray 3 times.", "Repeat three times."):
            with self.subTest(value=value):
                result = MODULE.normalize_text(value)
                self.assertIn("repeat-notation", {item["rule"] for item in result["diagnostics"]})
                self.assertGreater(result["summary"]["review_required"], 0)

    def test_editorial_contact_and_rubric_are_review_findings(self):
        text = "Pray.\nNote: Report favors to test@example.org.\n[All stand in silence.]"
        result = MODULE.normalize_text(text)
        rules = {item["rule"] for item in result["diagnostics"]}
        self.assertTrue({"editorial-line", "contact-or-provenance", "rubric-or-stage-direction"} <= rules)

    def test_json_audit_reports_nested_paths_without_mutation(self):
        payload = {"contract": {"sections": [{"text": "V. Pray.\nR. Amen."}]}}
        original = json.loads(json.dumps(payload))
        result = MODULE.audit_json(payload, "sample.json")
        self.assertEqual(payload, original)
        self.assertEqual(result["results"][0]["path"], "$.contract.sections[0].text")
        self.assertEqual(result["results"][0]["segments"][1]["audio_role"], "response")
        self.assertTrue(
            all(
                item["source_path"] == "$.contract.sections[0].text"
                for item in result["results"][0]["diagnostics"]
            )
        )

    def test_json_audit_ignores_non_spoken_metadata(self):
        result = MODULE.audit_json({"notes": "Pause here to mention your request.", "text": "Pray."})
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["path"], "$.text")

    def test_out_of_range_pause_is_rejected(self):
        for duration_ms in (0, -1, 120001):
            with self.subTest(duration_ms=duration_ms), self.assertRaisesRegex(ValueError, "1 through 120000"):
                MODULE.normalize_text("Pray.", MODULE.NormalizationOptions(intention_pause_ms=duration_ms))

    def test_cli_text_output_and_no_bell(self):
        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), "-", "--format", "text", "--no-bell"],
            input="Pause for your intention.",
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        payload = json.loads(proc.stdout)
        self.assertEqual([row["kind"] for row in payload["segments"]], ["pause"])

    def test_cli_strict_fails_review_findings(self):
        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), "-", "--format", "text", "--strict"],
            input="Repeat three times.",
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 1)

    def test_cli_invalid_json(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "bad.json"
            path.write_text("{", encoding="utf-8")
            proc = subprocess.run(
                [sys.executable, str(SCRIPT_PATH), str(path)],
                text=True,
                capture_output=True,
                check=False,
            )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error:", proc.stderr)


if __name__ == "__main__":
    unittest.main()
