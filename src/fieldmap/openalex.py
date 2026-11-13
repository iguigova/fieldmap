"""Download the scope's works from OpenAlex, one numbered page at a time,
and who wrote and funded them, by their ids.

Numbered pages need no API key and reach the first 10,000 results of a query,
so a caller keeps each query under that.
"""

import json
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterator

API = "https://api.openalex.org/works"
FIELDS = (
    "id,doi,title,publication_year,cited_by_count,"
    "abstract_inverted_index,referenced_works,primary_location"
)
# Who wrote a work, where they work, and who paid for it.
WHO_FIELDS = "id,authorships,funders"
PAGE_SIZE = 200
# OpenAlex takes up to 100 values in one filter.
ID_BATCH = 100
USER_AGENT = "fieldmap/0.1"

Fetch = Callable[[str], dict]


def page_url(works_filter: str, number: int) -> str:
    query = {
        "filter": works_filter,
        "select": FIELDS,
        "per_page": PAGE_SIZE,
        "page": number,
    }
    return f"{API}?{urllib.parse.urlencode(query)}"


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def pages(works_filter: str, fetch: Fetch = fetch_json) -> Iterator[list]:
    number = 1
    while results := fetch(page_url(works_filter, number))["results"]:
        yield results
        number += 1


def ids_url(ids: list[str]) -> str:
    query = {
        "filter": f"openalex:{'|'.join(ids)}",
        "select": WHO_FIELDS,
        "per_page": ID_BATCH,
    }
    return f"{API}?{urllib.parse.urlencode(query)}"


def who(ids: list[str], fetch: Fetch = fetch_json) -> Iterator[list]:
    for start in range(0, len(ids), ID_BATCH):
        yield fetch(ids_url(ids[start : start + ID_BATCH]))["results"]


def abstract(inverted: dict[str, list[int]] | None) -> str:
    if not inverted:
        return ""
    placed = {i: word for word, spots in inverted.items() for i in spots}
    return " ".join(placed[i] for i in sorted(placed))
