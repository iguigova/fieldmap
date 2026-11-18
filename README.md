# Fieldmap

A map of a research field that shows which of its subfields a reading
list covers and which it misses, what to read first in each, who works
in each, which subfields each one is closest to, and which journals each
publishes in and what they charge. For a topic in any field, it gives a
reading path instead, and a small map of the topic's own groups. Four
fields are mapped:

- **[Biostatistics →](https://iguigova.github.io/fieldmap/)**
- **[Ecology →](https://iguigova.github.io/fieldmap/?map=ecology)**
- **[Epidemiology →](https://iguigova.github.io/fieldmap/?map=epidemiology)**
- **[Psychology methods →](https://iguigova.github.io/fieldmap/?map=psychology-methods)**

![A walk through Fieldmap's biostatistics map. The page shows a map of 40
grey circles, one per subfield, and links to the other fields under its
title. Clicking "Try a sample reading list" fills eight circles with a
count of the reader's papers and turns the other 32 into hollow dashed
circles. Below the map, the 32 gaps are listed; opening one shows the
reviews to start with. Twelve circle names are in italics, the soft
subfields. Typing "missing data imputation" into the topic box gives a
reading path from 200 papers OpenAlex found: five reviews to start with,
then the older works they build on, in reading order. Below it, a small
map shows the topic's six groups, named information, generative,
imputation techniques, traffic, feature and electrical. Last, the theme
switch turns the page dark.](docs/demo.gif)

## Use it

1. Export a reference library as a BibTeX file. In Zotero: right-click
   *My Library* or a collection, choose *Export Library…* or *Export
   Collection…*, and pick BibTeX.
2. Open the field's map, linked above, and choose *Load a BibTeX file*.
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
4. Open a gap in the *Gaps* list below the map. *Reviews to start with*
   lists the five most-cited reviews from the map's journals placed in
   that subfield, then asks OpenAlex for up to five more from any
   journal. *Reading
   order* lists the ten papers its own papers cite most, each after the
   ones of the ten it builds on. *Most-cited papers to start with* lists
   the five papers from it cited most often, and *New papers citing it*
   the newest papers since the map's last year that build on its work.
   *Who publishes here* lists its five most frequent authors and
   institutions from 2021 to 2025, and *Who funds it* its five most
   frequent funders. *Nearest by citation* links its three closest
   subfields.
5. Open *Where it publishes* on a subfield to see which of the map's
   journals its papers appeared in, most first. Each journal says whether
   it is fully open access, its fee, whether it is in MEDLINE and, when
   DOAJ lists it, its licences and whether it waives the fee. Each fact
   links to its source, and the heading gives the day they were fetched.

*Try a sample reading list* shows the same thing without a library.

The file is read in the browser. Only the DOIs of papers that aren't on the
map leave it: they are sent to [OpenAlex](https://openalex.org) to look up
what those papers cite. Opening *Reviews to start with* or *New papers
citing it* asks OpenAlex too, with the works that subfield cites, and
sends nothing from the file.

For a topic outside the four fields, type it, or a paper's DOI, under
*Any topic* and choose *Build a reading path*. The page asks OpenAlex
for the works on it and lists its reviews to start with, a reading order,
its most-cited papers and its new papers from the last twelve months.
Below them, a small map groups its works by the papers they cite, with a
card per group giving its reading order and most-cited works. The
address then names the topic, as in
[`?topic=missing data imputation`](https://iguigova.github.io/fieldmap/?topic=missing%20data%20imputation),
so a reading path can be shared as a link.

## A topic's reading path

The browser asks OpenAlex directly, from the reader's connection, so a
reading path costs nothing to host. OpenAlex gives each connection 1,000
free credits a day: a search costs 10 and any other request 1, so a topic
takes 13 and a DOI 5, plus one for each of its groups.

- **Works:** one page of 200 from OpenAlex's search for the topic,
  articles and reviews, in the order it ranks them; for a DOI, the paper
  and the 200 works citing it that are cited most.
- **Core works:** the five works those cite most.
- **Reading order:** the ten works they cite most, from any year, ordered
  as a subfield's reading order is. `tests/reading_cases.json` holds cases
  both the pipeline and the page must order the same way.
- **Reviews:** for a topic, the reviews its search found, in its order;
  then any other review among the works, or among the 50 most-cited
  reviews citing a core work, that cites at least two core works, those
  citing more first and then the most cited.
- **New papers:** the 50 newest works from the last twelve months citing
  a core work, keeping those that cite at least two, those citing more
  first.
- **Groups:** two works are linked by the papers they both cite, each
  paper weighted by how few of the works cite it; a paper cited by only
  one work, or by half of them or more, links none. Louvain's method
  splits the links into communities, and each of five works or more is
  a group, at most eight, largest first. A group is named by up to five
  title terms, single words or pairs, those in two or more of its
  titles first. Each term scores its count in the group times the log
  of the works over those whose title holds it, so a word in every
  title, such as the topic's own, names no group. The groups are laid
  out by classical MDS on the distances between their citation profiles, and
  each is joined to the three whose citations are most alike. A group's
  reading order is the ten works its own works cite most, ordered as
  the topic's is, at one more request per group. On 2026-11-18, the DOI
  of *Global warming and recurrent mass bleaching of corals* gave four
  groups holding 197 of its 201 works: *coral, reefs, reef*,
  *heatwaves, marine, climate*, *coral, microbiome, reef building* and
  *climate, change, earth*. *Attention Is All You Need* gave seven,
  holding all 201 of its works, among them *language, bert, text*,
  *vision, transformer, image*, *large language, chatgpt, gemini*,
  *diffusion, image, resolution* and *protein, accurate, structure*.

Citations tell which works build on a topic, not whether they are about
it. A study that uses a method cites it as a review of the method does.
On 2026-11-17, *missing data imputation* gave the three reviews its
search found, then the STROBE reporting guideline and *Missing Data
Analysis: Making It Work in the Real World*. Its new papers included a
study of refugees' housing quality that cites at least two of its core
works. A paper cited mainly as software gives the loosest path: for
*mice*, the R package for multiple imputation, *Missing Data in Clinical
Research: A Tutorial on Multiple Imputation* ranked second among five
reviews; the other four, such as a meta-analysis of semen quality, cite
the package without being about it.

## What the maps cover

| Field | Journals | Papers, 2015–2025 | Subfields |
|---|---|---|---|
| Biostatistics | 8 | 11,295 | 40 |
| Ecology | 10 | 19,703 | 40 |
| Epidemiology | 8 | 15,116 | 40 |
| Psychology methods | 11 | 7,086 | 40 |

- **Papers:** every article OpenAlex lists in the field's journals from
  2015 to 2025. A subfield that publishes mostly in other journals looks
  smaller here than it is.
  - Biostatistics: Biometrics, Statistics in Medicine, Biostatistics,
    Statistical Methods in Medical Research, Biometrical Journal, BMC
    Medical Research Methodology, Statistics in Biosciences and The
    International Journal of Biostatistics.
  - Ecology: Ecology, Ecology Letters, Journal of Ecology, Journal of
    Animal Ecology, Oikos, Ecological Monographs, Global Ecology and
    Biogeography, Functional Ecology, Oecologia and Ecography.
  - Epidemiology: American Journal of Epidemiology, Epidemiology,
    International Journal of Epidemiology, European Journal of
    Epidemiology, Journal of Clinical Epidemiology, Annals of
    Epidemiology, Journal of Epidemiology & Community Health and
    Paediatric and Perinatal Epidemiology.
  - Psychology methods: Psychological Methods, Psychometrika,
    Multivariate Behavioral Research, Behavior Research Methods,
    Structural Equation Modeling, British Journal of Mathematical and
    Statistical Psychology, Educational and Psychological Measurement,
    Applied Psychological Measurement, Journal of Educational
    Measurement, Journal of Educational and Behavioral Statistics and
    Advances in Methods and Practices in Psychological Science.
- **Subfields:** groups of papers that use the same words and cite the
  same work. Each is named by the five words that set it apart from the
  rest, such as *missing, imputation, mi, multiple, missingness* in
  biostatistics. Some are topics rather than methods, such as *covid*.
  Report words name a few in epidemiology, such as *mortality, hr, cause,
  ci, years*, a soft subfield of 565 papers. Three are named by the text
  around an article rather than its topic: ecology's *org, https, doi,
  figshare, s1*, 130 papers, and epidemiology's *et al, epidemiology,
  journal, doi, authors*, 265, and *university, author, department,
  email, conflicts*, 153.
- **Papers without an abstract:** they take no part in building the
  subfields, since a title alone groups with other titles rather than
  with its topic. An abstract longer than 500 words counts as none: no
  journal here allows one that long, and OpenAlex then holds the
  article's own text. Each is placed by the works it cites, then by its
  title, and left off the map when neither matches: 447 of 482 are
  placed in biostatistics, 2,297 of 2,741 in ecology, 4,879 of 5,150 in
  epidemiology and 1,235 of 1,260 in psychology methods.
- **Placement:** a paper in the map's journals is matched by its DOI. Any
  other paper with a DOI is placed by the works it cites, as OpenAlex lists
  them. A paper whose citations match no subfield, or that has no DOI, is
  placed by the words in its title, and left unplaced when its title
  matches no subfield closely. On a fifth of each map's own papers, held
  back while the rest built the subfields, citations picked the paper's
  own subfield 67% of the time in biostatistics, 64% in ecology, 43% in
  epidemiology and 67% in psychology methods, and title words 55%, 47%,
  51% and 56%.
  Epidemiology's papers cite clinical work widely, and OpenAlex lists no
  references for a third of the International Journal of Epidemiology's.
  The line under *Load a BibTeX file* gives the counts.
- **Reviews:** the works OpenAlex types as reviews in the same journals
  and years. They take no part in building the subfields; each is placed
  by the works it cites, as an outside paper is. Biostatistics places
  525 of 545, and one of its subfields gets none: *recurrent, events*.
  Ecology places 544 of 548, and one gets none: *org, https*.
  Epidemiology places 1,419 of 1,559, and every subfield gets some.
  Psychology methods places 99 of 104, and 12 subfields get none. Some
  are systematic reviews of a clinical question rather than
  introductions to a method. Opening the
  list asks OpenAlex for the 50 most-cited reviews from any journal and
  year citing the subfield's five core works, the five it cites most
  tellingly, and adds the first five that place in the subfield and are
  not already listed. On 2026-11-18, psychology methods' *word, words,
  norms, language, semantic*, which has none of the map's reviews, got
  five, among them *Semantic memory: A review of methods, models, and
  current challenges* and *The ubiquity of frequency effects in first
  language acquisition*.
- **Reading order:** the ten papers a subfield's own papers cite most,
  each placed after the ones of the ten it cites, and the most cited
  first otherwise. A loop of papers citing each other starts at its most
  cited. Each says which earlier entries it builds on. A subfield's ten
  hold a median of three that build on another in epidemiology, three
  and a half in biostatistics, four in ecology and five in psychology
  methods; four epidemiology subfields hold none, and one each in
  ecology and psychology methods. The maps start in 2015, so a classic from before
  then is not in the order.
- **New papers:** the page asks OpenAlex, when the list is opened, for
  the 50 newest works dated from the map's last year to today that cite
  any of the subfield's five core works, and shows the first five that
  place in that subfield by what they cite. On 2026-11-18, every
  subfield of biostatistics, epidemiology and psychology methods showed
  five, and 37 of ecology's 40; of the works asked for, 1,504 of 2,000
  placed back in biostatistics, 885 of 1,958 in ecology, 1,600 of 1,983
  in epidemiology and 1,424 of 2,000 in psychology methods.
  `node docs/new_papers.mjs <slug>…` asks again and prints these counts. Many apply a method rather
  than develop it, such as a cohort study of mortality after heart-valve
  replacement under biostatistics' joint-modelling subfield.
- **Who:** the authors, institutions and funders OpenAlex records on a
  subfield's papers from 2021 to 2025. Nearly all of those papers name an
  institution; 76% name a funder in biostatistics, 83% in ecology, 66% in
  epidemiology and 54% in psychology methods. OpenAlex sometimes credits a paper to
  the wrong person of the same name: of 59 recent biostatistics papers
  it credits to Yale's Fan Li, one is by Duke's Fan Li, and one by both
  credits both to Yale's. It names a funder and its parts separately: of
  580 recent biostatistics papers that name the National Cancer
  Institute, 396 also name the National Institutes of Health, and only
  those count for both.
- **Venues:** each field's journals above, and no others. OpenAlex gives
  each one's fee for the latest year it lists, whether it is fully open
  access and whether it is in MEDLINE. For a journal that is not fully
  open access, the fee is the price of making one article open. DOAJ, the
  Directory of Open Access Journals, gives a journal's licences and fee
  waiver. It lists BMC Medical Research Methodology among biostatistics'
  journals, Functional Ecology and Ecography among ecology's, Advances in
  Methods and Practices in Psychological Science among psychology
  methods', and none of epidemiology's; for the rest,
  neither is known here.

## Method

`src/fieldmap/build.py` holds every step, and its constants hold every
setting.

1. **Papers.** Every work OpenAlex types as an article in the field's
   journals and years, less those with no title and the journals' cover
   pictures. A paper's text is its title and abstract, less a LaTeX
   preamble around a formula, a publisher's copyright notice and its
   notice on supporting information. An abstract over 500 words is the
   article's own text, and the paper is taken as having none.
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
   40 is set by hand in each field's file, not chosen by a fit statistic;
   *Stability* below says how much the groups depend on it.
6. **Names.** Each group's words are scored by class-based TF-IDF: how
   often a term appears in the group, weighted by how rare it is across
   groups. The name is the five top terms, skipping a term whose words
   are inside a term already picked.
7. **Layout.** The distance between two groups is the cosine distance
   between their centres; metric MDS lays those distances out in two
   dimensions.
8. **Papers to start with.** A group's five papers with the most
   citations in OpenAlex, and its five most-cited reviews. A review is
   placed in the group whose cited works it cites most, scored as the
   page scores a paper's citations, and left unplaced when it cites none
   of them. The reading order is the group's ten papers cited most by its
   own papers, ordered so each follows the ones of the ten it cites; when
   none is free of the rest, the most cited goes next.
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
13. **Placement test.** A fifth of the papers, drawn with seed 0, is held
    back. The rest are profiled under the map's own groups, and each
    held-back paper is placed by its citations and, separately, by its
    title, as the page places a paper off the map. The map ships how many
    of each landed in the paper's own group, and the page states the
    shares.

`uv run fieldmap check` tests a map against subfields known before it
was built, named in the field's file: every one of five named subfields
must name a group, and four of five held back must.

- **Biostatistics:** the five named in
  [the Academia.SE question](https://academia.stackexchange.com/questions/228054)
  that started this map (causal inference, research synthesis, ML
  methods, spatial statistics, missing data) are all found, and four of
  five held back (survival analysis, clinical trial design, longitudinal
  data, multiple testing, statistical genetics). No group names multiple
  testing by that phrase; the nearest is *test, tests, testing, rate,
  error*.
- **Ecology:** all five named (pollination, food webs, biogeography,
  plant-soil, animal movement) and all five held back (forests, disease
  ecology, climate and phenology, seed dispersal, birds). One group
  answers for two subfields: *migration, migratory, breeding, migrants,
  birds* for animal movement and birds.
- **Epidemiology:** all five named (causal inference, cancer,
  cardiovascular, infectious disease, perinatal) and four of five held
  back (diet, air pollution, mental health, research methods, social
  inequality). Research methods is missed; the nearest group is
  *guidelines, guideline, evidence, recommendations, reviews*.
- **Psychology methods:** all five named (structural equation modeling,
  item response theory, missing data, meta-analysis, Bayesian methods)
  and all five held back (multilevel and longitudinal, mediation,
  measurement invariance, replication, experiment software).

### Stability

`uv run fieldmap stability` reruns k-means on the same vectors at
k = 30, 40 and 50, each with seeds 0 to 4, and compares the runs as step
9 does. On each map's data, run 2026-11-18:

| Field | k | Seeds agree (mean adjusted Rand index, seed 0 against 1–4) | Groups found again under another seed | The map's 40 groups found at this k, seed 0 | Runs passing the check |
|---|---|---|---|---|---|
| Biostatistics | 30 | 0.56 | 69% | 50% | 4 of 5 |
| | 40 | 0.63 | 74% | 100% | 5 of 5 |
| | 50 | 0.69 | 77% | 72% | 5 of 5 |
| Ecology | 30 | 0.63 | 78% | 52% | 3 of 5 |
| | 40 | 0.70 | 83% | 100% | 5 of 5 |
| | 50 | 0.77 | 86% | 90% | 5 of 5 |
| Epidemiology | 30 | 0.59 | 69% | 60% | 4 of 5 |
| | 40 | 0.61 | 77% | 100% | 5 of 5 |
| | 50 | 0.63 | 73% | 80% | 5 of 5 |
| Psychology methods | 30 | 0.60 | 72% | 57% | 3 of 5 |
| | 40 | 0.64 | 77% | 100% | 5 of 5 |
| | 50 | 0.69 | 77% | 75% | 5 of 5 |

About three in four of a map's groups come back under another seed; the
rest split or merge differently from run to run. Of the 40 groups, the
four reruns all find 20 in biostatistics, 22 in ecology, 18 in
epidemiology and 24 in psychology methods, and none find 2, 2, 5 and 3.
Each map's largest group is soft: biostatistics' *bayesian, latent,
regression*, with 756 papers, ecology's *ecosystem, ecosystems,
vegetation*, with 1,129, epidemiology's *prevalence, care, women*, with
882, and psychology methods' *bayesian, regression, variables*, with 572,
are each found again in at most two reruns. k = 40 is no clear optimum:
every map's seeds agree more at k = 50, and every run at k = 40 passes
its check.

Each field is one file under `src/fieldmap/fields/`: its name, journals,
years, number of groups, the subfields its check needs and, when one was
found by hand, a note on its *Who* data. A new field is a new file there
and its slug in `SLUGS` in `src/fieldmap/fields/__init__.py`. The page
loads `data/<slug>.json` for `?map=<slug>` in its address, biostatistics
without one, and links every map `data/fields.json` lists.

The code was written with Claude, an AI assistant. Every number on the
map and in this README comes from running it.

## Build it

The map is built by a Python pipeline run with
[uv](https://docs.astral.sh/uv/), from [OpenAlex](https://openalex.org)
data:

```sh
uv run fieldmap fetch      # download the papers into data/raw/<slug>/
uv run fieldmap reviews    # download the reviews into data/raw/<slug>/
uv run fieldmap who        # download their authors and funders, by id
uv run fieldmap venues     # download the journals' OpenAlex and DOAJ records
uv run fieldmap build      # cluster them into data/<slug>.json
uv run fieldmap check      # check the field's subfields are found
uv run fieldmap stability  # rerun the clustering at other k and seeds
```

Each command takes `--field <slug>`, biostatistics by default. A list
request costs one of OpenAlex's free daily credits, as *A topic's
reading path* above says; downloading a field takes one request per 200
papers and one per 100 for their authors, so a field of 20,000 papers
takes about 300.

`index.html` draws the page and `fieldmap.js` holds its logic: reading
BibTeX, placing papers, laying out the map and reading a topic's path. The page loads the site's
shared `brand.css` and `brand.js` from the folder above, so serve that
folder to run it locally and open `/fieldmap/`.

Tests: `uv run pytest` for the pipeline, at full line coverage, and
`npm test` for `fieldmap.js` and the scripts in `docs/`; `npm run
coverage` runs the same tests and fails below full line coverage of
`fieldmap.js`. Lint: `uv run ruff check src tests`.

The demo GIF: serve the folder above on any port, open it in a
Playwright page started in that folder, and run `docs/demo.playwright.js`
through that page. It records frames into `docs/frames/`, and
`docs/make_demo.sh` turns them into `docs/demo.gif`. Its walk reads one
topic's reading path and its groups, so it uses about 20 OpenAlex
credits.

## Extend it

Each of these is a change to the pipeline and the page, and open to a
request:

- **More journals.** A field's venues are the journals its map is built
  from. A journal added to a field's file joins both the map and the
  venues on the next build.
- **Another field.** A new file under `src/fieldmap/fields/`, as
  *Stability* above says.
- **Licence checks.** A paper reusing a figure or table under one
  Creative Commons licence can only go to a venue whose licence is
  compatible with it. The venues' licences are already on the map; the
  check needs the licence of each reused item, which BibTeX does not
  carry.
- **Classics in the reading order.** The works a subfield cites most
  include papers from before 2015, which the map holds only as OpenAlex
  ids. Fetching their titles would let the reading order start with them,
  as a topic's reading order does.
- **Fresher facts.** Fees change every year. Rerunning `venues` and
  `build` refreshes them.

To ask for one of these, or anything else, open an issue at
[github.com/iguigova/fieldmap/issues](https://github.com/iguigova/fieldmap/issues).
A pull request is welcome too.

## Licence

Code: MIT, see `LICENSE`. Data: OpenAlex, CC0, and journal records from
DOAJ, under [DOAJ's terms](https://doaj.org/terms/).
