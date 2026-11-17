"""Ecology: ten general journals, and subfields any ecologist would expect
a map of them to find."""

from fieldmap.fields import Field

FIELD = Field(
    slug="ecology",
    name="ecology",
    journals={
        "S35917800": "Ecology",
        "S80967739": "Ecology Letters",
        "S11271929": "Journal of Ecology",
        "S33456383": "Journal of Animal Ecology",
        "S200794352": "Oikos",
        "S201386569": "Ecological Monographs",
        "S169694011": "Global Ecology and Biogeography",
        "S174303711": "Functional Ecology",
        "S67154222": "Oecologia",
        "S25093289": "Ecography",
    },
    years=(2015, 2025),
    clusters=40,
    named={
        "pollination": ("pollinator", "pollination", "flower", "bees"),
        "food webs": ("food web", "predator", "prey", "trophic"),
        "biogeography": (
            "biogeography",
            "latitudinal",
            "range",
            "species distribution",
        ),
        "plant-soil": ("soil", "mycorrhizal", "microbial", "fungi"),
        "animal movement": ("movement", "migration", "tracking", "home range"),
    },
    held_out={
        "forests": ("forest", "forests", "tree", "trees"),
        "disease ecology": ("parasite", "pathogen", "disease", "host"),
        "climate and phenology": ("warming", "phenology", "climate change"),
        "seed dispersal": ("seed", "seeds", "dispersal"),
        "birds": ("bird", "birds", "avian", "nest"),
    },
    held_out_needed=4,
)
