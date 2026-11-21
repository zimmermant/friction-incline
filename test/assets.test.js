import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS, inlineAssets } from '../build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMES = ['metal_block.webp', 'wood_floor2.webp', 'string.webp'];
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');

test('assets-present: the three shared images are in assets/ and each is under 20 KB', () => {
  assert.deepEqual([...ASSETS].sort(), [...NAMES].sort());
  for (const n of NAMES) {
    const p = join(root, 'assets', n);
    assert.ok(existsSync(p), `missing assets/${n}`);
    assert.ok(statSync(p).size < 20_000, `assets/${n} is ${statSync(p).size} bytes`);
  }
});

test('assets-match-source: each copy equals the friction_tutorial source when that folder exists', (t) => {
  const src = join(root, '..', 'friction_tutorial', 'assets');
  if (!existsSync(src)) { t.skip('no sibling friction_tutorial/assets'); return; }
  for (const n of NAMES) assert.equal(sha(join(root, 'assets', n)), sha(join(src, n)), `${n} differs from the source`);
});

test('build-inlines-assets: {{asset:…}} becomes a webp data URI; an unknown name fails', () => {
  const out = inlineAssets('a {{asset:string.webp}} b');
  assert.match(out, /^a data:image\/webp;base64,[A-Za-z0-9+/=]+ b$/);
  assert.throws(() => inlineAssets('{{asset:nope.webp}}'), /unknown asset/);
});

test('built page carries the three images and no placeholder (a fresh build, not the committed dist/)', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { main, PAGES } = await import('../build.js');
  const out = mkdtempSync(join(tmpdir(), 'friction-assets-'));
  try {
    const log = console.log; console.log = () => {};
    try { main(out); } finally { console.log = log; }
    const html = readFileSync(join(out, PAGES[0].out), 'utf8');
    assert.equal(html.includes('{{asset:'), false);
    assert.ok(html.split('data:image/webp;base64,').length - 1 >= 3);
  } finally { rmSync(out, { recursive: true, force: true }); }
});
