"""Value objects shared by the parser and import service."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

Direction = Literal["income", "expense"]
ImportStatus = Literal["staged", "committed", "failed"]
RawCell = str | int | bool | None


@dataclass(frozen=True)
class ParsedRow:
    sheet_name: str
    row_number: int
    raw_cells: dict[str, RawCell]
    transaction_date: date
    description: str
    direction: Direction
    amount: Decimal
    category: str


@dataclass(frozen=True)
class ExcludedRow:
    sheet_name: str
    row_number: int
    raw_cells: dict[str, RawCell]
    reason: str


@dataclass(frozen=True)
class ParsedWorkbook:
    rows: tuple[ParsedRow, ...]
    excluded_rows: tuple[ExcludedRow, ...]
    populated_rows: int

    @property
    def income_total(self) -> Decimal:
        return sum((row.amount for row in self.rows if row.direction == "income"), Decimal("0.00"))

    @property
    def expense_total(self) -> Decimal:
        return sum((row.amount for row in self.rows if row.direction == "expense"), Decimal("0.00"))


class ParseError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class ImportFailure(Exception):
    def __init__(self, code: str, message: str, status_code: int, retryable: bool = False,
                 import_id: UUID | None = None) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.import_id = import_id
        super().__init__(message)


@dataclass(frozen=True)
class ImportResult:
    id: UUID
    file_name: str
    status: ImportStatus
    source_row_count: int
    transaction_count: int
    income_total: Decimal
    expense_total: Decimal
    created_at: datetime
    error_code: str | None = None
    error_message: str | None = None


@dataclass(frozen=True)
class ImportPage:
    items: tuple[ImportResult, ...]
    page: int
    page_size: int
    total: int


@dataclass(frozen=True)
class TransactionRecord:
    id: UUID
    source_sheet: str
    source_row: int
    transaction_date: date
    description: str
    direction: Direction
    amount: Decimal
    category: str


@dataclass(frozen=True)
class ImportDetail:
    result: ImportResult
    transactions: tuple[TransactionRecord, ...]
    page: int
    page_size: int
    total: int
