import json
from pathlib import Path

import numpy as np

from fieldmap import build
from tests.conftest import credit, ref, work

TITLE_TERMS = json.loads(Path("tests/title_terms.json").read_text())


def built(works, reviews=()):
    who_works = [credit(w) for w in works]
    return build.field_map(works, list(reviews), who_works, 3, 2)


def cluster_of(field_map, theme):
    return field_map["dois"][f"10.1/{theme}0"]


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
    return build.Paper(pid, None, pid, 2020, 0, pid, refs, "S1", True)


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


def test_a_cluster_counts_its_papers_per_journal_most_first(works):
    for c in built(works)["clusters"]:
        assert [j["id"] for j in c["journals"]] == ["S1", "S2"]
        assert [j["papers"] for j in c["journals"]] == [9, 3]


def test_a_review_is_placed_where_its_citations_point(works, reviews):
    field_map = built(works, reviews)
    spatial = field_map["clusters"][cluster_of(field_map, "spatial")]
    assert [r["cites"] for r in spatial["reviews"]] == [2, 1]


def test_a_review_citing_nothing_on_the_map_is_unplaced(works, reviews):
    assert built(works, reviews)["reviews"] == {"fetched": 3, "placed": 2}


def test_by_citations_picks_the_first_highest_score():
    profiles = [{"a": 0.5}, {"a": 0.5, "b": 0.1}, {"b": 1.0}]
    assert build.by_citations(profiles, ("a",)) == 0
    assert build.by_citations(profiles, ("a", "b")) == 2
    assert build.by_citations(profiles, ("z",)) is None


def test_a_review_needs_a_profile_term_to_score():
    assert build.by_citations([{ref("x", 0): 0.0}], (ref("x", 0),)) is None


def test_reading_order_breaks_a_loop_at_its_highest_ranked_paper(works):
    field_map = built(works)
    spatial = field_map["clusters"][cluster_of(field_map, "spatial")]
    assert [
        (r["title"], r["inside"], r["after"]) for r in spatial["reading"]
    ] == [
        ("spatial paper 0", 7, []),
        ("spatial paper 2", 7, [1]),
        ("spatial paper 1", 7, [2]),
    ]


def test_reading_order_puts_each_paper_after_those_it_cites():
    corpus = [
        paper("a", ("b",)),
        paper("b", ("c",)),
        paper("c", ()),
        paper("d", ("a", "a")),
        paper("e", ("a", "b")),
    ]
    assert [(r["title"], r["after"]) for r in build.reading(corpus)] == [
        ("c", []),
        ("b", [1]),
        ("a", [2]),
    ]


def test_reading_order_holds_only_papers_its_subfield_cites():
    corpus = [paper("a", ("x",)), paper("b", ("x",)), paper("x", ())]
    assert [r["title"] for r in build.reading(corpus)] == ["x"]


def test_reading_order_stops_at_its_length():
    count = build.READING + 2
    corpus = [paper(f"p{n:02}", (f"p{n + 1:02}",)) for n in range(count)]
    assert len(build.reading(corpus)) == build.READING


def test_placement_places_the_held_back_papers_by_the_rest(works):
    tested = built(works)["placement"]
    assert 0 < tested["held_back"] < 36
    assert tested["by_citations"] == tested["held_back"]
    # Every fixture title scores its theme's floor exactly, and only a title
    # above the floor is placed.
    assert tested["by_title"] == 0


def test_a_title_below_the_floor_is_unplaced():
    profiles = [{"spatial": 1.0}, {"missing": 0.5}]
    assert build.by_title(profiles, 0.6, "Missing spatial") == 0
    assert build.by_title(profiles, 0.6, "Missing values") is None
    assert build.by_title(profiles, 1.0, "Spatial") is None


def test_an_abstract_keeps_only_its_authors_words():
    latex = (
        r"the \documentclass{minimal} \usepackage{x} $$x$$\end{document} index"
    )
    assert build.own_words(latex) == "the   index"
    for notice in (
        "Fit. Copyright © 2015 John Wiley & Sons, Ltd.",
        "Fit. © 2015 The Authors.",
        "Fit. (PsycInfo Database Record (c) 2025 APA, all rights reserved).",
        "Fit. (PsycINFO Database Record",
    ):
        assert build.own_words(notice) == "Fit."
    assert build.own_words("copyright-free images") == "copyright-free images"


def bare(n: int, cites: list[str], title: str) -> dict:
    return work(n, "bare", "x") | {
        "abstract_inverted_index": None,
        "referenced_works": cites,
        "title": title,
    }


def test_a_paper_without_an_abstract_is_placed_not_clustered(works):
    extra = [
        bare(1, [ref("missing", 0), ref("missing", 1)], "Notes"),
        bare(2, [], "Spatial disease mapping smoothing"),
        bare(3, [], "Notes"),
    ]
    field_map = built(works + extra)
    assert field_map["without_abstract"] == {"papers": 3, "placed": 2}
    assert field_map["dois"]["10.1/bare1"] == cluster_of(field_map, "missing")
    assert field_map["dois"]["10.1/bare2"] == cluster_of(field_map, "spatial")
    assert "10.1/bare3" not in field_map["dois"]
    assert field_map["papers"] == 38


def test_an_abstract_of_only_a_notice_is_no_abstract():
    notice = {"Copyright": [0], "©": [1], "2015": [2]}
    assert not build.paper(
        work(1, "a", "a") | {"abstract_inverted_index": notice}
    ).abstract


def test_front_matter_titled_alike_in_every_issue_is_not_a_paper(works):
    front = dict(works[0], title="Subscription Page")
    assert len(build.papers([*works, front])) == 36
