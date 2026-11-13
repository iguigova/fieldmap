"""Look a journal up in the Directory of Open Access Journals, by ISSN."""

from collections.abc import Callable

from fieldmap.web import fetch_json

API = "https://doaj.org/api/search/journals/"

Fetch = Callable[[str], dict]


def url(issn: str) -> str:
    return f"{API}issn:{issn}"


def journal(issns: list[str], fetch: Fetch = fetch_json) -> dict | None:
    """The record of the first ISSN DOAJ lists; None when it lists none."""
    for issn in issns:
        if results := fetch(url(issn))["results"]:
            return results[0]
    return None
