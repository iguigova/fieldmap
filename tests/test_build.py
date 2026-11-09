from fieldmap import build


def built(works):
    return build.field_map(works, 3, 2)


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
