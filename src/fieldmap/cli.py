"""The fieldmap command: fetch the scope, build the map, check it."""

import argparse
import json
from datetime import date
from pathlib import Path

from fieldmap import check, openalex, scope
from fieldmap.build import DIMENSIONS, field_map

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


def run_check(out: Path) -> tuple[str, bool]:
    built = json.loads(out.read_text())
    return check.report(built), check.verdict(built)["passed"]


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fieldmap", description=__doc__)
    p.add_argument("command", choices=("fetch", "build", "check"))
    p.add_argument("--raw", type=Path, default=RAW)
    p.add_argument("--map", type=Path, default=MAP)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.command == "fetch":
        print(fetch(args.raw))
        return 0
    if args.command == "build":
        print(build(args.raw, args.map))
        return 0
    text, passed = run_check(args.map)
    print(text)
    return 0 if passed else 1
