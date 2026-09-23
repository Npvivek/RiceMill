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


def test_formula_without_cached_value_fails_closed() -> None:
    data = workbook_bytes("Income", [
        ["Date", "Description", "Amount"],
        ["01/09/2026", "Rice sale", "=100+25"],
    ])
    with pytest.raises(ParseError, match="formula") as error:
        parse_workbook(data)
    assert error.value.code == "formula_value"


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


def test_invalid_date_with_amount_rejects_entire_workbook() -> None:
    data = workbook_bytes("Income", [
        ["Date", "Description", "Amount"],
        ["31/02/2026", "Rice sale", "10.00"],
    ])
    with pytest.raises(ParseError) as error:
        parse_workbook(data)
    assert error.value.code == "invalid_date"


def test_invalid_date_and_amount_together_cannot_disappear_as_a_note() -> None:
    data = workbook_bytes("Income", [
        ["Date", "Description", "Amount"],
        ["31/02/2026", "Rice sale", "1,2,3"],
    ])
    with pytest.raises(ParseError) as error:
        parse_workbook(data)
    assert error.value.code == "invalid_transaction"


def test_split_debit_credit_parses_per_row_and_rejects_both_filled() -> None:
    rows = [
        ["Date", "Description", "Debit", "Credit"],
        ["01/09/2026", "Paddy", "50.00", None],
        ["02/09/2026", "Rice sale", None, "75.00"],
    ]
    parsed = parse_workbook(workbook_bytes("Ledger", rows))
    assert [row.direction for row in parsed.rows] == ["expense", "income"]
    rows.append(["03/09/2026", "Unclear", "1.00", "2.00"])
    with pytest.raises(ParseError) as error:
        parse_workbook(workbook_bytes("Ledger", rows))
    assert error.value.code == "ambiguous_direction"


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
