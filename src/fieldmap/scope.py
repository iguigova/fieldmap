"""What OpenAlex is asked for: a field's works of one type, by year."""

from fieldmap.fields import Field

ARTICLE = "article"
REVIEW = "review"


def works_filter(field: Field, kind: str, year: int) -> str:
    sources = "|".join(field.journals)
    return (
        f"primary_location.source.id:{sources},"
        f"publication_year:{year},"
        f"type:{kind}"
    )


def works_filters(field: Field, kind: str) -> list[str]:
    first, last = field.years
    return [works_filter(field, kind, year) for year in range(first, last + 1)]
