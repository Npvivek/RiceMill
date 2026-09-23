"""Bounded, read-only calculations over one authorized committed dataset."""

from __future__ import annotations

from calendar import monthrange
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Protocol
from uuid import UUID

MAX_ROWS = 10_000
MAX_PAGE = 100


class AnalysisInputError(ValueError):
    pass


@dataclass(frozen=True)
class LedgerRow:
    id: UUID
    source_row_id: UUID
    transaction_date: date
    description: str
    direction: str
    amount: Decimal
    category: str
    source_sheet: str
    source_row: int


@dataclass(frozen=True)
class DatasetSnapshot:
    version_id: UUID
    import_id: UUID
    rows: tuple[LedgerRow, ...]
    excluded_count: int
    review_count: int


class DatasetReader(Protocol):
    def load(self, user_id: UUID, version_id: UUID) -> DatasetSnapshot:
        """Reject foreign or uncommitted versions before returning canonical rows."""


def _range(start: date, end: date) -> tuple[date, date]:
    if start > end or (end - start).days > 3660:
        raise AnalysisInputError("Date range must be ordered and at most ten years.")
    return start, end


def _amount(value: Decimal) -> str:
    return f"{value:.2f}"


def _incomplete_month(start: date, end: date) -> bool:
    return start.day != 1 or end.day != monthrange(end.year, end.month)[1]


def _totals(rows: tuple[LedgerRow, ...]) -> dict[str, str | int]:
    income = sum((row.amount for row in rows if row.direction == "income"), Decimal("0"))
    expense = sum((row.amount for row in rows if row.direction == "expense"), Decimal("0"))
    return {"income": _amount(income), "expense": _amount(expense),
            "net_cash_flow": _amount(income - expense), "transaction_count": len(rows)}


