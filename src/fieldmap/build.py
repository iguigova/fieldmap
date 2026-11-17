"""Turn the scope's works into the map the page reads: clusters, names,
who works in each, where it publishes and which others each cites."""

from collections import Counter
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

from fieldmap.compare import groups, recurs
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
# The map is clustered with the first seed; the rest rerun it to test it.
SEEDS = (0, 1, 2, 3, 4)
NAME_TERMS = 5
STARTERS = 5
SHIPPED_TERMS = 150
SHIPPED_REFS = 300
# A title scoring below this share of the map's own titles is left unplaced.
FLOOR_PERCENTILE = 5
# Who is active in a subfield: the map's last five years.
ACTIVE_YEARS = 5
WHO_KINDS = ("authors", "institutions", "funders")
TOP_WHO = 5
NEIGHBOURS = 3


@dataclass(frozen=True)
class Paper:
    id: str
    doi: str | None
    title: str
    year: int
    cites: int
    text: str
    refs: tuple[str, ...]
    journal: str


def short_doi(doi: str | None) -> str | None:
    return doi.removeprefix("https://doi.org/").lower() if doi else None


def short_id(url: str) -> str:
    return url.rsplit("/", 1)[-1]


def paper(work: dict) -> Paper:
    return Paper(
        id=short_id(work["id"]),
        doi=short_doi(work.get("doi")),
        title=work["title"],
        year=work["publication_year"],
        cites=work["cited_by_count"],
        text=f"{work['title']} {abstract(work['abstract_inverted_index'])}",
        refs=tuple(map(short_id, work.get("referenced_works") or ())),
        journal=short_id(work["primary_location"]["source"]["id"]),
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


def clusters(points: np.ndarray, count: int, seed: int = 0) -> np.ndarray:
    return KMeans(count, random_state=seed, n_init=10).fit_predict(points)


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


# ---- Who: the authors, institutions and funders of recent papers --------


def named(entities) -> set[tuple[str, str]]:
    return {(e["id"], e["display_name"]) for e in entities if e.get("id")}


def credits(work: dict) -> dict[str, set]:
    authorships = work["authorships"]
    places = (i for a in authorships for i in a["institutions"])
    return {
        "authors": named(a["author"] for a in authorships),
        "institutions": named(places),
        "funders": named(work["funders"]),
    }


def top(named_sets) -> list[dict]:
    counts = Counter(e for named in named_sets for e in named)
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0][1]))
    return [{"name": n, "papers": k} for (_, n), k in ranked[:TOP_WHO]]


def who(members: list[Paper], by_id: dict[str, dict], since: int) -> dict:
    recent = [credits(by_id[p.id]) for p in members if p.year >= since]
    return {kind: top(c[kind] for c in recent) for kind in WHO_KINDS}


# ---- Neighbours: the subfields each one cites and is cited by most -------


def citation_counts(corpus, labels, count: int) -> np.ndarray:
    label_of = {p.id: k for p, k in zip(corpus, labels, strict=True)}
    pairs = [
        (k, label_of[r])
        for p, k in zip(corpus, labels, strict=True)
        for r in p.refs
        if r in label_of
    ]
    counts = np.zeros((count, count))
    np.add.at(counts, ([a for a, _ in pairs], [b for _, b in pairs]), 1)
    return counts


# Citations both ways, scaled so two large subfields aren't near only for size.
def strength(counts: np.ndarray, sizes: np.ndarray) -> np.ndarray:
    both = counts + counts.T
    np.fill_diagonal(both, 0)
    return both / np.sqrt(np.outer(sizes, sizes))


def neighbours(counts: np.ndarray, sizes: np.ndarray) -> list[list[dict]]:
    scaled = strength(counts, sizes)
    both = counts + counts.T
    return [
        [{"id": int(j), "cites": int(both[i, j])} for j in nearest(row)]
        for i, row in enumerate(scaled)
    ]


