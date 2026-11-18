// Prints the README's New papers counts: for each named map, asks OpenAlex for
// each subfield's new papers exactly as the page does, from the map's last
// year to today, and counts the subfields showing five and the works asked
// for that place back in their subfield. One credit per subfield.
// Usage: node docs/new_papers.mjs <slug>...
import { readFileSync } from 'node:fs';

import { SHOWN, coreWorks, newPapers, newPapersUrl, newSince, placedIn, readMap } from '../fieldmap.js';

const today = new Date().toISOString().slice(0, 10);

const getJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
};

const measure = async (slug) => {
  const fieldMap = readMap(JSON.parse(readFileSync(new URL(`../data/${slug}.json`, import.meta.url))));
  let full = 0;
  let asked = 0;
  let placed = 0;
  for (const cluster of fieldMap.clusters) {
    const works = (await getJson(newPapersUrl(coreWorks(cluster), newSince(fieldMap), today))).results;
    full += newPapers(fieldMap, cluster, works).length === SHOWN ? 1 : 0;
    asked += works.length;
    placed += placedIn(fieldMap, cluster, works).length;
  }
  return `${slug}: ${full} of ${fieldMap.clusters.length} subfields show ${SHOWN}; ${placed} of ${asked} works asked for place back`;
};

console.log(`On ${today}:`);
for (const slug of process.argv.slice(2)) console.log(await measure(slug));
