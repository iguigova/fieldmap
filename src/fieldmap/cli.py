"""The fieldmap command: fetch a field's papers and reviews, who wrote and
funded them and what its journals charge, build its map, check it, and
measure how stable its clusters are."""

import argparse
import json
from datetime import date
from pathlib import Path

from fieldmap import check, doaj, fields, openalex, scope, stability
from fieldmap.build import DIMENSIONS, SEEDS, field_map, short_id
from fieldmap.venues import venues

DATA = Path("data")
# Each field's downloads, under DATA / "raw" / <slug>.
RAW_FILES = {
    "raw": "works.jsonl",
    "reviews": "reviews.jsonl",
    "who": "who.jsonl",
    "venues": "venues.json",
}
INDEX = DATA / "fields.json"


def fetch(field: fields.Field, kind: str, raw: Path) -> str:
    works = [
        w
        for query in scope.works_filters(field, kind)
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


def fetch_venues(field: fields.Field, out: Path) -> str:
    sources = openalex.sources(list(field.journals))
    listed = {short_id(s["id"]): doaj.journal(s["issn"]) for s in sources}
    fetched = {
        "fetched": date.today().isoformat(),
        "sources": sources,
        "doaj": listed,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fetched))
    in_doaj = sum(r is not None for r in listed.values())
    return f"{len(sources)} journals, {in_doaj} in DOAJ, written to {out}"


# Every map built in the folder, for the page to offer.
def index(folder: Path) -> list[dict]:
    maps = sorted(p for p in folder.glob("*.json") if p.name != INDEX.name)
    scopes = [json.loads(p.read_text())["scope"] for p in maps]
    return [{"slug": s["slug"], "name": s["field"]} for s in scopes]


def build(field: fields.Field, paths: dict[str, Path], out: Path) -> str:
    built = field_map(
        read_works(paths["raw"]),
        read_works(paths["reviews"]),
        read_works(paths["who"]),
        field.clusters,
        DIMENSIONS,
    )
    built["venues"] = venues(json.loads(paths["venues"].read_text()))
    built["scope"] = {
        "slug": field.slug,
        "field": field.name,
        "who_note": field.who_note,
        "journals": list(field.journals.values()),
        "years": list(field.years),
        "built": date.today().isoformat(),
    }
    out.write_text(json.dumps(built, separators=(",", ":")))
    out.with_name(INDEX.name).write_text(json.dumps(index(out.parent)))
    placed = built["reviews"]
    return (
        f"{built['papers']} papers in {len(built['clusters'])} clusters, "
        f"{placed['placed']} of {placed['fetched']} reviews placed"
    )


def raw_paths(args) -> dict[str, Path]:
    folder = DATA / "raw" / args.field.slug
    return {
        key: getattr(args, key) or folder / name
        for key, name in RAW_FILES.items()
    }


def map_path(args) -> Path:
    return args.map or DATA / f"{args.field.slug}.json"


def run_fetch(args) -> tuple[str, int]:
    return fetch(args.field, scope.ARTICLE, raw_paths(args)["raw"]), 0


def run_reviews(args) -> tuple[str, int]:
    return fetch(args.field, scope.REVIEW, raw_paths(args)["reviews"]), 0


def run_who(args) -> tuple[str, int]:
    paths = raw_paths(args)
    return fetch_who(paths["raw"], paths["who"]), 0


def run_venues(args) -> tuple[str, int]:
    return fetch_venues(args.field, raw_paths(args)["venues"]), 0


def run_build(args) -> tuple[str, int]:
    return build(args.field, raw_paths(args), map_path(args)), 0


def run_check(args) -> tuple[str, int]:
    built = json.loads(map_path(args).read_text())
    passed = check.verdict(built, args.field)["passed"]
    return check.report(built, args.field), 0 if passed else 1


def run_stability(args) -> tuple[str, int]:
    rows = stability.stability(
        read_works(raw_paths(args)["raw"]),
        stability.KS,
        SEEDS,
        DIMENSIONS,
        args.field,
    )
    return stability.report(rows), 0


COMMANDS = {
    "fetch": run_fetch,
    "reviews": run_reviews,
    "who": run_who,
    "venues": run_venues,
    "build": run_build,
    "check": run_check,
    "stability": run_stability,
}


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fieldmap", description=__doc__)
    p.add_argument("command", choices=COMMANDS)
    p.add_argument("--field", choices=fields.SLUGS, default=fields.SLUGS[0])
    for key in RAW_FILES:
        p.add_argument(f"--{key}", type=Path)
    p.add_argument("--map", type=Path)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    args.field = fields.load(args.field)
    text, status = COMMANDS[args.command](args)
    print(text)
    return status
