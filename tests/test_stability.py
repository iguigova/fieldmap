from fieldmap import stability


def runs(works):
    return stability.stability(works, (2, 3), (0, 1), 2, 3)


def test_the_themes_are_stable_at_their_own_k(works):
    at_three = runs(works)[1]
    assert (at_three["ari"], at_three["seeds"], at_three["map"]) == (1, 1, 1)


def test_the_check_runs_on_every_seed(works):
    assert [(r["passes"], r["runs"]) for r in runs(works)] == [(0, 2), (0, 2)]


def test_report_has_a_line_per_k(works):
    lines = stability.report(runs(works)).splitlines()
    assert lines[0] == stability.HEADER
    assert lines[2].startswith("3   1.00")
    assert lines[2].endswith("0 of 2")
