from fieldmap import venues

HYBRID = {
    "id": "https://openalex.org/S1",
    "display_name": "Hybrid",
    "issn": ["0000-0001"],
    "host_organization_name": "Press",
    "homepage_url": "https://hybrid.org",
    "is_oa": False,
    "apc_usd_by_year": [
        {"year": 2024, "price": 3000},
        {"year": 2025, "price": 3100},
        {"year": 2023, "price": 2900},
    ],
    "listed_in": ["medline", "doyens"],
}
OPEN = HYBRID | {
    "issn": [],
    "id": "https://openalex.org/S2",
    "is_oa": True,
    "apc_usd_by_year": None,
    "listed_in": None,
}


def record(**bib):
    return {
        "bibjson": {
            "pissn": "0000-0002",
            "apc": {"has_apc": True, "url": "https://open.org/fee"},
            "waiver": {"has_waiver": True, "url": "https://open.org/waiver"},
            "license": [{"type": "CC BY"}, {"type": "CC BY-NC-ND"}],
        }
        | bib
    }


def test_fee_is_the_latest_year_listed():
    assert venues.fee(HYBRID) == {"usd": 3100, "year": 2025}


def test_no_fee_listed_is_none_not_zero():
    assert venues.fee(OPEN) is None


def test_listing_links_doaj_by_the_online_issn_first():
    assert venues.listing(record(eissn="0000-0003"))["url"].endswith("3")
    assert venues.listing(record())["url"] == venues.DOAJ_PAGE + "0000-0002"


def test_listing_carries_waiver_and_licences():
    assert venues.listing(record()) == {
        "url": venues.DOAJ_PAGE + "0000-0002",
        "fee_url": "https://open.org/fee",
        "waiver": True,
        "waiver_url": "https://open.org/waiver",
        "licences": ["CC BY", "CC BY-NC-ND"],
    }


def test_a_journal_doaj_does_not_list_has_no_listing():
    assert venues.listing(None) is None


def test_journal_states_access_fee_and_lists():
    hybrid = venues.journal(HYBRID, None)
    assert hybrid["open_access"] is False
    assert hybrid["medline"] is True
    assert hybrid["doaj"] is None
    assert venues.journal(OPEN, record())["medline"] is False


def test_venues_key_each_journal_by_its_short_id():
    fetched = {
        "fetched": "2026-11-13",
        "sources": [HYBRID, OPEN],
        "doaj": {"S1": None, "S2": record()},
    }
    built = venues.venues(fetched)
    assert built["fetched"] == "2026-11-13"
    assert built["journals"]["S1"]["name"] == "Hybrid"
    assert built["journals"]["S2"]["doaj"]["waiver"] is True
