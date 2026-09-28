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
        self.assertIn("options: [generate, resolve-only, rotate-only, dry-run-rotation]", text)
        self.assertNotIn("pages: write", text)
        self.assertNotIn("deploy-pages", text)
        self.assertIn("python jobs/novena/generate_devotional_wallpapers.py", text)

    def test_legacy_pipelines_remain_unchanged_vs_base(self):
        import subprocess
        result = subprocess.run(
            ["git", "diff", "--name-only", "90e004f", "--", ".github/workflows/daily_devotional_image_remote.yml", ".github/workflows/publish_audio.yml", "jobs/novena/generate_devotional_image.py", "jobs/publish/site.py", "sync/build_devotional_public_tree.py"],
            text=True, capture_output=True, check=True,
        )
        self.assertEqual(result.stdout.strip(), "")


if __name__ == "__main__":
    unittest.main()
