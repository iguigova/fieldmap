"""Download the scope's works from OpenAlex, one numbered page at a time.

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
PAGE_SIZE = 200
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


def abstract(inverted: dict[str, list[int]] | None) -> str:
    if not inverted:
        return ""
    placed = {i: word for word, spots in inverted.items() for i in spots}
    return " ".join(placed[i] for i in sorted(placed))
