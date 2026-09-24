from uuid import uuid4

import pytest

from app.v2.ai.citations import CitationError, validate_citations


def test_exact_scalar_citation_exposes_ledger_source() -> None:
    source = str(uuid4())
    evidence = {"T1": {"items": [{"id": source, "description": "pd 4 trck rpr", "amount": "120.00"}]}}
    segments = validate_citations(
        'Review <cite ref="T1.items.0.description">pd 4 trck rpr</cite> for ₹'
        '<cite ref="T1.items.0.amount">120.00</cite>.', evidence,
    )
    assert [part.text for part in segments if part.ref] == ["pd 4 trck rpr", "120.00"]
    assert [part.source_ref for part in segments if part.ref] == [source, source]


@pytest.mark.parametrize("answer", [
    'Total is 121.00; <cite ref="T1.amount">120.00</cite>.',
    'There are two entries: <cite ref="T1.amount">120.00</cite>.',
    '<cite ref="T2.amount">120.00</cite>',
    '<cite ref="T1.missing">120.00</cite>',
    '<cite ref="T1.amount">121.00</cite>',
    '<cite ref="T1.amount"><b>120.00</b></cite>',
    '<cite ref="T1.amount">120.00',
    '<!DOCTYPE x><cite ref="T1.amount">120.00</cite>',
    'No cited values at all.',
])
def test_rejects_unsupported_model_output(answer: str) -> None:
    with pytest.raises(CitationError):
        validate_citations(answer, {"T1": {"amount": "120.00"}})


def test_never_accepts_floats_as_citable_values() -> None:
    with pytest.raises(CitationError):
        validate_citations('<cite ref="T1.amount">120.0</cite>', {"T1": {"amount": 120.0}})
