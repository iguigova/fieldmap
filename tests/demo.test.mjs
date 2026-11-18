import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';

// docs/demo.playwright.js is one function expression, which its Playwright
// runner reads as text and evaluates in a vm, with no way to import a module.
// The test evaluates it the same way: the one exception to the rule against
// evaluating code from a string.
const DEMO = new URL('../docs/demo.playwright.js', import.meta.url);
const walk = runInThisContext(readFileSync(DEMO, 'utf8'), { filename: DEMO.pathname });

// A page that records what the walk asks of it and draws nothing.
const fakePage = (url) => {
  const calls = [];
  const locator = (selector) => ({
    first: () => locator(selector),
    boundingBox: async () => ({ x: 0, y: 0, width: 10, height: 10 }),
    click: async () => calls.push(['click', selector]),
    press: async (key) => calls.push(['press', selector, key]),
  });
  const page = {
    url: () => url,
    goto: async (to) => calls.push(['goto', to]),
    reload: async () => {},
    setViewportSize: async () => {},
    emulateMedia: async () => {},
    screenshot: async () => {},
    waitForSelector: async (selector, options) => calls.push(['wait', selector, options]),
    locator,
    evaluate: async (fn, arg) => {
      if (Array.isArray(arg) && typeof arg[0] === 'string' && typeof arg[1] === 'number') calls.push(['scroll', arg[0]]);
      return String(fn).includes('parseFloat') ? [0, 0] : 0;
    },
  };
  return { page, calls };
};

test('the demo opens the fieldmap folder of whatever address the page is at', async () => {
  const { page, calls } = fakePage('http://127.0.0.1:9999/');
  await walk(page);
  assert.deepEqual(calls[0], ['goto', 'http://127.0.0.1:9999/fieldmap/']);
});

test('the demo types a topic, builds its path, waits for it and shows its groups', async () => {
  const { page, calls } = fakePage('http://127.0.0.1:9999/');
  await walk(page);
  const keys = calls.filter(([kind, selector]) => kind === 'press' && selector === '#topic').map(([, , key]) => key);
  assert.equal(keys.join(''), 'missingSpacedataSpaceimputation');
  const at = (call) => calls.findIndex((c) => JSON.stringify(c) === JSON.stringify(call));
  const steps = [
    ['scroll', '#topic-form'], ['click', '#topic'], ['click', '#topic-form button'],
    ['wait', '#topic-path h3', { timeout: 60000 }], ['scroll', '#topic-path'], ['scroll', '.topic-map'],
  ].map(at);
  assert.ok(steps.every((i, k) => i >= 0 && (k === 0 || i > steps[k - 1])), JSON.stringify(steps));
});
