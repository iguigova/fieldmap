import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const run = (args, env = {}) => spawnSync(
  process.execPath, ['--import', './tests/fake_openalex.mjs', 'docs/new_papers.mjs', ...args],
  { encoding: 'utf8', env: { ...process.env, ...env } });

test('new_papers prints, per map, the subfields showing five and the works placing back', () => {
  const out = run(['biostatistics', 'epidemiology']);
  assert.equal(out.status, 0, out.stderr);
  const [day, ...lines] = out.stdout.trim().split('\n');
  assert.match(day, /^On \d{4}-\d{2}-\d{2}:$/);
  assert.deepEqual(lines, [
    'biostatistics: 10 of 40 subfields show 5; 115 of 155 works asked for place back',
    'epidemiology: 12 of 40 subfields show 5; 119 of 159 works asked for place back',
  ]);
});

test('new_papers stops on a refused request, naming its status', () => {
  const out = run(['biostatistics'], { FAKE_STATUS: '429' });
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /HTTP 429 for https:\/\/api\.openalex\.org\/works\?filter=cites/);
});
