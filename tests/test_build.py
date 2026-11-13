import json
from pathlib import Path

import numpy as np

from fieldmap import build
from tests.conftest import credit

TITLE_TERMS = json.loads(Path("tests/title_terms.json").read_text())


def built(works):
    return build.field_map(works, [credit(w) for w in works], 3, 2)


def test_front_matter_and_untitled_works_are_not_papers(works):
    assert len(build.papers(works)) == 36


def test_short_doi_drops_the_resolver_and_lowercases():
    assert build.short_doi("https://doi.org/10.1/AB") == "10.1/ab"
    assert build.short_doi(None) is None


def test_each_theme_is_one_cluster(works):
    field_map = built(works)
    themes = {
        frozenset(
            d.split("/")[1].rstrip("0123456789")
            for d, c in field_map["dois"].items()
            if c == k
        )
        for k in range(3)
    }
    assert themes == {
        frozenset({"spatial"}),
        frozenset({"missing"}),
        frozenset({"survival"}),
    }


def test_a_cluster_is_named_by_its_theme_words(works):
    names = {
        w
        for c in built(works)["clusters"]
        for n in c["name"]
        for w in n.split()
    }
    assert {"spatial", "missing", "survival"} <= names


def test_a_cluster_lists_its_most_cited_papers_first(works):
    starters = built(works)["clusters"][0]["starters"]
    assert [s["cites"] for s in starters] == [11, 10, 9, 8, 7]


def test_layout_spans_the_unit_square(works):
    clusters = built(works)["clusters"]
    xs = [c["x"] for c in clusters]
    assert min(xs) == 0 and max(xs) == 1


def test_name_skips_terms_that_repeat_a_chosen_one():
    ranked = ["missing", "missing data", "data missing", "a", "b", "c", "d"]
    assert build.name(ranked) == ["missing", "a", "b", "c", "d"]


def test_a_cluster_profiles_the_works_its_papers_cite(works):
    for c in built(works)["clusters"]:
        theme = c["name"][0]
        assert set(c["refs"]) == {f"W{theme}{n}" for n in range(3)}
        assert max(c["refs"].values()) == 1


def test_weights_keep_only_terms_that_score():
    vocabulary = np.array(["a", "b", "c"])
    assert build.weights(np.array([2.0, 0, 1.0]), vocabulary, 3) == {
        "a": 1,
        "c": 0.5,
    }
    assert build.weights(np.zeros(3), vocabulary, 3) == {}


def test_the_map_ships_how_the_page_reads_titles(works):
    field_map = built(works)
    assert field_map["stop_words"] == build.STOP_WORDS
    assert 0 < field_map["title_floor"] <= 1


def test_title_terms_match_the_fixture_the_page_is_tested_on():
    for case in TITLE_TERMS:
        assert build.title_terms(case["title"]) == case["terms"]


def test_each_theme_recurs_in_every_rerun(works):
    field_map = built(works)
    assert field_map["reruns"] == len(build.SEEDS) - 1
    assert {c["recurs"] for c in field_map["clusters"]} == {
        field_map["reruns"]
    }


def test_a_cluster_names_who_works_in_it_and_who_funds_it(works):
    for c in built(works)["clusters"]:
        theme = c["name"][0]
        assert c["who"] == {
            "authors": [{"name": f"{theme} author", "papers": 12}],
            "institutions": [{"name": f"{theme} university", "papers": 12}],
            "funders": [{"name": "NIH", "papers": 6}],
        }


def test_who_counts_only_papers_since_the_active_year(works, who_works):
    members = build.papers(works)[:12]
    by_id = {build.short_id(w["id"]): w for w in who_works}
    assert build.who(members, by_id, 2021)["authors"] == []


def test_the_active_years_are_the_maps_last_five(works):
    assert built(works)["active_since"] == 2016


def test_who_ranks_by_papers_then_name():
    named_sets = [{("2", "b"), ("1", "a")}, {("2", "b")}, {("3", "c")}]
    assert build.top(named_sets) == [
        {"name": "b", "papers": 2},
        {"name": "a", "papers": 1},
        {"name": "c", "papers": 1},
    ]


def paper(pid: str, refs: tuple[str, ...]) -> build.Paper:
    return build.Paper(pid, None, pid, 2020, 0, pid, refs)


def test_citation_counts_count_citations_from_one_cluster_to_another():
    corpus = [paper("a", ("b", "x")), paper("b", ("c",)), paper("c", ())]
    counts = build.citation_counts(corpus, np.array([0, 1, 1]), 2)
    assert counts.tolist() == [[0, 1], [0, 1]]


def test_neighbours_are_the_strongest_scaled_by_size():
    counts = np.array([[5, 4, 1, 0], [0, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0]])
    sizes = np.array([1, 100, 1, 1])
    near = build.neighbours(counts, sizes)
    assert near[0] == [{"id": 2, "cites": 2}, {"id": 1, "cites": 4}]
    assert near[3] == []


def test_themes_citing_only_themselves_have_no_neighbours(works):
    assert all(c["near"] == [] for c in built(works)["clusters"])
