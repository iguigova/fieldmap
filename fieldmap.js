// The page's logic that needs no page: reading BibTeX, placing papers on the
// map, laying the map out. index.html draws what these return.

const SAMPLE_CLUSTERS = 8;
const SAMPLE_PER_CLUSTER = 3;
const OPENALEX = 'https://api.openalex.org/works';
// OpenAlex takes up to 100 values in one filter; a DOI can name two works.
const LOOKUP_BATCH = 50;
const LOOKUP_PAGE = 200;
// The pipeline's tokenizer: runs of two or more word characters.
const WORD = /[\p{L}\p{N}_]{2,}/gu;
// A DOI holding a filter separator cannot be looked up.
const SEPARATOR = /[,|]/;
// Works citing a set's core works: new papers, newest first, and reviews,
// most cited first. Five core works keep the filter under OpenAlex's keyless
// limit on OR operators.
const CORE = 5;
const ASKED = 50;
export const SHOWN = 5;
// A topic's search is looser than a subfield's profile, so a work citing it
// is kept when it cites at least two of its core works.
const ON_TOPIC = 2;
const WORK_FIELDS = 'id,doi,title,type,publication_year,publication_date,cited_by_count,referenced_works';
// A topic: one page of OpenAlex's search, and its reading order's ten works,
// ranked among every work tied with the tenth, up to one filter's worth.
const TOPIC_PAGE = 200;
const READING = 10;
const RANKED = 50;
const DOI_TEXT = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+)$/i;

export const WIDTH = 1000;
export const HEIGHT = 720;
const GAP = 6;
const CHAR_WIDTH = 7.5;
const SETTLE_STEPS = 300;

// ---- BibTeX: just the DOI and title of each entry ------------------------

const FIELD = (name) =>
  new RegExp(`\\b${name}\\s*=\\s*(\\{((?:[^{}]|\\{[^{}]*\\})*)\\}|"([^"]*)")`, 'i');

const field = (entry, name) => {
  const m = entry.match(FIELD(name));
  return m ? (m[2] ?? m[3]).replace(/[{}]/g, '').trim() : null;
};

export const cleanDoi = (doi) =>
  doi ? doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : null;

