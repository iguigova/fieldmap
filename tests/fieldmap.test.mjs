import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  FIELDS_URL, HEIGHT, WIDTH, afterText, citations, cleanDoi, entries, feeText, layout, licenceText, links, lookupUrl, mapUrl, newPapers, otherFields, placementText, newPapersUrl, newSince, place,
  readMap, recurrence, sample, shortId, shortName, soft, tally, titleTerms, toLookUp, venues, waiverText,
} from '../fieldmap.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const SHIPPED = read('../data/biostatistics.json');
const TITLE_TERMS = read('./title_terms.json');

const cluster = (id, name, terms, refs = {}, size = 10, x = 0.5, y = 0.5) => ({
  id, name, terms, refs, size, x, y,
  starters: [1, 2, 3, 4].map((n) => ({ title: `${name[0]} ${n}`, doi: n === 4 ? null : `10.1/${id}${n}`, cites: n })),
});
const FIELD_MAP = readMap({
  stop_words: ['a', 'of', 'model', 'data'],
  title_floor: 0.6,
  clusters: [
    cluster(0, ['missing', 'imputation'], { missing: 1, imputation: 0.8 }, { W1: 1, W2: 0.5 }, 30),
    cluster(1, ['spatial', 'disease'], { spatial: 1, disease: 0.5 }, { W3: 1 }, 20),
  ],
  dois: { '10.1/abc': 1 },
  scope: { slug: 'biostatistics', years: [2015, 2025] },
});

test('a DOI is lowercased and loses its resolver', () => {
  assert.equal(cleanDoi('https://dx.doi.org/10.1/ABC'), '10.1/abc');
  assert.equal(cleanDoi(''), null);
});

test('entries read braced, nested and quoted fields and skip empty ones', () => {
  const bib = '@article{a, title={A {B}ayesian model}, doi={10.1/X}}\n' +
    '@inproceedings(b, title = "Quoted title")\n@book{c, author={Nobody}}';
  assert.deepEqual(entries(bib), [
    { doi: '10.1/x', title: 'A Bayesian model' },
    { doi: null, title: 'Quoted title' },
  ]);
});

test('title terms are the terms the pipeline makes of the same title', () => {
  const stopWords = new Set(SHIPPED.stop_words);
  TITLE_TERMS.forEach(({ title, terms }) => assert.deepEqual(titleTerms(stopWords, title), terms));
});

test('a paper on the map is placed by its DOI', () => {
  assert.deepEqual(place(FIELD_MAP, { doi: '10.1/abc', title: 'missing' }, ['W1']), { cluster: 1, how: 'doi' });
});

test('a paper off the map is placed by the works it cites', () => {
  assert.deepEqual(place(FIELD_MAP, { doi: '10.9/zz', title: 'Missing' }, ['W3', 'W9']), { cluster: 1, how: 'citations' });
});

test('a paper citing nothing on the map is placed by its title words above the floor', () => {
  const missing = { doi: '10.9/zz', title: 'A model of missing data imputation' };
  assert.deepEqual(place(FIELD_MAP, missing, ['W9']), { cluster: 0, how: 'title' });
  assert.deepEqual(place(FIELD_MAP, missing, undefined), { cluster: 0, how: 'title' });
  assert.deepEqual(place(FIELD_MAP, { doi: null, title: 'Disease' }), { cluster: null, how: 'none' });
  assert.deepEqual(place(FIELD_MAP, { doi: '10.9/zz', title: null }, []), { cluster: null, how: 'none' });
});

test('tally counts placed papers per cluster', () => {
  assert.deepEqual(tally([{ cluster: 0 }, { cluster: 0 }, { cluster: 1 }, { cluster: null }]), { 0: 2, 1: 1 });
});

test('the sample is the biggest clusters\' first three starters, as entries', () => {
  const entriesOf = sample(FIELD_MAP);
  assert.equal(entriesOf.length, 6);
  assert.deepEqual(entriesOf[0], { doi: '10.1/01', title: 'missing 1' });
});

test('only DOIs off the map that a filter can hold are looked up, once each', () => {
  const found = [{ doi: '10.1/abc' }, { doi: '10.9/a' }, { doi: '10.9/a' }, { doi: '10.9/b,c' },
    { doi: '10.9/d|e' }, { doi: null }];
  assert.deepEqual(toLookUp(FIELD_MAP, found), ['10.9/a']);
});

