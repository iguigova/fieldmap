"""Turn the scope's works into the map the page reads: clusters, names."""

from dataclasses import dataclass

import numpy as np
from scipy.sparse import hstack
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import (
    ENGLISH_STOP_WORDS,
    CountVectorizer,
    TfidfVectorizer,
)
from sklearn.manifold import MDS
from sklearn.metrics.pairwise import cosine_distances
from sklearn.preprocessing import normalize

from fieldmap.openalex import abstract

# Words every methods abstract uses, which would otherwise name every cluster.
BOILERPLATE = {
    "analyses",
    "analysis",
    "application",
    "applied",
    "approach",
    "approaches",
    "article",
    "based",
    "data",
    "develop",
    "developed",
    "estimation",
    "estimator",
    "estimators",
    "illustrate",
    "method",
    "methods",
    "model",
    "models",
    "new",
    "paper",
    "performance",
    "propose",
    "proposed",
    "provide",
    "provides",
    "real",
    "results",
    "show",
    "simulation",
    "simulations",
    "statistical",
    "studies",
    "study",
    "use",
    "used",
    "using",
}
STOP_WORDS = sorted(ENGLISH_STOP_WORDS | BOILERPLATE)
TERM_SETTINGS = {
    "stop_words": STOP_WORDS,
    "ngram_range": (1, 2),
    "min_df": 5,
    "max_df": 0.4,
}
# A paper's references are its terms, kept when two papers share them.
REF_SETTINGS = {"analyzer": list, "min_df": 2}
# A journal's front matter that OpenAlex types as an article.
FRONT_MATTER = "Cover Picture:"
DIMENSIONS = 100
NAME_TERMS = 5
STARTERS = 5
SHIPPED_TERMS = 150
SHIPPED_REFS = 300
# A title scoring below this share of the map's own titles is left unplaced.
FLOOR_PERCENTILE = 5


@dataclass(frozen=True)
class Paper:
    doi: str | None
    title: str
    year: int
    cites: int
    text: str
    refs: tuple[str, ...]


def short_doi(doi: str | None) -> str | None:
    return doi.removeprefix("https://doi.org/").lower() if doi else None


def short_id(url: str) -> str:
    return url.rsplit("/", 1)[-1]


def paper(work: dict) -> Paper:
    return Paper(
        doi=short_doi(work.get("doi")),
        title=work["title"],
        year=work["publication_year"],
        cites=work["cited_by_count"],
        text=f"{work['title']} {abstract(work['abstract_inverted_index'])}",
        refs=tuple(map(short_id, work.get("referenced_works") or ())),
    )


def is_paper(work: dict) -> bool:
    title = work.get("title") or ""
    return bool(title) and not title.startswith(FRONT_MATTER)


def papers(works: list[dict]) -> list[Paper]:
    return [paper(work) for work in works if is_paper(work)]


# ---- Vectors and clusters ------------------------------------------------


def text_matrix(corpus: list[Paper]):
    vectorizer = TfidfVectorizer(sublinear_tf=True, **TERM_SETTINGS)
    return vectorizer.fit_transform(p.text for p in corpus)


def refs_matrix(corpus: list[Paper]):
    return TfidfVectorizer(**REF_SETTINGS).fit_transform(
        p.refs for p in corpus
    )


def vectors(corpus: list[Paper], dimensions: int) -> np.ndarray:
    parts = [normalize(text_matrix(corpus)), normalize(refs_matrix(corpus))]
    svd = TruncatedSVD(dimensions, random_state=0)
    return normalize(svd.fit_transform(hstack(parts).tocsr()))


def clusters(points: np.ndarray, count: int) -> np.ndarray:
    return KMeans(count, random_state=0, n_init=10).fit_predict(points)


# ---- Profiles: each cluster's terms by class-based TF-IDF ----------------