export const entries = (text) => text.split(/@\w+\s*[{(]/).slice(1)
  .map((e) => ({ doi: cleanDoi(field(e, 'doi')), title: field(e, 'title') }))
  .filter((e) => e.doi || e.title);

export const sample = (fieldMap) => [...fieldMap.clusters]
  .sort((a, b) => b.size - a.size)
  .slice(0, SAMPLE_CLUSTERS)
  .flatMap((c) => c.starters.slice(0, SAMPLE_PER_CLUSTER))
  .map(({ doi, title }) => ({ doi, title }));

// ---- Citations: what a paper off the map cites, from OpenAlex ------------

export const shortId = (url) => url.slice(url.lastIndexOf('/') + 1);

export const toLookUp = (fieldMap, found) => [...new Set(found
  .map((e) => e.doi)
  .filter((doi) => doi && !(doi in fieldMap.dois) && !SEPARATOR.test(doi)))];

const batches = (items) => Array.from(
  { length: Math.ceil(items.length / LOOKUP_BATCH) },
  (_, i) => items.slice(i * LOOKUP_BATCH, (i + 1) * LOOKUP_BATCH));

export const lookupUrl = (dois) => `${OPENALEX}?filter=${encodeURIComponent(`doi:${dois.join('|')}`)}` +
  `&select=doi,referenced_works&per_page=${LOOKUP_PAGE}`;

const remember = (refs, works) => works.forEach((w) =>
  refs.set(cleanDoi(w.doi), w.referenced_works.map(shortId)));

// The references of each DOI OpenAlex knows, and the DOIs it was not reached for.
export const citations = async (getJson, dois) => {
  const refs = new Map();
  const unreached = [];
  for (const batch of batches(dois)) {
    try {
      remember(refs, (await getJson(lookupUrl(batch))).results);
    } catch {
      unreached.push(...batch);
    }
  }
  return { refs, unreached };
};

// ---- Placing a paper: by DOI, else its citations, else its title words ---

const DEFAULT_MAP = 'biostatistics';
export const FIELDS_URL = 'data/fields.json';

// The map a page address names, ?map=<name> for data/<name>.json, else the
// default; a name is lowercase letters, digits and hyphens.
export const mapUrl = (search) => {
  const name = new URLSearchParams(search).get('map') ?? DEFAULT_MAP;
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`no map is named "${name}"`);
  return `data/${name}.json`;
};

// Every built field but the one shown, for the page to link to.
export const otherFields = (index, fieldMap) => index.filter((f) => f.slug !== fieldMap.scope.slug);

const percent = (part, whole) => `${Math.round((100 * part) / whole)}%`;

export const placementText = ({ held_back: held, by_citations: cited, by_title: titled }) =>
  `Tested on ${held.toLocaleString('en-US')} of the map's own papers, held back while the rest built the ` +
  `subfields, citations picked the paper's own subfield ${percent(cited, held)} of the time, and title ` +
  `words ${percent(titled, held)}.`;

export const readMap = (json) => ({ ...json, stopWords: new Set(json.stop_words) });

export const titleTerms = (stopWords, title) => {
  const words = (title.toLowerCase().match(WORD) ?? []).filter((w) => !stopWords.has(w));
  return [...words, ...words.slice(1).map((w, i) => `${words[i]} ${w}`)];
};

const score = (terms, weights) => terms.reduce((s, t) => s + (weights[t] ?? 0), 0);

const best = (fieldMap, profile, terms, floor) => fieldMap.clusters
  .map((c) => ({ id: c.id, s: score(terms, c[profile]) }))
  .reduce((a, b) => (b.s > a.s ? b : a), { id: null, s: floor }).id;

const byCitations = (fieldMap, refs) => (refs ? best(fieldMap, 'refs', refs, 0) : null);

const byTitle = (fieldMap, title) =>
  (title ? best(fieldMap, 'terms', titleTerms(fieldMap.stopWords, title), fieldMap.title_floor) : null);

// refs: the works the entry cites, or undefined when they are not known.
export const place = (fieldMap, entry, refs) => {
  if (entry.doi && entry.doi in fieldMap.dois) return { cluster: fieldMap.dois[entry.doi], how: 'doi' };
  const cited = byCitations(fieldMap, refs);
  if (cited !== null) return { cluster: cited, how: 'citations' };
  const titled = byTitle(fieldMap, entry.title);
  return { cluster: titled, how: titled === null ? 'none' : 'title' };
};

export const tally = (placed) => placed.reduce((counts, p) => {
  if (p.cluster !== null) counts[p.cluster] = (counts[p.cluster] ?? 0) + 1;
  return counts;
}, {});

// ---- Citing works: new papers and reviews that cite a set's core works ---

export const newSince = (fieldMap) => `${fieldMap.scope.years[1] + 1}-01-01`;

// A subfield's core works: the five it cites most tellingly.
export const coreWorks = (cluster) => Object.keys(cluster.refs).slice(0, CORE);

const citingUrl = (core, filter, sort) =>
  `${OPENALEX}?filter=${encodeURIComponent(`cites:${core.join('|')},${filter}`)}&sort=${sort}` +
  `&per_page=${ASKED}&select=${WORK_FIELDS}`;

export const newPapersUrl = (core, since, until) =>
  citingUrl(core, `from_publication_date:${since},to_publication_date:${until}`, 'publication_date:desc');

export const reviewsUrl = (core) => citingUrl(core, 'type:review', 'cited_by_count:desc');

const dated = (w) => ({ doi: cleanDoi(w.doi), title: w.title, date: w.publication_date });

const cited = (w) => ({ doi: cleanDoi(w.doi), title: w.title, year: w.publication_year, cites: w.cited_by_count });

// The works OpenAlex returned that place in the cluster by what they cite.
export const placedIn = (fieldMap, cluster, works) =>
  works.filter((w) => byCitations(fieldMap, w.referenced_works.map(shortId)) === cluster.id);

export const newPapers = (fieldMap, cluster, works) => placedIn(fieldMap, cluster, works).slice(0, SHOWN).map(dated);

// The reviews OpenAlex returned that place in the cluster, less the map's own.
export const citingReviews = (fieldMap, cluster, works) => {
  const known = new Set(cluster.reviews.map((r) => r.doi));
  return placedIn(fieldMap, cluster, works).map(cited)
    .filter((r) => !(r.doi && known.has(r.doi))).slice(0, SHOWN);
};

// ---- A topic: any topic or paper, read from OpenAlex in the browser ------

// What the reader typed: a paper's DOI, or a topic to search for.
export const topicAsk = (text) => {
  const typed = text.trim();
  if (!typed) throw new Error('type a topic or a DOI');
  const doi = typed.match(DOI_TEXT);
  return doi ? { kind: 'paper', doi: cleanDoi(doi[1]) } : { kind: 'topic', text: typed };
};

const worksUrl = (filter, extra = '') =>
  `${OPENALEX}?filter=${encodeURIComponent(filter)}${extra}&per_page=${TOPIC_PAGE}&select=${WORK_FIELDS}`;

export const searchUrl = (text) => `${worksUrl('type:article|review')}&search=${encodeURIComponent(text)}`;

export const paperUrl = (doi) => worksUrl(`doi:${doi}`);

export const citersUrl = (id) => worksUrl(`cites:${id}`, '&sort=cited_by_count:desc');

export const recordsUrl = (ids) => worksUrl(`openalex:${ids.join('|')}`);

// How many of the works cite each work, each work counted once per citer.
export const citedCounts = (works) => works.reduce((counts, w) => {
  const own = shortId(w.id);
  new Set(w.referenced_works.map(shortId)).forEach((r) => {
    if (r !== own) counts.set(r, (counts.get(r) ?? 0) + 1);
  });
  return counts;
}, new Map());

const byCount = (counts) => [...counts.keys()]
  .toSorted((a, b) => counts.get(b) - counts.get(a) || (a < b ? -1 : 1)); // mutation: equivalent — a and b are distinct Map keys, so a <= b and a < b agree

// The topic's core works: the five its works cite most.
export const topicCore = (counts) => byCount(counts).slice(0, CORE);

// The works to rank for the reading order: the ten cited most, with every
// work tied with the tenth, since a tie is broken by the year a lookup gives.
export const candidates = (counts) => {
  const ids = byCount(counts);
  const floor = counts.get(ids[READING - 1]) ?? 0;
  return ids.filter((id, i) => i < READING || counts.get(id) === floor).slice(0, RANKED);
};

const rank = (counts) => (a, b) => counts.get(b.id) - counts.get(a.id) || a.year - b.year || (a.id < b.id ? -1 : 1); // mutation: equivalent — OpenAlex returns each record once, so two ids never tie

const record = (w) => ({
  id: shortId(w.id), doi: cleanDoi(w.doi), title: w.title, year: w.publication_year, refs: w.referenced_works.map(shortId),
});

// The ten most cited, by count, then the earlier year, then the id.
export const foundations = (counts, works) => works.map(record).toSorted(rank(counts)).slice(0, READING);

// ---- Reading order: each paper after the earlier ones it builds on -------

const waits = (p, left) => left.some((q) => q.id !== p.id && p.refs.includes(q.id));

// A loop of papers citing each other yields its highest-ranked paper first.
export const ordered = (left) => {
  if (!left.length) return [];
  const next = left.find((p) => !waits(p, left)) ?? left[0];
  return [next, ...ordered(left.filter((p) => p !== next))];
};

// Each paper in order, with how many cite it and the earlier steps it cites.
export const steps = (order, counts) => order.map((p, k) => ({
  title: p.title, doi: p.doi, year: p.year, inside: counts.get(p.id),
  after: order.slice(0, k).flatMap((q, i) => (p.refs.includes(q.id) ? [i + 1] : [])),
}));

const byCites = (a, b) => b.cited_by_count - a.cited_by_count;

// The most-cited works of a topic, as a card lists them.
export const mostCited = (works) => works.toSorted(byCites).slice(0, SHOWN).map(cited);

const coreCited = (core) => (w) => w.referenced_works.map(shortId).filter((r) => core.includes(r)).length;

// The works citing at least two core works, those citing more first.
const onTopic = (core, works) => {
  const count = coreCited(core);
  return works.filter((w) => count(w) >= ON_TOPIC).toSorted((a, b) => count(b) - count(a));
};

const isReview = (w) => w.type === 'review';

// A topic's reviews: those its search found, as it ranked them, then any
// others it holds or that cite its core works, by how many core works they
// cite and then by how often they are cited.
export const topicReviews = (core, searched, others) => {
  const reviews = [...searched.filter(isReview), ...onTopic(core, others.filter(isReview).toSorted(byCites))];
  return [...new Map(reviews.map((w) => [shortId(w.id), w])).values()].slice(0, SHOWN).map(cited);
};

// A topic's new papers: those citing its core works, by how many, then newest.
export const topicNew = (core, works) => onTopic(core, works).slice(0, SHOWN).map(dated);

// The page address that names a topic, keeping the map it shows.
export const topicSearch = (search, text) => {
  const params = new URLSearchParams(search);
  params.set('topic', text.trim());
  return `?${params}`;
};

// New papers on a topic: those from the last twelve months.
export const yearBefore = (day) => `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`;

// ---- A topic's groups: works that cite the same papers --------------------

// A group is shown when it holds at least five works, and at most eight are.
const MIN_GROUP = 5;
const MAX_GROUPS = 8;
const NAME_TERMS = 5;
const NEIGHBOURS = 3;
// Modularity gains closer than this are a tie, so rounding moves no work.
const TIE = 1e-12;
const POWER_STEPS = 100;

const total = (values) => values.reduce((a, b) => a + b, 0);

const counted = (items) => items.reduce((counts, x) => counts.set(x, (counts.get(x) ?? 0) + 1), new Map());

const unit = (weights) => {
  const norm = Math.hypot(...weights.values());
  return new Map([...weights].map(([k, x]) => [k, x / norm]));
};

const cosine = (a, b) => total([...a].map(([k, x]) => x * (b.get(k) ?? 0)));

// Each work's citations, weighted by how rare each is among the works, at unit
// length. A work cited by only one of them links nothing, and one cited by
// half or more links nearly everything, so both are left out.
export const couplingVectors = (works) => {
  const sets = works.map((w) => [...new Set(w.referenced_works.map(shortId))]);
  const df = counted(sets.flat());
  const shared = (r) => df.get(r) >= 2 && df.get(r) * 2 < works.length;
  return sets.map((refs) => unit(new Map(refs.filter(shared).map((r) => [r, Math.log(works.length / df.get(r))]))));
};

// Each work's links: every other work it shares a citation with, by the
// cosine of their vectors, summed over the citations they share.
export const coupling = (vectors) => {
  const citers = vectors.reduce((by, v, i) => {
    v.forEach((x, r) => by.set(r, [...(by.get(r) ?? []), [i, x]]));
    return by;
  }, new Map());
  const links = vectors.map(() => new Map());
  citers.forEach((pairs) => pairs.forEach(([i, x]) => pairs.forEach(([j, y]) => {
    if (i !== j) links[i].set(j, (links[i].get(j) ?? 0) + x * y);
  })));
  return links;
};

// ---- Louvain: communities that raise modularity, merged level by level ----

const toCommunities = (graph, community, i) => [...graph.links[i]].reduce(
  (weights, [j, x]) => weights.set(community[j], (weights.get(community[j]) ?? 0) + x), new Map());

// Moves node i to the neighbouring community it gains most modularity in,
// staying put on a tie; says whether it moved.
const move = (graph, state, i) => {
  const { community, tot, k, m2 } = state;
  const from = community[i];
  tot[from] -= k[i];
  const weights = toCommunities(graph, community, i);
  const gain = (c) => (weights.get(c) ?? 0) - (tot[c] * k[i]) / m2;
  const beats = (c, best) => gain(c) > gain(best) + TIE; // mutation: equivalent — >= differs only when two gains differ by exactly TIE, which no test can arrange
  const to = [...weights.keys()].reduce((best, c) => (beats(c, best) ? c : best), from);
  community[i] = to;
  tot[to] += k[i];
  return to !== from;
};

// One level: every node moves until none gains. Null when none moved.
const settle = (graph) => {
  const k = graph.links.map((links, i) => graph.self[i] + total([...links.values()]));
  const state = { community: k.map((_, i) => i), tot: [...k], k, m2: total(k) };
  const pass = () => k.map((_, i) => move(graph, state, i)).some(Boolean);
  let moved = false;
  while (state.m2 && pass()) moved = true;
  return moved ? state.community : null;
};

// The next level's graph: one node per community, its inner links as a self loop.
const aggregate = (graph, community) => {
  const ids = [...new Set(community)];
  const index = new Map(ids.map((c, a) => [c, a]));
  const next = { links: ids.map(() => new Map()), self: ids.map(() => 0), members: ids.map(() => []) };
  graph.links.forEach((links, i) => {
    const a = index.get(community[i]);
    next.self[a] += graph.self[i];
    next.members[a].push(...graph.members[i]);
    links.forEach((x, j) => {
      const b = index.get(community[j]);
      if (a === b) next.self[a] += x;
      else next.links[a].set(b, (next.links[a].get(b) ?? 0) + x);
    });
  });
  return next;
};

const louvain = (graph) => {
  const community = settle(graph);
  return community ? louvain(aggregate(graph, community)) : graph.members;
};

// The works' groups, as lists of their indices: Louvain communities by shared
// citations, those of five or more works, largest first, at most eight.
// Louvain returns its communities in the order of their first work, and a
// stable sort keeps that order among groups of one size.
export const groupsOf = (vectors) => louvain({
  links: coupling(vectors), self: vectors.map(() => 0), members: vectors.map((_, i) => [i]),
}).filter((g) => g.length >= MIN_GROUP).map((g) => g.toSorted((a, b) => a - b))
  .toSorted((a, b) => b.length - a.length).slice(0, MAX_GROUPS);

// ---- A group's name: the title terms that set it apart --------------------

const overlaps = (term, chosen) => {
  const words = term.split(' ');
  return chosen.some((c) => {
    const other = c.split(' ');
    return words.every((w) => other.includes(w)) || other.every((w) => words.includes(w));
  });
};

// The first five terms, skipping one whose words overlap a term already chosen.
export const pickName = (ranked) =>
  ranked.reduce((chosen, t) => (chosen.length < NAME_TERMS && !overlaps(t, chosen) ? [...chosen, t] : chosen), []);

// Each group's name from its works' titles. A term scores its count in the
// group times log(the works / the works whose title holds it), as a cited work
// is weighted in couplingVectors: the works came from one search or one work's
// citations, so a word in every title tells no group apart and is left out. A
// term in two or more of the group's titles comes first, then the higher
// score, then the alphabet.
export const groupNames = (stopWords, titles, groups) => {
  const terms = titles.map((t) => titleTerms(stopWords, t ?? ''));
  const df = counted(terms.flatMap((ts) => [...new Set(ts)]));
  const weight = (t) => Math.log(titles.length / df.get(t));
  return groups.map((g) => {
    const c = counted(g.flatMap((i) => terms[i]));
    const score = (t) => c.get(t) * weight(t);
    const shared = (t) => Number(c.get(t) > 1);
    const telling = [...c.keys()].filter((t) => weight(t) > 0);
    const ranked = telling.toSorted((a, b) => shared(b) - shared(a) || score(b) - score(a) || (a < b ? -1 : 1)); // mutation: equivalent — a and b are distinct Map keys, so a <= b and a < b agree
    return pickName(ranked);
  });
};

// ---- A topic's small map ----------------------------------------------------

// The maps' values summed by key. Its sums are read only as ratios: the cosine
// between two groups' centres.
const summed = (maps) => maps.reduce((sum, m) => {
  m.forEach((x, k) => sum.set(k, (sum.get(k) ?? 0) + x)); // mutation: equivalent — negating every sum leaves each ratio read from them unchanged
  return sum;
}, new Map());

const centroid = (vectors) => unit(summed(vectors));

const times = (m, v) => m.map((row) => total(row.map((x, j) => x * v[j])));

const normed = (v) => {
  const norm = Math.hypot(...v);
  return norm ? v.map((x) => x / norm) : v;
};

const leading = (m) => {
  const v = Array.from({ length: POWER_STEPS }).reduce((u) => normed(times(m, u)), normed(m.map((_, i) => i + 1)));
  return { v, lambda: total(times(m, v).map((x, i) => x * v[i])) };
};

const deflate = (m, { v, lambda }) => m.map((row, i) => row.map((x, j) => x - lambda * v[i] * v[j]));

const spread = (xs) => {
  const lo = Math.min(...xs);
  const span = Math.max(...xs) - lo;
  return xs.map((x) => (span ? (x - lo) / span : 0.5));
};

// An axis whose eigenvalue is rounding beside the largest spreads nothing: its
// points sit at the middle.
const axis = ({ v, lambda }, largest) => (lambda > largest * TIE ? spread(v) : v.map(() => 0.5)); // mutation: equivalent — lambda equals largest * TIE only when both are 0, for one group, whose spread is 0.5 too

// Classical MDS: the two leading eigenvectors of the double-centred squared
// distances, by power iteration, each axis scaled to span 0 to 1.
export const mds = (d) => {
  const sq = d.map((row) => row.map((x) => x * x));
  const mean = sq.map((row) => total(row) / d.length);
  const grand = total(mean) / d.length;
  const b = sq.map((row, i) => row.map((x, j) => -0.5 * (x - mean[i] - mean[j] + grand)));
  const first = leading(b);
  const second = leading(deflate(b, first));
  return { x: axis(first, Math.abs(first.lambda)), y: axis(second, Math.abs(first.lambda)) };
};

// Each group's three most alike by citations, most alike first, and on a tie
// the first group first, which the stable sort keeps.
export const nearestGroups = (alike) => alike.map((row, i) => row.map((s, id) => ({ id, s }))
  .filter(({ id, s }) => id !== i && s > 0).toSorted((a, b) => b.s - a.s)
  .slice(0, NEIGHBOURS).map(({ id }) => ({ id })));

// A topic's groups as a field map's subfields are: name, size, place and
// nearest, with the works in each.
export const topicMap = (stopWords, works) => {
  const vectors = couplingVectors(works);
  const groups = groupsOf(vectors);
  const centres = groups.map((g) => centroid(g.map((i) => vectors[i])));
  const alike = centres.map((a) => centres.map((b) => cosine(a, b)));
  const { x, y } = mds(alike.map((row) => row.map((s) => Math.sqrt(Math.max(0, 2 - 2 * s)))));
  const names = groupNames(stopWords, works.map((w) => w.title), groups);
  const near = nearestGroups(alike);
  return groups.map((g, id) => ({
    id, name: names[id].length ? names[id] : [`group ${id + 1}`], size: g.length, x: x[id], y: y[id], near: near[id], works: g.map((i) => works[i]),
  }));
};

// ---- Reading order, as the page words it --------------------------------

const series = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
  : `${items[0]}`);

