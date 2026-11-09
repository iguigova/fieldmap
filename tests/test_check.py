from fieldmap import check


def field_map(*names):
    return {
        "clusters": [{"id": i, "name": list(n)} for i, n in enumerate(names)]
    }


PASSING = field_map(
    ("causal",),
    ("meta",),
    ("machine learning",),
    ("spatial",),
    ("missing",),
    ("survival",),
    ("trial",),
    ("longitudinal",),
    ("gene",),
)


def test_a_term_holds_only_as_whole_words():
    assert check.holds("meta", "network meta")
    assert not check.holds("meta", "metabolic")
    assert not check.holds("meta", "meta-regression")
    assert check.holds("meta-analysis", "meta-analysis")


def test_every_named_subfield_and_four_held_out_pass():
    assert check.verdict(PASSING)["passed"]


def test_a_missing_named_subfield_fails():
    clusters = [c for c in PASSING["clusters"] if c["name"] != ["spatial"]]
    assert not check.verdict({"clusters": clusters})["passed"]


def test_report_names_what_was_found_and_what_was_missing():
    text = check.report(PASSING)
    assert "found    spatial statistics: spatial" in text
    assert "MISSING  multiple testing" in text
    assert text.endswith("PASS")


def test_report_fails_a_map_missing_subfields():
    assert check.report(field_map(("spatial",))).endswith("FAIL")
