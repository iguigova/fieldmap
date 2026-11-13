import json

import pytest

from fieldmap import cli, scope
from tests.test_check import PASSING


def write(path, works):
    path.write_text("".join(json.dumps(w) + "\n" for w in works))
    return path


@pytest.fixture
def raw(tmp_path, works):
    (tmp_path / "raw").mkdir()
    return write(tmp_path / "raw" / "works.jsonl", works)


@pytest.fixture
def who(raw, who_works):
    return write(raw.parent / "who.jsonl", who_works)


def test_fetch_writes_every_page_of_every_year(tmp_path, monkeypatch):
    monkeypatch.setattr(scope, "works_filters", lambda: ["a", "b"])
    monkeypatch.setattr(cli.openalex, "pages", lambda q: [[{"q": q}], [{}]])
    raw = tmp_path / "raw" / "works.jsonl"
    assert cli.main(["fetch", "--raw", str(raw)]) == 0
    assert len(cli.read_works(raw)) == 4


def echo(ids):
    return [[{"id": i} for i in ids]]


def test_who_fetches_the_credits_of_every_work(raw, monkeypatch, capsys):
    monkeypatch.setattr(cli.openalex, "who", echo)
    out = raw.parent / "who.jsonl"
    assert cli.main(["who", "--raw", str(raw), "--who", str(out)]) == 0
    assert len(cli.read_works(out)) == 38
    assert capsys.readouterr().out.startswith("38 of 38")


def test_build_writes_the_map_with_its_scope(raw, who, tmp_path, monkeypatch):
    monkeypatch.setattr(scope, "CLUSTERS", 3)
    monkeypatch.setattr(cli, "DIMENSIONS", 2)
    out = tmp_path / "map.json"
    args = ["build", "--raw", str(raw), "--who", str(who), "--map", str(out)]
    assert cli.main(args) == 0
    built = json.loads(out.read_text())
    assert built["papers"] == 36
    assert built["scope"]["years"] == list(scope.YEARS)


@pytest.mark.parametrize(
    ("field_map", "status"), [(PASSING, 0), ({"clusters": []}, 1)]
)
def test_check_exits_with_the_verdict(tmp_path, field_map, status):
    out = tmp_path / "map.json"
    out.write_text(json.dumps(field_map))
    assert cli.main(["check", "--map", str(out)]) == status


def test_stability_reports_each_k(raw, monkeypatch, capsys):
    monkeypatch.setattr(cli.stability, "KS", (2, 3))
    monkeypatch.setattr(cli, "SEEDS", (0, 1))
    monkeypatch.setattr(cli, "DIMENSIONS", 2)
    monkeypatch.setattr(scope, "CLUSTERS", 3)
    assert cli.main(["stability", "--raw", str(raw)]) == 0
    assert len(capsys.readouterr().out.splitlines()) == 3