class AnalysisTools:
    def __init__(self, reader: DatasetReader, user_id: UUID) -> None:
        self.reader = reader
        self.user_id = user_id

    def _snapshot(self, version_id: UUID) -> DatasetSnapshot:
        snapshot = self.reader.load(self.user_id, version_id)
        if len(snapshot.rows) > MAX_ROWS:
            raise AnalysisInputError("Dataset exceeds the 10,000-transaction analysis limit.")
        return snapshot

    def get_data_quality(self, version_id: UUID) -> dict[str, Any]:
        data = self._snapshot(version_id)
        return {"transaction_count": len(data.rows), "excluded_count": data.excluded_count,
                "review_count": data.review_count, "ready": bool(data.rows) and data.review_count == 0,
                "sample_source_refs": [str(row.id) for row in data.rows[:5]]}

    def summarize_cash_flow(self, version_id: UUID, date_range: tuple[date, date]) -> dict[str, Any]:
        start, end = _range(*date_range)
        data = self._snapshot(version_id)
        rows = tuple(row for row in data.rows if start <= row.transaction_date <= end)
        return {"start": start.isoformat(), "end": end.isoformat(), **_totals(rows),
                "sample_source_refs": [str(row.id) for row in rows[:5]],
                "limitation": "Cash flow is not profit; non-cash costs and inventory are not represented."}

    def compare_periods(self, version_id: UUID, baseline_range: tuple[date, date],
                        comparison_range: tuple[date, date]) -> dict[str, Any]:
        baseline_start, baseline_end = _range(*baseline_range)
        comparison_start, comparison_end = _range(*comparison_range)
        if (baseline_end - baseline_start).days != (comparison_end - comparison_start).days:
            raise AnalysisInputError("Compared periods must have equal lengths.")
        data = self._snapshot(version_id)
        baseline = _totals(tuple(row for row in data.rows if baseline_start <= row.transaction_date <= baseline_end))
        comparison = _totals(tuple(row for row in data.rows if comparison_start <= row.transaction_date <= comparison_end))
        base = Decimal(str(baseline["net_cash_flow"]))
        current = Decimal(str(comparison["net_cash_flow"]))
        change = None if base == 0 else _amount((current - base) / abs(base) * Decimal("100"))
        return {"baseline": baseline, "comparison": comparison, "percent_change": change,
                "percent_change_reason": "Zero baseline; percentage change undefined." if change is None else None,
                "insufficient_samples": min(int(baseline["transaction_count"]), int(comparison["transaction_count"])) < 5,
                "incomplete_months": _incomplete_month(baseline_start, baseline_end)
                or _incomplete_month(comparison_start, comparison_end)}

    def breakdown_by_category(self, version_id: UUID, date_range: tuple[date, date]) -> dict[str, Any]:
        start, end = _range(*date_range)
        data = self._snapshot(version_id)
        sums: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal("0"))
        counts: Counter[tuple[str, str]] = Counter()
        evidence: dict[tuple[str, str], list[str]] = defaultdict(list)
        for row in data.rows:
            if start <= row.transaction_date <= end:
                key = (row.direction, row.category)
                sums[key] += row.amount
                counts[key] += 1
                if len(evidence[key]) < 5:
                    evidence[key].append(str(row.id))
        categories = [{"direction": key[0], "category": key[1], "amount": _amount(sums[key]),
                       "count": counts[key], "source_refs": evidence[key]}
                      for key in sorted(sums, key=lambda item: (-sums[item], item))[:50]]
        return {"categories": categories, "truncated": len(sums) > 50}

    def get_transactions(self, version_id: UUID, filters: dict[str, str] | None = None,
                         cursor: int = 0, limit: int = 50) -> dict[str, Any]:
        if not 1 <= limit <= MAX_PAGE or cursor < 0 or cursor > MAX_ROWS:
            raise AnalysisInputError("Transaction page is outside allowed bounds.")
        filters = filters or {}
        if set(filters) - {"direction", "category", "start", "end"}:
            raise AnalysisInputError("Unsupported transaction filter.")
        if filters.get("direction") not in (None, "income", "expense"):
            raise AnalysisInputError("Invalid transaction direction.")
        start = date.fromisoformat(filters["start"]) if "start" in filters else date.min
        end = date.fromisoformat(filters["end"]) if "end" in filters else date.max
        _range(start, end) if start != date.min and end != date.max else None
        data = self._snapshot(version_id)
        rows = sorted((row for row in data.rows if (not filters.get("direction") or row.direction == filters["direction"])
                       and (not filters.get("category") or row.category == filters["category"])
                       and start <= row.transaction_date <= end), key=lambda row: (row.transaction_date, str(row.id)), reverse=True)
        page = rows[cursor:cursor + limit]
        return {"items": [{"id": str(row.id), "source_row_id": str(row.source_row_id),
                           "date": row.transaction_date.isoformat(), "description": row.description,
                           "direction": row.direction, "amount": _amount(row.amount),
                           "category": row.category, "source_sheet": row.source_sheet,
                           "source_row": row.source_row} for row in page],
                "next_cursor": cursor + limit if cursor + limit < len(rows) else None, "total": len(rows)}

    def find_duplicate_candidates(self, version_id: UUID) -> dict[str, Any]:
        data = self._snapshot(version_id)
        groups: dict[tuple[date, str, Decimal, str], list[LedgerRow]] = defaultdict(list)
        for row in data.rows:
            groups[(row.transaction_date, row.direction, row.amount, row.description.strip().casefold())].append(row)
        candidates = [{"source_refs": [str(row.id) for row in group[:5]], "amount": _amount(group[0].amount),
                       "date": group[0].transaction_date.isoformat(), "count": len(group)}
                      for group in groups.values() if len(group) > 1]
        candidates.sort(key=lambda item: (item["date"], item["source_refs"]))
        return {"candidates": candidates[:50], "truncated": len(candidates) > 50,
                "limitation": "Matching entries are candidates, not confirmed duplicate payments."}

    def find_unusual_entries(self, version_id: UUID, method_parameters: dict[str, str]) -> dict[str, Any]:
        if set(method_parameters) - {"multiplier"}:
            raise AnalysisInputError("Unsupported unusual-entry parameter.")
        try:
            multiplier = Decimal(method_parameters.get("multiplier", "3"))
        except (ValueError, ArithmeticError) as error:
            raise AnalysisInputError("Invalid multiplier.") from error
        if not multiplier.is_finite() or not Decimal("2") <= multiplier <= Decimal("10"):
            raise AnalysisInputError("Multiplier must be between 2 and 10.")
        data = self._snapshot(version_id)
        amounts = sorted(row.amount for row in data.rows)
        if len(amounts) < 5:
            return {"candidates": [], "insufficient_samples": True}
        median = amounts[len(amounts) // 2]
        candidates = [row for row in data.rows if row.amount > median * multiplier]
        candidates.sort(key=lambda row: (-row.amount, str(row.id)))
        return {"candidates": [{"source_ref": str(row.id), "amount": _amount(row.amount),
                                 "date": row.transaction_date.isoformat()} for row in candidates[:50]],
                "truncated": len(candidates) > 50, "median": _amount(median),
                "insufficient_samples": False,
                "limitation": "Large relative to this workbook, not evidence of an error or fraud."}