export const afterText = (after) => (after.length ? `builds on ${series(after)}` : '');

// ---- Stability: how often a subfield came back when the clustering reran --

export const recurrence = (fieldMap, c) => `found again in ${c.recurs} of ${fieldMap.reruns} reruns`;

// A subfield found again in at most half the reruns is soft.
export const soft = (fieldMap, c) => c.recurs * 2 <= fieldMap.reruns;

// ---- Neighbours: the subfields each one cites and is cited by most ------

// Each pair once, whether one or both of the two name the other.
export const links = (clusters) => [...new Map(clusters.flatMap((c) => c.near.map((n) => {
  const [a, b] = [c.id, n.id].sort((x, y) => x - y);
  return [`${a} ${b}`, { a, b }];
}))).values()];

// ---- Venues: where a subfield publishes, and what each journal charges ---

// Each journal the subfield's papers appeared in, most papers first.
export const venues = (fieldMap, cluster) =>
  cluster.journals.map(({ id, papers }) => ({ ...fieldMap.venues.journals[id], papers }));

const dollars = (usd) => `$${usd.toLocaleString('en-US')}`;

// The fee is the article processing charge: for a journal that is not fully
// open access, the price of making one article open.
export const feeText = (j) => {
  if (!j.fee) return `${j.open_access ? 'Fully open access' : 'Not fully open access'}; OpenAlex lists no fee`;
  const price = `${dollars(j.fee.usd)} in ${j.fee.year}`;
  return j.open_access ? `Fully open access; charges ${price} to publish`
    : `Not fully open access; open access for an article costs ${price}`;
};

