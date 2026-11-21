import test from 'node:test';
import assert from 'node:assert/strict';
import { stubElement, installSvgDocument } from './stub-dom.js';
import { createScene, SCENE_TRACKS, FBD_CX, FBD_CY, K, arrowPoints, sceneSlopePoint } from '../src/scene.js';
import { MOTION_START, S_MIN, S_MAX } from '../src/motion.js';

installSvgDocument();

const REST = MOTION_START;
const TOP = { mode: 'top', s: S_MAX, v: 0, dir: 0 }, BOTTOM = { mode: 'bottom', s: S_MIN, v: 0, dir: 0 };
function draw(s, m = REST, opts = {}) {
  const svg = stubElement('svg');
  createScene(svg).render(s, m, opts);
  const cls = (n) => (n.attrs.class || '').split(/\s+/);
  const find = (c) => svg.children.find(n => cls(n).includes(c));
  const all = (c) => svg.children.filter(n => cls(n).includes(c));
  return { svg, find, all, cls, texts: svg.children.filter(n => n.tag === 'text') };
}
const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);
const ends = (g) => ({ x1: Number(g.children[0].attrs.x1), y1: Number(g.children[0].attrs.y1),
                       x2: Number(g.children[0].attrs.x2), y2: Number(g.children[0].attrs.y2) });
const RAD = Math.PI / 180;

test('scale: one scale for every force, 1.2 units per newton; W is 117.72 units straight down', () => {
  near(K, 1.2, 'K');
  const w = ends(draw({ t: 25, theta: 20, mu: 0.4 }).find('force-W'));
  near(w.x2, FBD_CX, 'vertical'); near(w.y2 - FBD_CY, 117.72, 'length');
});

test('normal-perpendicular: N_A points along the outward normal of the slope', () => {
  for (const th of [0, 20, 40]) {
    const n = ends(draw({ t: 25, theta: th, mu: 0.4 }).find('force-N'));
    const dx = n.x2 - n.x1, dy = n.y2 - n.y1;
    near(dx * Math.cos(th * RAD) + dy * -Math.sin(th * RAD), 0, `perpendicular at ${th}`);
    near(Math.hypot(dx, dy), 98.1 * Math.cos(th * RAD) * 1.2, `length at ${th}`);
  }
});

test('chain-up: at rest with friction up the slope, f starts at the tip of T', () => {
  const d = draw({ t: 10, theta: 20, mu: 0.4 });
  const T = ends(d.find('force-T')), f = ends(d.find('force-f'));
  near(f.x1, T.x2, 'x'); near(f.y1, T.y2, 'y');
  near(Math.hypot(T.x2 - T.x1, T.y2 - T.y1), 12, 'T length');
});

test('friction down the slope starts at the point, opposite T', () => {
  const d = draw({ t: 60, theta: 20, mu: 0.4 });
  const T = ends(d.find('force-T')), f = ends(d.find('force-f'));
  near(f.x1, FBD_CX, 'tail at the point');
  assert.ok((f.x2 - f.x1) * (T.x2 - T.x1) < 0, 'opposite directions');
});

test('chain-down-with-C: against stop C the stop force starts at the friction tip, both down the slope', () => {
  const d = draw({ t: 90, theta: 30, mu: 0.4 }, TOP);
  const f = ends(d.find('force-f')), C = ends(d.find('force-NC'));
  near(C.x1, f.x2, 'x'); near(C.y1, f.y2, 'y');
  near(Math.hypot(C.x2 - C.x1, C.y2 - C.y1), (90 - 49.05 - 0.4 * 98.1 * Math.cos(30 * RAD)) * 1.2, 'N_C length', 1e-4);
});

test('chain-up-with-D: against stop D the stop force follows T and f up the slope', () => {
  const d = draw({ t: 5, theta: 30, mu: 0.4 }, BOTTOM);
  const f = ends(d.find('force-f')), D = ends(d.find('force-ND'));
  near(D.x1, f.x2, 'x'); near(D.y1, f.y2, 'y');
});

test('no f arrow when friction is zero; no T arrow at T = 0', () => {
  assert.equal(draw({ t: 98.1 * Math.sin(20 * RAD), theta: 20, mu: 0.4 }).find('force-f'), undefined);
  assert.equal(draw({ t: 0, theta: 20, mu: 0.4 }).find('force-T'), undefined);
});

