"""The fields a map is built for, one module each, and what each one sets."""

import importlib
from dataclasses import dataclass

# Each field's module is named for its slug, with underscores for hyphens.
SLUGS = ("biostatistics", "epidemiology", "ecology", "psychology-methods")


@dataclass(frozen=True)
class Field:
    slug: str
    name: str
    # OpenAlex source id to journal name.
    journals: dict[str, str]
    years: tuple[int, int]
    clusters: int
    # Subfields the map must find, each by the terms that name it: every
    # named one, and at least held_out_needed of the held-out ones.
    named: dict[str, tuple[str, ...]]
    held_out: dict[str, tuple[str, ...]]
    held_out_needed: int
    # What was found by hand in its who data, which the page states.
    who_note: str = ""


def load(slug: str) -> Field:
    module = importlib.import_module(
        f"fieldmap.fields.{slug.replace('-', '_')}"
    )
    return module.FIELD
