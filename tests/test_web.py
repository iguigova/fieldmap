import io
import json

from fieldmap import web


def test_fetch_json_reads_the_response_as_the_named_client(monkeypatch):
    seen = {}

    def fake_urlopen(request, timeout):
        seen["agent"] = request.get_header("User-agent")
        return io.BytesIO(json.dumps({"results": []}).encode())

    monkeypatch.setattr(web.urllib.request, "urlopen", fake_urlopen)
    assert web.fetch_json("https://x.org") == {"results": []}
    assert seen["agent"] == web.USER_AGENT