test('kinetic colour while slipping', () => {
  const d = draw({ t: 80, theta: 20, mu: 0.4 }, { mode: 'slip', s: 1, v: 0.3, dir: 1 });
  assert.equal(d.find('force-f').children[1].attrs.fill, 'url(#grad-fk)');
});

test('comps-toggle: the dashed components of W appear only when asked', () => {
  assert.equal(draw({ t: 25, theta: 20, mu: 0.4 }).all('comps').length, 0);
  assert.equal(draw({ t: 25, theta: 20, mu: 0.4 }, REST, { comps: true }).all('comps').length, 1);
});

test('wood-rotates: the wood pattern follows the slope', () => {
  const { svg } = draw({ t: 25, theta: 20, mu: 0.4 });
  let pat = null;
  const walk = (n) => { if (n.tag === 'pattern') pat = n; n.children.forEach(walk); };
  walk(svg);
  assert.ok(pat.attrs.patternTransform.includes('rotate(-20)'), pat.attrs.patternTransform);
});

test('the block sits on the slope at its motion position, rotated with the slope', () => {
  const blk = (m) => draw({ t: 25, theta: 20, mu: 0.4 }, m).find('block').attrs.transform;
  const p = sceneSlopePoint(20, 55);
  assert.equal(blk(BOTTOM), `translate(${p[0]} ${p[1]}) rotate(-20)`);
  assert.notEqual(blk(REST), blk(TOP));
});

test('images-referenced: block, wood and string are the embedded images', () => {
  const { svg } = draw({ t: 25, theta: 20, mu: 0.4 });
  const hrefs = [];
  const walk = (n) => { if (n.tag === 'image') hrefs.push(n.attrs.href); n.children.forEach(walk); };
  walk(svg);
  for (const a of ['{{asset:metal_block.webp}}', '{{asset:wood_floor2.webp}}', '{{asset:string.webp}}']) assert.ok(hrefs.includes(a), a);
});

test('every text is class t, at least 16 units; every graphic is a top-level g (decoration excepted)', () => {
  for (const [s, m] of [[{ t: 25, theta: 20, mu: 0.4 }, REST], [{ t: 90, theta: 30, mu: 0.4 }, TOP], [{ t: 0, theta: 0, mu: 0.1 }, REST]]) {
    const { svg, texts, cls } = draw(s, m, { comps: true });
    assert.ok(texts.length >= 6);
    for (const n of texts) {
      assert.ok(cls(n).includes('t'), n.textContent);
      assert.ok(Number(n.attrs['font-size']) >= 16, n.textContent);
    }
    const deco = (n) => n.tag === 'defs' || cls(n).includes('bg') || cls(n).includes('vb');
    for (const n of svg.children.filter(c => c.tag !== 'text' && !deco(c))) assert.ok(cls(n).includes('g'), n.tag);
  }
});

test('render clears first', () => {
  const svg = stubElement('svg');
  const sc = createScene(svg);
  sc.render({ t: 25, theta: 20, mu: 0.4 }, REST, {}); const n = svg.children.length;
  sc.render({ t: 25, theta: 20, mu: 0.4 }, REST, {});
  assert.equal(svg.children.length, n);
});

test('arrowPoints: a 7-point polygon whose middle point is the tip', () => {
  const pts = arrowPoints(0, 0, 50, 0).split(' ').map(p => p.split(',').map(Number));
  assert.equal(pts.length, 7); assert.deepEqual(pts[3], [50, 0]);
  assert.equal(arrowPoints(0, 0, 0.5, 0), '');
});

test('SCENE_TRACKS: the weight arrow is always 117.72 units tall', () => {
  const tr = SCENE_TRACKS.find(r => r.sel === 'g.force-W');
  assert.equal(tr.want({ t: 25, theta: 20, mu: 0.4 }), 117.72);
});

test('stays inside the figure at the steepest angle: the handle and string end below the top edge', () => {
  const { find } = draw({ t: 25, theta: 40, mu: 0.4 });
  const h = find('handle').children[0];
  assert.ok(Number(h.attrs.cy) - 7 >= 4, `handle top ${Number(h.attrs.cy) - 7}`);
});

