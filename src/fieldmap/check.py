"""Checks that a built map finds the subfields it was built to find.

A subfield is found when one of a cluster's name terms holds one of the
subfield's terms as whole words. The map passes when every subfield its
field names is found, and enough of the held-out ones are.
"""

import re

from fieldmap.fields import Field


def holds(subfield_term: str, name_term: str) -> bool:
    pattern = rf"(?<![\w-]){re.escape(subfield_term)}(?![\w-])"
    return re.search(pattern, name_term) is not None


def owners(terms: tuple[str, ...], clusters: list[dict]) -> list[int]:
    return [
        c["id"]
        for c in clusters
        if any(holds(t, n) for t in terms for n in c["name"])
    ]


def found(subfields: dict, clusters: list[dict]) -> dict[str, list[int]]:
    return {s: owners(terms, clusters) for s, terms in subfields.items()}


def verdict(field_map: dict, field: Field) -> dict:
    named = found(field.named, field_map["clusters"])
    held_out = found(field.held_out, field_map["clusters"])
    return {
        "named": named,
        "held_out": held_out,
        "passed": (
            all(named.values())
            and sum(map(bool, held_out.values())) >= field.held_out_needed
        ),
    }


def report_line(subfield: str, ids: list[int], clusters: list[dict]) -> str:
    if not ids:
        return f"  MISSING  {subfield}"
    names = "; ".join(", ".join(clusters[i]["name"]) for i in ids)
    return f"  found    {subfield}: {names}"


def report(field_map: dict, field: Field) -> str:
    result = verdict(field_map, field)
    clusters = field_map["clusters"]
    lines = ["Named by the asker:"]
    lines += [
        report_line(s, ids, clusters) for s, ids in result["named"].items()
    ]
    need = f"{field.held_out_needed} of {len(field.held_out)}"
    lines += [f"Held out (need {need}):"]
    lines += [
        report_line(s, ids, clusters) for s, ids in result["held_out"].items()
    ]
    lines += ["PASS" if result["passed"] else "FAIL"]
    return "\n".join(lines)
