import httpx
import pytest

from app.v2.ai.openrouter import OpenRouterClient, ProviderRejected, ProviderUnavailable


@pytest.mark.parametrize("status", [429, 500, 503])
def test_rate_limit_and_server_failure_use_fallback(status: int) -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(status))
    with httpx.Client(transport=transport) as client, OpenRouterClient("test-only", client) as model:
        with pytest.raises(ProviderUnavailable):
            model.complete([{"role": "user", "content": "hi"}], [], "auto")


def test_malformed_provider_reply_is_rejected() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"choices": []}))
    with httpx.Client(transport=transport) as client, OpenRouterClient("test-only", client) as model:
        with pytest.raises(ProviderRejected):
            model.complete([], [], "auto")


def test_tool_calls_are_structured_and_bounded() -> None:
    reply = {"choices": [{"message": {"content": "", "tool_calls": [{"id": "a", "type": "function",
        "function": {"name": "get_data_quality", "arguments": "{}"}}]}}]}
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json=reply))
    with httpx.Client(transport=transport) as client, OpenRouterClient("test-only", client) as model:
        assert model.complete([], [], "required").tool_calls[0].name == "get_data_quality"
