"""How much the clusters depend on k and on the k-means seed."""

import numpy as np
from sklearn.metrics import adjusted_rand_score

from fieldmap import check
from fieldmap.build import (
    SHIPPED_TERMS,
    TERM_SETTINGS,
    clusters,
    name,
    papers,
    profiles,
    vectors,
)
from fieldmap.compare import recovered

KS = (30, 40, 50)
HEADER = (
    "k   seeds agree (ARI)  groups found again  map's groups  check passes"
)


# ---- The check, on one run -----------------------------------------------


def named(texts: list[str], labels: np.ndarray, k: int) -> list[dict]:
    terms = profiles(TERM_SETTINGS, texts, labels, k, SHIPPED_TERMS)
    return [{"id": c, "name": name(list(t))} for c, t in enumerate(terms)]


def passes(texts: list[str], labels: np.ndarray, k: int) -> bool:
    return check.verdict({"clusters": named(texts, labels, k)})["passed"]


# ---- One row per k -------------------------------------------------------


def row(texts, points, k: int, seeds: tuple, base: np.ndarray) -> dict:
    runs = [clusters(points, k, seed) for seed in seeds]
    first, rest = runs[0], runs[1:]
    return {
        "k": k,
        "ari": float(np.mean([adjusted_rand_score(first, r) for r in rest])),
        "seeds": float(np.mean([recovered(first, r) for r in rest])),
        "map": recovered(base, first),
        "passes": sum(passes(texts, r, k) for r in runs),
        "runs": len(runs),
    }


def stability(works, ks, seeds, dimensions: int, count: int) -> list[dict]:
    corpus = papers(works)
    points = vectors(corpus, dimensions)
    texts = [p.text for p in corpus]
    base = clusters(points, count, seeds[0])
    return [row(texts, points, k, seeds, base) for k in ks]


def line(r: dict) -> str:
    return (
        f"{r['k']:<4}{r['ari']:<19.2f}{r['seeds']:<20.0%}{r['map']:<14.0%}"
        f"{r['passes']} of {r['runs']}"
    )


def report(rows: list[dict]) -> str:
    return "\n".join([HEADER, *map(line, rows)])
