import base64
import unittest

from jobs.novena.devotional_infographic import (
    InfographicCopy,
    extract_response_image_bytes,
    infographic_render_prompt,
    response_image_tool,
)


class _Item:
    def __init__(self, item_type, result=""):
        self.type = item_type
        self.result = result


class _Response:
    def __init__(self, output):
        self.output = output


class TestDevotionalInfographic(unittest.TestCase):
    def test_copy_requires_title_and_three_themes(self):
        copy = InfographicCopy(title="Saint Example", spiritual_themes=["Faith", "Hope", "Charity"])
        self.assertIn("Saint Example", copy.to_private_json())
        with self.assertRaises(RuntimeError):
            InfographicCopy(title="", spiritual_themes=[]).validate()
        with self.assertRaises(RuntimeError):
            InfographicCopy(title="Saint Example", spiritual_themes=["Faith"]).validate()

    def test_extracts_responses_image_tool_result(self):
        payload = base64.b64encode(b"png-bytes").decode("ascii")
        self.assertEqual(extract_response_image_bytes(_Response([_Item("message"), _Item("image_generation_call", payload)])), b"png-bytes")

    def test_image_tool_uses_gpt_image_2_compatible_options(self):
        tool = response_image_tool(size="1024x1536", quality="high")
        self.assertEqual(tool, {"type": "image_generation", "size": "1024x1536", "quality": "high"})

    def test_render_prompt_returns_approved_copy(self):
        copy = InfographicCopy(
            title="Saint Example",
            subtitle="Witness",
            feast_day="August 12",
            sections={"Who She Was": ["A faithful witness."]},
            spiritual_themes=["Faith", "Hope", "Charity"],
            footer="Pray for us.",
        )
        prompt = infographic_render_prompt(copy, subject_context="A religious sister.")
        self.assertIsInstance(prompt, str)
        self.assertIn("TITLE: Saint Example", prompt)
        self.assertIn("Who She Was:\n- A faithful witness.", prompt)
        self.assertIn("Never render citations", prompt)

    def test_visible_copy_rejects_urls_and_markdown_citations(self):
        with self.assertRaisesRegex(RuntimeError, "visible copy"):
            InfographicCopy(
                title="Saint Example",
                sections={"Who She Was": ["Born in Example ([source](https://example.test))."]},
                spiritual_themes=["Faith", "Hope", "Charity"],
            ).validate()
        with self.assertRaisesRegex(RuntimeError, "visible copy"):
            InfographicCopy(
                title="Saint Example",
                sections={"Who She Was": ["Born in Example (sources differ on the year)."]},
                spiritual_themes=["Faith", "Hope", "Charity"],
            ).validate()

    def test_parse_copy_requires_cited_validated_json(self):
        payload = {
            "title": "Saint Example", "subtitle": "Witness", "feast_day": "August 12",
            "sections": {"Who He Was": ["A faithful witness."]},
            "spiritual_themes": ["Faith", "Hope", "Charity"], "footer": "Pray for us.",
            "sources": [{"title": "Official source", "url": "https://example.test/saint"}],
        }
        from jobs.novena.devotional_infographic import parse_infographic_copy
        self.assertEqual(parse_infographic_copy(__import__("json").dumps(payload)).title, "Saint Example")
        payload["sources"] = []
        with self.assertRaises(RuntimeError):
            parse_infographic_copy(__import__("json").dumps(payload))

    def test_parse_copy_accepts_standard_source_url_aliases(self):
        payload = {
            "title": "Saint Example", "sections": {}, "spiritual_themes": [], "sources": [{"name": "Official", "href": "https://example.test/saint"}],
        }
        from jobs.novena.devotional_infographic import parse_infographic_copy
        self.assertEqual(parse_infographic_copy(__import__("json").dumps(payload)).sources[0]["url"], "https://example.test/saint")

    def test_qa_result_requires_explicit_decision(self):
        from jobs.novena.devotional_infographic import parse_qa_result
        self.assertTrue(parse_qa_result('{"approved": true, "issues": []}')["approved"])
        with self.assertRaises(RuntimeError):
            parse_qa_result('{"issues": []}')

    def test_qa_prompt_keeps_private_sources_out_of_visible_copy(self):
        from jobs.novena.devotional_infographic import infographic_qa_prompt
        copy = InfographicCopy(
            title="Saint Example",
            spiritual_themes=["Faith", "Hope", "Charity"],
            sources=[{"title": "Private source", "url": "https://example.test/saint"}],
        )
        prompt = infographic_qa_prompt(copy)
        self.assertIn("visible citations", prompt)
        self.assertNotIn("https://example.test/saint", prompt)
        self.assertNotIn("Private source", copy.to_public_json())


if __name__ == "__main__":
    unittest.main()
