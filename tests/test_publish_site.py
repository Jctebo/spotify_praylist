import unittest
from pathlib import Path


class TestPagesDeployment(unittest.TestCase):
    def test_pages_workflow_stages_coming_soon_and_podcast_assets_only(self):
        workflow = Path(".github/workflows/publish_audio.yml").read_text(encoding="utf-8")
        landing_page = Path("config/site/coming-soon.html").read_text(encoding="utf-8")
        validation = Path(".github/workflows/contract_validation.yml").read_text(encoding="utf-8")

        self.assertIn("cp config/site/coming-soon.html pages_artifact/index.html", workflow)
        self.assertIn("cp docs/podcast.xml pages_artifact/podcast.xml", workflow)
        self.assertIn("cp docs/images/logo_ora_pro_nobis.png pages_artifact/images/logo_ora_pro_nobis.png", workflow)
        self.assertNotIn("jobs.publish.site", workflow)
        self.assertNotIn("rclone copy", workflow)
        self.assertNotIn("cp -a docs/. pages_artifact/", workflow)
        self.assertFalse(Path("docs/index.html").exists())
        prayer_output = Path("docs/prayers")
        self.assertFalse(prayer_output.exists() and list(prayer_output.rglob("*.*")))
        site_images = Path("docs/images/site")
        self.assertFalse(site_images.exists() and list(site_images.rglob("*.*")))
        self.assertIn("Coming soon", landing_page)
        self.assertIn("podcast.xml", landing_page)
        self.assertIn("tests.test_publish_site", validation)


if __name__ == "__main__":
    unittest.main()
