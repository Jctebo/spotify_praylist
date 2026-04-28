import datetime
import unittest
from unittest import mock

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

    def test_generate_text_calls_openai_with_context_and_returns_model_text(self):
        captured = {}

        class FakeResponses:
            def create(self, **kwargs):
                captured["responses_create"] = kwargs
                return type("Response", (), {"output_text": "  O Sacred Heart, make our hearts like yours.  "})()

        class FakeChatCompletions:
            def create(self, **kwargs):
                captured["chat_create"] = kwargs
                return type(
                    "Chat",
                    (),
                    {
                        "choices": [
                            type(
                                "Choice",
                                (),
                                {"message": type("Message", (), {"content": "chat fallback text"})()},
                            )()
                        ]
                    },
                )()

        class FakeClient:
            def __init__(self, *args, **kwargs):
                captured["client_kwargs"] = kwargs
                self.responses = FakeResponses()
                self.chat = type("ChatNamespace", (), {"completions": FakeChatCompletions()})()

        with mock.patch.dict(
            engine_mod.os.environ,
            {
                "OPENAI_API_KEY": "test-key",
                "OAI_API_BASE_URL": "https://api.openai.com/v1",
                "OAI_MODEL": "gpt-test",
            },
            clear=False,
        ), mock.patch.object(engine_mod, "OpenAI", FakeClient):
            text = engine_mod.generate_text(
                "Compose the novena prayer for {saint_name} on day {day} with the theme {theme}.",
                {"saint_name": "Saint Example", "feast_name": "Example Feast", "day": 4, "theme": "hope"},
            )

        self.assertEqual(text, "O Sacred Heart, make our hearts like yours.")
        self.assertEqual(captured["client_kwargs"]["api_key"], "test-key")
        self.assertEqual(captured["client_kwargs"]["base_url"], "https://api.openai.com/v1")
        self.assertEqual(captured["responses_create"]["model"], "gpt-test")
        self.assertEqual(captured["responses_create"]["temperature"], 0)
        user_message = captured["responses_create"]["input"][1]["content"][0]["text"]
        self.assertIn("Saint: Saint Example", user_message)
        self.assertIn("Feast: Example Feast", user_message)
        self.assertIn("Write the devotional section requested below:", user_message)
        self.assertIn("Compose the novena prayer for", user_message)
        self.assertNotIn("generated::", text)

    def test_generate_text_requires_openai_api_key(self):
        with mock.patch.dict(engine_mod.os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError) as ctx:
                engine_mod.generate_text("Compose a prayer.", {"saint_name": "Saint Example"})

        self.assertIn("OPENAI_API_KEY", str(ctx.exception))

    def test_generate_text_rejects_prompt_echo_and_uses_fallback(self):
        captured = {}

        class FakeResponses:
            def create(self, **kwargs):
                captured["responses_create"] = kwargs
                user_prompt = kwargs["input"][1]["content"][0]["text"]
                return type("Response", (), {"output_text": user_prompt})()

        class FakeChatCompletions:
            def create(self, **kwargs):
                captured["chat_create"] = kwargs
                return type(
                    "Chat",
                    (),
                    {
                        "choices": [
                            type(
                                "Choice",
                                (),
                                {"message": type("Message", (), {"content": "fallback devotional text"})()},
                            )()
                        ]
                    },
                )()

        class FakeClient:
            def __init__(self, *args, **kwargs):
                self.responses = FakeResponses()
                self.chat = type("ChatNamespace", (), {"completions": FakeChatCompletions()})()

        with mock.patch.dict(
            engine_mod.os.environ,
            {
                "OPENAI_API_KEY": "test-key",
                "OAI_API_BASE_URL": "https://api.openai.com/v1",
                "OAI_MODEL": "gpt-test",
            },
            clear=False,
        ), mock.patch.object(engine_mod, "OpenAI", FakeClient):
            text = engine_mod.generate_text("Compose the novena prayer.", {"saint_name": "Saint Example"})

        self.assertEqual(text, "fallback devotional text")
        self.assertIn("chat_create", captured)
