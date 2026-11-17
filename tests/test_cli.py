import json

import pytest

from fieldmap import cli, fields, scope
from tests.test_check import PASSING
from tests.test_venues import HYBRID, OPEN


def write(path, works):
    path.write_text("".join(json.dumps(w) + "\n" for w in works))
    return path


@pytest.fixture(autouse=True)
def small(monkeypatch, tmp_path, field):
    monkeypatch.setattr(cli.fields, "load", lambda slug: field)
    monkeypatch.setattr(cli, "DATA", tmp_path / "data")
    return field


@pytest.fixture
def raw(tmp_path, works):
    (tmp_path / "raw").mkdir()
    return write(tmp_path / "raw" / "works.jsonl", works)


@pytest.fixture
def reviewed(raw, reviews):
    return write(raw.parent / "reviews.jsonl", reviews)


@pytest.fixture
def who(raw, who_works):
    return write(raw.parent / "who.jsonl", who_works)


@pytest.mark.parametrize(
    ("command", "flag", "kind"),
    [("fetch", "--raw", "article"), ("reviews", "--reviews", "review")],
)
def test_fetch_writes_every_page_of_every_year_of_its_kind(
    tmp_path, monkeypatch, command, flag, kind
):
    monkeypatch.setattr(scope, "works_filters", lambda f, k: [k, "b"])
    monkeypatch.setattr(cli.openalex, "pages", lambda q: [[{"q": q}], [{}]])
    out = tmp_path / "raw" / "works.jsonl"
    assert cli.main([command, flag, str(out)]) == 0
    assert cli.read_works(out)[0] == {"q": kind}
    assert len(cli.read_works(out)) == 4


def echo(ids):
    return [[{"id": i} for i in ids]]


def test_who_fetches_the_credits_of_every_work(raw, monkeypatch, capsys):
    monkeypatch.setattr(cli.openalex, "who", echo)
    out = raw.parent / "who.jsonl"
    assert cli.main(["who", "--raw", str(raw), "--who", str(out)]) == 0
    assert len(cli.read_works(out)) == 38
    assert capsys.readouterr().out.startswith("38 of 38")


def test_venues_writes_each_journal_and_its_doaj_record(
    tmp_path, monkeypatch, capsys
):
    monkeypatch.setattr(cli.openalex, "sources", lambda ids: [HYBRID, OPEN])
    monkeypatch.setattr(
        cli.doaj, "journal", lambda issns: {"bibjson": {}} if issns else None
    )
    out = tmp_path / "venues.json"
    assert cli.main(["venues", "--venues", str(out)]) == 0
    fetched = json.loads(out.read_text())
    assert fetched["doaj"] == {"S1": {"bibjson": {}}, "S2": None}
    assert capsys.readouterr().out.startswith("2 journals, 1 in DOAJ")


def test_build_writes_the_map_with_its_scope_and_venues(
    raw, reviewed, who, tmp_path, monkeypatch, capsys
):
    monkeypatch.setattr(cli, "DIMENSIONS", 2)
    fetched = raw.parent / "venues.json"
    fetched.write_text(
        json.dumps(
            {
                "fetched": "2026-11-13",
                "sources": [HYBRID],
                "doaj": {"S1": None},
            }
        )
    )
    out = tmp_path / "map.json"
    args = ["build", "--raw", str(raw), "--who", str(who)]
    args += ["--reviews", str(reviewed)]
    args += ["--venues", str(fetched), "--map", str(out)]
    assert cli.main(args) == 0
    assert capsys.readouterr().out.endswith(", 2 of 3 reviews placed\n")
    built = json.loads(out.read_text())
    assert built["papers"] == 36
    assert built["scope"]["years"] == [2015, 2025]
    assert built["scope"]["field"] == "biostatistics"
    assert built["scope"]["who_note"].startswith("OpenAlex sometimes")
    assert built["venues"]["journals"]["S1"]["name"] == "Hybrid"
    index = json.loads((tmp_path / "fields.json").read_text())
    assert index == [{"slug": "biostatistics", "name": "biostatistics"}]


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
    assert cli.main(["stability", "--raw", str(raw)]) == 0
    assert len(capsys.readouterr().out.splitlines()) == 3


def test_a_fields_files_default_to_its_own_folder(monkeypatch, tmp_path):
    monkeypatch.setattr(scope, "works_filters", lambda f, k: [k])
    monkeypatch.setattr(cli.openalex, "pages", lambda q: [[{"q": q}]])
    assert cli.main(["reviews"]) == 0
    folder = tmp_path / "data" / "raw" / "biostatistics"
    assert cli.read_works(folder / "reviews.jsonl") == [{"q": "review"}]
    args = cli.parser().parse_args(["check"])
    args.field = fields.load(args.field)
    assert cli.map_path(args) == tmp_path / "data" / "biostatistics.json"


def test_an_unknown_field_is_refused():
    with pytest.raises(SystemExit):
        cli.main(["build", "--field", "alchemy"])
