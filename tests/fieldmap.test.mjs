import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  FIELDS_URL, HEIGHT, WIDTH, afterText, candidates, citations, citedCounts, citersUrl, citingReviews, cleanDoi, coreWorks, entries,
  feeText, foundations, layout, licenceText, links, lookupUrl, mapUrl, mostCited, newPapers, newPapersUrl, newSince, ordered,
  coupling, couplingVectors, groupNames, groupsOf, mds, nearestGroups, pickName, topicMap,
  otherFields, paperUrl, place, placedIn, placementText, readMap, recordsUrl, recurrence, reviewsUrl, sample, searchUrl, shortId, shortName,
  soft, steps, tally, titleTerms, toLookUp, topicAsk, topicCore, topicNew, topicReviews, topicSearch, venues, waiverText, yearBefore,
} from '../fieldmap.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const SHIPPED = read('../data/biostatistics.json');
const TITLE_TERMS = read('./title_terms.json');
// Reading-order cases the pipeline's build.py passes too.
const READING_CASES = read('./reading_cases.json');

const cluster = (id, name, terms, refs = {}, size = 10, x = 0.5, y = 0.5) => ({
  id, name, terms, refs, size, x, y,
  starters: [1, 2, 3, 4].map((n) => ({ title: `${name[0]} ${n}`, doi: n === 4 ? null : `10.1/${id}${n}`, cites: n })),
  reviews: [{ title: 'known review', doi: '10.1/known', year: 2020, cites: 9 }],
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

test("a subfield's core works are the five it cites most tellingly", () => {
  assert.deepEqual(coreWorks(FIELD_MAP.clusters[0]), ['W1', 'W2']);
  const many = { refs: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`W${n}`, 1 / n])) };
  assert.deepEqual(coreWorks(many), ['W1', 'W2', 'W3', 'W4', 'W5']);
});

test('new papers are asked for by the core works they cite, newest first', () => {
  const url = new URL(newPapersUrl(['W1', 'W2'], '2026-01-01', '2026-11-17'));
  assert.equal(url.searchParams.get('filter'), 'cites:W1|W2,from_publication_date:2026-01-01,to_publication_date:2026-11-17');
  assert.equal(url.searchParams.get('sort'), 'publication_date:desc');
  assert.equal(url.searchParams.get('per_page'), '50');
  assert.equal(url.searchParams.get('select'),
    'id,doi,title,type,publication_year,publication_date,cited_by_count,referenced_works');
});

test('reviews are asked for by the core works they cite, most cited first', () => {
  const url = new URL(reviewsUrl(['W1', 'W2']));
  assert.equal(url.searchParams.get('filter'), 'cites:W1|W2,type:review');
  assert.equal(url.searchParams.get('sort'), 'cited_by_count:desc');
});

const openalexWork = (n, refs, extra = {}) => ({
  id: `https://openalex.org/W${n}`, doi: `https://doi.org/10.1/R${n}`, title: `work ${n}`, type: 'article',
  publication_year: 2000 + n, publication_date: `20${10 + n}-01-01`, cited_by_count: n,
  referenced_works: refs.map((r) => `https://openalex.org/${r}`), ...extra,
});

