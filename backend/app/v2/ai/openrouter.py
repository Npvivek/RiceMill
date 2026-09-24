"""Small, bounded OpenRouter adapter; model text and tool requests are untrusted."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx

MODEL = "inclusionai/ling-3.0-flash-fin:free"
ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


class ProviderUnavailable(Exception):
    """A rate limit, server error, or transport failure permits static fallback."""


class ProviderRejected(Exception):
    """The configured provider or its response is invalid; do not expose details."""


@dataclass(frozen=True)
class ModelToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ModelReply:
    content: str
    tool_calls: tuple[ModelToolCall, ...]


class OpenRouterClient:
    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        if not api_key:
            raise ProviderRejected("AI provider is not configured.")
        self._api_key = api_key
        self._client = client or httpx.Client(timeout=httpx.Timeout(25.0, connect=5.0))
        self._owns_client = client is None

    def __enter__(self) -> OpenRouterClient:
        return self

    def __exit__(self, *_: object) -> None:
        if self._owns_client:
            self._client.close()

    def complete(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]],
                 tool_choice: str) -> ModelReply:
        if len(json.dumps(messages, ensure_ascii=False)) > 48_000:
            raise ProviderRejected("AI context exceeds its safe limit.")
        try:
            response = self._client.post(
                ENDPOINT,
                headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                json={"model": MODEL, "messages": messages, "tools": tools,
                      "tool_choice": tool_choice, "parallel_tool_calls": False,
                      "max_tokens": 700, "temperature": 0, "stream": False},
            )
        except httpx.TransportError as error:
            raise ProviderUnavailable("AI provider is temporarily unavailable.") from error
        if response.status_code == 429 or response.status_code >= 500:
            raise ProviderUnavailable("AI provider is temporarily unavailable.")
        if response.status_code >= 400:
            raise ProviderRejected("AI provider rejected the request.")
        try:
            payload = response.json()
            message = payload["choices"][0]["message"]
            content = message.get("content") or ""
            raw_calls = message.get("tool_calls") or []
            if not isinstance(content, str) or not isinstance(raw_calls, list) or len(raw_calls) > 8:
                raise ValueError
            calls = []
            for item in raw_calls:
                call_id = item["id"]
                function = item["function"]
                name = function["name"]
                arguments = json.loads(function["arguments"])
                if (item.get("type") != "function" or not isinstance(call_id, str)
                        or not 1 <= len(call_id) <= 128 or not isinstance(name, str)
                        or not isinstance(arguments, dict)):
                    raise ValueError
                calls.append(ModelToolCall(call_id, name, arguments))
            return ModelReply(content, tuple(calls))
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise ProviderRejected("AI provider returned an invalid response.") from error
