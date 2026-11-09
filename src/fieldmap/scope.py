"""The field being mapped: which journals and years count as biostatistics."""

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


def works_filter(year: int) -> str:
    sources = "|".join(JOURNALS)
    return (
        f"primary_location.source.id:{sources},"
        f"publication_year:{year},"
        "type:article"
    )


def works_filters() -> list[str]:
    first, last = YEARS
    return [works_filter(year) for year in range(first, last + 1)]
