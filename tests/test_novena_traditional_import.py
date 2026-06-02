import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.test_helpers import load_module


class _DummyReport:
    def __init__(self, *, month: str, written: int = 1, disabled: int = 0, failed: int = 0, total: int = 1):
        self.month = month
        self.written = written
        self.disabled = disabled
        self.hard_failures = failed
        self.entries = [object()] * total

    def to_dict(self):
        return {
            "summary": {
                "month": self.month,
                "written": self.written,
                "disabled": self.disabled,
                "failed": self.hard_failures,
                "total": len(self.entries),
            }
        }

    def to_markdown(self):
        return f"# Report for {self.month}"


class TestTraditionalNovenaImport(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/novena_contracts/traditional_import.py")

    def test_defaults_to_july_and_august_and_batches_the_importer(self):
        def fake_import(catalog_url, **kwargs):
            return _DummyReport(month=str(kwargs["month"]))

        with patch.object(self.mod, "import_bulk_catalog", side_effect=fake_import) as bulk_mock:
            run = self.mod.import_traditional_novena_months()

        self.assertEqual(run.months, ("july", "august"))
        self.assertEqual([call.kwargs["month"] for call in bulk_mock.call_args_list], ["july", "august"])
        self.assertEqual(run.written, 2)
        self.assertEqual(run.failed, 0)
        self.assertEqual(run.total, 2)

    def test_normalizes_overrides_and_keeps_report_stems_separate(self):
        months = self.mod.normalize_import_months([" July ", 8, "july", "august"])
        self.assertEqual(months, ("july", "august"))
        self.assertEqual(
            self.mod.traditional_bulk_report_base_path("july", report_dir=Path("/tmp/reports")),
            Path("/tmp/reports/july-bulk-report"),
        )
        self.assertEqual(
            self.mod.traditional_bulk_report_base_path(8, report_dir=Path("/tmp/reports")),
            Path("/tmp/reports/august-bulk-report"),
        )

    def test_writes_month_specific_bulk_reports(self):
        run = self.mod.TraditionalNovenaImportRun(
            catalog_url="https://catholicnovenaapp.com/list-of-all-novenas/",
            months=("july", "august"),
            reports=(
                _DummyReport(month="july"),
                _DummyReport(month="august"),
            ),
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            written = self.mod.write_traditional_novena_import_reports(run, report_dir=Path(tmpdir))

        self.assertEqual(len(written), 2)
        self.assertTrue(str(written[0][0]).endswith("july-bulk-report.json"))
        self.assertTrue(str(written[0][1]).endswith("july-bulk-report.md"))
        self.assertTrue(str(written[1][0]).endswith("august-bulk-report.json"))
        self.assertTrue(str(written[1][1]).endswith("august-bulk-report.md"))