test("a review from any journal is kept when it places in the subfield and isn't the map's own, up to five", () => {
  const here = [1, 2, 3, 4, 5, 6].map((n) => openalexWork(n, ['W1']));
  const known = { ...openalexWork(7, ['W1']), doi: 'https://doi.org/10.1/KNOWN' };
  const undoied = { ...openalexWork(8, ['W1']), doi: null };
  const kept = citingReviews(FIELD_MAP, FIELD_MAP.clusters[0], [openalexWork(0, ['W3']), known, undoied, ...here]);
  assert.deepEqual(kept.map((r) => r.title), ['work 8', 'work 1', 'work 2', 'work 3', 'work 4']);
  assert.deepEqual(kept[1], { doi: '10.1/r1', title: 'work 1', year: 2001, cites: 1 });
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

test('the works placed in a subfield are those whose citations pick it', () => {
  const work = (n, refs) => ({ title: `w${n}`, referenced_works: refs.map((r) => `https://openalex.org/${r}`) });
  const works = [work(0, ['W1']), work(1, ['W3']), work(2, []), work(3, ['W2', 'W3'])];
  assert.deepEqual(placedIn(FIELD_MAP, FIELD_MAP.clusters[0], works).map((w) => w.title), ['w0']);
  assert.deepEqual(placedIn(FIELD_MAP, FIELD_MAP.clusters[1], works).map((w) => w.title), ['w1', 'w3']);
});

for (const c of READING_CASES) {
  test(`reading order, as the pipeline orders it: ${c.name}`, () => {
    const works = c.members.map((m) => ({
      id: `https://openalex.org/${m.id}`, doi: null, title: m.id, publication_year: m.year,
      referenced_works: m.refs.map((r) => `https://openalex.org/${r}`),
    }));
    const counts = citedCounts(works);
    const asked = new Set(candidates(counts));
    const order = ordered(foundations(counts, works.filter((w) => asked.has(shortId(w.id)))));
    assert.deepEqual(steps(order, counts).map((s) => [s.title, s.inside, s.after]),
      c.order.map((id, i) => [id, c.inside[i], c.after[i]]));
  });
}

test('a tie in count and year ranks the lower id first', () => {
  const works = ['W2', 'W1'].map((id) => ({ id, doi: null, title: id, publication_year: 2015, referenced_works: [] }));
  assert.deepEqual(foundations(new Map([['W1', 1], ['W2', 1]]), works).map((w) => w.id), ['W1', 'W2']);
});

test('a paper citing itself does not wait on itself', () => {
  assert.deepEqual(ordered([{ id: 'A', refs: ['A'] }, { id: 'B', refs: [] }]).map((p) => p.id), ['A', 'B']);
});

test('the works ranked for a reading order are the ten cited most and every one tied with the tenth', () => {
  const counts = new Map([...Array(12).keys()].map((n) => [`W${n}`, n < 9 ? 3 : 2]));
  assert.deepEqual(candidates(counts), ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W10', 'W11', 'W9']);
  counts.set('W11', 1);
  assert.deepEqual(candidates(counts), ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W10', 'W9']);
  const clear = new Map([...Array(12).keys()].map((n) => [`W${n}`, n < 10 ? 3 : 1]));
  assert.equal(candidates(clear).length, 10);
  assert.equal(candidates(new Map(Array.from({ length: 60 }, (_, n) => [`W${n}`, 1]))).length, 50);
  assert.deepEqual(candidates(new Map([['W2', 1], ['W1', 1]])), ['W1', 'W2']);
});

test("a topic's core works are the five its works cite most, ties by id", () => {
  const works = [openalexWork(1, ['W9', 'W8', 'W7', 'W6', 'W5', 'W4']), openalexWork(2, ['W9', 'W3'])];
  assert.deepEqual(topicCore(citedCounts(works)), ['W9', 'W3', 'W4', 'W5', 'W6']);
});

test('a typed DOI asks about that paper, anything else is a topic', () => {
  assert.deepEqual(topicAsk(' https://doi.org/10.1002/SIM.123 '), { kind: 'paper', doi: '10.1002/sim.123' });
  assert.deepEqual(topicAsk('doi: 10.1234/x'), { kind: 'paper', doi: '10.1234/x' });
  assert.deepEqual(topicAsk('10.1234/x'), { kind: 'paper', doi: '10.1234/x' });
  assert.deepEqual(topicAsk('10.1/x'), { kind: 'topic', text: '10.1/x' });
  assert.deepEqual(topicAsk('missing data 10.1234/x'), { kind: 'topic', text: 'missing data 10.1234/x' });
  assert.deepEqual(topicAsk('10.1234/x and more'), { kind: 'topic', text: '10.1234/x and more' });
  assert.deepEqual(topicAsk('http://doi.org/10.1234/x'), { kind: 'paper', doi: '10.1234/x' });
  assert.deepEqual(topicAsk('doi:10.1234/x'), { kind: 'paper', doi: '10.1234/x' });
  assert.deepEqual(topicAsk('  missing data  '), { kind: 'topic', text: 'missing data' });
  assert.throws(() => topicAsk('  '), /type a topic or a DOI/);
});

test('a topic is searched among articles and reviews, a page at a time', () => {
  const url = new URL(searchUrl('missing data & MI'));
  assert.equal(url.searchParams.get('search'), 'missing data & MI');
  assert.equal(url.searchParams.get('filter'), 'type:article|review');
  assert.equal(url.searchParams.get('per_page'), '200');
  assert.match(url.searchParams.get('select'), /referenced_works/);
});

test("a paper is looked up by its DOI, its citers most cited first, and records by their ids", () => {
  assert.equal(new URL(paperUrl('10.1/x')).searchParams.get('filter'), 'doi:10.1/x');
  const citers = new URL(citersUrl('W1'));
  assert.equal(citers.searchParams.get('filter'), 'cites:W1');
  assert.equal(citers.searchParams.get('sort'), 'cited_by_count:desc');
  assert.equal(new URL(recordsUrl(['W1', 'W2'])).searchParams.get('filter'), 'openalex:W1|W2');
});

const CORE_WORKS = ['W91', 'W92', 'W93'];

test("a topic's reviews are those its search found, then other reviews citing two core works, by how many, then most cited", () => {
  const review = (n, refs = []) => openalexWork(n, refs, { type: 'review' });
  const found = [review(1), openalexWork(9, []), review(3)];
  const citing = [review(3, ['W91', 'W92']), review(2, ['W91', 'W92']), review(8, ['W91']), openalexWork(5, ['W91', 'W92', 'W93']),
    review(4, ['W91', 'W92']), review(6, ['W91', 'W92', 'W93']), review(7, ['W92', 'W93'])];
  assert.deepEqual(topicReviews(CORE_WORKS, found, citing).map((r) => r.title),
    ['work 1', 'work 3', 'work 6', 'work 7', 'work 4']);
  assert.deepEqual(mostCited([openalexWork(1, []), openalexWork(2, [])])[0], { doi: '10.1/r2', title: 'work 2', year: 2002, cites: 2 });
  assert.equal(mostCited([1, 2, 3, 4, 5, 6].map((n) => openalexWork(n, []))).length, 5);
});

test("a topic's new papers cite two of its core works, those citing more first, up to five", () => {
  const works = [openalexWork(1, ['W91']), ...[2, 3, 4, 5, 6].map((n) => openalexWork(n, ['W91', 'W92'])),
    openalexWork(7, ['W91', 'W92', 'W93'])];
  assert.deepEqual(topicNew(CORE_WORKS, works).map((p) => p.title), ['work 7', 'work 2', 'work 3', 'work 4', 'work 5']);
  assert.equal(topicNew(CORE_WORKS, works)[0].doi, '10.1/r7');
  const few = [openalexWork(1, ['W91']), openalexWork(2, ['W1', 'W2']), openalexWork(3, ['W91', 'W93'])];
  assert.deepEqual(topicNew(CORE_WORKS, few).map((p) => p.title), ['work 3']);
  assert.equal(yearBefore('2026-11-17'), '2025-11-17');
});

test('a topic is named in the page address beside the map it shows', () => {
  assert.equal(topicSearch('?map=epidemiology', ' missing data '), '?map=epidemiology&topic=missing+data');
  assert.equal(topicSearch('?topic=old', 'new'), '?topic=new');
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

// ---- A topic's groups ----------------------------------------------------

const citing = (n, refs, title = `work ${n}`) => ({
  id: `https://openalex.org/T${n}`, title, referenced_works: refs.map((r) => `https://openalex.org/${r}`),
});

// Cliques of works, each clique citing its own two papers, numbered on from `from`.
const cliques = (sizes, from = 0) => sizes.flatMap((size, k) => Array.from({ length: size }, (_, i) =>
  citing(from + sizes.slice(0, k).reduce((a, b) => a + b, 0) + i, [`R${k}a`, `R${k}b`], `clique${k} theme${k} ${i}`)));

// Works citing nothing, numbered on from `from`, so a clique's papers are cited
// by under half of all the works.
const loners = (count, from) => Array.from({ length: count }, (_, i) => citing(from + i, []));

test('a citation links works only when two to under half of them cite it', () => {
  const works = [
    citing(0, ['A', 'A', 'B', 'C']), citing(1, ['A', 'B']), citing(2, ['B']), citing(3, []), citing(4, []), citing(5, []),
  ];
  const [first, second, third, fourth] = couplingVectors(works);
  assert.deepEqual([...first], [['A', 1]]);
  assert.deepEqual([...second], [['A', 1]]);
  assert.equal(third.size, 0);
  assert.equal(fourth.size, 0);
});

test('a citation weighs more the fewer works cite it', () => {
  const works = [citing(0, ['A', 'B']), citing(1, ['A', 'B']), citing(2, ['B']), ...[3, 4, 5, 6, 7].map((n) => citing(n, []))];
  const [first] = couplingVectors(works);
  const ratio = first.get('A') / first.get('B');
  assert.ok(Math.abs(ratio - Math.log(8 / 2) / Math.log(8 / 3)) < 1e-9, String(ratio));
  assert.ok(Math.abs(Math.hypot(...first.values()) - 1) < 1e-9);
});

test("two works' link is the cosine of their citations", () => {
  const works = [citing(0, ['A', 'B']), citing(1, ['A', 'B']), citing(2, ['A']), citing(3, ['B', 'C']), citing(4, ['C']),
    ...loners(6, 5)];
  const links = coupling(couplingVectors(works));
  const near = (m, expected) => [...m].every(([j, x]) => Math.abs(x - expected.get(j)) < 1e-9) && m.size === expected.size;
  const a = Math.log(11 / 3);
  const b = Math.log(11 / 3);
  assert.ok(near(links[0], new Map([[1, 1], [2, a / Math.hypot(a, b)], [3, (b / Math.hypot(a, b)) * (b / Math.hypot(b, Math.log(11 / 2)))]])),
    JSON.stringify([...links[0]]));
  assert.equal(links[0].has(0), false);
});

test('works citing the same papers form a group, largest first', () => {
  const works = [...cliques([5, 6]), citing(11, ['X']), citing(12, [])];
  assert.deepEqual(groupsOf(couplingVectors(works)), [[5, 6, 7, 8, 9, 10], [0, 1, 2, 3, 4]]);
});

test('groups of the same size keep the order of their first work', () => {
  const works = cliques([5, 5, 5]);
  assert.deepEqual(groupsOf(couplingVectors(works)).map((g) => g[0]), [0, 5, 10]);
});

test('a group needs five works, and at most eight are kept', () => {
  assert.deepEqual(groupsOf(couplingVectors(cliques([4, 5, 4, 4, 4]))), [[4, 5, 6, 7, 8]]);
  assert.equal(groupsOf(couplingVectors(cliques([5, 5, 5, 5, 5, 5, 5, 5, 5]))).length, 8);
});

test('a weak tie between two groups does not merge them', () => {
  const works = [...cliques([6, 6]), ...loners(13, 12)];
  works[5] = citing(5, ['R0a', 'R0b', 'R1a']);
  assert.deepEqual(groupsOf(couplingVectors(works)), [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11]]);
});

test('a group is merged level by level until no merge raises modularity', () => {
  // Two pairs of cliques, each pair tied by a work citing both; Louvain's
  // second level joins each pair, and no level joins the pairs.
  const works = cliques([5, 5, 5, 5, 3]);
  works.push(citing(23, ['R0a', 'R1a']), citing(24, ['R2a', 'R3a']));
  assert.ok(groupsOf(couplingVectors(works)).every((g) => g.length >= 5));
});

test('Louvain merges small communities at a later level, and a group lists its works in order', () => {
  // Eight cliques of three, interleaved: work i is in clique i % 8 and cites
  // its clique's R and S, and the first of each clique cites the next
  // clique's R too. The first level finds the cliques, the second joins them
  // in pairs; on a ring every pairing ties, and the order of the links picks.
  const works = [...Array.from({ length: 24 }, (_, i) => {
    const c = i % 8;
    return citing(i, [`R${c}`, `S${c}`, ...(i < 8 ? [`R${(c + 1) % 8}`] : [])]);
  }), ...loners(24, 24)];
  assert.deepEqual(groupsOf(couplingVectors(works)), [
    [0, 7, 8, 15, 16, 23], [1, 2, 9, 10, 17, 18], [3, 4, 11, 12, 19, 20], [5, 6, 13, 14, 21, 22],
  ]);
});

test('a work tied equally to two groups joins the first it is linked to', () => {
  const works = [...cliques([5, 5]), citing(10, ['R0a', 'R1a']), ...loners(12, 11)];
  assert.deepEqual(groupsOf(couplingVectors(works)), [[0, 1, 2, 3, 4, 10], [5, 6, 7, 8, 9]]);
});

test('nothing links works that share no citation, so no group forms', () => {
  assert.deepEqual(groupsOf(couplingVectors([citing(0, ['A']), citing(1, ['B'])])), []);
});

test('a name takes five terms, skipping one inside a term already chosen', () => {
  assert.deepEqual(pickName(['missing', 'missing data', 'data missing', 'a', 'b', 'c', 'd']), ['missing', 'a', 'b', 'c', 'd']);
  assert.deepEqual(pickName(['data', 'missing data']), ['data']);
  assert.deepEqual(pickName(['missing data', 'missing values']), ['missing data', 'missing values']);
  assert.deepEqual(pickName(['a', 'b', 'c', 'd', 'e', 'f', 'g']), ['a', 'b', 'c', 'd', 'e']);
});

test('a group is named by the words its titles share and other groups lack', () => {
  const titles = ['coral bleaching', 'coral bleaching heat', 'reef fish', 'heat waves', 'marine of heat waves', 'ocean'];
  // A tie is broken alphabetically, and a term inside a chosen one is skipped.
  assert.deepEqual(groupNames(new Set(['of']), titles, [[0, 1, 2], [3, 4, 5]]),
    [['bleaching', 'coral', 'fish', 'reef', 'heat'], ['heat waves', 'marine', 'ocean']]);
});

test('a word in every title is in no name', () => {
  const titles = ['alpha beta', 'gamma alpha', 'alpha delta', 'epsilon alpha'];
  assert.deepEqual(groupNames(new Set(), titles, [[0, 1], [2, 3]]), [['alpha beta', 'gamma'], ['alpha delta', 'epsilon']]);
  assert.deepEqual(groupNames(new Set(), ['solo title'], [[0]]), [[]]);
});

test('a term in two titles comes before a rarer term that scores more', () => {
  const titles = ['beta one', 'beta two', 'beta three', 'beta four', 'five', 'six', 'seven', 'eight'];
  const [name] = groupNames(new Set(), titles, [[0, 1], [2, 3, 4, 5, 6, 7]]);
  assert.deepEqual(name, ['beta', 'one', 'two']);
});

test('mds lays three points in a row along one axis and centres the other', () => {
  assert.deepEqual(mds([[0, 1, 2], [1, 0, 1], [2, 1, 0]]), { x: [0, 0.5, 1], y: [0.5, 0.5, 0.5] });
  assert.deepEqual(mds([[0]]), { x: [0.5], y: [0.5] });
});

test('mds spreads a triangle over both axes', () => {
  const { x, y } = mds([[0, 1, 1], [1, 0, 1], [1, 1, 0]]);
  assert.deepEqual([...x].sort(), [0, 0.5, 1]);
  assert.deepEqual([...y].sort(), [0, 0, 1]);
});

test('each group is near the three it cites most alike, most first', () => {
  const alike = [
    [1, 0.2, 0.5, 0.1, 0.3],
    [0.2, 1, 0, 0, 0],
    [0.5, 0, 1, 0.5, 0],
    [0.1, 0, 0.5, 1, 0],
    [0.3, 0, 0, 0, 1],
  ];
  assert.deepEqual(nearestGroups(alike).map((n) => n.map((m) => m.id)), [[2, 4, 1], [0], [0, 3], [2, 0], [0]]);
});

test("a topic's map gives each group its name, size, place, nearest and works", () => {
  const works = [...cliques([6, 5]), citing(11, ['R0a', 'R1a'], 'bridge'), ...loners(14, 12)];
  const groups = topicMap(new Set(), works);
  assert.deepEqual(groups.map((g) => [g.id, g.size, g.name[0], g.near]), [
    [0, 6, 'clique0', [{ id: 1 }]], [1, 6, 'clique1', [{ id: 0 }]],
  ]);
  assert.deepEqual(groups.map((g) => [g.x, g.y]), [[0, 0.5], [1, 0.5]]);
  assert.deepEqual(groups[1].works.map((w) => w.title)[0], 'clique1 theme1 0');
});

test('a group whose titles hold no word is named by its number', () => {
  const works = [...cliques([5]).map((w) => ({ ...w, title: null })), ...loners(6, 5)];
  assert.deepEqual(topicMap(new Set(), works)[0].name, ['group 1']);
});
