// Loaded with node --import before a script that asks OpenAlex, so the script
// runs without the network: every request answers FAKE_STATUS, 200 unless set.
// The kth request, from 0, gets k % 7 works citing every work its filter
// names, and one citing nothing.
const status = Number(process.env.FAKE_STATUS ?? 200);
let asked = 0;

const answer = (url) => {
  const filter = new URL(url).searchParams.get('filter');
  const cited = filter.match(/cites:([^,]*)/)[1].split('|').map((id) => `https://openalex.org/${id}`);
  const work = (n, refs) => ({ doi: null, title: `w${n}`, publication_date: '2026-01-01', referenced_works: refs });
  const citing = Array.from({ length: asked++ % 7 }, (_, n) => work(n + 1, cited));
  return { results: [...citing, work(0, [])] };
};

globalThis.fetch = async (url) => ({ ok: status === 200, status, json: async () => answer(url) });
