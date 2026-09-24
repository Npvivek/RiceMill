from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.v2.ai.graph import DeterministicNodes, build_analysis_graph
from app.v2.ai.tools import AnalysisInputError, AnalysisTools
from tests.test_analysis_tools import USER, VERSION, SeededReader, row


def state():
    return {"run_id": str(uuid4()), "dataset_version_id": str(VERSION),
            "deadline": (datetime.now(UTC) + timedelta(seconds=180)).isoformat()}


def test_four_node_graph_produces_validated_findings():
    tools = AnalysisTools(SeededReader([row(1, "income", "100.00"), row(2, "expense", "20.00")]), USER)
    nodes = DeterministicNodes(tools)
    result = build_analysis_graph(nodes.assess_quality, nodes.compute_metrics,
                                  nodes.investigate, nodes.validate_findings).invoke(state())
    assert result["investigation_round"] == 1
    assert len(result["tool_calls"]) == 4
    assert result["findings"][0]["title"] == "Recorded cash flow"
    assert result["findings"][0]["source_refs"]
    assert result["findings"][1]["type"] == "data_quality"


def test_dangling_source_and_metric_are_rejected():
    tools = AnalysisTools(SeededReader([row(1, "income", "1.00")]), USER)
    nodes = DeterministicNodes(tools)
    base = state()
    base.update({"tool_calls": [{"id": str(uuid4())}], "findings": [{
        "type": "observation", "severity": "info", "title": "Orphan",
        "explanation": "Orphan reference", "metric_refs": [str(uuid4())],
        "source_refs": [str(uuid4())], "limitations": "Synthetic",
    }]})
    with pytest.raises(AnalysisInputError, match="unresolved"):
        nodes.validate_findings(base)


def test_call_round_and_deadline_budgets_enforced():
    nodes = DeterministicNodes(AnalysisTools(SeededReader([row(1, "income", "1.00")]), USER))
    base = state()
    base["tool_calls"] = [{}] * 8
    with pytest.raises(AnalysisInputError, match="eight"):
        nodes.assess_quality(base)
    base = state()
    base["investigation_round"] = 3
    with pytest.raises(AnalysisInputError, match="two"):
        nodes.validate_findings(base)
    base = state()
    base["deadline"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
    with pytest.raises(TimeoutError):
        nodes.assess_quality(base)


def test_numeric_prose_is_rejected_even_with_valid_references():
    source = row(1, "income", "100.00")
    nodes = DeterministicNodes(AnalysisTools(SeededReader([source]), USER))
    base = state()
    metric_id = str(uuid4())
    base["tool_calls"] = [{"id": metric_id}]
    base["findings"] = [{"type": "observation", "severity": "info", "title": "Sales",
                         "explanation": "Income rose by 50 percent.", "metric_refs": [metric_id],
                         "source_refs": [str(source.id)], "limitations": "Synthetic"}]
    with pytest.raises(AnalysisInputError, match="numeric"):
        nodes.validate_findings(base)
