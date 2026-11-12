"""The fieldmap command: fetch the scope, build the map, check it, and
measure how stable its clusters are."""

import argparse
import json
from datetime import date
from pathlib import Path

from fieldmap import check, openalex, scope, stability
from fieldmap.build import DIMENSIONS, SEEDS, field_map

RAW = Path("data/raw/works.jsonl")
MAP = Path("data/map.json")


def fetch(raw: Path) -> str:
    works = [
        w
        for query in scope.works_filters()
        for page in openalex.pages(query)
        for w in page
    ]
    raw.parent.mkdir(parents=True, exist_ok=True)
    raw.write_text("".join(json.dumps(w) + "\n" for w in works))
    return f"{len(works)} works written to {raw}"


def read_works(raw: Path) -> list[dict]:
    return [json.loads(line) for line in raw.read_text().splitlines()]


def build(raw: Path, out: Path) -> str:
    built = field_map(read_works(raw), scope.CLUSTERS, DIMENSIONS)
    built["scope"] = {
        "journals": list(scope.JOURNALS.values()),
        "years": list(scope.YEARS),
        "built": date.today().isoformat(),
    }
    out.write_text(json.dumps(built, separators=(",", ":")))
    return f"{built['papers']} papers in {len(built['clusters'])} clusters"


def run_fetch(args) -> tuple[str, int]:
    return fetch(args.raw), 0


def run_build(args) -> tuple[str, int]:
    return build(args.raw, args.map), 0


def run_check(args) -> tuple[str, int]:
    built = json.loads(args.map.read_text())
    return check.report(built), 0 if check.verdict(built)["passed"] else 1


def run_stability(args) -> tuple[str, int]:
    rows = stability.stability(
        read_works(args.raw),
        stability.KS,
        SEEDS,
        DIMENSIONS,
        scope.CLUSTERS,
    )
    return stability.report(rows), 0


COMMANDS = {
    "fetch": run_fetch,
    "build": run_build,
    "check": run_check,
    "stability": run_stability,
}


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fieldmap", description=__doc__)
    p.add_argument("command", choices=COMMANDS)
    p.add_argument("--raw", type=Path, default=RAW)
    p.add_argument("--map", type=Path, default=MAP)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    text, status = COMMANDS[args.command](args)
    print(text)
    return status
