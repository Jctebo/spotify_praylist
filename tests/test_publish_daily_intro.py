import datetime
import unittest
from types import SimpleNamespace

from catholic_mass_readings import models

from tests.test_helpers import load_module


class TestPublishDailyIntro(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/daily_intro.py")

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

        with self.assertRaises(RuntimeError) as ctx:
            self.mod.fetch_daily_gospel_context(datetime.date(2026, 4, 27))

        self.assertIn("Gospel section", str(ctx.exception))

    def test_build_daily_intro_text_rejects_invalid_openai_shape(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.asyncio.run = lambda coro: self._fake_asyncio_run(coro)
        self.mod._call_openai_prompt = lambda model, prompt: "Today the Church celebrates Saint Example. In today's Gospel, Jesus calls his sheep by name."

        with self.assertRaises(RuntimeError) as ctx:
            self.mod.build_daily_intro_text(datetime.date(2026, 4, 27))

        self.assertIn("three sentences", str(ctx.exception))
