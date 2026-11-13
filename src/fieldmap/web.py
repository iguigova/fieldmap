"""Read JSON from the web, as one named client."""

import json
import urllib.request

USER_AGENT = "fieldmap/0.1"


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)
