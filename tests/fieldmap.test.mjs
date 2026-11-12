import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  HEIGHT, WIDTH, citations, cleanDoi, entries, layout, lookupUrl, place, readMap, recurrence, sample, shortId,
  shortName, soft, tally, titleTerms, toLookUp,
} from '../fieldmap.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const SHIPPED = read('../data/map.json');
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
