"""Restricted Postgres adapter and durable deterministic analysis runs."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4, uuid5

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.v2.ai.graph import MAX_ACTIVE_SECONDS, DeterministicNodes, AnalysisState, build_analysis_graph
from app.v2.ai.tools import AnalysisTools, DatasetSnapshot, LedgerRow
from app.v2.checkpoints import put_checkpoint
from app.v2.imports.models import ImportFailure
from app.v2.imports.service import PostgresImportRepository
from app.v2.workspaces import WorkspaceAccess

GRAPH_VERSION = "d1"
PROMPT_VERSION = "rules-1"
MODEL_ID = "deterministic"
MAX_ATTEMPTS = 3
STAGES = ("assess_quality", "compute_metrics", "investigate", "validate_findings")


class AnalysisFailure(Exception):
    def __init__(self, code: str, message: str, status_code: int = 409) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class PostgresAnalysisRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    @contextmanager
    def _session(self, user_id: UUID) -> Iterator[Session]:
        with Session(self.engine) as session, session.begin():
            session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"),
                            {"subject": str(user_id)})
            session.execute(text("select set_config('statement_timeout', '10000', true)"))
            yield session

    def _workspace(self, session: Session, user_id: UUID) -> WorkspaceAccess:
        try:
            workspace_id = PostgresImportRepository._workspace_id(session, user_id)
        except ImportFailure as error:
            raise AnalysisFailure(error.code, error.message, error.status_code) from error
        return WorkspaceAccess(workspace_id, "", "member")

    def _version(self, session: Session, workspace_id: UUID, version_id: UUID) -> dict[str, Any]:
        row = session.execute(text("""
            select v.id, v.import_id from public.dataset_versions v
            join public.imports i on i.id = v.import_id
            where v.id = :version and v.workspace_id = :workspace and i.workspace_id = :workspace
              and v.status = 'committed' and i.status = 'committed'
        """), {"version": version_id, "workspace": workspace_id}).mappings().first()
        if row is None:
            raise AnalysisFailure("version_not_found", "Committed dataset not found.", 404)
        return dict(row)

    def load(self, user_id: UUID, version_id: UUID) -> DatasetSnapshot:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            version = self._version(session, workspace.id, version_id)
            rows = session.execute(text("""
                select t.id, t.source_row_id, t.transaction_date, t.description, t.direction,
                       t.amount, t.category, s.sheet_name, s.row_number
                from public.transactions t
                join public.source_rows s on s.id = t.source_row_id and s.dataset_version_id = t.dataset_version_id
                where t.dataset_version_id = :version and t.workspace_id = :workspace
                order by t.transaction_date, t.id limit 10001
            """), {"version": version_id, "workspace": workspace.id}).mappings().all()
            counts = session.execute(text("""
                select count(*) filter (where parse_status = 'excluded') as excluded,
                       count(*) filter (where parse_status = 'review_required') as review
                from public.source_rows where dataset_version_id = :version
            """), {"version": version_id}).mappings().one()
            return DatasetSnapshot(version_id, version["import_id"], tuple(
                LedgerRow(row["id"], row["source_row_id"], row["transaction_date"], row["description"],
                          row["direction"], Decimal(row["amount"]), row["category"], row["sheet_name"],
                          row["row_number"]) for row in rows), counts["excluded"], counts["review"])

    def create(self, user_id: UUID, version_id: UUID) -> tuple[dict[str, Any], bool]:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            session.execute(text("""
                delete from public.graph_checkpoints c using public.analysis_runs r
                where c.analysis_run_id = r.id and r.workspace_id = :workspace
                  and r.status in ('completed', 'partial', 'failed', 'cancelled')
                  and r.completed_at < now() - interval '30 days'
            """), {"workspace": workspace.id})
            self._version(session, workspace.id, version_id)
            run_id = uuid4()
            created = session.execute(text("""
                insert into public.analysis_runs
                  (id, workspace_id, dataset_version_id, requested_by, graph_version, prompt_version, model_id, status)
                values (:id, :workspace, :version, :user, :graph, :prompt, :model, 'queued')
                on conflict (dataset_version_id, graph_version, prompt_version, model_id) do nothing
                returning id
            """), {"id": run_id, "workspace": workspace.id, "version": version_id, "user": user_id,
                   "graph": GRAPH_VERSION, "prompt": PROMPT_VERSION, "model": MODEL_ID}).scalar_one_or_none()
            if created is None:
                run_id = cast(UUID, session.execute(text("""
                    select id from public.analysis_runs where dataset_version_id = :version
                      and workspace_id = :workspace and graph_version = :graph
                      and prompt_version = :prompt and model_id = :model
                """), {"version": version_id, "workspace": workspace.id, "graph": GRAPH_VERSION,
                       "prompt": PROMPT_VERSION, "model": MODEL_ID}).scalar_one())
            return self._get(session, workspace.id, run_id), created is not None

    def _get(self, session: Session, workspace_id: UUID, run_id: UUID) -> dict[str, Any]:
        row = session.execute(text("""
            select id, dataset_version_id, status, attempt_count, active_lease_until,
                   error_code, error_message, started_at, completed_at, created_at
            from public.analysis_runs where id = :id and workspace_id = :workspace
        """), {"id": run_id, "workspace": workspace_id}).mappings().first()
        if row is None:
            raise AnalysisFailure("run_not_found", "Analysis run not found.", 404)
        result = dict(row)
        result["findings"] = [dict(item) for item in session.execute(text("""
            select id, finding_type as type, severity, title, explanation, metric_refs,
                   source_refs, limitations, suggested_check
            from public.findings where analysis_run_id = :run order by created_at, id
        """), {"run": run_id}).mappings()]
        result["tool_calls"] = [dict(item) for item in session.execute(text("""
            select id, tool_name, input, result, created_at from public.tool_results
            where analysis_run_id = :run order by created_at, id
        """), {"run": run_id}).mappings()]
        stage = session.execute(text("""
            select state ->> 'stage' from public.graph_checkpoints
            where analysis_run_id = :run order by created_at desc, id desc limit 1
        """), {"run": run_id}).scalar_one_or_none()
        result["stage"] = stage or ("queued" if row["status"] == "queued" else row["status"])
        return result

    def get(self, user_id: UUID, run_id: UUID) -> dict[str, Any]:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            return self._get(session, workspace.id, run_id)

    def list(self, user_id: UUID, version_id: UUID, page: int, page_size: int) -> dict[str, Any]:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            self._version(session, workspace.id, version_id)
            total = session.execute(text("""
                select count(*) from public.analysis_runs where workspace_id = :workspace
                  and dataset_version_id = :version
            """), {"workspace": workspace.id, "version": version_id}).scalar_one()
            ids = session.execute(text("""
                select id from public.analysis_runs where workspace_id = :workspace
                  and dataset_version_id = :version order by created_at desc, id desc
                  limit :limit offset :offset
            """), {"workspace": workspace.id, "version": version_id, "limit": page_size,
                   "offset": (page - 1) * page_size}).scalars().all()
            return {"items": [self._get(session, workspace.id, item) for item in ids],
                    "page": page, "page_size": page_size, "total": total}

    def claim(self, user_id: UUID, run_id: UUID) -> int | None:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            row = session.execute(text("""
                update public.analysis_runs set status = 'running', attempt_count = attempt_count + 1,
                    active_lease_until = now() + interval '180 seconds',
                    started_at = coalesce(started_at, now()), error_code = null, error_message = null
                where id = :run and workspace_id = :workspace and attempt_count < :max_attempts
                  and (status in ('queued', 'failed', 'partial')
                       or (status = 'running' and active_lease_until < now()))
                returning attempt_count
            """), {"run": run_id, "workspace": workspace.id, "max_attempts": MAX_ATTEMPTS}).scalar_one_or_none()
            return cast(int | None, row)

    def _active(self, session: Session, workspace_id: UUID, run_id: UUID, attempt: int) -> None:
        active = session.execute(text("""
            select 1 from public.analysis_runs where id = :run and workspace_id = :workspace
              and attempt_count = :attempt and status = 'running' and active_lease_until > now()
            for update
        """), {"run": run_id, "workspace": workspace_id, "attempt": attempt}).scalar_one_or_none()
        if active is None:
            raise AnalysisFailure("run_inactive", "Analysis was cancelled or its lease expired.")

    def latest_state(self, user_id: UUID, run_id: UUID) -> AnalysisState | None:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            self._get(session, workspace.id, run_id)
            row = session.execute(text("""
                select state from public.graph_checkpoints where analysis_run_id = :run
                order by created_at desc, id desc limit 1
            """), {"run": run_id}).scalar_one_or_none()
            return cast(AnalysisState | None, row)

    def checkpoint(self, user_id: UUID, run_id: UUID, attempt: int, state: AnalysisState) -> None:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            self._active(session, workspace.id, run_id, attempt)
            for call in state.get("tool_calls", []):
                session.execute(text("""
                    insert into public.tool_results (id, analysis_run_id, tool_name, input, result)
                    values (:id, :run, :name, :input, :result) on conflict (id) do nothing
                """).bindparams(bindparam("input", type_=JSONB), bindparam("result", type_=JSONB)),
                    {"id": UUID(call["id"]), "run": run_id, "name": call["tool_name"],
                     "input": call["input"], "result": call["result"]})
            parent = session.execute(text("""
                select id from public.graph_checkpoints where analysis_run_id = :run
                order by created_at desc, id desc limit 1
            """), {"run": run_id}).scalar_one_or_none()
            put_checkpoint(session, workspace, run_id, cast(dict[str, Any], state), parent)
            session.execute(text("""
                update public.analysis_runs set active_lease_until = now() + interval '180 seconds'
                where id = :run and workspace_id = :workspace and attempt_count = :attempt
            """), {"run": run_id, "workspace": workspace.id, "attempt": attempt})

    def finish(self, user_id: UUID, run_id: UUID, attempt: int, findings: Sequence[dict[str, Any]]) -> None:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            self._active(session, workspace.id, run_id, attempt)
            for index, finding in enumerate(findings):
                finding_id = uuid5(run_id, f"finding:{index}")
                session.execute(text("""
                    insert into public.findings
                      (id, analysis_run_id, finding_type, severity, title, explanation,
                       metric_refs, source_refs, limitations, suggested_check)
                    values (:id, :run, :type, :severity, :title, :explanation,
                            :metrics, :sources, :limitations, :suggested)
                    on conflict (id) do nothing
                """).bindparams(bindparam("metrics", type_=JSONB), bindparam("sources", type_=JSONB)),
                    {"id": finding_id, "run": run_id, "type": finding["type"], "severity": finding["severity"],
                     "title": finding["title"], "explanation": finding["explanation"],
                     "metrics": finding["metric_refs"], "sources": finding["source_refs"],
                     "limitations": finding["limitations"], "suggested": finding.get("suggested_check")})
            session.execute(text("""
                update public.analysis_runs set status = 'completed', active_lease_until = null,
                    completed_at = now() where id = :run and workspace_id = :workspace
                      and attempt_count = :attempt and status = 'running'
            """), {"run": run_id, "workspace": workspace.id, "attempt": attempt})

    def fail(self, user_id: UUID, run_id: UUID, attempt: int, code: str, message: str) -> None:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            checkpoints = session.execute(text("""
                select count(*) from public.graph_checkpoints where analysis_run_id = :run
            """), {"run": run_id}).scalar_one()
            status = "partial" if checkpoints and code in ("analysis_timeout", "analysis_unavailable") else "failed"
            session.execute(text("""
                update public.analysis_runs set status = :status, active_lease_until = null,
                    error_code = :code, error_message = :message, completed_at = now()
                where id = :run and workspace_id = :workspace and attempt_count = :attempt
                  and status = 'running'
            """), {"run": run_id, "workspace": workspace.id, "attempt": attempt,
                   "code": code, "message": message, "status": status})

    def cancel(self, user_id: UUID, run_id: UUID) -> dict[str, Any]:
        with self._session(user_id) as session:
            workspace = self._workspace(session, user_id)
            updated = session.execute(text("""
                update public.analysis_runs set status = 'cancelled', active_lease_until = null,
                    completed_at = now() where id = :run and workspace_id = :workspace
                      and status in ('queued', 'running') returning id
            """), {"run": run_id, "workspace": workspace.id}).scalar_one_or_none()
            if updated is None:
                existing = self._get(session, workspace.id, run_id)
                if existing["status"] != "cancelled":
                    raise AnalysisFailure("run_terminal", "Only queued or running analysis can be cancelled.")
            return self._get(session, workspace.id, run_id)


class AnalysisService:
    def __init__(self, repository: PostgresAnalysisRepository) -> None:
        self.repository = repository

    def create(self, user_id: UUID, version_id: UUID) -> tuple[dict[str, Any], bool]:
        return self.repository.create(user_id, version_id)

    def execute(self, user_id: UUID, run_id: UUID) -> None:
        attempt = self.repository.claim(user_id, run_id)
        if attempt is None:
            return
        try:
            state = self.repository.latest_state(user_id, run_id) or {}
            run = self.repository.get(user_id, run_id)
            state = {**state, "run_id": str(run_id), "dataset_version_id": str(run["dataset_version_id"]),
                     "deadline": (datetime.now(timezone.utc) + timedelta(seconds=MAX_ACTIVE_SECONDS)).isoformat()}
            nodes = DeterministicNodes(AnalysisTools(self.repository, user_id))
            completed = state.get("stage")

            def wrap(stage: str, fn: Any) -> Any:
                def invoke(current: AnalysisState) -> dict[str, Any]:
                    if completed in STAGES and STAGES.index(stage) <= STAGES.index(completed):
                        return {}
                    result = cast(dict[str, Any], fn(current))
                    next_state = cast(AnalysisState, {**current, **result, "stage": stage})
                    self.repository.checkpoint(user_id, run_id, attempt, next_state)
                    return {**result, "stage": stage}
                return invoke

            graph = build_analysis_graph(
                wrap("assess_quality", nodes.assess_quality),
                wrap("compute_metrics", nodes.compute_metrics),
                wrap("investigate", nodes.investigate),
                wrap("validate_findings", nodes.validate_findings),
            )
            final = graph.invoke(state)
            self.repository.finish(user_id, run_id, attempt, final.get("findings", []))
        except AnalysisFailure:
            # A cancellation or replacement lease must never be overwritten by this worker.
            return
        except TimeoutError:
            self.repository.fail(user_id, run_id, attempt, "analysis_timeout",
                                 "Analysis exceeded its time budget. Retry from the import page.")
        except ValueError as error:
            self.repository.fail(user_id, run_id, attempt, "analysis_invalid", str(error)[:240])
        except Exception:
            self.repository.fail(user_id, run_id, attempt, "analysis_unavailable",
                                 "Analysis stopped unexpectedly. Retry from the import page.")
