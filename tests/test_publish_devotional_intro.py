from __future__ import annotations

import unittest

from jobs.publish.devotional_intro import (
    AUXILIUM_CHRISTIANORUM_PROFILE,
    DEVOTIONAL_INTRO_POLICY_VERSION,
    MORNING_PRAYER_PROFILE,
    NOVENA_PROFILE,
    SOURCE_FALLBACK_DETERMINISTIC,
    SOURCE_OPENAI,
    build_devotional_intro,
    build_devotional_intro_prompt,
    validate_devotional_intro,
)


class TestPublishDevotionalIntro(unittest.TestCase):
    def setUp(self) -> None:
        self.morning_context = {
            "date": "2026-07-23",
            "prayer_title": "Morning Prayer",
            "celebration_clause": "Saint Bridget",
            "daily_theme_title": "Trust",
            "daily_theme_explanation": "Entrust the work of this day to the Lord.",
            "daily_gospel_bridge": "In today's Gospel, Christ teaches us to remain in him",
            "daily_gospel_citation": "John 15:1-8",
            "daily_gospel_text": "Remain in me, as I remain in you.",
        }

    def test_prompt_contains_profile_sentence_guidance_without_exact_count_validation(self):
        morning = build_devotional_intro_prompt(MORNING_PRAYER_PROFILE, self.morning_context)
        auxilium = build_devotional_intro_prompt(
            AUXILIUM_CHRISTIANORUM_PROFILE,
            {
                "prayer_title": "Auxilium Christianorum prayers",
                "devotion": "Auxilium Christianorum",
                "daily_theme_title": "Trust",
            },
        )

        self.assertIn("Write the introduction in 2-4 sentences.", morning)
        self.assertIn("Write the introduction in 1-2 sentences.", auxilium)
        self.assertIn("Do not force a stock opening phrase.", morning)

    def test_validation_accepts_flexible_sentence_shapes(self):
        two_sentences = (
            "Morning Prayer gathers us around the grace of Trust as Saint Bridget accompanies the Church today. "
            "In today's Gospel, Christ teaches us to remain in him, so we offer our work and relationships to God."
        )
        four_sentences = (
            "Morning Prayer begins in Trust. Saint Bridget accompanies the Church today. "
            "The Gospel calls us to remain in Christ. We offer every task and encounter to God."
        )

        self.assertEqual(
            validate_devotional_intro(two_sentences, MORNING_PRAYER_PROFILE, self.morning_context),
            two_sentences,
        )
        self.assertEqual(
            validate_devotional_intro(four_sentences, MORNING_PRAYER_PROFILE, self.morning_context),
            four_sentences,
        )

    def test_validation_rejects_bounds_and_missing_prayer_or_daily_anchor(self):
        with self.assertRaisesRegex(RuntimeError, "shorter"):
            validate_devotional_intro("Morning Prayer and Trust.", MORNING_PRAYER_PROFILE, self.morning_context)
        with self.assertRaisesRegex(RuntimeError, "identify the prayer"):
            validate_devotional_intro(
                "Trust gathers our hearts as Saint Bridget accompanies the Church through today's Gospel. "
                "We receive Christ's invitation to remain in him and offer the day to God.",
                MORNING_PRAYER_PROFILE,
                self.morning_context,
            )
        with self.assertRaisesRegex(RuntimeError, "daily liturgical anchor"):
            validate_devotional_intro(
                "Morning Prayer opens our hearts to God and places every concern before him. "
                "The Gospel helps us listen with faith and begin this day in hope.",
                MORNING_PRAYER_PROFILE,
                self.morning_context,
            )

    def test_validation_accepts_an_intro_longer_than_the_former_profile_limit(self):
        text = (
            "Morning Prayer gathers us around Trust as Saint Bridget accompanies the Church today. "
            "In today's Gospel, Christ teaches us to remain in him, and we receive that invitation with gratitude. "
            "May this prayer shape each conversation, task, and hidden sacrifice we offer to God throughout the day. "
        ) * 3

        self.assertEqual(validate_devotional_intro(text, MORNING_PRAYER_PROFILE, self.morning_context), text.strip())

    def test_validation_rejects_gospel_language_when_context_is_missing(self):
        context = {
            "prayer_title": "Auxilium Christianorum prayers",
            "daily_theme_title": "Trust",
        }
        with self.assertRaisesRegex(RuntimeError, "must not mention Gospel"):
            validate_devotional_intro(
                "As we begin the Auxilium Christianorum prayers, the Gospel and today's focus of Trust "
                "lead us to place our families under Mary's protection.",
                AUXILIUM_CHRISTIANORUM_PROFILE,
                context,
            )

    def test_validation_accepts_prayer_devotion_alias(self):
        context = {
            "prayer_title": "Auxilium Christianorum prayers",
            "devotion": "Auxilium Christianorum",
            "daily_theme_title": "Trust",
        }

        text = validate_devotional_intro(
            "Auxilium Christianorum receives today's focus of Trust as we place our families "
            "and the needs of this day under Mary's protection.",
            AUXILIUM_CHRISTIANORUM_PROFILE,
            context,
        )

        self.assertIn("Auxilium Christianorum", text)

    def test_validation_rejects_foreign_scripture_citation(self):
        with self.assertRaisesRegex(RuntimeError, "unsupported Scripture citation"):
            validate_devotional_intro(
                "Morning Prayer gathers us in Trust as Saint Bridget accompanies the Church today. "
                "In today's Gospel, Matthew 5:1-12 calls us to remain close to Christ and offer the day to God.",
                MORNING_PRAYER_PROFILE,
                self.morning_context,
            )

    def test_generation_retries_semantic_failure_then_returns_valid_result(self):
        calls = []

        def generate(model, system, prompt, temperature):
            calls.append((model, system, prompt, temperature))
            if len(calls) == 1:
                return "Too short."
            return (
                "Morning Prayer gathers us around Trust as Saint Bridget accompanies the Church today. "
                "In today's Gospel, Christ teaches us to remain in him, and we offer the whole day to God."
            )

        result = build_devotional_intro(
            MORNING_PRAYER_PROFILE,
            self.morning_context,
            prompt_model="test-model",
            generate_text_fn=generate,
        )

        self.assertEqual(result.source, SOURCE_OPENAI)
        self.assertEqual(result.policy_version, DEVOTIONAL_INTRO_POLICY_VERSION)
        self.assertEqual(len(calls), 2)
        self.assertIn("Correction required after validation", calls[1][2])

    def test_generation_uses_auditable_deterministic_fallback(self):
        def fail(model, system, prompt, temperature):
            raise RuntimeError("model unavailable")

        result = build_devotional_intro(
            NOVENA_PROFILE,
            {
                "prayer_title": "Novena to Saint Joseph",
                "saint_name": "Saint Joseph",
                "day": "3",
                "daily_focus": "faithful work",
                "daily_theme_title": "Trust",
            },
            generate_text_fn=fail,
        )

        self.assertEqual(result.source, SOURCE_FALLBACK_DETERMINISTIC)
        self.assertEqual(result.profile, "novena")
        self.assertEqual(result.policy_version, DEVOTIONAL_INTRO_POLICY_VERSION)
        self.assertIn("model unavailable", result.fallback_reason)
        self.assertIn("Day 3", result.text)
        self.assertIn("Novena to Saint Joseph", result.text)
        self.assertIn("faithful work", result.text)
        self.assertNotIn("Trust", result.text)

    def test_novena_prompt_and_validation_prioritize_the_specific_prayer(self):
        context = {
            "prayer_title": "Novena to Saint Joseph",
            "saint_name": "Saint Joseph",
            "day": "3",
            "daily_focus": "faithful work",
            "daily_theme_title": "Trust",
            "daily_gospel_bridge": "Christ teaches us to remain in him",
        }

        prompt = build_devotional_intro_prompt(NOVENA_PROFILE, context)
        text = (
            "On Day 3 of the Novena to Saint Joseph, we ask for the grace of faithful work in the duties before us. "
            "With Saint Joseph, let us begin this day's prayer."
        )

        self.assertIn("not a summary of the day's liturgy", prompt)
        self.assertIn("explicitly name Day 3", prompt)
        self.assertIn("major solemnity or feast first, then the Gospel, then a memorial", prompt)
        self.assertIn("When none is available, give only a brief introduction", prompt)
        self.assertNotIn("shared theme as a fallback", prompt)
        self.assertIn("adapt it naturally to this saint and novena", prompt)
        self.assertEqual(validate_devotional_intro(text, NOVENA_PROFILE, context), text)

    def test_novena_validation_requires_day_and_focus_but_not_daily_theme(self):
        context = {
            "prayer_title": "Novena to Saint Joseph",
            "saint_name": "Saint Joseph",
            "day": "3",
            "daily_focus": "faithful work",
            "daily_theme_title": "Trust",
        }
        with self.assertRaisesRegex(RuntimeError, "identify Day 3"):
            validate_devotional_intro(
                "The Novena to Saint Joseph asks for the grace of faithful work in every duty before us. "
                "With Saint Joseph, let us begin this day's prayer.",
                NOVENA_PROFILE,
                context,
            )
        with self.assertRaisesRegex(RuntimeError, "novena focus"):
            validate_devotional_intro(
                "On Day 3 of the Novena to Saint Joseph, we bring our needs before God with humble confidence. "
                "With Saint Joseph, let us begin this day's prayer.",
                NOVENA_PROFILE,
                context,
            )

    def test_fallback_reason_redacts_credentials_and_urls(self):
        def fail(model, system, prompt, temperature):
            raise RuntimeError("Authorization: Bearer secret-token failed at https://example.invalid/private")

        result = build_devotional_intro(
            NOVENA_PROFILE,
            {
                "prayer_title": "Novena to Saint Joseph",
                "saint_name": "Saint Joseph",
                "day": "3",
                "daily_focus": "faithful work",
                "daily_theme_title": "Trust",
            },
            generate_text_fn=fail,
        )

        self.assertNotIn("secret-token", result.fallback_reason)
        self.assertNotIn("example.invalid", result.fallback_reason)
        self.assertIn("[redacted]", result.fallback_reason)

    def test_novena_fallback_preserves_complete_saint_metadata_without_truncation(self):
        result = build_devotional_intro(
            NOVENA_PROFILE,
            {
                "prayer_title": "Novena to St Peter Julian Eymard",
                "saint_name": "St Peter Julian Eymard",
                "day": "7",
                "daily_focus": "St Peter Julian Eymard",
                "intro_summary": "St Peter Julian Eymard, a French priest, founded the Congregation of the Blessed Sacrament and promoted devotion to the Eucharist.",
                "intro_patronage": "Eucharistic devotion, priests, religious congregations",
            },
            generate_text_fn=lambda *_args: "Too short.",
        )

        self.assertEqual(result.source, SOURCE_FALLBACK_DETERMINISTIC)
        self.assertGreater(len(result.text), 420)
        self.assertIn("Day 7", result.text)
        self.assertIn("founded the Congregation of the Blessed Sacrament and promoted devotion to the Eucharist.", result.text)
        self.assertIn("Eucharistic devotion, priests, religious congregations", result.text)
        self.assertNotIn("…", result.text)


if __name__ == "__main__":
    unittest.main()
