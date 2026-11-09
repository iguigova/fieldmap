// Records the README's demo as numbered PNG frames, one per tenth of a second
// of the finished GIF. Run it through a Playwright `page` started in the site
// root, with that folder served at BASE; FRAMES is relative to it and starts
// empty. docs/make_demo.sh turns the frames into the GIF.
async (page) => {
  const BASE = 'http://127.0.0.1:8765/fieldmap/';
  const FRAMES = 'fieldmap/docs/frames';

  let n = 0;
  const shot = async () => page.screenshot({ path: `${FRAMES}/f${String(n++).padStart(4, '0')}.png` });
  const hold = async (frames) => { for (let i = 0; i < frames; i++) await shot(); };

  const CURSOR = `
    #democursor { position: fixed; z-index: 99; width: 26px; height: 26px; pointer-events: none;
      left: 0; top: 0; transform: translate(-4px, -2px); filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
    #democursor.click::after { content: ''; position: absolute; left: -12px; top: -12px; width: 30px; height: 30px;
      border-radius: 50%; border: 3px solid #cc6633; opacity: .8; }`;
  const ARROW = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7 19 2.5-7.5L20 11z" ' +
    'fill="#fff" stroke="#222" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const addCursor = async () => page.evaluate(([css, svg]) => {
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    const c = document.createElement('div'); c.id = 'democursor'; c.innerHTML = svg; document.body.append(c);
  }, [CURSOR, ARROW]);
  const cursorAt = async (x, y) => page.evaluate(([x, y]) => {
    const c = document.getElementById('democursor'); c.style.left = `${x}px`; c.style.top = `${y}px`;
  }, [x, y]);
  const cursorPos = async () => page.evaluate(() => {
    const c = document.getElementById('democursor'); return [parseFloat(c.style.left) || 0, parseFloat(c.style.top) || 0];
  });
  const glide = async (x, y, frames = 8) => {
    const [x0, y0] = await cursorPos();
    for (let i = 1; i <= frames; i++) {
      const t = i / frames; const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await cursorAt(x0 + (x - x0) * e, y0 + (y - y0) * e); await shot();
    }
  };
  const centre = async (selector) => {
    const box = await page.locator(selector).first().boundingBox();
    return [box.x + box.width / 2, box.y + box.height / 2];
  };
  const click = async (selector) => {
    const [x, y] = await centre(selector);
    await glide(x, y);
    await page.evaluate(() => document.getElementById('democursor').classList.add('click'));
    await hold(2);
    await page.locator(selector).first().click();
    await page.evaluate(() => document.getElementById('democursor').classList.remove('click'));
  };
  const scrollTo = async (selector, frames = 12, offset = 24) => {
    const from = await page.evaluate(() => window.scrollY);
    const to = await page.evaluate(([s, o]) =>
      document.querySelector(s).getBoundingClientRect().top + window.scrollY - o, [selector, offset]);
    for (let i = 1; i <= frames; i++) {
      const t = i / frames; const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await page.evaluate((y) => window.scrollTo(0, y), from + (to - from) * e); await shot();
    }
  };

  await page.setViewportSize({ width: 1100, height: 720 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto(BASE);
  await page.evaluate(() => { try { localStorage.removeItem('theme'); } catch {} });
  await page.reload();
  await page.waitForSelector('#map a');
  await addCursor();
  await cursorAt(900, 620);

  await hold(22);                                   // the page as it opens
  await click('#sample');                           // try the sample reading list
  await hold(14);
  await scrollTo('figure', 14, 12);                 // the map, read subfields filled
  await hold(26);
  await scrollTo('#lists', 14, 12);                 // the gaps, listed
  await hold(14);
  await click('#lists details summary');            // a gap's papers to start with
  await hold(30);
  await scrollTo('header', 16, 40);
  await click('.theme-switch');                     // and in the dark
  await hold(10);
  await scrollTo('figure', 14, 12);
  await hold(26);
  return n;
}