def nearest(row: np.ndarray) -> list:
    return [j for j in np.argsort(-row, kind="stable")[:NEIGHBOURS] if row[j]]


# ---- Reviews: placed by what they cite, as the page places a paper -------


def by_citations(ref_profiles: list[dict], refs: tuple[str, ...]):
    scores = [sum(w.get(r, 0) for r in refs) for w in ref_profiles]
    top = int(np.argmax(scores))
    return top if scores[top] > 0 else None


def placed(ref_profiles: list[dict], reviews: list[Paper]) -> list:
    return [by_citations(ref_profiles, r.refs) for r in reviews]


def reviewed(clusters: list, reviews: list[Paper], count: int) -> list:
    return [
        [r for r, c in zip(reviews, clusters, strict=True) if c == k]
        for k in range(count)
    ]


# ---- The map -------------------------------------------------------------


def starter(p: Paper) -> dict:
    return {"title": p.title, "doi": p.doi, "year": p.year, "cites": p.cites}


def starters(members: list[Paper]) -> list[dict]:
    by_cites = sorted(members, key=lambda p: -p.cites)
    return [starter(p) for p in by_cites[:STARTERS]]


def journals(members: list[Paper]) -> list[dict]:
    counts = Counter(p.journal for p in members)
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [{"id": j, "papers": n} for j, n in ranked]


def cluster_entry(c, members, position, terms, refs, recurred) -> dict:
    return {
        "id": c,
        "name": name(list(terms)),
        "size": len(members),
        "recurs": recurred,
        "x": round(float(position[0]), 4),
        "y": round(float(position[1]), 4),
        "starters": starters(members),
        "journals": journals(members),
        "terms": terms,
        "refs": refs,
    }


def memberships(corpus, labels, count: int) -> list[list[Paper]]:
    return [
        [p for p, k in zip(corpus, labels, strict=True) if k == c]
        for c in range(count)
    ]


def doi_clusters(corpus, labels) -> dict[str, int]:
    return {
        p.doi: int(k) for p, k in zip(corpus, labels, strict=True) if p.doi
    }


def field_map(
    works: list[dict],
    review_works: list[dict],
    who_works: list[dict],
    count: int,
    dimensions: int,
) -> dict:
    corpus = papers(works)
    points = vectors(corpus, dimensions)
    labels = clusters(points, count, SEEDS[0])
    reruns = [groups(clusters(points, count, s)) for s in SEEDS[1:]]
    recurred = [recurs(g, reruns) for g in groups(labels)]
    texts = [p.text for p in corpus]
    cited = [p.refs for p in corpus]
    terms = profiles(TERM_SETTINGS, texts, labels, count, SHIPPED_TERMS)
    refs = profiles(REF_SETTINGS, cited, labels, count, SHIPPED_REFS)
    positions = layout(points, labels, count)
    members = memberships(corpus, labels, count)
    by_id = {short_id(w["id"]): w for w in who_works}
    since = max(p.year for p in corpus) - ACTIVE_YEARS + 1
    sizes = np.array([len(m) for m in members])
    near = neighbours(citation_counts(corpus, labels, count), sizes)
    reviews = papers(review_works)
    homes = placed(refs, reviews)
    by_cluster = reviewed(homes, reviews, count)
    return {
        "papers": len(corpus),
        "stop_words": STOP_WORDS,
        "title_floor": title_floor(corpus, terms),
        "reruns": len(reruns),
        "active_since": since,
        "clusters": [
            cluster_entry(
                c, members[c], positions[c], terms[c], refs[c], recurred[c]
            )
            | {
                "who": who(members[c], by_id, since),
                "near": near[c],
                "reviews": starters(by_cluster[c]),
            }
            for c in range(count)
        ],
        "reviews": {
            "fetched": len(reviews),
            "placed": sum(h is not None for h in homes),
        },
        "dois": doi_clusters(corpus, labels),
    }
