import dataclasses

import pytest

from fieldmap import fields

THEMES = {
    "spatial": "spatial disease mapping region neighbour county smoothing",
    "missing": "missing imputation dropout incomplete chained missingness",
    "survival": "survival hazard censored cox frailty proportional",
}


def ref(theme: str, n: int) -> str:
    return f"https://openalex.org/W{theme}{n}"


def work(n: int, theme: str, words: str) -> dict:
    inverted = {w: [i] for i, w in enumerate(words.split())}
    return {
        "id": f"https://openalex.org/W{theme}{n}",
        "doi": f"https://doi.org/10.1/{theme.upper()}{n}",
        "title": f"{theme} paper {n}",
        "publication_year": 2020,
        "cited_by_count": n,
        "abstract_inverted_index": inverted,
        "referenced_works": [ref(theme, n % 3), ref(theme, (n + 1) % 3)],
        "primary_location": {
            "source": {"id": f"https://openalex.org/S{1 + n % 4 // 3}"}
        },
    }


# Biostatistics' settings, at the three clusters the fixture's themes make.
@pytest.fixture
def field() -> fields.Field:
    return dataclasses.replace(fields.load("biostatistics"), clusters=3)


@pytest.fixture
def works() -> list[dict]:
    themed = [work(n, t, w) for t, w in THEMES.items() for n in range(12)]
    cover = dict(themed[0], title="Cover Picture: Biometrical Journal 1'20")
    return [*themed, cover, dict(themed[1], title=None)]


def review(n: int, cites: list[str]) -> dict:
    return work(n, "review", "review") | {"referenced_works": cites}


@pytest.fixture
def reviews() -> list[dict]:
    return [
        review(1, [ref("spatial", 0), ref("spatial", 1)]),
        review(2, [ref("spatial", 2), ref("spatial", 0), ref("missing", 0)]),
        review(3, [ref("elsewhere", 0)]),
    ]


def credit(work: dict) -> dict:
    theme = (
        work["id"].removeprefix("https://openalex.org/W").rstrip("0123456789")
    )
    n = int(work["id"][len(theme) + len("https://openalex.org/W") :])
    team = {"id": f"I{theme}", "display_name": f"{theme} university"}
    return {
        "id": work["id"],
        "authorships": [
            {
                "author": {
                    "id": f"A{theme}",
                    "display_name": f"{theme} author",
                },
                "institutions": [team],
            },
            {
                "author": {"id": None, "display_name": "unmatched"},
                "institutions": [],
            },
        ],
        "funders": [{"id": "Fnih", "display_name": "NIH"}] if n % 2 else [],
    }


@pytest.fixture
def who_works(works) -> list[dict]:
    return [credit(w) for w in works]
