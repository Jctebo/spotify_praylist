import datetime
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from catholic_mass_readings import models

from tests.test_helpers import load_module


class TestPublishDailyIntro(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/daily_intro.py")

    def _html_mass_page(self):
        return """
        <html>
          <head><title>Fifth Sunday of Easter | USCCB</title></head>
          <body>
            <div class="content-header">
              <h3 class="name">Gospel</h3>
              <div class="address">John 14:1-12</div>
            </div>
            <div class="content-body">
              <p>Jesus said to his disciples, Do not let your hearts be troubled.</p>
              <p>In my Father's house there are many dwelling places.</p>
            </div>
          </body>
        </html>
        """

    def _fake_mass(self, *, gospel_text="Jesus said to his disciples, I am the good shepherd.", citation="John 10:11-18"):
        return SimpleNamespace(
            title="Monday of the Fourth Week of Easter",
            url="https://bible.usccb.org/bible/readings/042726.cfm",
            sections=[
                SimpleNamespace(
                    type_=models.SectionType.GOSPEL,
                    header="Gospel",
                    readings=[
                        SimpleNamespace(
                            text=gospel_text,
                            verses=[SimpleNamespace(text=citation, book="John", link="https://example.invalid")],
                        )
                    ],
                )
            ],
        )

    def _fake_asyncio_run(self, coro, result=None):
        try:
            coro.close()
        except Exception:
            pass
        return result if result is not None else self._fake_mass()

    def _valid_generator(self, captured=None):
        def generate(model, system, prompt, temperature):
            if captured is not None:
                captured.update(
                    {
                        "model": model,
                        "system": system,
                        "prompt": prompt,
                        "temperature": temperature,
                    }
                )
            return (
                "Morning Prayer gathers us around Trust as Saint Example accompanies the Church today. "
                "In today's Gospel, Christ calls us to listen with faith and offer the whole day to God."
            )

        return generate

    def test_fetch_daily_gospel_context_joins_multiple_celebrations_with_and(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [
            {"name": "Saint One"},
            {"name": "Saint Two"},
        ]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(coro)

        context = self.mod.fetch_daily_gospel_context(datetime.date(2026, 4, 27))

        self.assertEqual(context.celebration_clause, "Saint One and Saint Two")
        self.assertEqual(context.gospel_citation, "John 10:11-18")
        self.assertIn("good shepherd", context.gospel_text)

    def test_fetch_daily_gospel_context_rejects_missing_gospel_section(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(
            coro,
            SimpleNamespace(title="Broken Mass", url="", sections=[]),
        )
        self.mod._fetch_usccb_html = lambda date_value: "<html><head><title>Broken | USCCB</title></head><body></body></html>"

        with self.assertRaises(self.mod.DailyIntroMissingDataError) as ctx:
            self.mod.fetch_daily_gospel_context(datetime.date(2026, 4, 27))

        self.assertIn("no usable Gospel data", str(ctx.exception))
        self.assertIn("Gospel section", str(ctx.exception.__cause__))

    def test_fetch_daily_gospel_context_falls_back_to_html_when_library_returns_none(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod._fetch_mass_with_retry = lambda date_value: None
        self.mod._fetch_usccb_html = lambda date_value: self._html_mass_page()

        context = self.mod.fetch_daily_gospel_context(datetime.date(2026, 4, 27))

        self.assertEqual(context.gospel_citation, "John 14:1-12")
        self.assertIn("Do not let your hearts be troubled", context.gospel_text)
        self.assertEqual(context.mass_title, "Fifth Sunday of Easter")

    def test_build_daily_intro_uses_flexible_prompt_and_compatibility_wrapper(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(coro)
        captured = {}

        result = self.mod.build_daily_intro_result(
            datetime.date(2026, 4, 27),
            shared_theme={
                "sharedThemeTitle": "Trust",
                "sharedThemeExplanation": "Entrust the work of this day to the Lord.",
            },
            generate_text_fn=self._valid_generator(captured),
        )
        text = self.mod.build_daily_intro_text(
            datetime.date(2026, 4, 27),
            shared_theme={"sharedThemeTitle": "Trust"},
            generate_text_fn=self._valid_generator(),
        )

        self.assertEqual(result.source, "openai")
        self.assertEqual(result.profile, "morning-prayer")
        self.assertEqual(text, result.text)
        self.assertIn("Write the introduction in 2-4 sentences.", captured["prompt"])
        self.assertNotIn("must begin with", captured["prompt"].lower())

    def test_build_daily_intro_omits_gospel_context_when_missing(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod._fetch_mass_with_retry = lambda date_value: None
        self.mod._fetch_usccb_html = lambda date_value: (_ for _ in ()).throw(
            self.mod.DailyIntroMissingDataError("missing")
        )
        captured = {}

        def generate(model, system, prompt, temperature):
            captured["prompt"] = prompt
            return (
                "Morning Prayer gathers us around Trust as Saint Example accompanies the Church today. "
                "We receive this grace through faithful prayer and offer the whole day to God."
            )

        text = self.mod.build_daily_intro_text(
            datetime.date(2026, 4, 27),
            allow_missing_gospel=True,
            shared_theme={"sharedThemeTitle": "Trust"},
            generate_text_fn=generate,
        )

        self.assertNotIn("Gospel bridge:", captured["prompt"])
        self.assertIn("No Gospel context is supplied.", captured["prompt"])
        self.assertNotIn("Gospel", text)

    def test_offline_mode_never_performs_live_gospel_lookup(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod._fetch_mass_with_retry = lambda date_value: self.fail("live mass lookup should not run")
        with mock.patch.dict(self.mod.os.environ, {"DEVOTIONAL_OFFLINE_TESTS": "true"}, clear=False):
            context = self.mod.fetch_daily_gospel_context(datetime.date(2026, 4, 27), allow_missing_gospel=True)
        self.assertEqual(context.gospel_text, "")

    def test_build_daily_intro_invalid_output_retries_then_falls_back(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(coro)
        calls = []

        def generate(model, system, prompt, temperature):
            calls.append(prompt)
            return "Invalid."

        result = self.mod.build_daily_intro_result(
            datetime.date(2026, 4, 27),
            shared_theme={"sharedThemeTitle": "Trust"},
            generate_text_fn=generate,
        )

        self.assertEqual(len(calls), 2)
        self.assertEqual(result.source, "fallback-deterministic")
        self.assertIn("Morning Prayer", result.text)
        self.assertIn("Trust", result.text)
        self.assertIn("Gospel", result.text)

    def test_resolve_openai_settings_reads_local_env_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            local_env = Path(tmpdir) / "openai.env"
            local_env.write_text(
                "OPENAI_API_KEY=local-test-key\n"
                "OAI_API_BASE_URL=https://example.invalid/v1\n"
                "OAI_MODEL=gpt-local-mini\n",
                encoding="utf-8",
            )
            with mock.patch.dict(
                self.mod.os.environ,
                {
                    "OPENAI_API_KEY": "",
                    "OPENAI_API_KEY_FILE": str(local_env),
                    "OAI_API_BASE_URL": "",
                    "OAI_MODEL": "",
                },
                clear=False,
            ):
                resolved = self.mod._resolve_openai_settings()

        self.assertEqual(resolved, ("local-test-key", "https://example.invalid/v1", "gpt-local-mini"))


class TestLiturgicalAnnouncement(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/liturgical_announcement.py")

    def test_build_liturgical_announcement_text_is_deterministic(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [
            {"name": "Saint Example", "season": "ordinary_time"},
            {"name": "Saint Optional"},
        ]

        text = self.mod.build_liturgical_announcement_text(
            datetime.date(2026, 6, 2),
            include_season=True,
        )

        self.assertIn("Tuesday, June 2, 2026", text)
        self.assertIn("Saint Example and Saint Optional", text)
        self.assertIn("Ordinary Time", text)

    def test_build_liturgical_announcement_text_rejects_missing_rows(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: []

        with self.assertRaises(RuntimeError):
            self.mod.build_liturgical_announcement_text(datetime.date(2026, 6, 2))


if __name__ == "__main__":
    unittest.main()