export const licenceText = (doaj) => `published under ${doaj.licences.join(' or ')}`;

export const waiverText = (doaj) => (doaj.waiver ? 'offers a fee waiver' : 'lists no fee waiver');

// ---- Layout: circles and their labels, kept apart ------------------------

// A first name term two subfields share takes the second term too.
export const shortName = (clusters, cluster) => {
  const shared = clusters.filter((c) => c.name[0] === cluster.name[0]).length > 1;
  return shared ? cluster.name.slice(0, 2).join(', ') : cluster.name[0];
};

const radius = (size, biggest) => 10 + 34 * Math.sqrt(size / biggest);

// A circle and the label under it, as one disc the layout keeps apart.
const disc = (clusters, biggest, c) => {
  const short = shortName(clusters, c);
  const r = radius(c.size, biggest);
  const reach = Math.max(r + 10, (short.length * CHAR_WIDTH) / 2);
  return { c, short, r, reach, x: 60 + c.x * 880, y: 50 + c.y * 600 };
};

// Two discs at the same point have no direction to part in, so they part sideways.
const direction = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  return dist ? { ux: dx / dist, uy: dy / dist, dist } : { ux: 1, uy: 0, dist: 0 };
};

const separate = (a, b) => {
  const { ux, uy, dist } = direction(a, b);
  const push = (a.reach + b.reach + GAP - dist) / 2;
  if (push <= 0) return;
  a.x -= ux * push; a.y -= uy * push;
  b.x += ux * push; b.y += uy * push;
};

const clamp = (d) => {
  d.x = Math.min(WIDTH - d.reach, Math.max(d.reach, d.x));
  d.y = Math.min(HEIGHT - d.r - 22, Math.max(d.r + 4, d.y));
};

export const layout = (clusters) => {
  const biggest = Math.max(...clusters.map((c) => c.size));
  const discs = clusters.map((c) => disc(clusters, biggest, c));
  for (let step = 0; step < SETTLE_STEPS; step++) {
    discs.forEach((a, i) => discs.slice(i + 1).forEach((b) => separate(a, b)));
    discs.forEach(clamp);
  }
  return discs;
};
