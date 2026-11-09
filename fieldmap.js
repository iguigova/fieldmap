// The page's logic that needs no page: reading BibTeX, placing papers on the
// map, laying the map out. index.html draws what these return.

const STOP = new Set(('a an and are as at be by for from in into is it of on or that the this ' +
  'to with we our its using based via new approach method methods model models data study ' +
  'analysis statistical').split(' '));
// Off-field titles score under 0.3 and 95% of the map's own titles score
// 0.45 or more, so a title below this floor is left unplaced.
export const TITLE_FLOOR = 0.4;
const SAMPLE_CLUSTERS = 8;
const SAMPLE_PER_CLUSTER = 3;

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

// ---- Placing a paper: by DOI, else by its title words --------------------

export const titleTerms = (title) => {
  const words = (title.toLowerCase().match(/[a-z0-9-]+/g) ?? []).filter((w) => !STOP.has(w));
  return [...words, ...words.slice(1).map((w, i) => `${words[i]} ${w}`)];
};

const score = (terms, cluster) => terms.reduce((s, t) => s + (cluster.terms[t] ?? 0), 0);

const byTitle = (fieldMap, title) => {
  const terms = titleTerms(title);
  return fieldMap.clusters
    .map((c) => ({ id: c.id, s: score(terms, c) }))
    .reduce((a, b) => (b.s > a.s ? b : a), { id: null, s: TITLE_FLOOR }).id;
};

export const place = (fieldMap, entry) => {
  if (entry.doi && entry.doi in fieldMap.dois) return { cluster: fieldMap.dois[entry.doi], how: 'doi' };
  const cluster = entry.title ? byTitle(fieldMap, entry.title) : null;
  return { cluster, how: cluster === null ? 'none' : 'title' };
};

export const tally = (placed) => placed.reduce((counts, p) => {
  if (p.cluster !== null) counts[p.cluster] = (counts[p.cluster] ?? 0) + 1;
  return counts;
}, {});

export const sample = (fieldMap) => [...fieldMap.clusters]
  .sort((a, b) => b.size - a.size)
  .slice(0, SAMPLE_CLUSTERS)
  .flatMap((c) => c.starters.slice(0, SAMPLE_PER_CLUSTER))
  .map((p, i) => `@article{s${i}, title = {${p.title}}, doi = {${p.doi ?? ''}}}`)
  .join('\n');

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
