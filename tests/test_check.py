import dataclasses

import pytest

from fieldmap import check, fields

FIELD = fields.load("biostatistics")


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
    assert check.verdict(PASSING, FIELD)["passed"]


def test_a_missing_named_subfield_fails():
    clusters = [c for c in PASSING["clusters"] if c["name"] != ["spatial"]]
    assert not check.verdict({"clusters": clusters}, FIELD)["passed"]


def test_report_names_what_was_found_and_what_was_missing():
    text = check.report(PASSING, FIELD)
    assert "found    spatial statistics: spatial" in text
    assert "MISSING  multiple testing" in text
    assert text.endswith("PASS")


def test_report_fails_a_map_missing_subfields():
    assert check.report(field_map(("spatial",)), FIELD).endswith("FAIL")


@pytest.mark.parametrize("slug", fields.SLUGS)
def test_every_field_names_what_its_check_needs(slug):
    field = fields.load(slug)
    assert field.slug == slug
    assert field.journals and field.named
    assert field.held_out_needed <= len(field.held_out)


def test_a_fields_settings_are_read_only():
    with pytest.raises(dataclasses.FrozenInstanceError):
        FIELD.clusters = 3
