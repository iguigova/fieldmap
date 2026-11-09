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