test('a lookup URL asks OpenAlex for the references of every DOI in one filter', () => {
  const url = new URL(lookupUrl(['10.9/a', '10.9/b']));
  assert.equal(url.searchParams.get('filter'), 'doi:10.9/a|10.9/b');
  assert.equal(url.searchParams.get('select'), 'doi,referenced_works');
});

test('citations come back by DOI, in batches, and a failed batch is named', async () => {
  const dois = Array.from({ length: 120 }, (_, i) => `10.9/${i}`);
  const asked = [];
  const getJson = async (url) => {
    asked.push(url);
    if (asked.length === 2) throw new Error('HTTP 429');
    return { results: [{ doi: 'https://doi.org/10.9/0', referenced_works: ['https://openalex.org/W1'] }] };
  };
  const { refs, unreached } = await citations(getJson, dois);
  assert.equal(asked.length, 3);
  assert.deepEqual([...refs], [['10.9/0', ['W1']]]);
  assert.deepEqual(unreached, dois.slice(50, 100));
  assert.equal(shortId('https://openalex.org/W7'), 'W7');
});

test('a shared first name term takes the second one too', () => {
  const clusters = [cluster(0, ['treatment', 'optimal'], {}), cluster(1, ['treatment', 'subgroup'], {}),
    cluster(2, ['spatial', 'disease'], {})];
  assert.equal(shortName(clusters, clusters[0]), 'treatment, optimal');
  assert.equal(shortName(clusters, clusters[2]), 'spatial');
});

test('layout keeps every circle apart and inside the map', () => {
  const clusters = [0, 1, 2, 3].map((i) => cluster(i, [`c${i}`], {}, {}, 10 + i));
  const discs = layout(clusters);
  discs.forEach((a, i) => discs.slice(i + 1).forEach((b) => {
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.reach + b.reach);
  }));
  discs.forEach((d) => {
    assert.ok(d.x >= d.reach && d.x <= WIDTH - d.reach);
    assert.ok(d.y > d.r && d.y < HEIGHT - d.r);
  });
});

test('coincident circles part sideways', () => {
  const discs = layout([cluster(0, ['a'], {}), cluster(1, ['b'], {})]);
  assert.ok(Math.abs(discs[0].x - discs[1].x) >= discs[0].reach + discs[1].reach);
});

test('a subfield found again in at most half the reruns is soft', () => {
  const fieldMap = { reruns: 4 };
  assert.deepEqual([1, 2, 3].map((recurs) => soft(fieldMap, { recurs })), [true, true, false]);
  assert.equal(recurrence(fieldMap, { recurs: 3 }), 'found again in 3 of 4 reruns');
});

test('every shipped subfield says how many reruns found it again', () => {
  assert.ok(SHIPPED.clusters.every((c) => c.recurs >= 0 && c.recurs <= SHIPPED.reruns));
});

test('neighbours become one link per pair', () => {
  const near = (id, ids) => ({ id, near: ids.map((n) => ({ id: n, cites: 1 })) });
  assert.deepEqual(links([near(0, [1, 2]), near(1, [0]), near(2, [])]), [{ a: 0, b: 1 }, { a: 0, b: 2 }]);
});

test('every shipped subfield names its neighbours and who works in it', () => {
  const ids = new Set(SHIPPED.clusters.map((c) => c.id));
  SHIPPED.clusters.forEach((c) => {
    assert.ok(c.near.length > 0 && c.near.every((n) => ids.has(n.id) && n.id !== c.id));
    assert.deepEqual(Object.keys(c.who), ['authors', 'institutions', 'funders']);
  });
});

test('a subfield\'s venues are its journals with their facts, in its order', () => {
  const fieldMap = { venues: { journals: { S1: { name: 'One' }, S2: { name: 'Two' } } } };
  const cluster = { journals: [{ id: 'S2', papers: 9 }, { id: 'S1', papers: 3 }] };
  assert.deepEqual(venues(fieldMap, cluster), [{ name: 'Two', papers: 9 }, { name: 'One', papers: 3 }]);
});

