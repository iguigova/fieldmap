"""The success checks README.md states, run against a built map."""

import re

NAMED = {
    "causal inference": ("causal", "propensity", "instrumental"),
    "research synthesis": ("meta-analysis", "meta", "network meta-analysis"),
    "ML methods": ("machine learning", "learning", "random forest", "neural"),
    "spatial statistics": ("spatial",),
    "missing data": ("missing", "imputation"),
}
HELD_OUT = {
    "survival analysis": ("survival", "hazard", "competing risks"),
    "clinical trial design": ("trial", "trials", "dose", "adaptive"),
    "longitudinal data": ("longitudinal", "mixed", "repeated measures"),
    "multiple testing": ("multiple testing", "false discovery"),
    "statistical genetics": ("genetic", "gwas", "genomic", "snp", "gene"),
}
HELD_OUT_NEEDED = 4


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


def verdict(field_map: dict) -> dict:
    named = found(NAMED, field_map["clusters"])
    held_out = found(HELD_OUT, field_map["clusters"])
    return {
        "named": named,
        "held_out": held_out,
        "passed": (
            all(named.values())
            and sum(map(bool, held_out.values())) >= HELD_OUT_NEEDED
        ),
    }


def report_line(subfield: str, ids: list[int], clusters: list[dict]) -> str:
    if not ids:
        return f"  MISSING  {subfield}"
    names = "; ".join(", ".join(clusters[i]["name"]) for i in ids)
    return f"  found    {subfield}: {names}"


def report(field_map: dict) -> str:
    result = verdict(field_map)
    clusters = field_map["clusters"]
    lines = ["Named by the asker:"]
    lines += [
        report_line(s, ids, clusters) for s, ids in result["named"].items()
    ]
    lines += [f"Held out (need {HELD_OUT_NEEDED} of {len(HELD_OUT)}):"]
    lines += [
        report_line(s, ids, clusters) for s, ids in result["held_out"].items()
    ]
    lines += ["PASS" if result["passed"] else "FAIL"]
    return "\n".join(lines)
