# Fieldmap

A map of one research field's subfields, built from its papers, with your
own reading list laid over it, so the subfields you have never read show
up as gaps.

The first field is biostatistics. The page is `index.html`, served at
https://iguigova.github.io/fieldmap/.

## How the map is made

1. **Scope.** Every article from 2015 to 2025 in eight general
   biostatistics methods journals, taken from [OpenAlex](https://openalex.org):
   Biometrics, Statistics in Medicine, Biostatistics, Statistical Methods
   in Medical Research, Biometrical Journal, BMC Medical Research
   Methodology, Statistics in Biosciences and The International Journal
   of Biostatistics. Specialty journals are left out on purpose, so a
   subfield has to emerge from the general journals rather than from a
   journal devoted to it.
2. **Clustering.** Each paper becomes a vector of its title and abstract
   words plus the papers it cites, so two papers are close when they use
   the same words or cite the same work. The vectors are reduced and split
   into 40 clusters.
3. **Names.** Each cluster is named by the terms that set it apart from
   the others, and lists its most-cited papers as places to start.
4. **Overlay.** On the page you load a BibTeX file. A paper on the map is
   matched by its DOI; any other paper is placed by its title words, or
   left unplaced when no cluster scores at least 0.4 for them. Placement by
   title is rough: on a sample of 993 papers on the map, it picked the
   cluster the full method chose 521 times. A cluster holding none of your
   papers is marked as a gap.

`uv run fieldmap fetch` downloads the scope into `data/raw/`, and
`uv run fieldmap build` writes `data/map.json`, which the page reads.
`uv run fieldmap check` runs the success checks below against it. The
fetch needs no OpenAlex API key: it asks for one year at a time in
numbered pages, which OpenAlex serves without a key up to 10,000 results
a query.

The page's logic that needs no page, reading BibTeX, placing papers and
laying out the map, is `fieldmap.js`; `index.html` draws what it returns.

## Tests

`uv run pytest` tests the Python pipeline and `node --test tests/*.test.mjs` tests
`fieldmap.js`; both hold every line covered, the first through its
`--cov-fail-under=100` setting and the second checked with
`node --test --experimental-test-coverage --test-coverage-include=fieldmap.js tests/*.test.mjs`.
`uv run ruff format --check src tests` and `uv run ruff check src tests`
lint the Python.

## What counts as success

These were fixed before the first map was built.

**The map works** when all of these hold:

- Each subfield the asker on Academia.SE question 228054 named is its own
  cluster, meaning one of the cluster's five name terms holds one of the
  subfield's terms as whole words: causal inference (`causal`, `propensity`,
  `instrumental`), research synthesis (`meta-analysis`, `meta`, `network
  meta-analysis`), ML methods (`machine learning`, `learning`, `random
  forest`, `neural`), spatial statistics (`spatial`) and missing data
  (`missing`, `imputation`).
- At least 4 of 5 held-out subfields are their own cluster by the same
  rule: survival analysis (`survival`, `hazard`, `competing risks`),
  clinical trial design (`trial`, `trials`, `dose`, `adaptive`),
  longitudinal data (`longitudinal`, `mixed`, `repeated measures`),
  multiple testing (`multiple testing`, `false discovery`) and statistical
  genetics (`genetic`, `gwas`, `genomic`, `snp`, `gene`).
- A BibTeX upload highlights the clusters holding its papers and marks the
  rest as gaps, in text as well as colour.
- The page works without a login, on a phone, and meets WCAG AA.

**People like it** when the answer posted to Academia.SE question 228054,
which discloses that the map is ours, reaches a score of 3 or more within
two weeks, and its asker comments on it, upvotes it or accepts it. A spam
flag is a fail.
