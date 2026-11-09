import pytest

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
    }


@pytest.fixture
def works() -> list[dict]:
    themed = [work(n, t, w) for t, w in THEMES.items() for n in range(12)]
    cover = dict(themed[0], title="Cover Picture: Biometrical Journal 1'20")
    return [*themed, cover, dict(themed[1], title=None)]
