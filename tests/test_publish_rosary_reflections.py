import datetime
import json
import unittest
from types import SimpleNamespace
from unittest import mock

from tests.test_helpers import load_module


JOYFUL_TEXT = """Joyful Mysteries
1. The Annunciation - Humility
2. The Visitation - Love of Neighbor
3. The Nativity - Poverty of Spirit
4. The Presentation - Obedience
5. The Finding of Jesus in the Temple - Joy in Finding Jesus
"""


class TestPublishRosaryReflections(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/rosary_reflections.py")
        self.date = datetime.date(2026, 6, 5)
        self.gospel = SimpleNamespace(
            celebration_clause="Friday of the Ninth Week in Ordinary Time",
            gospel_citation="Mark 12:35-37",
            gospel_text="Jesus taught in the temple.",
        )

    def _context(self, rows, *, season="", gospel=None, shared=None):
        with mock.patch.object(
            self.mod,
            "fetch_daily_gospel_context",
            return_value=self.gospel if gospel is None else gospel,
        ), mock.patch.object(self.mod, "romcal_fetch_day", return_value=rows):
            return self.mod.build_rosary_day_context(
                self.date,
                JOYFUL_TEXT,
                season=season,
                shared_theme=shared,
            )

    def _valid_payload(self, context):
        anchor = context.dominant_priority.anchors[0]
        categories = self.mod.APPROVED_HUMAN_NEED_CATEGORIES[:5]
        return {
            "dominant_priority_key": context.dominant_priority.key,
            "introduction": (
                f"As we begin the Joyful Mysteries, {anchor} draws our prayer toward Christ and the needs of this day. "
                "With Mary, we receive each mystery as a distinct invitation to faith, hope, and charity. "
                "May this Rosary unite our intentions in one coherent offering."
            ),
            "overall_intention": (
                f"We offer this Rosary in the light of {anchor}, asking the Lord to renew our faith "
                "and guide every need we place before him."
            ),
            "decades": [
                {
                    "number": mystery.number,
                    "human_need_category": category,
                    "intention": (
                        f"In the light of {anchor}, we pray for those entrusted to this decade, "
                        f"asking for the grace of {mystery.fruit.lower()}."
                    ),
                    "reflection": (
                        f"In {mystery.title}, we contemplate the saving work of Christ through {anchor}. "
                        f"The fruit of {mystery.fruit.lower()} gives this shared focus a particular shape for our choices and relationships. "
                        "May the mystery teach us to receive grace faithfully and carry it toward the people named in our prayer."
                    ),
                }
                for mystery, category in zip(context.mysteries, categories)
            ],
        }

    def test_parse_rosary_mysteries_requires_five_ordered_rows(self):
        title, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        self.assertEqual(title, "Joyful Mysteries")
        self.assertEqual([item.number for item in mysteries], [1, 2, 3, 4, 5])

        with self.assertRaisesRegex(RuntimeError, "exactly 5 mystery rows"):
            self.mod.parse_rosary_mysteries("Joyful Mysteries\n1. The Annunciation - Humility\n")

    def test_ordinary_time_orders_major_gospel_memorial_then_ordinary(self):
        rows = [
            {"name": "A Solemnity", "rank_name": "solemnity", "season": "ordinary_time"},
            {"name": "A Memorial", "rank_name": "memorial", "season": "ordinary_time"},
        ]
        context = self._context(rows)
        self.assertEqual(
            [priority.key for priority in context.priorities],
            ["major-celebration", "gospel", "memorial", "ordinary-time", "mystery-fruits"],
        )
        self.assertEqual(context.dominant_priority.key, "major-celebration")

    def test_ordinary_time_gospel_outranks_memorial(self):
        context = self._context(
            [{"name": "Saint Boniface", "rank_name": "memorial", "season": "ordinary_time"}]
        )
        self.assertEqual(context.dominant_priority.key, "gospel")
        self.assertEqual(context.memorial_names, ("Saint Boniface",))

    def test_ordinary_time_memorial_outranks_ordinary_reflection_without_gospel(self):
        missing = SimpleNamespace(celebration_clause="Friday", gospel_citation="", gospel_text="")
        context = self._context(
            [{"name": "Saint Boniface", "rank_name": "optional_memorial", "season": "ordinary_time"}],
            gospel=missing,
        )
        self.assertEqual(context.dominant_priority.key, "memorial")

    def test_nonordinary_season_outranks_gospel_and_memorial(self):
        context = self._context(
            [{"name": "An Advent Memorial", "rank_name": "memorial", "season": "advent"}]
        )
        self.assertEqual(
            [priority.key for priority in context.priorities],
            ["season", "gospel", "memorial", "mystery-fruits"],
        )
        self.assertEqual(context.dominant_priority.title, "Advent")

    def test_nonordinary_major_celebration_still_dominates(self):
        context = self._context(
            [{"name": "The Annunciation of the Lord", "rank_name": "solemnity", "season": "lent"}]
        )
        self.assertEqual(context.dominant_priority.key, "major-celebration")
        self.assertEqual(context.priorities[1].key, "season")

    def test_easter_octave_pseudo_rank_remains_seasonal(self):
        context = self._context(
            [{
                "name": "Friday within the Octave of Easter",
                "rank_name": "solemnity-easter octave",
                "season": "easter_time",
            }]
        )
        self.assertEqual(context.dominant_priority.key, "season")
        self.assertEqual(context.dominant_priority.title, "Easter season")
        self.assertEqual(context.feast_names, ())

    def test_shared_theme_supports_but_does_not_overwrite_rosary_authority(self):
        context = self._context(
            [{"name": "Ferial Friday", "rank_name": "weekday", "season": "ordinary_time"}],
            shared={
                "sharedThemeTitle": "A Different Display Theme",
                "sharedThemeReflectionFocus": "A different shared focus",
            },
        )
        self.assertEqual(context.focus_title, "Today's Gospel, Mark 12:35-37")
        self.assertEqual(context.shared_theme_title, "A Different Display Theme")

    def test_prompt_guides_two_to_four_intro_sentences_without_validator_enforcement(self):
        context = self._context(
            [{"name": "Ferial Friday", "rank_name": "weekday", "season": "ordinary_time"}]
        )

        prompt = self.mod._build_devotional_prompt(self.date, context)

        self.assertIn("Write the introduction in 2-4 sentences.", prompt)
        self.assertIn("Do not force a sentence count", prompt)

    def test_prompt_allows_optional_quotes_and_event_observance_information(self):
        context = self._context(
            [{"name": "The Annunciation of the Lord", "rank_name": "solemnity", "season": "lent"}]
        )
        observance = self.mod.RosaryObservanceContext(
            subject="The Annunciation of the Lord",
            summary="The angel announces the Incarnation to Mary.",
            relevant_details=["Mary receives God's will with faith."],
        )

        prompt = self.mod._build_devotional_prompt(self.date, context, observance)

        self.assertIn("A quotation is optional.", prompt)
        self.assertIn("whether it describes a person, event, Marian celebration, feast, or another liturgical subject", prompt)
        self.assertIn("The angel announces the Incarnation to Mary.", prompt)
        self.assertNotIn("named theme or taxonomy", prompt.split("Requirements:", 1)[0])

    def test_observance_context_rejects_prompt_commentary_and_requires_quote_source(self):
        context = self._context(
            [{"name": "Saint John Eudes, Priest", "rank_name": "memorial", "season": "ordinary_time"}]
        )
        with mock.patch.object(
            self.mod,
            "_call_openai_observance_context",
            return_value=json.dumps(
                {
                    "subject": "Saint John Eudes, Priest",
                    "summary": "A concise account of his witness.",
                    "relevant_details": ["He served the Church with pastoral zeal."],
                    "quotation": "",
                    "quotation_source": "",
                }
            ),
        ):
            result = self.mod._resolve_observance_context("test-model", self.date, context)

        self.assertEqual(result.subject, "Saint John Eudes, Priest")
        self.assertEqual(result.quotation, "")

        with mock.patch.object(
            self.mod,
            "_call_openai_observance_context",
            return_value=json.dumps(
                {
                    "subject": "The Annunciation",
                    "summary": "Return JSON in relevant_details.",
                    "relevant_details": [],
                }
            ),
        ), self.assertRaisesRegex(RuntimeError, "prompt commentary"):
            self.mod._resolve_observance_context("test-model", self.date, context)

    def test_observance_context_discards_unapproved_quotation(self):
        context = self._context(
            [{"name": "Saint John Eudes, Priest", "rank_name": "memorial", "season": "ordinary_time"}],
            shared={
                "saintWitness": "Saint John Eudes, Priest",
                "saintWitnessQuote": "Approved wording.",
                "saintWitnessQuoteSource": "Approved source",
            },
        )
        with mock.patch.object(
            self.mod,
            "_call_openai_observance_context",
            return_value=json.dumps(
                {
                    "subject": "Saint John Eudes, Priest",
                    "summary": "A concise account of his witness.",
                    "relevant_details": [],
                    "quotation": "Invented wording.",
                    "quotation_source": "Invented source",
                }
            ),
        ):
            result = self.mod._resolve_observance_context("test-model", self.date, context)

        self.assertEqual(result.quotation, "")
        self.assertEqual(result.quotation_source, "")

    def test_display_witness_name_does_not_duplicate_honorific(self):
        self.assertEqual(
            self.mod._display_witness_name("Saint John Eudes, Priest"),
            "Saint John Eudes, Priest",
        )
        self.assertEqual(self.mod._display_witness_name("St. John Eudes"), "Saint John Eudes")

    def test_deterministic_fallback_is_natural_for_saint_context(self):
        context = self._context(
            [{"name": "Saint John Eudes, Priest", "rank_name": "memorial", "season": "ordinary_time"}],
            shared={"saintWitness": "Saint John Eudes, Priest"},
        )
        observance = self.mod.RosaryObservanceContext(
            subject="Saint John Eudes, Priest",
            summary="His preaching and pastoral service called people toward the Heart of Christ.",
            relevant_details=["He served the Church through preaching and priestly formation."],
        )

        result = self.mod._deterministic_devotional_set(
            self.date,
            "Joyful Mysteries",
            context.mysteries,
            context,
            observance_context=observance,
            fallback_reason="test",
        )

        prose = " ".join(
            [result.introduction, result.overall_intention]
            + [part for decade in result.decades for part in (decade.intention, decade.reflection)]
        )
        self.assertNotIn("Saint Saint", prose)
        self.assertIn("Saint John Eudes, Priest", prose)
        self.assertTrue(all(text.rstrip().endswith((".", "?", "!")) for text in prose.split("  ") if text))
        self.assertTrue(all(decade.reflection for decade in result.decades))

    def test_event_fallback_does_not_require_a_saint_witness(self):
        context = self._context(
            [{"name": "The Annunciation of the Lord", "rank_name": "solemnity", "season": "lent"}]
        )
        result = self.mod._deterministic_devotional_set(
            self.date,
            "Joyful Mysteries",
            context.mysteries,
            context,
            observance_context=self.mod.RosaryObservanceContext(
                subject="The Annunciation of the Lord",
                summary="The angel announces the Incarnation to Mary.",
            ),
            fallback_reason="test",
        )

        self.assertNotIn("Saint Saint", result.introduction)
        self.assertIn("Annunciation", result.introduction)
        self.assertEqual(len(result.decades), 5)

    def test_semantic_validation_allows_flexible_sentence_shapes(self):
        context = self._context(
            [{"name": "Ferial Friday", "rank_name": "weekday", "season": "ordinary_time"}]
        )
        parsed = self.mod.validate_rosary_devotional_response(self._valid_payload(context), context)
        self.assertEqual(len(parsed.decades), 5)
        self.assertFalse(parsed.introduction.startswith("For today's rosary"))

    def test_semantic_validation_rejects_priority_category_and_mystery_failures(self):
        context = self._context(
            [{"name": "Ferial Friday", "rank_name": "weekday", "season": "ordinary_time"}]
        )
        wrong_key = self._valid_payload(context)
        wrong_key["dominant_priority_key"] = "season"
        with self.assertRaisesRegex(RuntimeError, "wrong dominant priority"):
            self.mod.validate_rosary_devotional_response(wrong_key, context)

        repeated_category = self._valid_payload(context)
        repeated_category["decades"][1]["human_need_category"] = repeated_category["decades"][0]["human_need_category"]
        with self.assertRaisesRegex(RuntimeError, "five distinct"):
            self.mod.validate_rosary_devotional_response(repeated_category, context)

        missing_mystery = self._valid_payload(context)
        missing_mystery["decades"][0]["intention"] = (
            "In today's Gospel, we pray for families who need patience and renewed trust in God's providence."
        )
        missing_mystery["decades"][0]["reflection"] = (
            "Today's Gospel directs our attention toward Christ and calls us to listen with faith. "
            "This shared focus can guide concrete choices, relationships, and burdens without becoming abstract. "
            "May the Lord teach us to receive grace faithfully and carry it toward the people named in our prayer."
        )
        with self.assertRaisesRegex(RuntimeError, "mystery title or fruit"):
            self.mod.validate_rosary_devotional_response(missing_mystery, context)

        foreign_citation = self._valid_payload(context)
        foreign_citation["decades"][0]["reflection"] += " John 3:16 confirms this prayer."
        with self.assertRaisesRegex(RuntimeError, "unsupported Scripture citation"):
            self.mod.validate_rosary_devotional_response(foreign_citation, context)

    def test_generation_prefers_structured_package(self):
        context = self._context(
            [{"name": "Ferial Friday", "rank_name": "weekday", "season": "ordinary_time"}]
        )
        with mock.patch.object(
            self.mod,
            "_call_openai_structured",
            return_value=self._valid_payload(context),
        ), mock.patch.object(self.mod, "_call_openai_json") as json_call:
            result = self.mod.build_rosary_devotional_set(self.date, JOYFUL_TEXT, day_context=context)

        self.assertEqual(result.source, self.mod.SOURCE_GENERATED_STRUCTURED)
        self.assertEqual(len(result.decades), 5)
        json_call.assert_not_called()

    def test_generation_retries_plain_json_then_uses_atomic_fallback(self):
        context = self._context(
            [{"name": "Ferial Friday", "rank_name": "weekday", "season": "ordinary_time"}]
        )
        with mock.patch.object(
            self.mod,
            "_call_openai_structured",
            side_effect=RuntimeError("unsupported"),
        ), mock.patch.object(
            self.mod,
            "_call_openai_json",
            return_value=json.dumps(self._valid_payload(context)),
        ):
            result = self.mod.build_rosary_devotional_set(self.date, JOYFUL_TEXT, day_context=context)
        self.assertEqual(result.source, self.mod.SOURCE_GENERATED_JSON)

        with mock.patch.object(
            self.mod,
            "_call_openai_structured",
            side_effect=RuntimeError("model down"),
        ), mock.patch.object(
            self.mod,
            "_call_openai_json",
            side_effect=RuntimeError("provider down"),
        ):
            fallback = self.mod.build_rosary_devotional_set(self.date, JOYFUL_TEXT, day_context=context)

        self.assertEqual(fallback.source, self.mod.SOURCE_FALLBACK_DETERMINISTIC)
        self.assertEqual(len(fallback.decades), 5)
        self.assertTrue(fallback.introduction)
        self.assertTrue(fallback.overall_intention)
        self.assertTrue(all(decade.intention and decade.reflection for decade in fallback.decades))


if __name__ == "__main__":
    unittest.main()
