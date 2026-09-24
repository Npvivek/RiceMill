from uuid import uuid4

from langgraph.checkpoint.memory import MemorySaver
import pytest

from app.v2.ai.chat_graph import ToolDispatcher, run_turn
from app.v2.ai.conversations import scoped_chat_checkpointer
from app.v2.ai.openrouter import ModelReply, ModelToolCall, ProviderUnavailable


class Reader:
    def load(self, user_id, version_id):
        from app.v2.ai.tools import DatasetSnapshot, LedgerRow
        from datetime import date
        from decimal import Decimal
        row = LedgerRow(uuid4(), uuid4(), date(2026, 9, 20), "pd 4 trck rpr", "expense",
                        Decimal("120.00"), "other", "Cash", 4)
        return DatasetSnapshot(version_id, uuid4(), (row,), 0, 0)


class ScriptedModel:
    def __init__(self, replies):
        self.replies = iter(replies)

    def complete(self, messages, tools, tool_choice):
        result = next(self.replies)
        if isinstance(result, Exception):
            raise result
        return result


def dispatcher():
    from app.v2.ai.tools import AnalysisTools
    user_id, version_id = uuid4(), uuid4()
    return ToolDispatcher(AnalysisTools(Reader(), user_id), version_id)


def test_anomaly_mode_forces_raw_row_read_then_validates_description() -> None:
    model = ScriptedModel([ModelReply('Review <cite ref="T1.items.0.description">pd 4 trck rpr</cite>.', ())])
    result = run_turn(mode="anomalies", history=[{"role": "user", "content": "Inspect descriptions"}],
                      dispatcher=dispatcher(), model=model)
    assert result.kind == "normal"
    assert result.segments[1].source_ref is not None


def test_uncited_math_abstains_without_persisting_draft() -> None:
    model = ScriptedModel([
        ModelReply("", (ModelToolCall("a", "get_data_quality", {}),)),
        ModelReply("There are 999 rows.", ()),
    ])
    result = run_turn(mode="anomalies", history=[{"role": "user", "content": "Inspect"}],
                      dispatcher=dispatcher(), model=model)
    assert result.kind == "abstained"
    assert "999" not in result.content


def test_provider_rate_limit_returns_explicit_fallback() -> None:
    result = run_turn(mode="anomalies", history=[{"role": "user", "content": "Inspect"}],
                      dispatcher=dispatcher(), model=ScriptedModel([ProviderUnavailable()]))
    assert result.kind == "fallback"
    assert "deterministic insights" in result.content


def test_chat_checkpoint_contains_only_bounded_history_and_phase() -> None:
    saver = MemorySaver()
    thread = uuid4()
    model = ScriptedModel([
        ModelReply("", (ModelToolCall("a", "get_data_quality", {}),)),
        ModelReply('Rows: <cite ref="T1.transaction_count">1</cite>.', ()),
    ])
    result = run_turn(mode="chat", history=[{"role": "user", "content": "How many rows?"}],
                      dispatcher=dispatcher(), model=model, checkpointer=saver, thread_id=thread)
    assert result.kind == "normal"
    checkpoint = saver.get({"configurable": {"thread_id": str(thread)}})
    assert checkpoint is not None
    persisted = checkpoint["channel_values"]
    assert set(persisted) <= {"history", "phase"}
    assert "evidence" not in str(persisted)


def test_checkpointer_rejects_privileged_database_role() -> None:
    with pytest.raises(ValueError):
        with scoped_chat_checkpointer("postgresql+psycopg://postgres@localhost/postgres", uuid4()):
            pytest.fail("Privileged role must not open a checkpoint connection")
