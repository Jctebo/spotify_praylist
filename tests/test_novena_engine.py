import datetime
import unittest

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.engine as engine_mod


class TestNovenaEngine(unittest.TestCase):
    def test_render_novena_renders_fixed_and_generated_sections_with_context(self):
        runtime = contracts_mod.NovenaRuntime(
            family_id="standard_9_day",
            contract_id="most_sacred_heart_of_jesus",
            saint={"id": "most_sacred_heart_of_jesus", "name": "The Most Sacred Heart of Jesus"},
            feast={"month": 6, "day": 12, "name": "The Most Sacred Heart of Jesus"},
            novena={"duration_days": 9, "start_offset_days": -9, "content_mode": "hybrid", "ai_config": {"themes": ["trust", "mercy"]}},
            resolved_template=contracts_mod.TemplateSpec(
                template_id="standard-9-day",
                source="embedded",
                sections=(
                    contracts_mod.TemplateSection(
                        key="opening",
                        title="Opening Prayer",
                        kind="fixed",
                        text="Pray for {saint_name} on {date_display}.",
                    ),
                    contracts_mod.TemplateSection(
                        key="petition",
                        title="Daily Petition",
                        kind="generated",
                        prompt="Compose day {day} for {theme}.",
                    ),
                    contracts_mod.TemplateSection(
                        key="closing",
                        title="Closing Prayer",
                        kind="fixed",
                        text="Amen for {feast_name}.",
                    ),
                ),
            ),
            date=datetime.date(2026, 6, 4),
            active_day=2,
            publishing={"audio": {"enabled": True}, "rss": {"enabled": True}},
            source_path=contracts_mod.DEFAULT_FEAST_DIR / "most_sacred_heart_of_jesus.json",
        )

        calls = []

        def fake_generate_text(prompt, context):
            calls.append((prompt, dict(context)))
            return f"generated::{prompt}"

        rendered = engine_mod.render_novena(runtime, generate_text_fn=fake_generate_text)

        self.assertEqual(rendered["context"]["theme"], "mercy")
        self.assertEqual(rendered["content"]["sections"][0]["text"], "Pray for The Most Sacred Heart of Jesus on June 4, 2026.")
        self.assertEqual(rendered["content"]["sections"][1]["text"], "generated::Compose day 2 for mercy.")
        self.assertEqual(rendered["content"]["sections"][2]["text"], "Amen for The Most Sacred Heart of Jesus.")
        self.assertEqual(len(rendered["audio_fragments"]), 3)
        self.assertEqual(calls[0][1]["saint_name"], "The Most Sacred Heart of Jesus")
        self.assertEqual(calls[0][1]["day"], 2)
