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
          <head>
            <title>Fifth Sunday of Easter | USCCB</title>
          </head>
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

    def test_build_daily_intro_text_returns_three_sentences(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(coro)
        self.mod._call_openai_prompt = (
            lambda model, prompt: "Today the Church celebrates Saint Example. Praise be to God for his mercy. "
            "In today's Gospel, Jesus calls his sheep by name."
        )

        text = self.mod.build_daily_intro_text(datetime.date(2026, 4, 27))

        self.assertEqual(
            text,
            "Today the Church celebrates Saint Example. Praise be to God for his mercy. In today's Gospel, Jesus calls his sheep by name.",
        )

    def test_fetch_daily_gospel_context_rejects_missing_gospel_section(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(coro, SimpleNamespace(title="Broken Mass", url="", sections=[]))
        self.mod._fetch_usccb_html = lambda date_value: "<html><head><title>Broken | USCCB</title></head><body></body></html>"

        with self.assertRaises(self.mod.DailyIntroMissingDataError) as ctx:
            self.mod.fetch_daily_gospel_context(datetime.date(2026, 4, 27))

        self.assertIn("no usable Gospel data", str(ctx.exception))
        self.assertIsNotNone(ctx.exception.__cause__)
        self.assertIn("Gospel section", str(ctx.exception.__cause__))

    def test_fetch_daily_gospel_context_falls_back_to_html_when_library_returns_none(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod._fetch_mass_with_retry = lambda date_value: None
        self.mod._fetch_usccb_html = lambda date_value: self._html_mass_page()

        context = self.mod.fetch_daily_gospel_context(datetime.date(2026, 4, 27))

        self.assertEqual(context.celebration_clause, "Saint Example")
        self.assertEqual(context.gospel_citation, "John 14:1-12")
        self.assertIn("Do not let your hearts be troubled", context.gospel_text)
        self.assertEqual(context.mass_title, "Fifth Sunday of Easter")

    def test_build_daily_intro_text_omits_gospel_when_allowed(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod._fetch_mass_with_retry = lambda date_value: None
        self.mod._fetch_usccb_html = lambda date_value: (_ for _ in ()).throw(self.mod.DailyIntroMissingDataError("missing"))
        captured = {}
        def fake_prompt(model, prompt):
            captured["prompt"] = prompt
            return (
                "Today the Church celebrates Saint Example. "
                "Praise be to God for his mercy. "
                "We thank God for this day. "
                "May his peace be with us all."
            )

        self.mod._call_openai_prompt = fake_prompt

        text = self.mod.build_daily_intro_text(datetime.date(2026, 4, 27), allow_missing_gospel=True)

        self.assertEqual(
            text,
            "Today the Church celebrates Saint Example. Praise be to God for his mercy. We thank God for this day. May his peace be with us all.",
        )
        self.assertIn("Write exactly two sentences", captured["prompt"])
        self.assertNotIn("Gospel citation:", captured["prompt"])
        self.assertNotIn("Gospel text:", captured["prompt"])

    def test_build_daily_intro_text_allows_empty_output_when_gospel_missing(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod._fetch_mass_with_retry = lambda date_value: None
        self.mod._fetch_usccb_html = lambda date_value: (_ for _ in ()).throw(self.mod.DailyIntroMissingDataError("missing"))
        self.mod._call_openai_prompt = lambda model, prompt: ""

        text = self.mod.build_daily_intro_text(datetime.date(2026, 4, 27), allow_missing_gospel=True)

        self.assertEqual(text, "")

    def test_build_daily_intro_text_rejects_invalid_openai_shape(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(coro)
        self.mod._call_openai_prompt = lambda model, prompt: "Today the Church celebrates Saint Example. Praise be to God for his mercy."

        with self.assertRaises(RuntimeError) as ctx:
            self.mod.build_daily_intro_text(datetime.date(2026, 4, 27))

        self.assertIn("exactly 3 sentences", str(ctx.exception))

    def test_resolve_openai_settings_reads_local_env_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            local_env = Path(tmpdir) / "openai.env"
            local_env.write_text(
                "\n".join(
                    [
                        "OPENAI_API_KEY=local-test-key",
                        "OAI_API_BASE_URL=https://example.invalid/v1",
                        "OAI_MODEL=gpt-local-mini",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            with mock.patch.dict(
                self.mod.os.environ,
                {"OPENAI_API_KEY": "", "OPENAI_API_KEY_FILE": str(local_env)},
                clear=False,
            ):
                resolved = self.mod._resolve_openai_settings()

        self.assertEqual(
            resolved,
            ("local-test-key", "https://example.invalid/v1", "gpt-local-mini"),
        )


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
            calendar="general_roman",
            locale="en",
            include_season=True,
        )

        self.assertEqual(
            text,
            "Today is Tuesday, June 2, 2026. Today the Church celebrates Saint Example and Saint Optional. Liturgical season: Ordinary Time.",
        )

    def test_build_liturgical_announcement_text_rejects_missing_rows(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: []

        with self.assertRaises(self.mod.DailyIntroMissingDataError) as ctx:
            self.mod.build_liturgical_announcement_text(datetime.date(2026, 6, 2))

        self.assertIn("Romcal returned no celebrations", str(ctx.exception))
