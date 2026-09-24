"""Small synthetic workbooks exercise deterministic import boundaries."""

from io import BytesIO

import pytest
from openpyxl import Workbook

from app.v2.imports.models import ParseError
from app.v2.imports.parser import parse_workbook


def workbook_bytes(sheet_name: str, rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = sheet_name
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def test_refund_reverses_expense_direction_without_float_money() -> None:
    data = workbook_bytes("Expenses", [
        ["Date", "Description", "Amount"],
        ["01/09/2026", "Diesel", "1,200.50"],
        ["02/09/2026", "Diesel refund", "(200.25)"],
    ])
    parsed = parse_workbook(data)
    assert [(row.direction, str(row.amount)) for row in parsed.rows] == [
        ("expense", "1200.50"), ("income", "200.25"),
    ]
    assert str(parsed.expense_total) == "1200.50"
    assert str(parsed.income_total) == "200.25"


def test_formula_row_is_excluded_without_using_a_cached_value() -> None:
    data = workbook_bytes("Income", [
        ["Date", "Description", "Amount"],
        ["01/09/2026", "Rice sale", "=100+25"],
        ["02/09/2026", "Bran sale", "25.00"],
    ])
    parsed = parse_workbook(data)
    assert [(row.row_number, str(row.amount)) for row in parsed.rows] == [(3, "25.00")]
    assert [(row.row_number, row.reason, row.raw_cells["C"]) for row in parsed.excluded_rows
            if row.reason == "formula_value"] == [(2, "formula_value", "=100+25")]


def test_telugu_and_english_descriptions_survive_unchanged() -> None:
    description = "రైతు Ramesh paddy కొనుగోలు"
    parsed = parse_workbook(workbook_bytes("Expenses", [
        ["Date", "Description", "Amount"],
        ["01/09/2026", description, "123.45"],
    ]))
    assert parsed.rows[0].description == description
    assert parsed.rows[0].raw_cells["B"] == description


def test_duplicate_total_rows_are_excluded_not_double_counted() -> None:
    parsed = parse_workbook(workbook_bytes("Income", [
        ["Date", "Description", "Amount"],
        ["01/09/2026", "Rice sale", "10.00"],
        [None, "Total", "10.00"],
        [None, "Grand Total", "10.00"],
    ]))
    assert len(parsed.rows) == 1
    assert str(parsed.income_total) == "10.00"
    assert [row.reason for row in parsed.excluded_rows].count("total_or_balance") == 2


def test_total_word_inside_a_real_description_is_not_silently_excluded() -> None:
    parsed = parse_workbook(workbook_bytes("Expenses", [
        ["Date", "Description", "Amount"],
        ["01/09/2026", "Total vehicle maintenance", "10.00"],
    ]))
    assert len(parsed.rows) == 1


def test_bad_transaction_rows_are_excluded_with_source_values_and_reasons() -> None:
    parsed = parse_workbook(workbook_bytes("Income", [
        ["Date", "Description", "Amount"],
        ["01/09/2026", "Good sale", "10.00"],
        ["31/02/2026", "Rice sale", "10.00"],
        ["02/09/2026", "Transport advance", None],
        [None, "Rice sale", "12.00"],
        ["03/09/2026", None, "13.00"],
        ["31/02/2026", "Rice sale", "1,2,3"],
        ["04/09/2026", "Rice sale", "1.234"],
        ["05/09/2026", "Rice sale", "14.00"],
    ]))
    assert [(row.row_number, str(row.amount)) for row in parsed.rows] == [(2, "10.00"), (9, "14.00")]
    assert [(row.row_number, row.reason) for row in parsed.excluded_rows] == [
        (1, "header_or_prelude"), (3, "invalid_date"), (4, "missing_amount"),
        (5, "invalid_date"), (6, "missing_description"), (7, "invalid_transaction"),
        (8, "amount_precision"),
    ]
    assert parsed.excluded_rows[2].raw_cells == {"A": "02/09/2026", "B": "Transport advance"}
    assert parsed.excluded_rows[5].raw_cells["C"] == "1,2,3"
    assert str(parsed.income_total) == "24.00"


def test_split_debit_credit_parses_per_row_and_excludes_both_filled() -> None:
    rows = [
        ["Date", "Description", "Debit", "Credit"],
        ["01/09/2026", "Paddy", "50.00", None],
        ["02/09/2026", "Rice sale", None, "75.00"],
    ]
    rows.append(["03/09/2026", "Unclear", "1.00", "2.00"])
    parsed = parse_workbook(workbook_bytes("Ledger", rows))
    assert [row.direction for row in parsed.rows] == ["expense", "income"]
    assert parsed.excluded_rows[-1].reason == "ambiguous_direction"
    assert parsed.excluded_rows[-1].raw_cells["D"] == "2.00"


def test_no_valid_transactions_still_rejects_workbook() -> None:
    with pytest.raises(ParseError) as error:
        parse_workbook(workbook_bytes("Income", [
            ["Date", "Description", "Amount"], ["31/02/2026", "Rice sale", "10.00"],
        ]))
    assert error.value.code == "no_transactions"


def test_overlapping_workbooks_are_independent_parser_inputs() -> None:
    first = workbook_bytes("Income", [
        ["Date", "Description", "Amount"], ["01/09/2026", "Rice sale", "10.00"],
    ])
    second = workbook_bytes("Income", [
        ["Date", "Description", "Amount"], ["01/09/2026", "Rice sale", "10.00"],
        ["02/09/2026", "Bran sale", "5.00"],
    ])
    assert len(parse_workbook(first).rows) == 1
    assert len(parse_workbook(second).rows) == 2


def test_ambiguous_amount_headers_reject_workbook() -> None:
    data = workbook_bytes("Income", [
        ["Date", "Description", "Amount", "Value"],
        ["01/09/2026", "Rice sale", "10.00", "10.00"],
    ])
    with pytest.raises(ParseError) as error:
        parse_workbook(data)
    assert error.value.code == "ambiguous_columns"
