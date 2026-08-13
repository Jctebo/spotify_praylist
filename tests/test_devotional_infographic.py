import base64
import unittest

from jobs.novena.devotional_infographic import InfographicCopy, extract_response_image_bytes, response_image_tool


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

    def test_image_tool_uses_high_reference_fidelity(self):
        self.assertEqual(response_image_tool(size="1024x1536", quality="high")["input_fidelity"], "high")

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

    def test_qa_result_requires_explicit_decision(self):
        from jobs.novena.devotional_infographic import parse_qa_result
        self.assertTrue(parse_qa_result('{"approved": true, "issues": []}')["approved"])
        with self.assertRaises(RuntimeError):
            parse_qa_result('{"issues": []}')


if __name__ == "__main__":
    unittest.main()