def class_tfidf(settings: dict, docs, labels: np.ndarray, count: int):
    vectorizer = CountVectorizer(**settings)
    counts = vectorizer.fit_transform(docs)
    members = np.eye(count)[labels].T
    per_cluster = np.asarray(members @ counts)
    totals = np.maximum(per_cluster.sum(axis=1, keepdims=True), 1)
    idf = np.log1p(per_cluster.sum() / count / per_cluster.sum(axis=0))
    return per_cluster / totals * idf, vectorizer.get_feature_names_out()


def weights(scores: np.ndarray, vocabulary, top: int) -> dict[str, float]:
    ranked = [i for i in np.argsort(-scores)[:top] if scores[i] > 0]
    peak = scores[ranked[0]] if ranked else 1
    return {
        str(vocabulary[i]): round(float(scores[i] / peak), 4) for i in ranked
    }


def profiles(settings, docs, labels, count, top) -> list[dict]:
    scores, vocabulary = class_tfidf(settings, docs, labels, count)
    return [weights(row, vocabulary, top) for row in scores]


def overlaps(term: str, chosen: list[str]) -> bool:
    words = set(term.split())
    return any(
        words <= set(c.split()) or set(c.split()) <= words for c in chosen
    )


def name(ranked: list[str]) -> list[str]:
    chosen: list[str] = []
    for term in ranked:
        if len(chosen) == NAME_TERMS:
            break
        if not overlaps(term, chosen):
            chosen.append(term)
    return chosen


# ---- Title placement: the page scores a title's terms the same way -------


title_terms = CountVectorizer(**TERM_SETTINGS).build_analyzer()


def best_score(terms: list[str], term_profiles: list[dict]) -> float:
    return max(sum(w.get(t, 0) for t in terms) for w in term_profiles)


def title_floor(corpus: list[Paper], term_profiles: list[dict]) -> float:
    best = [best_score(title_terms(p.title), term_profiles) for p in corpus]
    return round(float(np.percentile(best, FLOOR_PERCENTILE)), 4)


# ---- Layout --------------------------------------------------------------


def layout(points: np.ndarray, labels: np.ndarray, count: int) -> np.ndarray:
    centroids = np.array(
        [points[labels == c].mean(axis=0) for c in range(count)]
    )
    mds = MDS(2, metric="precomputed", init="classical_mds", random_state=0)
    placed = mds.fit_transform(cosine_distances(centroids))
    span = placed.max(axis=0) - placed.min(axis=0)
    return (placed - placed.min(axis=0)) / span


# ---- The map -------------------------------------------------------------


def starter(p: Paper) -> dict:
    return {"title": p.title, "doi": p.doi, "year": p.year, "cites": p.cites}


def starters(members: list[Paper]) -> list[dict]:
    by_cites = sorted(members, key=lambda p: -p.cites)
    return [starter(p) for p in by_cites[:STARTERS]]


def cluster_entry(c, members, position, terms, refs) -> dict:
    return {
        "id": c,
        "name": name(list(terms)),
        "size": len(members),
        "x": round(float(position[0]), 4),
        "y": round(float(position[1]), 4),
        "starters": starters(members),
        "terms": terms,
        "refs": refs,
    }


def field_map(works: list[dict], count: int, dimensions: int) -> dict:
    corpus = papers(works)
    points = vectors(corpus, dimensions)
    labels = clusters(points, count)
    texts = [p.text for p in corpus]
    cited = [p.refs for p in corpus]
    terms = profiles(TERM_SETTINGS, texts, labels, count, SHIPPED_TERMS)
    refs = profiles(REF_SETTINGS, cited, labels, count, SHIPPED_REFS)
    positions = layout(points, labels, count)
    members = [
        [p for p, k in zip(corpus, labels, strict=True) if k == c]
        for c in range(count)
    ]
    return {
        "papers": len(corpus),
        "stop_words": STOP_WORDS,
        "title_floor": title_floor(corpus, terms),
        "clusters": [
            cluster_entry(c, members[c], positions[c], terms[c], refs[c])
            for c in range(count)
        ],
        "dois": {
            p.doi: int(k) for p, k in zip(corpus, labels, strict=True) if p.doi
        },
    }
