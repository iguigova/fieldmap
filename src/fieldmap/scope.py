"""The field being mapped: its name, which journals and years count as it,
and what was measured on its map, which the page states."""

FIELD = "biostatistics"

JOURNALS = {
    "S8265502": "Biometrics",
    "S55189604": "Statistics in Medicine",
    "S190140075": "Biostatistics",
    "S150263959": "Statistical Methods in Medical Research",
    "S126457381": "Biometrical Journal",
    "S185874209": "BMC Medical Research Methodology",
    "S89613883": "Statistics in Biosciences",
    "S96961628": "The International Journal of Biostatistics",
}
YEARS = (2015, 2025)
CLUSTERS = 40
ARTICLE = "article"
REVIEW = "review"
# Measured on this field's map; README.md says how.
NOTES = {
    "placement": (
        "Tested on a fifth of the map's own papers, held back while the rest "
        "built the subfields, citations picked the paper's own subfield two "
        "times in three, and title words about half the time."
    ),
    "who": (
        "OpenAlex sometimes credits a paper to the wrong person of the same "
        "name: of 58 recent papers it credits to Yale's Fan Li, one is by "
        "Duke's Fan Li, and one by both credits both to Yale's. It names a "
        "funder and its parts separately: of 581 recent papers that name the "
        "National Cancer Institute, 397 also name the National Institutes of "
        "Health, and only those count for both."
    ),
}


def works_filter(kind: str, year: int) -> str:
    sources = "|".join(JOURNALS)
    return (
        f"primary_location.source.id:{sources},"
        f"publication_year:{year},"
        f"type:{kind}"
    )


def works_filters(kind: str) -> list[str]:
    first, last = YEARS
    return [works_filter(kind, year) for year in range(first, last + 1)]
