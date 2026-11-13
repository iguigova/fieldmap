"""The fieldmap command: fetch the scope, who wrote and funded it and what
its journals charge, build the map, check it, and measure how stable its
clusters are."""

import argparse
import json
from datetime import date
from pathlib import Path

from fieldmap import check, doaj, openalex, scope, stability
from fieldmap.build import DIMENSIONS, SEEDS, field_map, short_id
from fieldmap.venues import venues

RAW = Path("data/raw/works.jsonl")
WHO = Path("data/raw/who.jsonl")
VENUES = Path("data/raw/venues.json")
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


def fetch_who(raw: Path, out: Path) -> str:
    ids = [short_id(w["id"]) for w in read_works(raw)]
    works = [w for page in openalex.who(ids) for w in page]
    out.write_text("".join(json.dumps(w) + "\n" for w in works))
    return f"{len(works)} of {len(ids)} works' authors and funders in {out}"


def fetch_venues(out: Path) -> str:
    sources = openalex.sources(list(scope.JOURNALS))
    listed = {short_id(s["id"]): doaj.journal(s["issn"]) for s in sources}
    fetched = {
        "fetched": date.today().isoformat(),
        "sources": sources,
        "doaj": listed,
    }
    out.write_text(json.dumps(fetched))
    in_doaj = sum(r is not None for r in listed.values())
    return f"{len(sources)} journals, {in_doaj} in DOAJ, written to {out}"


def build(raw: Path, who: Path, fetched: Path, out: Path) -> str:
    built = field_map(
        read_works(raw), read_works(who), scope.CLUSTERS, DIMENSIONS
    )
    built["venues"] = venues(json.loads(fetched.read_text()))
    built["scope"] = {
        "journals": list(scope.JOURNALS.values()),
        "years": list(scope.YEARS),
        "built": date.today().isoformat(),
    }
    out.write_text(json.dumps(built, separators=(",", ":")))
    return f"{built['papers']} papers in {len(built['clusters'])} clusters"


def run_fetch(args) -> tuple[str, int]:
    return fetch(args.raw), 0


def run_who(args) -> tuple[str, int]:
    return fetch_who(args.raw, args.who), 0


def run_venues(args) -> tuple[str, int]:
    return fetch_venues(args.venues), 0


def run_build(args) -> tuple[str, int]:
    return build(args.raw, args.who, args.venues, args.map), 0


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
    "who": run_who,
    "venues": run_venues,
    "build": run_build,
    "check": run_check,
    "stability": run_stability,
}


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fieldmap", description=__doc__)
    p.add_argument("command", choices=COMMANDS)
    p.add_argument("--raw", type=Path, default=RAW)
    p.add_argument("--who", type=Path, default=WHO)
    p.add_argument("--venues", type=Path, default=VENUES)
    p.add_argument("--map", type=Path, default=MAP)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    text, status = COMMANDS[args.command](args)
    print(text)
    return status
