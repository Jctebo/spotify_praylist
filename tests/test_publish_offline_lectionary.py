import datetime
import json
import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import load_module


class TestOfflineLectionary(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/offline_lectionary.py")

    def _caches(self):
        tmpdir = tempfile.TemporaryDirectory()
        root = Path(tmpdir.name)
        lectionary = root / "lectionary.json"
        bible = root / "bible.json"
        lectionary.write_text(json.dumps({
            "version": "test-catalog",
            "entries": {"2026-04-27": {"mass_title": "Test Mass", "gospel": " John 10:1 - 10 "}},
        }), encoding="utf-8")
        bible.write_text(json.dumps({
            "version": "test-bible",
            "passages": {"John 10:1-10": "The sheep hear his voice."},
        }), encoding="utf-8")
        return tmpdir, lectionary, bible

    def test_resolves_date_and_normalizes_reference(self):
        tmpdir, lectionary, bible = self._caches()
        self.addCleanup(tmpdir.cleanup)
        result = self.mod.resolve_offline_gospel(datetime.date(2026, 4, 27), lectionary_path=lectionary, bible_path=bible)
        self.assertEqual(result.citation, "John 10:1-10")
        self.assertEqual(result.text, "The sheep hear his voice.")
        self.assertEqual(result.source, "offline-douay-rheims")
        self.assertEqual(result.catalog_version, "test-catalog")

    def test_missing_date_is_explicit(self):
        tmpdir, lectionary, bible = self._caches()
        self.addCleanup(tmpdir.cleanup)
        with self.assertRaises(self.mod.OfflineLectionaryError) as ctx:
            self.mod.resolve_offline_gospel(datetime.date(2026, 4, 28), lectionary_path=lectionary, bible_path=bible)
        self.assertIn("No offline lectionary entry", str(ctx.exception))

    def test_missing_passage_is_explicit(self):
        tmpdir, lectionary, bible = self._caches()
        self.addCleanup(tmpdir.cleanup)
        bible.write_text(json.dumps({"version": "test-bible", "passages": {}}), encoding="utf-8")
        with self.assertRaises(self.mod.OfflineLectionaryError) as ctx:
            self.mod.resolve_offline_gospel(datetime.date(2026, 4, 27), lectionary_path=lectionary, bible_path=bible)
        self.assertIn("No cached Douay-Rheims text", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
