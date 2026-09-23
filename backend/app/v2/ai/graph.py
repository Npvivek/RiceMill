"""Four deterministic LangGraph stages; persistence is injected at node boundaries."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict
from uuid import UUID, uuid5

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.v2.ai.tools import AnalysisInputError, AnalysisTools

MAX_TOOL_CALLS = 8
MAX_INVESTIGATION_ROUNDS = 2
MAX_ACTIVE_SECONDS = 180


class AnalysisState(TypedDict, total=False):
    run_id: str
    dataset_version_id: str
    deadline: str
    stage: str
    data_quality: dict[str, Any]
    metrics: dict[str, Any]
    investigation_round: int
    tool_calls: list[dict[str, Any]]
    findings: list[dict[str, Any]]


AnalysisStep = Callable[[AnalysisState], dict[str, Any]]


class FindingDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["observation", "hypothesis", "data_quality"]
    severity: Literal["info", "review", "important"]
    title: str = Field(min_length=1, max_length=180)
    explanation: str = Field(min_length=1, max_length=4000)
    metric_refs: list[str] = Field(min_length=1)
    source_refs: list[str] = Field(min_length=1)
    limitations: str = Field(min_length=1)
    suggested_check: str | None = None


def build_analysis_graph(
    assess_quality: AnalysisStep,
    compute_metrics: AnalysisStep,
    investigate: AnalysisStep,
    validate_findings: AnalysisStep,
):
    graph = StateGraph(AnalysisState)
    graph.add_node("assess_quality", assess_quality)  # type: ignore[call-overload]
    graph.add_node("compute_metrics", compute_metrics)  # type: ignore[call-overload]
    graph.add_node("investigate", investigate)  # type: ignore[call-overload]
    graph.add_node("validate_findings", validate_findings)  # type: ignore[call-overload]
    graph.add_edge(START, "assess_quality")
    graph.add_edge("assess_quality", "compute_metrics")
    graph.add_edge("compute_metrics", "investigate")
    graph.add_edge("investigate", "validate_findings")
    graph.add_edge("validate_findings", END)
    return graph.compile()


class DeterministicNodes:
    def __init__(self, tools: AnalysisTools) -> None:
        self.tools = tools

    @staticmethod
    def _check(state: AnalysisState) -> None:
        if datetime.now(timezone.utc) >= datetime.fromisoformat(state["deadline"]):
            raise TimeoutError("Analysis exceeded 180 active seconds.")

    def _call(self, state: AnalysisState, name: str, arguments: dict[str, Any],
              invoke: Callable[[], dict[str, Any]]) -> dict[str, Any]:
        self._check(state)
        calls = state.get("tool_calls", [])
        if len(calls) >= MAX_TOOL_CALLS:
            raise AnalysisInputError("Analysis exceeded eight tool calls.")
        result = invoke()
        self._check(state)
        tool_id = uuid5(UUID(state["run_id"]), f"{len(calls)}:{name}")
        return {"id": str(tool_id), "tool_name": name, "input": arguments, "result": result}

    def assess_quality(self, state: AnalysisState) -> dict[str, Any]:
        version = UUID(state["dataset_version_id"])
        call = self._call(state, "get_data_quality", {}, lambda: self.tools.get_data_quality(version))
        return {"data_quality": call["result"], "tool_calls": [*state.get("tool_calls", []), call]}

    def compute_metrics(self, state: AnalysisState) -> dict[str, Any]:
        version = UUID(state["dataset_version_id"])
        snapshot = self.tools.reader.load(self.tools.user_id, version)
        if not snapshot.rows:
            return {"metrics": {"empty": True}}
        first = min(row.transaction_date for row in snapshot.rows)
        last = max(row.transaction_date for row in snapshot.rows)
        call = self._call(state, "summarize_cash_flow", {"start": first.isoformat(), "end": last.isoformat()},
                          lambda: self.tools.summarize_cash_flow(version, (first, last)))
        return {"metrics": call["result"], "tool_calls": [*state.get("tool_calls", []), call]}

    def investigate(self, state: AnalysisState) -> dict[str, Any]:
        self._check(state)
        version = UUID(state["dataset_version_id"])
        calls = list(state.get("tool_calls", []))
        findings: list[dict[str, Any]] = []
        quality = state.get("data_quality", {})
        metrics = state.get("metrics", {})
        if metrics.get("sample_source_refs"):
            metric = next(call for call in calls if call["tool_name"] == "summarize_cash_flow")
            quality_metric = next(call for call in calls if call["tool_name"] == "get_data_quality")
            findings.append({"type": "observation", "severity": "info", "title": "Recorded cash flow",
                             "explanation": "The recorded income and expenses produce the cash-flow totals in the linked calculation. Cash flow is not profit.",
                             "metric_refs": [metric["id"], quality_metric["id"]],
                             "source_refs": metrics["sample_source_refs"],
                             "limitations": "This workbook may omit non-cash costs, inventory, and other accounts."
                             + (" Some source rows were excluded during import." if quality.get("excluded_count", 0) else ""),
                             "suggested_check": "Reconcile these entries with the bank and cash book."})
        if 0 < quality.get("transaction_count", 0) < 5 and quality.get("sample_source_refs"):
            metric = next(call for call in calls if call["tool_name"] == "get_data_quality")
            findings.append({"type": "data_quality", "severity": "review", "title": "Small transaction sample",
                             "explanation": "This workbook has few committed transactions, so patterns may be unstable.",
                             "metric_refs": [metric["id"]], "source_refs": quality["sample_source_refs"][:1],
                             "limitations": "A small sample cannot establish a recurring pattern.",
                             "suggested_check": "Check that the workbook covers the intended period."})
        # Fixed rules: duplicate and relative-size checks run once each. A second round
        # is permitted by the budget but not used unless a future deterministic rule needs it.
        for name, invoke in (
            ("find_duplicate_candidates", lambda: self.tools.find_duplicate_candidates(version)),
            ("find_unusual_entries", lambda: self.tools.find_unusual_entries(version, {"multiplier": "3"})),
        ):
            transient: AnalysisState = {**state, "tool_calls": calls}
            call = self._call(transient, name, {"multiplier": "3"} if name == "find_unusual_entries" else {}, invoke)
            calls.append(call)
            candidates = call["result"]["candidates"]
            if candidates:
                first = candidates[0]
                refs = first.get("source_refs", [first.get("source_ref")])
                findings.append({"type": "hypothesis", "severity": "review",
                                 "title": "Possible duplicate entries" if name == "find_duplicate_candidates" else "Unusually large entry",
                                 "explanation": "The linked entries meet a deterministic review rule; this does not establish an error or cause.",
                                 "metric_refs": [call["id"]], "source_refs": refs,
                                 "limitations": call["result"]["limitation"],
                                 "suggested_check": "Compare the original voucher and bank record."})
        return {"investigation_round": 1, "tool_calls": calls, "findings": findings}

    def validate_findings(self, state: AnalysisState) -> dict[str, Any]:
        self._check(state)
        if state.get("investigation_round", 0) > MAX_INVESTIGATION_ROUNDS:
            raise AnalysisInputError("Analysis exceeded two investigation rounds.")
        version = UUID(state["dataset_version_id"])
        snapshot = self.tools.reader.load(self.tools.user_id, version)
        valid_sources = {str(row.id) for row in snapshot.rows}
        valid_metrics = {call["id"] for call in state.get("tool_calls", [])}
        validated: list[dict[str, Any]] = []
        for candidate in state.get("findings", []):
            try:
                finding = FindingDraft.model_validate(candidate)
            except ValidationError as error:
                raise AnalysisInputError("Finding does not match the structured contract.") from error
            if (not set(finding.metric_refs).issubset(valid_metrics)
                    or not set(finding.source_refs).issubset(valid_sources)):
                raise AnalysisInputError("Finding has an unresolved metric or source reference.")
            validated.append(finding.model_dump())
        return {"findings": validated}