test('labels clear the shapes: D and theta in the ground strip, the FBD title above the N_A label', () => {
  for (const th of [0, 20, 40]) {
    const { texts } = draw({ t: 25, theta: th, mu: 0.4 });
    const D = texts.find(n => n.textContent === 'D');
    assert.ok(Number(D.attrs.y) - 13 > 255 + 10, `D top at ${th}`);
    const title = texts.find(n => n.textContent === 'Free-body diagram of B');
    const N = texts.find(n => n.textContent === 'N' && n.children.some(c => c.textContent === 'A'));
    assert.ok(Number(N.attrs.y) - 16 > Number(title.attrs.y) + 2, `N_A label below the title at ${th}`);
  }
});

// Label boxes (anchor middle, 15 px font with subscript): x - 13 .. x + 13, y - 18 .. y + 5.
const labelBox = (n) => ({ x0: Number(n.attrs.x) - 15, x1: Number(n.attrs.x) + 15, y0: Number(n.attrs.y) - 19, y1: Number(n.attrs.y) + 9 });   // measured in Chromium, with margin
const arrowBox = (g) => {
  const pts = g.children[1].attrs.points.split(' ').map(p => p.split(',').map(Number));
  return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) };
};
const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test('fbd-labels-clear: no force label touches any force arrow\'s bounding box or another label, over a grid of states', () => {
  const modes = [REST, TOP, BOTTOM, { mode: 'slip', s: 1, v: 0.3, dir: 1 }, { mode: 'slip', s: 1, v: -0.3, dir: -1 }];
  for (const theta of [0, 10, 20, 30, 40]) for (const t of [0, 5, 10, 25, 33.5, 50, 80, 100]) for (const mu of [0.1, 0.4, 0.8]) for (const m of modes) {
    const { svg, texts, all } = draw({ t, theta, mu }, m);
    const arrows = all('force').map(arrowBox);
    const labels = texts.filter(n => Number(n.attrs.x) > 440 && Number(n.attrs.y) > 30 && Number(n.attrs.y) < 280).map(labelBox);
    for (const [i, L] of labels.entries()) {
      for (const A of arrows) assert.ok(!hit(L, A), `label ${i} on an arrow: t ${t} θ ${theta} μ ${mu} ${m.mode}`);
      for (const [j, M] of labels.entries()) if (j > i) assert.ok(!hit(L, M), `labels ${i}/${j} overlap: t ${t} θ ${theta} μ ${mu} ${m.mode}`);
    }
  }
});

test('the wedge is scenery (bg), not a measured graphic', () => {
  const { svg } = draw({ t: 25, theta: 20, mu: 0.4 });
  assert.ok(svg.children.some(n => (n.attrs.class || '').split(' ').includes('wedge') && (n.attrs.class || '').includes('bg')));
});

test('the B label sits outside the rotated block\'s bounding box and inside the figure, at every angle and position', () => {
  for (const th of [0, 10, 20, 30, 40]) for (const m of [REST, TOP, BOTTOM]) {
    const { find, texts } = draw({ t: 25, theta: th, mu: 0.4 }, m);
    const tr = find('block').attrs.transform.match(/translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)/).slice(1).map(Number);
    const a = tr[2] * Math.PI / 180, cs = [[-45, 0], [45, 0], [-45, -48], [45, -48]];
    const xs = cs.map(([x, y]) => tr[0] + x * Math.cos(a) - y * Math.sin(a)), ys = cs.map(([x, y]) => tr[1] + x * Math.sin(a) + y * Math.cos(a));
    const blk = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    const B = texts.find(n => n.textContent === 'B'), bx = Number(B.attrs.x), by = Number(B.attrs.y);
    const box = { x0: bx - 7, x1: bx + 7, y0: by - 13, y1: by + 4 };
    assert.ok(!hit(box, blk), `B on the block at ${th} ${m.mode}`);
    assert.ok(box.y0 >= 0 && box.x0 >= 0, `B outside the figure at ${th} ${m.mode}`);
  }
});

test('fbd-point: the body is one dark point with a white ring at the FBD centre, and no extended shape', () => {
  const p = draw({ t: 25, theta: 20, mu: 0.4 }).find('point');
  const c = p.children.find(n => n.tag === 'circle');
  assert.equal(Number(c.attrs.cx), FBD_CX); assert.equal(Number(c.attrs.cy), FBD_CY); assert.equal(Number(c.attrs.r), 7);
  assert.equal(p.children.filter(n => n.tag === 'rect').length, 0);
});
