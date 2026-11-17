"""Biostatistics: eight general journals, and the subfields named in the
Academia.SE question that started the map."""

from fieldmap.fields import Field

FIELD = Field(
    slug="biostatistics",
    name="biostatistics",
    journals={
        "S8265502": "Biometrics",
        "S55189604": "Statistics in Medicine",
        "S190140075": "Biostatistics",
        "S150263959": "Statistical Methods in Medical Research",
        "S126457381": "Biometrical Journal",
        "S185874209": "BMC Medical Research Methodology",
        "S89613883": "Statistics in Biosciences",
        "S96961628": "The International Journal of Biostatistics",
    },
    years=(2015, 2025),
    clusters=40,
    named={
        "causal inference": ("causal", "propensity", "instrumental"),
        "research synthesis": (
            "meta-analysis",
            "meta",
            "network meta-analysis",
        ),
        "ML methods": (
            "machine learning",
            "learning",
            "random forest",
            "neural",
        ),
        "spatial statistics": ("spatial",),
        "missing data": ("missing", "imputation"),
    },
    held_out={
        "survival analysis": ("survival", "hazard", "competing risks"),
        "clinical trial design": ("trial", "trials", "dose", "adaptive"),
        "longitudinal data": ("longitudinal", "mixed", "repeated measures"),
        "multiple testing": ("multiple testing", "false discovery"),
        "statistical genetics": ("genetic", "gwas", "genomic", "snp", "gene"),
    },
    held_out_needed=4,
    who_note=(
        "OpenAlex sometimes credits a paper to the wrong person of the same "
        "name: of 59 recent papers it credits to Yale's Fan Li, one is by "
        "Duke's Fan Li, and one by both credits both to Yale's. It names a "
        "funder and its parts separately: of 580 recent papers that name the "
        "National Cancer Institute, 396 also name the National Institutes of "
        "Health, and only those count for both."
    ),
)
