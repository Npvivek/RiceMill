from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest

from app.v2.ai.tools import AnalysisInputError, AnalysisTools, DatasetSnapshot, LedgerRow

USER = uuid4()
OTHER = uuid4()
VERSION = uuid4()
IMPORT = uuid4()


class SeededReader:
    def __init__(self, rows):
        self.rows = tuple(rows)
        self.calls = 0

    def load(self, user_id, version_id):
        self.calls += 1
        if user_id != USER or version_id != VERSION:
            raise PermissionError("Foreign or uncommitted dataset")
        return DatasetSnapshot(VERSION, IMPORT, self.rows, 1, 0)


def row(day, direction, amount, description="rice", category="Sales"):
    return LedgerRow(uuid4(), uuid4(), date(2026, 9, day), description, direction,
                     Decimal(amount), category, "Sheet1", day)


def test_cash_flow_uses_decimal_and_never_calls_it_profit():
    reader = SeededReader([row(1, "income", "0.10"), row(2, "income", "0.20"),
                           row(3, "expense", "0.05")])
    tools = AnalysisTools(reader, USER)
    result = tools.summarize_cash_flow(VERSION, (date(2026, 9, 1), date(2026, 9, 30)))
    assert result["income"] == "0.30"
    assert result["expense"] == "0.05"
    assert result["net_cash_flow"] == "0.25"
    assert "not profit" in result["limitation"]
    assert len(result["sample_source_refs"]) == 3


def test_zero_baseline_is_undefined_and_unequal_periods_rejected():
    tools = AnalysisTools(SeededReader([row(20, "income", "10.00")]), USER)
    result = tools.compare_periods(VERSION, (date(2026, 9, 1), date(2026, 9, 7)),
                                   (date(2026, 9, 15), date(2026, 9, 21)))
    assert result["percent_change"] is None
    assert "Zero baseline" in result["percent_change_reason"]
    assert result["incomplete_months"] is True
    with pytest.raises(AnalysisInputError):
        tools.compare_periods(VERSION, (date(2026, 9, 1), date(2026, 9, 7)),
                              (date(2026, 9, 15), date(2026, 9, 22)))


def test_duplicate_unusual_and_category_results_are_bounded():
    rows = [row(1, "income", "10.00") for _ in range(6)]
    rows.append(row(2, "expense", "100.00", "repair", "Maintenance"))
    tools = AnalysisTools(SeededReader(rows), USER)
    assert len(tools.find_duplicate_candidates(VERSION)["candidates"]) == 1
    unusual = tools.find_unusual_entries(VERSION, {"multiplier": "3"})
    assert unusual["candidates"][0]["amount"] == "100.00"
    categories = tools.breakdown_by_category(VERSION, (date(2026, 9, 1), date(2026, 9, 30)))
    assert categories["categories"][0]["amount"] == "100.00"
    assert len(tools.get_transactions(VERSION, cursor=0, limit=2)["items"]) == 2
    with pytest.raises(AnalysisInputError):
        tools.get_transactions(VERSION, limit=101)
    with pytest.raises(AnalysisInputError):
        tools.find_unusual_entries(VERSION, {"multiplier": "100"})
    with pytest.raises(AnalysisInputError):
        tools.find_unusual_entries(VERSION, {"multiplier": "NaN"})


def test_each_tool_rechecks_authorized_committed_version():
    reader = SeededReader([])
    tools = AnalysisTools(reader, OTHER)
    calls = (
        lambda: tools.get_data_quality(VERSION),
        lambda: tools.summarize_cash_flow(VERSION, (date(2026, 9, 1), date(2026, 9, 2))),
        lambda: tools.compare_periods(VERSION, (date(2026, 9, 1), date(2026, 9, 2)),
                                      (date(2026, 9, 3), date(2026, 9, 4))),
        lambda: tools.breakdown_by_category(VERSION, (date(2026, 9, 1), date(2026, 9, 2))),
        lambda: tools.get_transactions(VERSION),
        lambda: tools.find_duplicate_candidates(VERSION),
        lambda: tools.find_unusual_entries(VERSION, {}),
    )
    for call in calls:
        with pytest.raises(PermissionError):
            call()
    assert reader.calls == len(calls)
