"""Psychology methods: eleven journals of quantitative psychology and
psychometrics, and the subfields their readers would expect a map to find."""

from fieldmap.fields import Field

FIELD = Field(
    slug="psychology-methods",
    name="psychology methods",
    journals={
        "S45419345": "Psychological Methods",
        "S186480540": "Psychometrika",
        "S64250036": "Multivariate Behavioral Research",
        "S137478622": "Behavior Research Methods",
        "S78020522": "Structural Equation Modeling",
        "S190099528": (
            "British Journal of Mathematical and Statistical Psychology"
        ),
        "S176831015": "Educational and Psychological Measurement",
        "S94663699": "Applied Psychological Measurement",
        "S30638350": "Journal of Educational Measurement",
        "S53135262": "Journal of Educational and Behavioral Statistics",
        "S4210173062": (
            "Advances in Methods and Practices in Psychological Science"
        ),
    },
    years=(2015, 2025),
    clusters=40,
    named={
        "structural equation modeling": (
            "structural equation",
            "sem",
            "factor",
            "latent",
        ),
        "item response theory": ("item response", "irt", "item"),
        "missing data": ("missing", "imputation"),
        "meta-analysis": (
            "meta-analysis",
            "meta",
            "publication bias",
            "effect sizes",
        ),
        "Bayesian methods": ("bayesian", "bayes factor", "prior"),
    },
    held_out={
        "multilevel and longitudinal": (
            "multilevel",
            "longitudinal",
            "growth",
            "mixed",
        ),
        "mediation": ("mediation", "indirect"),
        "measurement invariance": ("invariance", "dif", "differential item"),
        "replication": ("replication", "preregistration", "reproducibility"),
        "experiment software": (
            "eye",
            "tracking",
            "online",
            "software",
            "reaction time",
        ),
    },
    held_out_needed=4,
)
