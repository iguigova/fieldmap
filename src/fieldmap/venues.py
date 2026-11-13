"""Turn the journals' OpenAlex and DOAJ records into the facts the page
shows: what each charges, whether it waives the charge, which licences it
publishes under and where it is listed."""

from fieldmap.build import short_id

DOAJ_PAGE = "https://doaj.org/toc/"
MEDLINE = "medline"


def fee(source: dict) -> dict | None:
    by_year = source.get("apc_usd_by_year") or []
    latest = max(by_year, key=lambda f: f["year"], default=None)
    return {"usd": latest["price"], "year": latest["year"]} if latest else None


def listing(record: dict | None) -> dict | None:
    if record is None:
        return None
    bib = record["bibjson"]
    return {
        "url": DOAJ_PAGE + (bib.get("eissn") or bib["pissn"]),
        "fee_url": bib["apc"].get("url"),
        "waiver": bib["waiver"]["has_waiver"],
        "waiver_url": bib["waiver"].get("url"),
        "licences": [lic["type"] for lic in bib["license"]],
    }


def journal(source: dict, record: dict | None) -> dict:
    return {
        "name": source["display_name"],
        "publisher": source["host_organization_name"],
        "homepage": source["homepage_url"],
        "openalex": source["id"],
        "open_access": source["is_oa"],
        "fee": fee(source),
        "medline": MEDLINE in (source["listed_in"] or []),
        "doaj": listing(record),
    }


def venues(fetched: dict) -> dict:
    """The page's venues, from what `fieldmap venues` wrote."""
    return {
        "fetched": fetched["fetched"],
        "journals": {
            short_id(s["id"]): journal(s, fetched["doaj"][short_id(s["id"])])
            for s in fetched["sources"]
        },
    }
