import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  HEIGHT, TITLE_FLOOR, WIDTH, cleanDoi, entries, layout, place, sample, shortName, tally, titleTerms,
} from '../fieldmap.js';

const cluster = (id, name, terms, size = 10, x = 0.5, y = 0.5) => ({
  id, name, terms, size, x, y,
  starters: [1, 2, 3, 4].map((n) => ({ title: `${name[0]} ${n}`, doi: n === 4 ? null : `10.1/${id}${n}` })),
});
const FIELD_MAP = {
  clusters: [
    cluster(0, ['missing', 'imputation'], { missing: 1, imputation: 0.8 }, 30),
    cluster(1, ['spatial', 'disease'], { spatial: 1, disease: 0.5 }, 20),
  ],
  dois: { '10.1/abc': 1 },
};

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

test('title terms drop stop words and add neighbouring pairs', () => {
  assert.deepEqual(titleTerms('A model of missing data imputation'), ['missing', 'imputation', 'missing imputation']);
  assert.deepEqual(titleTerms('---'), ['---']);
  assert.deepEqual(titleTerms('!!'), []);
});

test('a paper on the map is placed by its DOI', () => {
  assert.deepEqual(place(FIELD_MAP, { doi: '10.1/abc', title: 'missing' }), { cluster: 1, how: 'doi' });
});

test('any other paper is placed by its title words above the floor', () => {
  assert.ok(TITLE_FLOOR < 1);
  assert.deepEqual(place(FIELD_MAP, { doi: '10.9/zz', title: 'Missing imputation' }), { cluster: 0, how: 'title' });
  assert.deepEqual(place(FIELD_MAP, { doi: null, title: 'Medieval trapeze artists' }), { cluster: null, how: 'none' });
  assert.deepEqual(place(FIELD_MAP, { doi: '10.9/zz', title: null }), { cluster: null, how: 'none' });
});

test('tally counts placed papers per cluster', () => {
  assert.deepEqual(tally([{ cluster: 0 }, { cluster: 0 }, { cluster: 1 }, { cluster: null }]), { 0: 2, 1: 1 });
});

test('the sample reads back as the biggest clusters\' first three starters', () => {
  const read = entries(sample(FIELD_MAP));
  assert.equal(read.length, 6);
  assert.deepEqual(read[0], { doi: '10.1/01', title: 'missing 1' });
});

test('a shared first name term takes the second one too', () => {
  const clusters = [cluster(0, ['treatment', 'optimal'], {}), cluster(1, ['treatment', 'subgroup'], {}),
    cluster(2, ['spatial', 'disease'], {})];
  assert.equal(shortName(clusters, clusters[0]), 'treatment, optimal');
  assert.equal(shortName(clusters, clusters[2]), 'spatial');
});

test('layout keeps every circle apart and inside the map', () => {
  const clusters = [0, 1, 2, 3].map((i) => cluster(i, [`c${i}`], {}, 10 + i));
  const discs = layout(clusters);
  discs.forEach((a, i) => discs.slice(i + 1).forEach((b) => {
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.reach + b.reach);
  }));
  discs.forEach((d) => {
    assert.ok(d.x >= d.reach && d.x <= WIDTH - d.reach);
    assert.ok(d.y > d.r && d.y < HEIGHT - d.r);
  });
});

test('a sample starter without a DOI reads back with its title alone', () => {
  const noDoi = { ...FIELD_MAP.clusters[0], starters: [{ title: 'untitled DOI', doi: null }] };
  assert.deepEqual(entries(sample({ ...FIELD_MAP, clusters: [noDoi] })), [{ doi: null, title: 'untitled DOI' }]);
});
