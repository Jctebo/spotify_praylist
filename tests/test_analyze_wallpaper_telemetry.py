import unittest

from scripts.analyze_wallpaper_telemetry import summarize


class WallpaperTelemetryAnalyzerTests(unittest.TestCase):
    def test_summarizes_generation_and_qa_counts_by_month_and_variant(self):
        report = summarize({
            "records": [
                {
                    "recorded_at": "2026-10-26T12:00:00+00:00",
                    "variant": "watch",
                    "status": "rendered",
                    "generation_request_count": 3,
                    "generation_response_count": 3,
                    "fallback_used": True,
                    "generation_attempts": [
                        {"local_qa_issue_categories": ["layout"]},
                        {"vision_qa_issue_categories": ["text_legibility"]},
                    ],
                },
                {
                    "asset_date": "2026-10-27",
                    "variant": "watch",
                    "status": "failed",
                    "generation_request_count": 1,
                    "generation_response_count": 0,
                    "fallback_used": False,
                    "generation_attempts": [],
                },
            ]
        })

        bucket = report["months"]["2026-10"]["watch"]
        self.assertEqual(bucket["assets"], 2)
        self.assertEqual(bucket["generation_requests"], 4)
        self.assertEqual(bucket["generation_responses"], 3)
        self.assertEqual(bucket["multi_generation_assets"], 1)
        self.assertEqual(bucket["qa_fallbacks"], 1)
        self.assertEqual(bucket["failed_assets"], 1)
        self.assertEqual(report["qa_issue_categories"]["2026-10"]["watch"], {
            "layout": 1,
            "text_legibility": 1,
        })

    def test_rejects_invalid_records_container(self):
        with self.assertRaisesRegex(ValueError, "records array"):
            summarize({"records": {}})


if __name__ == "__main__":
    unittest.main()
