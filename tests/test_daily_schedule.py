import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "daily.yml"


class TestDailyPlaylistSchedule(unittest.TestCase):
    def test_refresh_runs_once_daily_before_two_am_central(self):
        workflow = WORKFLOW.read_text(encoding="utf-8")
        cron_entries = re.findall(r'^\s*- cron:\s*"([^"]+)"', workflow, flags=re.MULTILINE)

        self.assertEqual(cron_entries, ["0 7 * * *"])
        self.assertNotIn('cron: "0 5 * * *"', workflow)
        self.assertNotIn('cron: "0 13 * * *"', workflow)
        self.assertNotIn('cron: "0 21 * * *"', workflow)
        self.assertIn("SPOTIFY_REFRESH_SCHEDULE_ENABLED", workflow)
        self.assertIn("01:00 CST / 02:00 CDT", workflow)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("spotify_playlist_name:", workflow)


if __name__ == "__main__":
    unittest.main()
