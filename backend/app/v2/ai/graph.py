from collections.abc import Callable
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph


class AnalysisState(TypedDict, total=False):
    dataset_version_id: str
    data_quality: dict[str, Any]
    metrics: dict[str, Any]
    investigation_round: int
    findings: list[dict[str, Any]]


AnalysisStep = Callable[[AnalysisState], dict[str, Any]]


def build_analysis_graph(
    assess_quality: AnalysisStep,
    compute_metrics: AnalysisStep,
    investigate: AnalysisStep,
    validate_findings: AnalysisStep,
):
    """Build the bounded deterministic workflow from injected analysis steps."""
    graph = StateGraph(AnalysisState)
    graph.add_node("assess_quality", assess_quality)
    graph.add_node("compute_metrics", compute_metrics)
    graph.add_node("investigate", investigate)
    graph.add_node("validate_findings", validate_findings)
    graph.add_edge(START, "assess_quality")
    graph.add_edge("assess_quality", "compute_metrics")
    graph.add_edge("compute_metrics", "investigate")
    graph.add_edge("investigate", "validate_findings")
    graph.add_edge("validate_findings", END)
    return graph.compile()
