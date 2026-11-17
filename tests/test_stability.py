import pytest

from fieldmap import stability


@pytest.fixture
def runs(works, field):
    return stability.stability(works, (2, 3), (0, 1), 2, field)


def test_the_themes_are_stable_at_their_own_k(runs):
    at_three = runs[1]
    assert (at_three["ari"], at_three["seeds"], at_three["map"]) == (1, 1, 1)


def test_the_check_runs_on_every_seed(runs):
    assert [(r["passes"], r["runs"]) for r in runs] == [(0, 2), (0, 2)]


def test_report_has_a_line_per_k(runs):
    lines = stability.report(runs).splitlines()
    assert lines[0] == stability.HEADER
    assert lines[2].startswith("3   1.00")
    assert lines[2].endswith("0 of 2")
