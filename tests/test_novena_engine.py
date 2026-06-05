import datetime
import re
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
        self.assertEqual(rendered["context"]["daily_focus"], "mercy")
        self.assertEqual(rendered["content"]["sections"][0]["text"], "Pray for The Most Sacred Heart of Jesus on June 4, 2026.")
        self.assertEqual(rendered["content"]["sections"][1]["text"], "generated::Compose day 2 for mercy.")
        self.assertEqual(rendered["content"]["sections"][2]["text"], "Amen for The Most Sacred Heart of Jesus.")
        self.assertEqual(len(rendered["audio_fragments"]), 3)
        self.assertEqual(calls[0][1]["saint_name"], "The Most Sacred Heart of Jesus")
        self.assertEqual(calls[0][1]["day"], 2)

    def test_render_novena_uses_compact_blocks_for_reusable_tts_fragments(self):
        runtime = contracts_mod.NovenaRuntime(
            family_id="our_lady_of_fatima",
            contract_id="our_lady_of_fatima",
            saint={"id": "our_lady_of_fatima", "name": "Our Lady of Fatima"},
            feast={"month": 5, "day": 13, "name": "Our Lady of Fatima"},
            novena={"duration_days": 9, "start_offset_days": -9, "content_mode": "fixed"},
            resolved_template=contracts_mod.TemplateSpec(
                template_id="url-import-our_lady_of_fatima",
                source="embedded",
                sections=(
                    contracts_mod.TemplateSection(
                        key="introduction",
                        title="Introduction",
                        kind="fixed",
                        text="You can pray the full novena below.",
                    ),
                    contracts_mod.TemplateSection(
                        key="day-1",
                        title="Day 1",
                        kind="fixed",
                        text="Day 1 prayer text.",
                    ),
                ),
                blocks=(
                    contracts_mod.TemplateSection(
                        key="introduction",
                        title="Introduction",
                        kind="fixed",
                        text="You can pray the full novena below.",
                    ),
                    contracts_mod.TemplateSection(
                        key="days-1-9",
                        title="Days 1-9",
                        kind="fixed",
                        text="Common prayer text.",
                        days=(1, 2, 3, 4, 5, 6, 7, 8, 9),
                    ),
                ),
            ),
            date=datetime.date(2026, 5, 4),
            active_day=4,
            publishing={"audio": {"enabled": True}, "rss": {"enabled": True}},
            source_path=contracts_mod.DEFAULT_FEAST_DIR / "our_lady_of_fatima.json",
        )

        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['day']})")

        self.assertEqual(len(rendered["audio_fragments"]), 2)
        self.assertEqual(rendered["audio_fragments"][0]["label"], "Welcome to Day 4")
        self.assertEqual(rendered["audio_fragments"][1]["label"], "Days 1-9")
        self.assertEqual(rendered["audio_fragments"][1]["days"], [1, 2, 3, 4, 5, 6, 7, 8, 9])
        self.assertIn("Welcome to Day 4 of the Novena to Our Lady of Fatima.", rendered["content"]["text"])
        self.assertIn("Common prayer text.", rendered["content"]["text"])

    def test_render_novena_expands_fragment_parts_from_library(self):
        runtime = contracts_mod.NovenaRuntime(
            family_id="our_lady_of_fatima",
            contract_id="our_lady_of_fatima",
            saint={"id": "our_lady_of_fatima", "name": "Our Lady of Fatima"},
            feast={"month": 5, "day": 13, "name": "Our Lady of Fatima"},
            novena={"duration_days": 9, "start_offset_days": -9, "content_mode": "fixed"},
            resolved_template=contracts_mod.TemplateSpec(
                template_id="url-import-our_lady_of_fatima",
                source="embedded",
                sections=(
                    contracts_mod.TemplateSection(
                        key="introduction",
                        title="Introduction",
                        kind="fixed",
                        text="You can pray the full novena below.",
                    ),
                ),
                blocks=(
                    contracts_mod.TemplateSection(
                        key="days-1-9",
                        title="Days 1-9",
                        kind="fixed",
                        days=(1, 2, 3, 4, 5, 6, 7, 8, 9),
                        parts=(
                            {"kind": "text", "text": "You are going to say the following 3 times:"},
                            {"kind": "fragment", "fragment_key": "our_father", "repeat": 3},
                            {"kind": "fragment", "fragment_key": "hail_mary", "repeat": 3},
                            {"kind": "fragment", "fragment_key": "glory_be", "repeat": 3},
                        ),
                    ),
                ),
                fragments=(
                    contracts_mod.TemplateFragment(
                        key="our_father",
                        title="Our Father",
                        kind="fixed",
                        text="Our Father text.",
                    ),
                    contracts_mod.TemplateFragment(
                        key="hail_mary",
                        title="Hail Mary",
                        kind="fixed",
                        text="Hail Mary text.",
                    ),
                    contracts_mod.TemplateFragment(
                        key="glory_be",
                        title="Glory Be",
                        kind="fixed",
                        text="Glory Be text.",
                    ),
                ),
            ),
            date=datetime.date(2026, 5, 4),
            active_day=4,
            publishing={"audio": {"enabled": True}, "rss": {"enabled": True}},
            source_path=contracts_mod.DEFAULT_FEAST_DIR / "our_lady_of_fatima.json",
        )

        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['day']})")

        self.assertEqual(len(rendered["audio_fragments"]), 11)
        self.assertEqual(rendered["audio_fragments"][0]["label"], "Welcome to Day 4")
        self.assertEqual(rendered["audio_fragments"][1]["label"], "Text")
        self.assertEqual(rendered["audio_fragments"][2]["source_fragment_key"], "our_father")
        self.assertEqual(rendered["audio_fragments"][2]["text"], "Our Father text.")
        self.assertEqual(rendered["audio_fragments"][4]["source_fragment_key"], "our_father")
        self.assertEqual(rendered["audio_fragments"][5]["source_fragment_key"], "hail_mary")
        self.assertEqual(rendered["audio_fragments"][8]["source_fragment_key"], "glory_be")
        self.assertIn("You are going to say the following 3 times:", rendered["content"]["text"])
        self.assertIn("Our Father text.", rendered["content"]["text"])

    def test_render_novena_skips_part_blocks_for_other_days(self):
        runtime = contracts_mod.NovenaRuntime(
            family_id="holy_spirit",
            contract_id="holy_spirit",
            saint={"id": "holy_spirit", "name": "Holy Spirit"},
            feast={"month": 5, "day": 24, "name": "Pentecost Sunday"},
            novena={"duration_days": 9, "start_offset_days": -9, "content_mode": "fixed"},
            resolved_template=contracts_mod.TemplateSpec(
                template_id="url-import-holy_spirit",
                source="embedded",
                sections=(
                    contracts_mod.TemplateSection(
                        key="introduction",
                        title="Introduction",
                        kind="fixed",
                        text="You can pray the full novena below.",
                    ),
                ),
                blocks=(
                    contracts_mod.TemplateSection(
                        key="day-1",
                        title="Day 1",
                        kind="fixed",
                        days=(1,),
                        parts=({"kind": "text", "text": "Day 1 prayer text."},),
                    ),
                    contracts_mod.TemplateSection(
                        key="day-2",
                        title="Day 2",
                        kind="fixed",
                        days=(2,),
                        parts=({"kind": "text", "text": "Day 2 prayer text."},),
                    ),
                ),
            ),
            date=datetime.date(2026, 5, 16),
            active_day=2,
            publishing={"audio": {"enabled": True}, "rss": {"enabled": True}},
            source_path=contracts_mod.DEFAULT_FEAST_DIR / "holy_spirit.json",
        )

        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['day']})")

        self.assertEqual(len(rendered["audio_fragments"]), 2)
        self.assertEqual(rendered["audio_fragments"][0]["label"], "Welcome to Day 2")
        self.assertEqual(rendered["audio_fragments"][1]["text"], "Day 2 prayer text.")
        self.assertNotIn("Day 1 prayer text.", rendered["content"]["text"])

    def test_render_novena_traditional_fatima_uses_single_three_prayer_cycle(self):
        contracts = contracts_mod.load_novena_contracts()
        contract = next(item for item in contracts if item.contract_id == "our_lady_of_fatima")
        runtime = contracts_mod.NovenaRuntime(
            family_id=contract.family_id,
            contract_id=contract.contract_id,
            saint=dict(contract.saint),
            feast=contract.feast.to_dict() if contract.feast is not None else {},
            novena=contract.novena.to_dict(),
            resolved_template=contract.novena.template,
            date=datetime.date(2026, 5, 4),
            active_day=1,
            publishing=contract.publishing.to_dict(),
            source_path=contract.source_path,
        )

        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['day']})")
        text = rendered["content"]["text"]

        self.assertEqual(text.count("Our Father, who art in heaven, hallowed be thy name."), 3)
        self.assertEqual(text.count("Hail Mary, full of grace, the Lord is with thee."), 3)
        self.assertEqual(text.count("Glory be to the Father, and to the Son, and to the Holy Spirit."), 3)
        self.assertEqual(text.count("You are going to say the following 3 times: Our Father"), 1)
        self.assertEqual(text.count("You are going to say the following 3 times: Hail Mary"), 1)
        self.assertEqual(text.count("You are going to say the following 3 times: Glory Be"), 1)
        self.assertEqual(len(rendered["audio_fragments"]), 16)

    def test_render_novena_holy_spirit_uses_once_once_and_seven_glory_be_sequence(self):
        contracts = contracts_mod.load_novena_contracts()
        contract = next(item for item in contracts if item.contract_id == "pentecost_sunday")
        runtime = contracts_mod.NovenaRuntime(
            family_id=contract.family_id,
            contract_id=contract.contract_id,
            saint=dict(contract.saint),
            feast=contract.feast.to_dict() if contract.feast is not None else {},
            novena=contract.novena.to_dict(),
            resolved_template=contract.novena.template,
            date=datetime.date(2026, 5, 15),
            active_day=1,
            publishing=contract.publishing.to_dict(),
            source_path=contract.source_path,
        )

        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['day']})")
        text = rendered["content"]["text"]

        self.assertEqual(text.count("Our Father, who art in heaven, hallowed be thy name."), 1)
        self.assertEqual(text.count("Hail Mary, full of grace, the Lord is with thee."), 1)
        self.assertEqual(text.count("Glory be to the Father, and to the Son, and to the Holy Spirit."), 7)

    def test_render_novena_traditional_st_anthony_has_no_colon_artifacts(self):
        contracts = contracts_mod.load_novena_contracts(contracts_mod.DEFAULT_FEAST_DIR / "st_anthony.json")
        contract = next(item for item in contracts if item.contract_id == "st_anthony")
        artifact_pattern = re.compile(r"\bcolon\b|(?:^|\n)\s*(?:Prayer|Reflection|Memorare):", re.IGNORECASE)

        for day in range(1, 10):
            runtime = contracts_mod.NovenaRuntime(
                family_id=contract.family_id,
                contract_id=contract.contract_id,
                saint=dict(contract.saint),
                feast=contract.feast.to_dict() if contract.feast is not None else {},
                novena=contract.novena.to_dict(),
                resolved_template=contract.novena.template,
                date=datetime.date(2026, 6, 3) + datetime.timedelta(days=day - 1),
                active_day=day,
                publishing=contract.publishing.to_dict(),
                source_path=contract.source_path,
            )
            rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['day']})")

            for fragment in rendered["audio_fragments"]:
                self.assertNotRegex(str(fragment.get("text", "")), artifact_pattern)

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
                {"saint_name": "Saint Example", "feast_name": "Example Feast", "day": 4, "theme": "hope", "daily_focus": "hope"},
            )

        self.assertEqual(text, "O Sacred Heart, make our hearts like yours.")
        self.assertEqual(captured["client_kwargs"]["api_key"], "test-key")
        self.assertEqual(captured["client_kwargs"]["base_url"], "https://api.openai.com/v1")
        self.assertEqual(captured["responses_create"]["model"], "gpt-test")
        self.assertEqual(captured["responses_create"]["temperature"], 0)
        system_message = captured["responses_create"]["input"][0]["content"][0]["text"]
        user_message = captured["responses_create"]["input"][1]["content"][0]["text"]
        self.assertIn("1-2 sentence introduction to the saint", system_message)
        self.assertIn("Saint: Saint Example", user_message)
        self.assertIn("Feast: Example Feast", user_message)
        self.assertIn("Daily focus: hope", user_message)
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
                return type("Response", (), {"output_text": f"{user_prompt} Amen."})()

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

    def test_generate_text_rejects_prompt_like_chat_fallback(self):
        class FakeResponses:
            def create(self, **kwargs):
                return type("Response", (), {"output_text": ""})()

        class FakeChatCompletions:
            def create(self, **kwargs):
                user_prompt = kwargs["messages"][1]["content"]
                return type(
                    "Chat",
                    (),
                    {
                        "choices": [
                            type(
                                "Choice",
                                (),
                                {"message": type("Message", (), {"content": f"{user_prompt} plus a prayer"})()},
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
            with self.assertRaises(RuntimeError) as ctx:
                engine_mod.generate_text(
                    "Compose the novena prayer.",
                    {"saint_name": "Saint Example", "feast_name": "Example Feast", "day": 4, "theme": "hope"},
                )

        self.assertIn("echoed the prompt", str(ctx.exception))
