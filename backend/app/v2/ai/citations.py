"""Fail-closed validation for model-authored, evidence-backed prose."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID
from xml.etree.ElementTree import ParseError

from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException

REF = re.compile(r"T[1-8](?:\.[A-Za-z_][A-Za-z0-9_]*|\.[0-9]+)+\Z")
NUMBER = re.compile(
    r"\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|"
    r"thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|"
    r"forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|crore|million|"
    r"billion|percent|percentage)\b",
    re.IGNORECASE,
)


class CitationError(ValueError):
    """Model output cannot be safely shown or persisted."""


@dataclass(frozen=True)
class CitationSegment:
    text: str
    ref: str | None = None
    source_ref: str | None = None


def _resolve(ref: str, evidence: dict[str, dict[str, Any]]) -> tuple[str, str | None]:
    if not REF.fullmatch(ref):
        raise CitationError("Citation reference is malformed.")
    head, *parts = ref.split(".")
    if head not in evidence:
        raise CitationError("Citation is not from a tool used in this answer.")
    value: Any = evidence[head]
    parent: Any = None
    for part in parts:
        parent = value
        if isinstance(value, dict) and part in value:
            value = value[part]
        elif isinstance(value, list) and part.isdigit() and int(part) < len(value):
            value = value[int(part)]
        else:
            raise CitationError("Citation does not resolve to tool evidence.")
    if value is None or isinstance(value, (dict, list, float)):
        raise CitationError("Citation must identify one exact tool value.")
    source_ref = None
    if isinstance(parent, dict) and isinstance(parent.get("id"), str):
        try:
            source_ref = str(UUID(parent["id"]))
        except ValueError:
            pass
    elif (parts[-1] in {"source_ref", "source_refs"} or
          (len(parts) > 1 and parts[-2] in {"source_ref", "source_refs", "sample_source_refs"})) and isinstance(value, str):
        try:
            source_ref = str(UUID(value))
        except ValueError:
            pass
    return str(value).lower() if isinstance(value, bool) else str(value), source_ref


def validate_citations(answer: str, evidence: dict[str, dict[str, Any]]) -> list[CitationSegment]:
    """Accept only literal tool values in `<cite ref="T1.path">value</cite>` tags.

    Every digit or English number word outside a cited value is rejected. The
    caller must keep evidence limited to this turn's authorized read-only tools.
    """
    if not answer or len(answer) > 4000 or "<!" in answer:
        raise CitationError("Answer is empty, too long, or contains forbidden XML.")
    try:
        root = ElementTree.fromstring(f"<answer>{answer}</answer>")
    except (ParseError, ValueError, DefusedXmlException) as error:
        raise CitationError("Answer contains malformed XML.") from error
    segments: list[CitationSegment] = []

    def plain(value: str | None) -> None:
        if value:
            if NUMBER.search(value) or any(mark in value for mark in ('"', '“', '”', '`')):
                raise CitationError("Numeric claim is outside an evidence citation.")
            segments.append(CitationSegment(value))

    plain(root.text)
    for child in root:
        if child.tag != "cite" or set(child.attrib) != {"ref"} or len(child):
            raise CitationError("Only flat cite tags with one ref are allowed.")
        ref = child.attrib["ref"]
        expected, source_ref = _resolve(ref, evidence)
        if child.text != expected:
            raise CitationError("Citation text does not exactly match its tool value.")
        segments.append(CitationSegment(expected, ref, source_ref))
        plain(child.tail)
    if not any(segment.ref for segment in segments):
        raise CitationError("A response needs at least one verified citation.")
    return segments
