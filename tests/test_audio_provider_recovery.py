import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import openai
import requests

try:
    import httpx2 as httpx
except ImportError:
    import httpx

from tests.test_helpers import load_module, make_test_mp3_bytes, temp_env


class TestAudioProviderRecovery(unittest.TestCase):
    def setUp(self):
        self.audio = load_module("jobs/publish/audio.py")

    def connection_error(self):
        error = openai.APIConnectionError(request=httpx.Request("POST", "https://example.test"))
        error.__cause__ = httpx.ConnectTimeout("SECRET request contents")
        return error

    def test_sdk_timeout_constructs_real_client_without_network(self):
        with self.audio.OpenAI(
            api_key="test-key", max_retries=0,
            timeout=self.audio.Timeout(300, connect=15),
        ) as client:
            self.assertEqual(client.timeout.connect, 15)
            self.assertEqual(client.timeout.read, 300)

    def http_error(self, status, body):
        response = requests.Response()
        response.status_code = status
        response._content = json.dumps(body).encode()
        return requests.HTTPError("SECRET request contents", response=response)

    def test_openai_recovers_with_fresh_client_and_no_nested_retries(self):
        clients = [Mock(), Mock()]
        for client in clients:
            client.__enter__ = Mock(return_value=client)
            client.__exit__ = Mock(return_value=False)
        clients[0].audio.speech.create.side_effect = self.connection_error()
        clients[1].audio.speech.create.return_value.content = b"audio"
        with temp_env({"OPENAI_API_KEY": "SECRET"}), patch.object(
            self.audio, "OpenAI", side_effect=clients
        ) as factory, patch("time.sleep") as sleep:
            with self.assertLogs(self.audio.logger, level="WARNING") as logs:
                result = self.audio.openai_tts_renderer("private prayer", {})
        self.assertEqual(result, b"audio")
        self.assertEqual(factory.call_count, 2)
        for call in factory.call_args_list:
            self.assertEqual(call.kwargs["max_retries"], 0)
            self.assertEqual(call.kwargs["timeout"].connect, 15)
            self.assertEqual(call.kwargs["timeout"].read, 300)
        self.assertEqual(sleep.call_count, 1)
        self.assertIn("ConnectTimeout", " ".join(logs.output))
        self.assertNotIn("SECRET", " ".join(logs.output))
        self.assertNotIn("private prayer", " ".join(logs.output))
        for client in clients:
            client.__exit__.assert_called_once()

    def test_elevenlabs_retries_temporary_errors_and_stops_after_three_attempts(self):
        for status in (408, 409, 429, 500, 503):
            with self.subTest(status=status), temp_env({"ELEVENLABS_API_KEY": "SECRET"}), patch.object(
                self.audio.requests, "post", side_effect=self.http_error(status, {})
            ) as post, patch("time.sleep") as sleep:
                with self.assertRaises(RuntimeError) as raised:
                    self.audio.elevenlabs_tts_renderer("private prayer", {"voice_id": "voice"})
                self.assertEqual(post.call_count, 3)
                self.assertEqual(sleep.call_count, 2)
                self.assertIn(str(status), str(raised.exception))
                self.assertNotIn("SECRET", str(raised.exception))

    def test_permanent_rejection_includes_code_without_response_prose(self):
        for status in (400, 401, 403, 422):
            error = self.http_error(status, {"detail": {"status": "voice_not_found", "message": "SECRET"}})
            with self.subTest(status=status), temp_env({"ELEVENLABS_API_KEY": "SECRET"}), patch.object(
                self.audio.requests, "post", side_effect=error
            ) as post, patch("time.sleep") as sleep:
                with self.assertRaises(RuntimeError) as raised:
                    self.audio.elevenlabs_tts_renderer("private prayer", {"voice_id": "voice"})
                post.assert_called_once()
                sleep.assert_not_called()
                self.assertIn("voice_not_found", str(raised.exception))
                self.assertNotIn("SECRET", str(raised.exception))

    def test_elevenlabs_connection_recovers(self):
        response = Mock(content=b"audio")
        with temp_env({"ELEVENLABS_API_KEY": "SECRET"}), patch.object(
            self.audio.requests, "post", side_effect=[requests.Timeout("SECRET"), response]
        ) as post, patch("time.sleep"):
            self.assertEqual(self.audio.elevenlabs_tts_renderer("prayer", {"voice_id": "voice"}), b"audio")
        self.assertEqual(post.call_count, 2)
        self.assertEqual(post.call_args.kwargs["timeout"], (15, 120))

    def test_openai_http_status_retry_policy(self):
        for status, attempts in ((400, 1), (401, 1), (429, 3), (503, 3)):
            error = openai.APIStatusError(
                "SECRET", response=httpx.Response(status, request=httpx.Request("POST", "https://example.test"),
                                                   json={"error": {"code": "rate_limit_exceeded", "message": "SECRET"}}),
                body=None,
            )
            request = Mock(side_effect=error)
            with self.subTest(status=status), patch("time.sleep"):
                with self.assertRaises(RuntimeError) as raised:
                    self.audio._request_audio_with_retry("openai", request)
                self.assertEqual(request.call_count, attempts)
                self.assertIn("rate_limit_exceeded", str(raised.exception))
                self.assertNotIn("SECRET", str(raised.exception))

    def test_diagnostics_handle_non_json_and_unexpected_bodies(self):
        for body in (None, [], {"detail": []}, {"detail": {"status": "SECRET prose\n"}}):
            with self.subTest(body=body):
                self.assertEqual(self.audio._audio_request_error(self.http_error(400, body)),
                                 "causes=HTTPError http_status=400")
        error = self.http_error(502, {})
        error.response._content = b"<html>SECRET gateway page</html>"
        self.assertEqual(self.audio._audio_request_error(error), "causes=HTTPError http_status=502")

    def test_fallback_after_openai_exhaustion_and_total_failure_writes_no_fragment(self):
        for fallback_success in (True, False):
            client = Mock()
            client.__enter__ = Mock(return_value=client)
            client.__exit__ = Mock(return_value=False)
            client.audio.speech.create.side_effect = self.connection_error()
            response = Mock(content=make_test_mp3_bytes())
            if not fallback_success:
                response.raise_for_status.side_effect = self.http_error(400, {"detail": {"status": "voice_not_found"}})
            with self.subTest(fallback_success=fallback_success), tempfile.TemporaryDirectory() as directory, temp_env(
                {"OPENAI_API_KEY": "SECRET", "ELEVENLABS_API_KEY": "SECRET"}
            ), patch.object(self.audio, "OpenAI", return_value=client) as factory, patch.object(
                self.audio.requests, "post", return_value=response
            ) as post, patch("time.sleep"):
                def render():
                    return self.audio.render_fragment_audio_with_provider_fallback(
                        {"fragment_key": "seelos/intro", "kind": "inline", "text": "Pray for us."},
                        {"providers": [{"provider": "openai"}, {"provider": "elevenlabs", "voice_id": "voice"}]},
                        None, cache_root=Path(directory), force_rebuild=False,
                    )
                if fallback_success:
                    result = render()
                    self.assertEqual(result["provider"], "elevenlabs")
                    self.assertTrue(Path(result["audio_path"]).exists())
                else:
                    with self.assertRaisesRegex(RuntimeError, "All audio providers failed") as raised:
                        render()
                    self.assertIn("ConnectTimeout", str(raised.exception))
                    self.assertIn("voice_not_found", str(raised.exception))
                    self.assertNotIn("SECRET", str(raised.exception))
                    self.assertEqual(list(Path(directory).rglob("*.mp3")), [])
                self.assertEqual(factory.call_count, 3)
                post.assert_called_once()
