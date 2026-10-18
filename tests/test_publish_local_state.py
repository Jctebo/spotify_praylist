import datetime
import json
import tempfile
import unittest
from pathlib import Path

from jobs.publish.local_state import load_publish_state, update_publish_state


class TestPublishLocalState(unittest.TestCase):
    def _job(self, **overrides):
        job = {
            "contract_id": "morning-prayer",
            "entry_id": "morning-prayer",
            "episode_id": "morning-prayer-2026-10-17",
            "published_date": "2026-10-17",
            "status": "approved",
            "title": "Morning Prayer",
            "description": "Description",
            "text": "Prayer text",
            "text_hash": "text-hash",
            "audio_config": {"enabled": True},
        }
        job.update(overrides)
        return job

    def test_creates_state_with_episode_fields_and_daily_completion_defaults(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "state.json"
            result = update_publish_state(
                [self._job()], path=path,
                completion_keys=["morning-prayer:morning-prayer"],
                local_date=datetime.date(2026, 10, 17),
            )
            state = load_publish_state(path)

        self.assertEqual(result["episodes_updated"], 1)
        self.assertEqual(state["schema_version"], 1)
        self.assertEqual(state["reset_date"], "2026-10-17")
        self.assertFalse(state["completions"]["morning-prayer:morning-prayer"])
        self.assertEqual(state["episodes"]["morning-prayer-2026-10-17"]["text_hash"], "text-hash")

    def test_same_day_rerun_preserves_completion_and_merges_audio_fields(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "state.json"
            update_publish_state([self._job()], path=path, local_date=datetime.date(2026, 10, 17))
            state = load_publish_state(path)
            state["completions"]["morning-prayer:morning-prayer"] = True
            path.write_text(json.dumps(state), encoding="utf-8")
            update_publish_state(
                [self._job(audio_url="https://example.test/episode.mp3", audio_path="docs/audio/episode.mp3", content_hash="content-hash")],
                path=path, local_date=datetime.date(2026, 10, 17),
            )
            updated = load_publish_state(path)

        self.assertTrue(updated["completions"]["morning-prayer:morning-prayer"])
        episode = updated["episodes"]["morning-prayer-2026-10-17"]
        self.assertEqual(episode["audio_url"], "https://example.test/episode.mp3")
        self.assertEqual(episode["audio_path"], "docs/audio/episode.mp3")
        self.assertEqual(episode["content_hash"], "content-hash")

    def test_new_local_date_resets_completion_flags_but_keeps_episode_history(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "state.json"
            update_publish_state([self._job()], path=path, local_date=datetime.date(2026, 10, 17))
            state = load_publish_state(path)
            state["completions"]["morning-prayer:morning-prayer"] = True
            path.write_text(json.dumps(state), encoding="utf-8")
            update_publish_state(
                [self._job(episode_id="morning-prayer-2026-10-18", published_date="2026-10-18")],
                path=path, local_date=datetime.date(2026, 10, 18),
            )
            updated = load_publish_state(path)

        self.assertEqual(updated["reset_date"], "2026-10-18")
        self.assertFalse(updated["completions"]["morning-prayer:morning-prayer"])
        self.assertIn("morning-prayer-2026-10-17", updated["episodes"])
        self.assertIn("morning-prayer-2026-10-18", updated["episodes"])

    def test_corrupt_or_unsupported_state_fails_clearly(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "state.json"
            path.write_text("not json", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "Unable to read publish state"):
                load_publish_state(path)
            path.write_text(json.dumps({"schema_version": 99}), encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "Unsupported or invalid"):
                load_publish_state(path)
