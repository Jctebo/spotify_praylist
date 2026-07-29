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
        self.assertNotIn("faithful work", result.text)
        self.assertNotIn("Trust", result.text)

    def test_all_profile_fallbacks_use_complete_spoken_sentences(self):
        cases = (
            (
                MORNING_PRAYER_PROFILE,
                {
                    "prayer_title": "Morning Prayer",
                    "daily_theme_title": "Trust.",
                    "celebration_clause": "Saint Bridget.",
                    "daily_gospel_bridge": "In today's Gospel, Christ teaches us to remain in him.",
                },
            ),
            (
                AUXILIUM_CHRISTIANORUM_PROFILE,
                {"prayer_title": "Auxilium Christianorum prayers", "daily_theme_title": "Trust."},
            ),
            ("angelus", {"prayer_title": "Angelus", "daily_theme_title": "Trust."}),
            ("regina-caeli", {"prayer_title": "Regina Caeli", "daily_theme_title": "Trust."}),
        )

        for profile, context in cases:
            with self.subTest(profile=profile):
                result = build_devotional_intro(profile, context, generate_text_fn=lambda *_args: "Too short.")
                self.assertEqual(result.source, SOURCE_FALLBACK_DETERMINISTIC)
                self.assertNotIn("..", result.text)
                self.assertNotIn("Trust. into", result.text)
                self.assertNotIn("Trust. draws", result.text)
                self.assertNotIn("Trust. joins", result.text)

        morning_result = build_devotional_intro(
            MORNING_PRAYER_PROFILE,
            cases[0][1],
            generate_text_fn=lambda *_args: "Too short.",
        )
        self.assertIn("Today the Church celebrates Saint Bridget.", morning_result.text)
        self.assertIn("In today's Gospel, Christ teaches us to remain in him.", morning_result.text)
        self.assertNotIn("him. invites", morning_result.text)

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
            "Saint Joseph teaches us faithful service in the ordinary duties of life. "
            "His quiet obedience makes room for God's work in every home and workplace. "
            "On Day 3 of the Novena to Saint Joseph, we gather to pray together. "
            "Let us begin this novena in prayer."
        )

        self.assertIn("not a summary of the day's liturgy", prompt)
        self.assertIn("exactly 4 to 6 sentences", prompt)
        self.assertIn("explicitly names Day 3", prompt)
        self.assertIn('beginning with "Let us"', prompt)
        self.assertIn("Do not mention any daily theme, Gospel, Scripture, calendar bridge, feast, liturgical season, or novena focus.", prompt)
        self.assertNotIn("Gospel bridge:", prompt)
        self.assertNotIn("Novena focus:", prompt)
        self.assertNotIn("shared theme as a fallback", prompt)
        self.assertIn("saint's life and witness give shape to the opening", prompt)
        self.assertEqual(validate_devotional_intro(text, NOVENA_PROFILE, context), text)

    def test_novena_validation_requires_day_but_accepts_natural_context(self):
        context = {
            "prayer_title": "Novena to Saint Joseph",
            "saint_name": "Saint Joseph",
            "day": "3",
            "daily_focus": "faithful work",
            "daily_theme_title": "Trust",
        }
        with self.assertRaisesRegex(RuntimeError, "identify Day 3"):
            validate_devotional_intro(
                "Saint Joseph teaches us faithful service. His obedience leads us to God. "
                "The Novena to Saint Joseph gathers us in prayer. Let us begin this novena in prayer.",
                NOVENA_PROFILE,
                context,
            )
        natural_intro = (
            "Saint Joseph shows us how to serve God quietly and faithfully. "
            "His humble work helps us serve the Lord in ordinary responsibilities. "
            "On Day 3 of the Novena to Saint Joseph, we bring our needs before God with humble confidence. "
            "Let us begin this novena in prayer."
        )
        self.assertEqual(validate_devotional_intro(natural_intro, NOVENA_PROFILE, context), natural_intro)

    def test_novena_validation_accepts_paraphrased_identity_description(self):
        context = {
            "prayer_title": "Novena to St Mary MacKillop",
            "saint_name": "St Mary MacKillop",
            "day": "1",
            "daily_focus": "hidden holiness and trust",
            "intro_summary": (
                "St Mary MacKillop was an Australian religious sister who co-founded the Sisters of St Joseph "
                "of the Sacred Heart and served the poor through education."
            ),
            "intro_patronage": "Australia, Catholic education, teachers",
        }
        text = (
            "We remember the Australian sister whose work opened Catholic education to the poor. "
            "Her courage still encourages generous service today. "
            "Her witness invites us to see Christ in the needs around us. "
            "On Day 1 of the Novena to St Mary MacKillop, we gather before God in prayer. "
            "Let us begin this novena in prayer."
        )

        self.assertEqual(validate_devotional_intro(text, NOVENA_PROFILE, context), text)

    def test_novena_validation_rejects_daily_liturgical_context(self):
        context = {
            "prayer_title": "Novena to St Mary MacKillop",
            "saint_name": "St Mary MacKillop",
            "day": "1",
            "daily_focus": "hidden holiness and trust",
        }
        daily_context = (
            "St Mary MacKillop served the poor through Catholic education. "
            "Her witness calls us to generous service. "
            "On Day 1 of the Novena to St Mary MacKillop, we ask for hidden holiness and trust. "
            "Let us begin this novena in prayer."
        )

        with self.assertRaisesRegex(RuntimeError, "must not use daily liturgical context"):
            validate_devotional_intro(daily_context, NOVENA_PROFILE, context)

    def test_novena_validation_requires_one_day_sentence(self):
        context = {
            "prayer_title": "Novena to Saint Joseph",
            "saint_name": "Saint Joseph",
            "day": "3",
            "daily_focus": "faithful work",
        }
        repeated_day = (
            "On Day 3, Saint Joseph shows us faithful service. "
            "His obedience helps us trust God in ordinary duties. "
            "On Day 3 of the Novena to Saint Joseph, we gather before God in prayer. "
            "Let us begin this novena in prayer."
        )

        with self.assertRaisesRegex(RuntimeError, "exactly one sentence"):
            validate_devotional_intro(repeated_day, NOVENA_PROFILE, context)

    def test_novena_generation_retries_daily_liturgical_context_before_rendering_audio(self):
        context = {
            "prayer_title": "Novena to St Mary MacKillop",
            "saint_name": "St Mary MacKillop",
            "day": "1",
            "daily_focus": "hidden holiness and trust",
        }
        responses = iter(
            (
                (
                    "St Mary MacKillop served the poor through Catholic education. "
                    "Her witness calls us to generous service. "
                    "On Day 1 of the Novena to St Mary MacKillop, we ask for hidden holiness and trust. "
                    "Let us begin this novena in prayer."
                ),
                (
                    "St Mary MacKillop served the poor through Catholic education. "
                    "Her witness calls us to generous service. "
                    "On Day 1 of the Novena to St Mary MacKillop, we gather before God in prayer. "
                    "Let us begin this novena in prayer."
                ),
            )
        )

        result = build_devotional_intro(
            NOVENA_PROFILE,
            context,
            generate_text_fn=lambda *_args: next(responses),
        )

        self.assertEqual(result.source, SOURCE_OPENAI)
        self.assertTrue(result.text.endswith("Let us begin this novena in prayer."))
        self.assertNotIn("hidden holiness and trust", result.text.lower())

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
        self.assertGreater(len(result.text), 250)
        self.assertIn("Day 7", result.text)
        self.assertIn("founded the Congregation of the Blessed Sacrament and promoted devotion to the Eucharist.", result.text)
        self.assertIn("Eucharistic devotion, priests, and religious congregations", result.text)
        self.assertNotIn("…", result.text)

    def test_novena_fallback_uses_complete_grammatical_sentences(self):
        result = build_devotional_intro(
            NOVENA_PROFILE,
            {
                "prayer_title": "Novena to St Mary MacKillop",
                "saint_name": "St Mary MacKillop",
                "day": "1",
                "daily_focus": "St Mary MacKillop",
                "intro_summary": (
                    "St Mary MacKillop was an Australian religious sister who co-founded the Sisters of St Joseph "
                    "of the Sacred Heart and served the poor through education."
                ),
                "intro_patronage": "Australia, Catholic education, teachers",
            },
            generate_text_fn=lambda *_args: "Too short.",
        )

        self.assertIn("education. We ask St Mary MacKillop's intercession", result.text)
        self.assertIn("for Australia, Catholic education, and teachers.", result.text)
        self.assertNotIn(". and seek", result.text.lower())
        self.assertNotIn("..", result.text)


if __name__ == "__main__":
    unittest.main()
