# Fieldmap

A map of biostatistics that shows which of its subfields a reading list
covers and which it misses, who works in each, which subfields each one
is closest to, and which journals each publishes in and what they charge.

**[Open the map →](https://iguigova.github.io/fieldmap/)**

![A walk through Fieldmap. The page shows a map of 40 grey circles, one per
subfield. Clicking "Try a sample reading list" fills eight circles with a
count of the reader's papers and turns the other 32 into hollow dashed
circles. Below the map, the 32 gaps are listed; opening one shows its five
most-cited papers. Eight circle names are in italics, the soft subfields.
Last, the theme switch turns the page dark.](docs/demo.gif)

## Use it

1. Export a reference library as a BibTeX file. In Zotero: right-click
   *My Library* or a collection, choose *Export Library…* or *Export
   Collection…*, and pick BibTeX.
2. Open [the map](https://iguigova.github.io/fieldmap/) and choose *Load a
   BibTeX file*.
3. Read the map:
   - **Filled circle with a number:** a subfield the library covers; the
     number is how many of its papers sit there.
   - **Hollow, dashed circle:** a gap, a subfield the library has no
     papers in.
   - **Italic name:** a soft subfield, one the clustering found again in
     at most two of four reruns. Its edges depend on chance more than on
     the papers. Each subfield's card says how many reruns found it.
   - **Line:** joins a subfield to one of the three it cites and is cited
     by most. Point at or tab to a circle to light up its three.
4. Open a gap in the *Gaps* list below the map. *Most-cited papers to start
   with* lists the five papers from that subfield cited most often. *Who
   publishes here* lists its five most frequent authors and institutions
   from 2021 to 2025, and *Who funds it* its five most frequent funders.
   *Nearest by citation* links its three closest subfields.
5. Open *Where it publishes* on a subfield to see which of the map's
   journals its papers appeared in, most first. Each journal says whether
   it is fully open access, its fee, whether it is in MEDLINE and, when
   DOAJ lists it, its licences and whether it waives the fee. Each fact
   links to its source, and the heading gives the day they were fetched.

*Try a sample reading list* shows the same thing without a library.

The file is read in the browser. Only the DOIs of papers that aren't on the
map leave it: they are sent to [OpenAlex](https://openalex.org) to look up
what those papers cite.

## What the map covers

- **Papers:** 11,331 articles from 2015 to 2025 in eight general
  biostatistics journals: Biometrics, Statistics in Medicine,
  Biostatistics, Statistical Methods in Medical Research, Biometrical
  Journal, BMC Medical Research Methodology, Statistics in Biosciences and
  The International Journal of Biostatistics. A subfield that publishes
  mostly in other journals looks smaller here than it is.
- **Subfields:** 40 groups of papers that use the same words and cite the
  same work. Each is named by the five words that set it apart from the
  rest, such as *missing, imputation, mi, multiple, missingness*. A few
  groups are topics rather than methods, such as *covid* and *survey*.
- **Placement:** a paper in the map's journals is matched by its DOI. Any
  other paper with a DOI is placed by the works it cites, as OpenAlex lists
  them. A paper whose citations match no subfield, or that has no DOI, is
  placed by the words in its title, and left unplaced when its title
  matches no subfield closely. On a fifth of the map's own papers, held
  back while the rest built the subfields, citations picked the paper's
  own subfield two times in three and title words about half the time.
  The line under *Load a BibTeX file* gives the counts.
- **Who:** the authors, institutions and funders OpenAlex records on a
  subfield's papers from 2021 to 2025. Of those 5,409 papers, 99% name an
  institution and 76% a funder. OpenAlex sometimes credits a paper to the
  wrong person of the same name: of 58 recent papers it credits to Yale's
  Fan Li, one is by Duke's Fan Li, and one by both credits both to
  Yale's. It names a funder and its parts
  separately: of 581 recent papers that name the National Cancer
  Institute, 397 also name the National Institutes of Health, and only
  those count for both.
- **Venues:** the eight journals above, and no others. OpenAlex gives each
  one's fee for the latest year it lists, whether it is fully open access
  and whether it is in MEDLINE. For a journal that is not fully open
  access, the fee is the price of making one article open. DOAJ, the
  Directory of Open Access Journals, gives a journal's licences and fee
  waiver; it lists one of the eight, BMC Medical Research Methodology, so
  for the other seven neither is known here.

## Method

`src/fieldmap/build.py` holds every step, and its constants hold every
setting.

1. **Papers.** Every work OpenAlex types as an article in the eight
   journals from 2015 to 2025, less those with no title and the journals'
   cover pictures. A paper's text is its title and abstract.
2. **Words.** Each paper becomes a TF-IDF vector of single words and
   two-word phrases, with sublinear term frequency. English stop words
   are dropped, along with words every methods abstract uses, such as
   *method*, *model* and *propose*. A term is kept when it is in at least
   5 papers and at most 40% of them.
3. **Citations.** Each paper becomes a second TF-IDF vector, whose terms
   are the works it cites. A cited work is kept when at least 2 papers
   cite it.
4. **One space.** Both vectors are scaled to unit length and laid side by
   side, so words and citations weigh the same. Truncated SVD reduces them
   to 100 dimensions, and the result is scaled to unit length again.
5. **Groups.** k-means with k = 40, best of 10 starts, seed 0. The number
   40 is set by hand in `src/fieldmap/scope.py`, not chosen by a fit
   statistic; *Stability* below says how much the groups depend on it.
6. **Names.** Each group's words are scored by class-based TF-IDF: how
   often a term appears in the group, weighted by how rare it is across
   groups. The name is the five top terms, skipping a term whose words
   are inside a term already picked.
7. **Layout.** The distance between two groups is the cosine distance
   between their centres; metric MDS lays those distances out in two
   dimensions.
8. **Papers to start with.** A group's five papers with the most
   citations in OpenAlex.
9. **Reruns.** k-means runs four more times on the same vectors, with
   seeds 1 to 4. A group is found again in a rerun when a group there
   shares at least half of the papers in either (Jaccard ≥ 0.5). Each
   group ships the number of reruns that found it, and the page marks one
   found in at most two as soft.

10. **Who.** For each group, the five authors, institutions and funders
    named on the most of its papers from the map's last five years, by
    OpenAlex id. A paper counts once for each.
11. **Nearest.** Two groups' strength is the citations between them, both
    ways, divided by the square root of the product of their sizes, so two
    large groups are not near just for being large. Each group ships the
    three strongest, with their citation counts.
12. **Venues.** Each group ships the number of its papers in each journal.
    `src/fieldmap/venues.py` turns each journal's OpenAlex and DOAJ
    records into the facts the page shows, and the map ships them with
    the day they were fetched.

`uv run fieldmap check` tests the result against subfields known before
the build. Each of the five named in
[the Academia.SE question](https://academia.stackexchange.com/questions/228054)
that started this map (causal inference, research synthesis, ML methods,
spatial statistics, missing data) must name a group, and four of five
held back (survival analysis, clinical trial design, longitudinal data,
multiple testing, statistical genetics) must. The map finds all five
named and four held back. Multiple testing is the one no group names by
that phrase; the nearest group is *test, tests, testing, error,
hypothesis*.

### Stability

`uv run fieldmap stability` reruns k-means on the same vectors at
k = 30, 40 and 50, each with seeds 0 to 4, and compares the runs as step
9 does. On the map's data, run 2026-11-12:

| k | Seeds agree (mean adjusted Rand index, seed 0 against 1–4) | Groups found again under another seed | The map's 40 groups found at this k, seed 0 | Runs passing the check |
|---|---|---|---|---|
| 30 | 0.61 | 72% | 65% | 5 of 5 |
| 40 | 0.63 | 81% | 100% | 5 of 5 |
| 50 | 0.63 | 75% | 78% | 5 of 5 |

About four in five of the map's groups come back under another seed; the
rest split or merge differently from run to run. Per group, 19 of the 40
are found again in all four reruns, 13 in three, 6 in two and 2 in one.
The two found in one are *brain, network, networks* and the largest,
*regression, case, sampling*, with 1,007 papers. k = 40 is no clear
optimum: from 30 to 50 the seeds agree about equally, and every run
passes the check.

The same steps map another field by changing the journals and years in
`src/fieldmap/scope.py`, the subfields `src/fieldmap/check.py` tests,
and the words every methods abstract uses, `BOILERPLATE` in
`src/fieldmap/build.py`.

The code was written with Claude, an AI assistant. Every number on the
map and in this README comes from running it.

## Build it

The map is built by a Python pipeline run with
[uv](https://docs.astral.sh/uv/), from [OpenAlex](https://openalex.org)
data:

```sh
uv run fieldmap fetch      # download the papers into data/raw/
uv run fieldmap who        # download their authors and funders, by id
uv run fieldmap venues     # download the journals' OpenAlex and DOAJ records
uv run fieldmap build      # cluster them into data/map.json
uv run fieldmap check      # check the named subfields in check.py are found
uv run fieldmap stability  # rerun the clustering at other k and seeds
```

`index.html` draws the page and `fieldmap.js` holds its logic: reading
BibTeX, placing papers and laying out the map. The page loads the site's
shared `brand.css` and `brand.js` from the folder above, so serve that
folder to run it locally and open `/fieldmap/`.

Tests: `uv run pytest` for the pipeline and `node --test tests/*.test.mjs`
for `fieldmap.js`, each at full line coverage. Lint: `uv run ruff check
src tests`.

The demo GIF: serve the folder above at `http://127.0.0.1:8765/` and run
`docs/demo.playwright.js` through a Playwright page started in that folder.
It records frames into `docs/frames/`, and `docs/make_demo.sh` turns them
into `docs/demo.gif`.

## Extend it

Each of these is a change to the pipeline and the page, and open to a
request:

- **More journals.** The venues are the eight the map is built from. A
  journal added to `JOURNALS` in `src/fieldmap/scope.py` joins both the
  map and the venues on the next build.
- **Another field.** The same steps map another field; *Stability* above
  names the three settings that change.
- **Licence checks.** A paper reusing a figure or table under one
  Creative Commons licence can only go to a venue whose licence is
  compatible with it. The venues' licences are already on the map; the
  check needs the licence of each reused item, which BibTeX does not
  carry.
- **Fresher facts.** Fees change every year. Rerunning `venues` and
  `build` refreshes them.

To ask for one of these, or anything else, open an issue at
[github.com/iguigova/fieldmap/issues](https://github.com/iguigova/fieldmap/issues).
A pull request is welcome too.

## Licence

Code: MIT, see `LICENSE`. Data: OpenAlex, CC0, and journal records from
DOAJ, under [DOAJ's terms](https://doaj.org/terms/).
