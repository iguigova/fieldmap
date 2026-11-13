import io
import json
import urllib.parse

from fieldmap import openalex, scope


def test_page_url_asks_for_one_numbered_page_of_the_filter():
    query = urllib.parse.parse_qs(
        urllib.parse.urlsplit(openalex.page_url("f:1", 3)).query
    )
    assert query["filter"] == ["f:1"]
    assert query["page"] == ["3"]
    assert query["per_page"] == ["200"]


def test_pages_stop_at_the_first_empty_page():
    served = {1: [1, 2], 2: [3], 3: []}

    def fake(url):
        number = int(
            urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["page"][0]
        )
        return {"results": served[number]}

    assert list(openalex.pages("f", fake)) == [[1, 2], [3]]


def test_fetch_json_reads_the_response(monkeypatch):
    seen = {}

    def fake_urlopen(request, timeout):
        seen["agent"] = request.get_header("User-agent")
        return io.BytesIO(json.dumps({"results": []}).encode())

    monkeypatch.setattr(openalex.urllib.request, "urlopen", fake_urlopen)
    assert openalex.fetch_json("https://x.org") == {"results": []}
    assert seen["agent"] == openalex.USER_AGENT


def test_abstract_restores_word_order():
    assert openalex.abstract({"b": [1], "a": [0, 2]}) == "a b a"


def test_abstract_of_nothing_is_empty():
    assert openalex.abstract(None) == ""


def test_scope_asks_one_query_per_year():
    filters = scope.works_filters()
    assert len(filters) == scope.YEARS[1] - scope.YEARS[0] + 1
    assert "publication_year:2015," in filters[0]


def test_who_asks_for_ids_in_batches_of_the_filter_limit():
    seen = []

    def fake(url):
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        seen.append(query["filter"][0].removeprefix("openalex:").split("|"))
        return {"results": [query["select"][0]]}

    ids = [f"W{n}" for n in range(openalex.ID_BATCH + 1)]
    assert list(openalex.who(ids, fake)) == [[openalex.WHO_FIELDS]] * 2
    assert [len(batch) for batch in seen] == [openalex.ID_BATCH, 1]