test('a fee reads as the price of publishing or of open access, with its year', () => {
  const fee = { usd: 3780, year: 2025 };
  assert.equal(feeText({ open_access: true, fee }), 'Fully open access; charges $3,780 in 2025 to publish');
  assert.equal(feeText({ open_access: false, fee }),
    'Not fully open access; open access for an article costs $3,780 in 2025');
  assert.equal(feeText({ open_access: true, fee: null }), 'Fully open access; OpenAlex lists no fee');
  assert.equal(feeText({ open_access: false, fee: null }), 'Not fully open access; OpenAlex lists no fee');
});

test('a DOAJ listing reads as its licences and its waiver', () => {
  assert.equal(licenceText({ licences: ['CC BY', 'CC BY-NC-ND'] }), 'published under CC BY or CC BY-NC-ND');
  assert.equal(waiverText({ waiver: true }), 'offers a fee waiver');
  assert.equal(waiverText({ waiver: false }), 'lists no fee waiver');
});

test('every shipped subfield\'s journals are shipped venues, and add up to its size', () => {
  SHIPPED.clusters.forEach((c) => {
    assert.ok(c.journals.every((j) => j.id in SHIPPED.venues.journals));
    assert.equal(c.journals.reduce((n, j) => n + j.papers, 0), c.size);
  });
});

test("new papers are those published after the map's last year", () => {
  assert.equal(newSince(FIELD_MAP), '2026-01-01');
});

test('new papers are asked for by the works a subfield cites most, newest first', () => {
  const url = new URL(newPapersUrl(FIELD_MAP, FIELD_MAP.clusters[0]));
  assert.equal(url.searchParams.get('filter'), 'cites:W1|W2,from_publication_date:2026-01-01');
  assert.equal(url.searchParams.get('sort'), 'publication_date:desc');
  assert.match(url.searchParams.get('select'), /referenced_works/);
  const many = { refs: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`W${n}`, 1 / n])) };
  assert.match(new URL(newPapersUrl(FIELD_MAP, many)).searchParams.get('filter'), /^cites:W1\|W2\|W3\|W4\|W5,/);
});

test('a new paper is kept when it places in the subfield, up to five', () => {
  const work = (n, refs) => ({
    doi: `https://doi.org/10.1/N${n}`, title: `new ${n}`, publication_date: '2026-11-0' + n, referenced_works: refs,
  });
  const here = [1, 2, 3, 4, 5, 6].map((n) => work(n, ['https://openalex.org/W1']));
  const works = [work(0, ['https://openalex.org/W3']), work(9, []), ...here];
  const kept = newPapers(FIELD_MAP, FIELD_MAP.clusters[0], works);
  assert.deepEqual(kept.map((p) => p.title), ['new 1', 'new 2', 'new 3', 'new 4', 'new 5']);
  assert.deepEqual(kept[0], { doi: '10.1/n1', title: 'new 1', date: '2026-11-01' });
});

test('a reading-order entry names the earlier entries it builds on', () => {
  assert.equal(afterText([]), '');
  assert.equal(afterText([2]), 'builds on 2');
  assert.equal(afterText([1, 2]), 'builds on 1 and 2');
  assert.equal(afterText([1, 3, 4]), 'builds on 1, 3 and 4');
});

test('a page address names the map it shows', () => {
  assert.equal(mapUrl(''), 'data/biostatistics.json');
  assert.equal(mapUrl('?map=ecology'), 'data/ecology.json');
  assert.throws(() => mapUrl('?map=../x'), /no map is named "..\/x"/);
  assert.throws(() => mapUrl('?map=ecology/../x'), /no map is named/);
});

test('the page links every other built field', () => {
  const index = [{ slug: 'biostatistics', name: 'biostatistics' }, { slug: 'ecology', name: 'ecology' }];
  assert.deepEqual(otherFields(index, FIELD_MAP), [{ slug: 'ecology', name: 'ecology' }]);
});

test('placement is stated as the share of held-back papers placed right', () => {
  assert.equal(placementText({ held_back: 2304, by_citations: 1560, by_title: 1214 }),
    "Tested on 2,304 of the map's own papers, held back while the rest built the subfields, citations " +
    "picked the paper's own subfield 68% of the time, and title words 53%.");
});

test('the page reads the field index the build writes beside the maps', () => {
  assert.ok(read(`../${FIELDS_URL}`).some((f) => f.slug === SHIPPED.scope.slug));
});
