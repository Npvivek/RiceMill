from app.v2.ai.service import AnalysisFailure, AnalysisService
from app.v2.ai.tools import DatasetSnapshot
from tests.test_analysis_tools import IMPORT, USER, VERSION, row


class FakeRepository:
    def __init__(self):
        self.rows = (row(1, "income", "10.00"), row(2, "expense", "2.00"))
        self.saved = None
        self.attempts = 0
        self.fail_once = True
        self.finished = None
        self.errors = []
        self.cancelled = False

    def load(self, user_id, version_id):
        assert user_id == USER and version_id == VERSION
        return DatasetSnapshot(VERSION, IMPORT, self.rows, 0, 0)

    def claim(self, user_id, run_id):
        assert user_id == USER
        self.attempts += 1
        return self.attempts

    def latest_state(self, user_id, run_id):
        return self.saved

    def get(self, user_id, run_id):
        assert user_id == USER
        return {"dataset_version_id": VERSION}

    def checkpoint(self, user_id, run_id, attempt, state):
        if self.cancelled:
            raise AnalysisFailure("run_inactive", "Cancelled")
        self.saved = dict(state)
        if state["stage"] == "compute_metrics" and self.fail_once:
            self.fail_once = False
            raise RuntimeError("synthetic process interruption")

    def finish(self, user_id, run_id, attempt, findings):
        self.finished = findings

    def fail(self, user_id, run_id, attempt, code, message):
        self.errors.append(code)


def test_retry_resumes_checkpoint_and_commits_one_report():
    repo = FakeRepository()
    service = AnalysisService(repo)
    from uuid import uuid4
    run_id = uuid4()
    service.execute(USER, run_id)
    assert repo.errors == ["analysis_unavailable"]
    assert repo.saved["stage"] == "compute_metrics"
    service.execute(USER, run_id)
    assert repo.attempts == 2
    assert repo.finished is not None
    assert repo.finished[0]["title"] == "Recorded cash flow"
    assert len(repo.saved["tool_calls"]) == 4


def test_cancelled_run_cannot_persist_next_stage():
    repo = FakeRepository()
    repo.cancelled = True
    service = AnalysisService(repo)
    from uuid import uuid4
    service.execute(USER, uuid4())
    assert repo.finished is None
    assert repo.errors == []
