"""Epidemiology: eight general journals, and subfields any epidemiologist
would expect a map of them to find."""

from fieldmap.fields import Field

FIELD = Field(
    slug="epidemiology",
    name="epidemiology",
    journals={
        "S170967050": "American Journal of Epidemiology",
        "S15470582": "Epidemiology",
        "S13389975": "International Journal of Epidemiology",
        "S48690275": "European Journal of Epidemiology",
        "S64418186": "Journal of Clinical Epidemiology",
        "S40844199": "Annals of Epidemiology",
        "S156988948": "Journal of Epidemiology & Community Health",
        "S134018196": "Paediatric and Perinatal Epidemiology",
    },
    years=(2015, 2025),
    clusters=40,
    named={
        "causal inference": (
            "causal",
            "mediation",
            "confounding",
            "mendelian randomization",
        ),
        "cancer": ("cancer", "tumor"),
        "cardiovascular": (
            "cardiovascular",
            "heart",
            "stroke",
            "blood pressure",
            "hypertension",
        ),
        "infectious disease": (
            "covid",
            "hiv",
            "influenza",
            "vaccine",
            "infection",
        ),
        "perinatal": (
            "pregnancy",
            "birth",
            "preterm",
            "maternal",
            "gestational",
        ),
    },
    held_out={
        "diet": ("diet", "dietary", "nutrition", "food"),
        "air pollution": ("air pollution", "pollution"),
        "mental health": ("depression", "suicide", "mental"),
        "research methods": (
            "systematic",
            "reporting",
            "risk of bias",
            "meta-analysis",
        ),
        "social inequality": (
            "socioeconomic",
            "income",
            "racial",
            "inequalities",
            "deprivation",
        ),
    },
    held_out_needed=4,
)
