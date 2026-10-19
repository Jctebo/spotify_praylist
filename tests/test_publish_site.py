import unittest
from pathlib import Path


class TestPagesDeployment(unittest.TestCase):
    def test_pages_workflow_builds_daily_prayer_home_and_preserves_podcast_assets(self):
        workflow = Path(".github/workflows/publish_audio.yml").read_text(encoding="utf-8")
        builder = Path("scripts/build_pages_artifact.py").read_text(encoding="utf-8")
        landing_page = Path("config/site/index.html").read_text(encoding="utf-8")
        validation = Path(".github/workflows/contract_validation.yml").read_text(encoding="utf-8")

        self.assertIn("python scripts/build_pages_artifact.py", workflow)
        self.assertIn("phone-current", workflow)
        self.assertIn("__${today}", workflow)
        self.assertIn('"site"', builder)
        self.assertIn('"index.html"', builder)
        self.assertIn('"podcast.xml"', builder)
        self.assertIn("logo_ora_pro_nobis.png", builder)
        self.assertNotIn("jobs.publish.site", workflow)
        self.assertNotIn("cp -a docs/. pages_artifact/", workflow)
        self.assertFalse(Path("docs/index.html").exists())
        prayer_output = Path("docs/prayers")
        self.assertFalse(prayer_output.exists() and list(prayer_output.rglob("*.*")))
        site_images = Path("docs/images/site")
        self.assertFalse(site_images.exists() and list(site_images.rglob("*.*")))
        self.assertIn("Today's prayer rhythm", landing_page)
        self.assertIn("podcast.xml", landing_page)
        self.assertIn("tests.test_publish_site", validation)


if __name__ == "__main__":
    unittest.main()
