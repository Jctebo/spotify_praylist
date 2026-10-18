import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from tests.test_helpers import load_module


class TestPublishTextPipeline(unittest.TestCase):
    def setUp(self):
        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.runner_mod = load_module("jobs/publish/run_text_pipeline.py")
        self.contracts_mod.build_daily_intro_result = lambda date_value, **kwargs: self.contracts_mod.DevotionalIntroResult(
            text="Morning Prayer receives today's Gospel with Trust as Saint Example accompanies our offering.",
            profile="morning-prayer",
            policy_version="devotional-intro-v1",
            source="openai",
        )
        self.contracts_mod.build_devotional_intro = lambda profile, context, **kwargs: self.contracts_mod.DevotionalIntroResult(
            text=f"As we begin the {context.get('prayer_title')}, today's focus of Trust leads us into faithful prayer.",
            profile=profile if isinstance(profile, str) else profile.key,
            policy_version="devotional-intro-v1",
            source="openai",
        )
        self.contracts_mod.build_liturgical_announcement_text = lambda date_value, **kwargs: (
            f"Today is {date_value.strftime('%A, %B')} {date_value.day}, {date_value.year}. "
            "Today the Church celebrates Saint Example."
        )
        self.contracts_mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.contracts_mod.build_rosary_day_context = self._fake_rosary_day_context
        self.contracts_mod.build_rosary_intro_text = lambda date_value, mystery_set_title, mysteries, **kwargs: (
            "Today is Monday, April 6, 2026, in the Easter season. "
            "For today's rosary, we will focus on the feast of Saint Example. "
            f"As we pray the {mystery_set_title}, we ask for grace."
        )
        self.contracts_mod.build_rosary_reflection_set = self._fake_rosary_reflection_set

    def _fake_rosary_day_context(self, date_value, mystery_text, **kwargs):
        lines = [line.strip() for line in mystery_text.splitlines() if line.strip()]
        mysteries = []
        for line in lines[1:]:
            number, rest = line.split(".", 1)
            title, fruit = rest.split(" - ", 1)
            mysteries.append(SimpleNamespace(number=int(number), title=title.strip(), fruit=fruit.strip()))
        return SimpleNamespace(
            date=date_value,
            mystery_set_title=lines[0],
            mysteries=tuple(mysteries),
            focus_source="feast",
            focus_title="Saint Example",
            focus_prompt_label="the feast of Saint Example",
            celebration_clause="Saint Example",
            season_label="Easter season",
            feast_names=("Saint Example",),
            gospel_citation="John 10:1-10",
            gospel_text="Jesus calls his sheep by name.",
            calendar="general_roman",
            locale="en",
        )

    def _fake_rosary_reflection_set(self, date_value, mystery_text, **kwargs):
        lines = [line.strip() for line in mystery_text.splitlines() if line.strip()]
        mysteries = []
        for line in lines[1:]:
            number, rest = line.split(".", 1)
            title, fruit = rest.split(" - ", 1)
            mysteries.append(SimpleNamespace(number=int(number), title=title.strip(), fruit=fruit.strip()))
        return SimpleNamespace(
            mystery_set_title=lines[0],
            mysteries=tuple(mysteries),
            reflections=tuple(f"Reflection for {mystery.title}." for mystery in mysteries),
            source="generated_feast",
            day_context=self._fake_rosary_day_context(date_value, mystery_text),
            fallback_reason="",
        )

    def test_run_text_pipeline_writes_local_episode_and_completion_state(self):
        contracts = self.contracts_mod.load_publish_contracts()
        self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts
        self.runner_mod.build_text_jobs = lambda loaded_contracts: [{
            "contract_id": "morning-prayer",
            "entry_id": "morning-prayer-elevenlabs",
            "episode_id": "morning-prayer-2026-04-06",
            "published_date": "2026-04-06",
            "status": "approved",
            "title": "Morning Prayer",
            "description": "Morning Prayer description",
            "text": "Prayer text",
            "text_hash": "text-hash",
            "audio_config": {"enabled": True},
        }]
        with tempfile.TemporaryDirectory() as temporary:
            state_path = Path(temporary) / "state.json"
            result = self.runner_mod.run_text_pipeline(state_path=state_path)
            state = json.loads(state_path.read_text(encoding="utf-8"))

        self.assertEqual(result["jobs"], 1)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(state["episodes"]["morning-prayer-2026-04-06"]["text_hash"], "text-hash")
        self.assertIn("morning-prayer:morning-prayer-elevenlabs", state["completions"])
        self.assertFalse(state["completions"]["morning-prayer:morning-prayer-elevenlabs"])

    def test_publish_text_workflow_is_not_active(self):
        active_path = Path(".github/workflows/publish_text.yml")
        archived_path = Path(".github/disabled_workflows/publish_text.yml")

        self.assertFalse(active_path.exists())
        self.assertFalse(archived_path.exists())
