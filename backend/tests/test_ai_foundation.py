from app.v2.ai.graph import build_analysis_graph


def test_bounded_analysis_graph_runs_steps_in_order() -> None:
    def quality(_state):
        return {"data_quality": {"ready": True}}

    def metrics(_state):
        return {"metrics": {"net_cash_flow": "1200.00"}}

    def investigate(_state):
        return {"investigation_round": 1, "findings": [{"title": "Checked baseline"}]}

    def validate(_state):
        return {"findings": [{"title": "Checked baseline", "validated": True}]}

    graph = build_analysis_graph(quality, metrics, investigate, validate)
    result = graph.invoke({"dataset_version_id": "dataset-v1"})

    assert result["data_quality"] == {"ready": True}
    assert result["metrics"] == {"net_cash_flow": "1200.00"}
    assert result["findings"] == [{"title": "Checked baseline", "validated": True}]
