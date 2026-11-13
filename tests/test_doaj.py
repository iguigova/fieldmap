from fieldmap import doaj

RECORD = {"bibjson": {"title": "Open"}}


def test_url_searches_by_issn():
    assert doaj.url("1234-5678") == f"{doaj.API}issn:1234-5678"


def test_journal_is_the_first_issn_doaj_lists():
    seen = []

    def fake(url):
        seen.append(url)
        return {"results": [RECORD] if url.endswith("2") else []}

    assert doaj.journal(["1", "2", "3"], fake) == RECORD
    assert seen == [doaj.url("1"), doaj.url("2")]


def test_journal_doaj_does_not_list_is_none():
    assert doaj.journal(["1", "2"], lambda url: {"results": []}) is None
