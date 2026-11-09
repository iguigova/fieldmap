# Fieldmap

A map of biostatistics that shows which of its subfields a reading list
covers and which it misses.

**[Open the map →](https://iguigova.github.io/fieldmap/)**

![A walk through Fieldmap. The page shows a map of 40 grey circles, one per
subfield. Clicking "Try a sample reading list" fills eight circles with a
count of the reader's papers and turns the other 32 into hollow dashed
circles. Below the map, the 32 gaps are listed; opening one shows its five
most-cited papers. Last, the theme switch turns the page dark.](docs/demo.gif)

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
4. Open a gap in the *Gaps* list below the map. *Most-cited papers to start
   with* lists the five papers from that subfield cited most often.

*Try a sample reading list* shows the same thing without a library.

The file is read in the browser and is never uploaded.

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
  other paper is placed by the words in its title, which picks the same
  subfield as its DOI would about half the time. A title that matches no
  subfield closely is left unplaced; the line under *Load a BibTeX file*
  gives the counts.

## Build it

The map is built by a Python pipeline run with
[uv](https://docs.astral.sh/uv/), from [OpenAlex](https://openalex.org)
data:

```sh
uv run fieldmap fetch   # download the papers into data/raw/
uv run fieldmap build   # cluster them into data/map.json
uv run fieldmap check   # check the named subfields in check.py are found
```

`index.html` draws the page and `fieldmap.js` holds its logic: reading
BibTeX, placing papers and laying out the map. The page loads the site's
shared `brand.css` and `brand.js` from the folder above, so serve that
folder to run it locally and open `/fieldmap/`.

Tests: `uv run pytest` for the pipeline and `node --test tests/*.test.mjs`
for `fieldmap.js`, each at full line coverage. Lint: `uv run ruff check
src tests`.

The demo GIF: `docs/demo.playwright.js` records frames into
`/home/ig/src/oceanhue/.playwright-mcp/frames` through a Playwright page
with the site served at `http://127.0.0.1:8765/`, and `docs/make_demo.sh`
turns them into `docs/demo.gif`.

## Licence

Code: MIT, see `LICENSE`. Data: OpenAlex, CC0.
