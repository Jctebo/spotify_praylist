"""Tests for the v580 feast classification (jobs/publish/feast_classification.py).

Fixtures are production: every feast name below is the observance name
the devotional calendar ICS itself carries for the stated date, and
the integration cases run the real calendar resolver.
"""

import datetime as dt
import unittest

from jobs.publish import feast_classification as fc
from jobs.publish.devotional_calendar_saint import resolve_saint_of_day
from jobs.publish.saints_ladder import resolve_invocations


class ClassifyTest(unittest.TestCase):
    def test_presentation_is_event(self):
        c = fc.classify_feast("The Presentation of the Blessed Virgin Mary")
        self.assertEqual(c.kind, "event")
        self.assertEqual(c.persons, [])

    def test_mary_major_dedication_yields_person(self):
        c = fc.classify_feast("The Dedication of the Basilica of Saint Mary Major")
        self.assertEqual(c.kind, "dedication")
        self.assertEqual(c.persons, ["Saint Mary Major"])

    def test_lateran_dedication_yields_person(self):
        c = fc.classify_feast("Dedication of the Lateran Basilica")
        self.assertEqual(c.kind, "dedication")
        self.assertEqual(c.persons, ["Saint John the Baptist"])

    def test_peter_paul_dedication_yields_persons(self):
        c = fc.classify_feast("The Dedication of the Basilicas of Saints Peter and Paul, Apostles")
        self.assertEqual(c.kind, "dedication")
        self.assertEqual(c.persons, ["Saint Peter and Saint Paul"])

    def test_nativity_of_john_the_baptist_extracts_person(self):
        c = fc.classify_feast("The Nativity of Saint John the Baptist")
        self.assertEqual(c.kind, "saint")
        self.assertEqual(c.persons, ["Saint John the Baptist"])

    def test_plain_saint_is_saint(self):
        c = fc.classify_feast("Saint Elizabeth of Hungary, Religious")
        self.assertEqual(c.kind, "saint")
        self.assertEqual(c.persons, ["Saint Elizabeth of Hungary"])

    def test_person_with_our_lady_in_name_is_saint(self):
        c = fc.classify_feast("Saint Gabriel of Our Lady of Sorrows")
        self.assertEqual(c.kind, "saint")

    def test_unknown_dedication_invents_no_person(self):
        c = fc.classify_feast("Dedication of the Basilica of Saint Nowhere")
        self.assertEqual(c.kind, "dedication")
        self.assertEqual(c.persons, [])


class GuardTest(unittest.TestCase):
    def test_guard_strikes_event_title_keeps_persons(self):
        names = [
            "Holy Mary, Mother of God",
            "The Presentation of the Blessed Virgin Mary",
            "Saint Mary Major",
        ]
        self.assertEqual(
            fc.guard_invocations(names),
            ["Holy Mary, Mother of God", "Saint Mary Major"],
        )


class BackstopTest(unittest.TestCase):
    def test_backstop_removes_only_flagged(self):
        out = fc.llm_backstop(
            ["Saint Peter", "The Transfiguration of the Lord", "Saint Paul"],
            generate_text=lambda system, prompt: "[1]",
            environ={"OPENAI_API_KEY": "x"},
        )
        self.assertEqual(out, ["Saint Peter", "Saint Paul"])

    def test_backstop_failure_leaves_list_unchanged(self):
        def boom(system, prompt):
            raise RuntimeError("provider down")

        names = ["Saint Peter", "Saint Paul"]
        self.assertEqual(
            fc.llm_backstop(names, generate_text=boom, environ={"OPENAI_API_KEY": "x"}),
            names,
        )

    def test_backstop_disabled_by_env(self):
        out = fc.llm_backstop(
            ["Saint Peter"],
            generate_text=lambda system, prompt: "[0]",
            environ={"OPENAI_API_KEY": "x", "ORA_LITANY_LLM_BACKSTOP": "0"},
        )
        self.assertEqual(out, ["Saint Peter"])


class ProductionCalendarTest(unittest.TestCase):
    """The three pinned fixtures from John's calendar, real sources."""

    def test_presentation_day_has_no_event_invocation(self):
        names = resolve_invocations(dt.date(2026, 11, 21), windows=[])
        self.assertFalse(any("Presentation" in n for n in names))
        self.assertEqual(names[0], "Holy Mary, Mother of God")

    def test_mary_major_stands_on_her_dedication(self):
        result = resolve_saint_of_day(dt.date(2027, 8, 5))
        self.assertEqual(result["litany_persons"], ["Saint Mary Major"])
        names = resolve_invocations(dt.date(2027, 8, 5), windows=[])
        self.assertIn("Saint Mary Major", names)

    def test_normal_saint_day_unchanged(self):
        names = resolve_invocations(dt.date(2026, 11, 17), windows=[])
        self.assertIn("Saint Elizabeth of Hungary", names)

    def test_nativity_of_john_the_baptist_not_duplicated(self):
        names = resolve_invocations(dt.date(2027, 6, 24), windows=[])
        self.assertNotIn("The Nativity of Saint John the Baptist", names)
        self.assertEqual(names.count("Saint John the Baptist"), 1)


if __name__ == "__main__":
    unittest.main()
