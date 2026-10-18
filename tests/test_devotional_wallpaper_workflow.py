import unittest
from pathlib import Path


class DevotionalWallpaperWorkflowTests(unittest.TestCase):
    def test_workflow_is_separate_and_does_not_publish_pages(self):
        path = Path(".github/workflows/daily_devotional_wallpapers.yml")
        text = path.read_text(encoding="utf-8")
        self.assertIn("name: Daily Devotional Wallpapers", text)
        self.assertIn("group: devotional-wallpapers", text)
        self.assertIn("DEVOTIONAL_WALLPAPERS_ENABLED", text)
        self.assertIn("DEVOTIONAL_ICS_URL", text)
        self.assertIn('cron: "15 5 * * *"', text)
        self.assertIn("changes to 06:15 UTC after DST ends", text)
        self.assertIn("options: [generate, resolve-only, rotate-only, dry-run-rotation]", text)
        self.assertNotIn("pages: write", text)
        self.assertNotIn("deploy-pages", text)
        self.assertIn("python jobs/novena/generate_devotional_wallpapers.py", text)
        self.assertIn("if: always()", text)
        self.assertIn("path: artifacts/devotional-wallpapers/", text)
        self.assertIn("retention-days: 30", text)

    def test_local_runner_uses_preserved_wallpaper_generator(self):
        runner = Path("scripts/run_devotional_wallpapers_local.ps1")
        self.assertTrue(runner.exists())
        self.assertIn("jobs/novena/generate_devotional_wallpapers.py", runner.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
