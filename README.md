# Fieldmap

**See the parts of your field you haven't read yet.**

Fieldmap is a map of biostatistics, built from 11,331 papers rather than
from anyone's list of topics. Load your reference library and the map
shows which subfields you've read and which ones you've never touched.

### [Open the map →](https://iguigova.github.io/fieldmap/)

![A walk through Fieldmap. The page loads a map of 40 grey circles, one per
subfield. Clicking "Try a sample reading list" fills eight circles with a
count of the reader's papers and turns the other 32 into hollow dashed
circles. Scrolling down shows the 32 gaps as a list; opening one shows its
five most-cited papers. Last, the theme switch turns the page dark.](docs/demo.gif)

## Why

You can look up a method you've seen named and never learned. What you
can't look up is the one you've never heard of. A biostatistics master's
student choosing a PhD put it as "there are great many things that I am
just missing", and only found out by chance that missing-data research is
a field of its own.

Search tools start from what you already have, so they find the
neighbours of your reading. Fieldmap starts from the whole field, so the
regions you've never been to show up as well.

## How to use it

1. **Export your library as BibTeX.** In Zotero, right-click *My Library*
   (or a collection) and choose *Export Library…* (or *Export
   Collection…*), then pick BibTeX. Most other reference managers,
   including Mendeley and JabRef, export BibTeX too.
2. **Open [the map](https://iguigova.github.io/fieldmap/) and choose *Load
   a BibTeX file*.** The file is read in your browser and never uploaded.
3. **Read the map.**
   - A **filled circle with a number** is a subfield you've read, and the
     number is how many of your papers sit there.
   - A **hollow, dashed circle** is a gap: a subfield with none of your
     papers.
   - Circles close together share words and citations, so a gap next to
     something you know well is an easy step over.
4. **Pick a gap.** Under the map, *Gaps* lists every subfield you haven't
   read, largest first. Open *Most-cited papers to start with* for five
   papers that a lot of the field builds on.

No library at hand? *Try a sample reading list* loads a few papers from
the eight largest subfields, so you can see how it works.

## What it can and can't tell you

- **It covers eight journals, 2015 to 2025.** Biometrics, Statistics in
  Medicine, Biostatistics, Statistical Methods in Medical Research,
  Biometrical Journal, BMC Medical Research Methodology, Statistics in
  Biosciences and The International Journal of Biostatistics. These are
  general methods journals; a subfield that publishes mostly elsewhere is
  smaller here than in real life.
- **The names are rough.** Each subfield is named by the five words that
  set it apart, such as *missing, imputation, mi, multiple, missingness*.
  A few clusters are topics rather than subfields, such as *covid* or
  *survey*.
- **Your papers are matched exactly only when they're on the map.** A
  paper on the map is matched by its DOI. Any other paper is placed by its
  title words, which is rough: for 993 papers whose subfield is known, the
  title alone picked the same one 521 times. A title that matches no
  subfield well enough, scoring under 0.4, is left out, and the status
  line says how many.

## How the map is made

1. **Scope.** Every article in the eight journals above, from
   [OpenAlex](https://openalex.org). Specialty journals are left out on
   purpose, so a subfield has to emerge from the general journals rather
   than from a journal devoted to it. 62 "Cover Picture" items that
   OpenAlex lists as articles are dropped.
2. **Clustering.** Each paper becomes a vector of its title and abstract
   words plus the papers it cites, so two papers are close when they use
   the same words or cite the same work. The vectors are reduced and split
   into 40 clusters.
3. **Names.** Each cluster is named by the terms that set it apart from
   the others, and lists its most-cited papers as places to start.
4. **Layout.** Clusters are placed by how alike they are, then pushed
   apart until no circle or label overlaps another.

## Rebuilding and developing

The pipeline is Python, run with [uv](https://docs.astral.sh/uv/):

```sh
uv run fieldmap fetch   # download the scope into data/raw/
uv run fieldmap build   # write data/map.json, which the page reads
uv run fieldmap check   # run the success checks below against it
```

The fetch needs no OpenAlex API key: it asks for one year at a time in
numbered pages, which OpenAlex serves without a key up to 10,000 results
a query.

The page is `index.html`. Its logic that needs no page, reading BibTeX,
placing papers and laying out the map, is `fieldmap.js`, and `index.html`
draws what it returns. It loads the site's shared `brand.css` and
`brand.js` from one folder up, so to run it locally, serve the folder
that holds this repo and the site's hub, and open `/fieldmap/`.

**Tests.** `uv run pytest` tests the Python pipeline and
`node --test tests/*.test.mjs` tests `fieldmap.js`. Both keep every line
covered: the first through its `--cov-fail-under=100` setting, the second
checked with
`node --test --experimental-test-coverage --test-coverage-include=fieldmap.js tests/*.test.mjs`.
`uv run ruff format --check src tests` and `uv run ruff check src tests`
lint the Python.

**The demo.** `docs/demo.playwright.js` records the walk-through as PNG
frames when run through a Playwright `page` with the site served at
`http://127.0.0.1:8765/`, into an empty frames folder.
`docs/make_demo.sh <frames-folder>` turns them into `docs/demo.gif`.

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

## Licence and data

The code is MIT licensed; see `LICENSE`. The paper data comes from
OpenAlex, which releases it under CC0.
