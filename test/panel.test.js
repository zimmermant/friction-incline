import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLines, createPanel, panelRel, panelHeading, forceText } from '../src/panel.js';
import { MOTION_START, S_MIN, S_MAX } from '../src/motion.js';
import { stubElement } from './stub-dom.js';
import { nb } from './nb.js';

const REST = MOTION_START, TOP = { mode: 'top', s: S_MAX, v: 0, dir: 0 }, BOTTOM = { mode: 'bottom', s: S_MIN, v: 0, dir: 0 };
const UP = { mode: 'slip', s: 1, v: 0.3, dir: 1 }, DOWN = { mode: 'slip', s: 1, v: -0.3, dir: -1 };
const lines = (s, m) => Object.fromEntries(calcLines(s, m).map(l => [l.key, l.html]));
const at = (t, theta = 20, mu = 0.4) => ({ t, theta, mu });

test('panel-rest: components of W, f = W sin theta - T with its direction, and the limit', () => {
  const h = lines(at(25), REST);
  assert.deepEqual(Object.keys(h), ['sym-axes', 'sym-y', 'sym-x', 'num-n', 'num-wx', 'num-f', 'num-max']);
  assert.equal(h['num-n'], nb('N = W cos θ = (98.1~N)(cos 20°) ≈ <b>92.2~N</b>'));
  assert.equal(h['num-wx'], nb('W sin θ = (98.1~N)(sin 20°) ≈ <b>33.6~N</b>'));
  assert.equal(h['num-f'], nb('f = W sin θ − T = 33.6~N − 25.0~N = <b>8.6~N</b> (up the slope)'));
  assert.equal(h['num-max'], nb('f<sub>max</sub> = μN = (0.40)(92.2~N) ≈ <b>36.9~N</b>'));
});

test('panel-rest down the slope: a negative f with its direction in words', () => {
  assert.equal(lines(at(60), REST)['num-f'], nb('f = W sin θ − T = 33.6~N − 60.0~N = <b>−26.4~N</b> (down the slope)'));
  assert.equal(lines(at(33.552), REST)['num-f'], nb('f = W sin θ − T = 33.6~N − 33.6~N = <b>0.0~N</b>'));
});

test('panel-slip: kinetic friction against the sliding, and no acceleration value', () => {
  const up = lines(at(80), UP), down = lines(at(0, 30), DOWN);
  assert.equal(up['num-k'], nb('f = μ<sub>k</sub>N = (¾)(0.40)(92.2~N) ≈ <b>27.7~N</b> (down the slope)'));
  assert.ok(down['sym-slip'].includes('sliding down the slope'));
  assert.ok(up['sym-slip'].includes('sliding up the slope'));
  assert.ok(up.note.includes('no equilibrium; B accelerates'));
});

test('panel-stop-C: friction at its max down the slope, stop C takes the rest', () => {
  const h = lines(at(90, 30), TOP);
  assert.ok(h['sym-stop'].includes('stop C takes the rest'));
  assert.equal(h['num-stop'], nb('N<sub>C</sub> = T − W sin θ − f<sub>max</sub> = 90.0~N − 49.1~N − 34.0~N ≈ <b>7.0~N</b>'));
});

test('panel-stop-D-approx: against D the printed difference uses "=" or "≈" as the printed numbers say', () => {
  const h = lines(at(5, 30), BOTTOM);
  assert.equal(h['num-stop'], nb('N<sub>D</sub> = W sin θ − T − f<sub>max</sub> = 49.1~N − 5.0~N − 34.0~N = <b>10.1~N</b>'));
});

test('at a stop within the limit: the stop pushes with zero and the rest lines show', () => {
  const h = lines(at(40, 30), BOTTOM);
  assert.ok(h['sym-stop'].includes('stop D pushes with 0'));
  assert.ok(h['num-f'].includes('(up the slope)'));
  assert.equal(h['num-stop'], undefined);
});

test('panelHeading names the state', () => {
  assert.equal(panelHeading(REST), 'Worked calculation — at rest');
  assert.equal(panelHeading(UP), 'Worked calculation — slipping');
  assert.equal(panelHeading(TOP), 'Worked calculation — at rest against stop C');
  assert.equal(panelHeading(BOTTOM), 'Worked calculation — at rest against stop D');
});

test('forceText rounds half up with one decimal', () => {
  assert.equal(forceText(49.05), '49.1'); assert.equal(forceText(-26.448), '−26.4'); assert.equal(forceText(0), '0.0');
});

test('panelRel: "=" only when the printed numbers give the printed result exactly', () => {
  assert.equal(panelRel(6.9, '7.0'), '≈'); assert.equal(panelRel(10.1, '10.1'), '=');
});

test('no-sandpaper: no line mentions sandpaper or roughness', () => {
  for (const [s, m] of [[at(25), REST], [at(80), UP], [at(90, 30), TOP], [at(5, 30), BOTTOM]]) {
    for (const l of calcLines(s, m)) assert.ok(!/sandpaper|rough/i.test(l.html), l.html);
  }
});

test('createPanel writes only when the text changes', () => {
  const el = stubElement('div');
  const p = createPanel(el);
  p.render(at(25), REST);
  assert.ok(el.innerHTML.includes('Worked calculation — at rest'));
  el.innerHTML = 'touched';
  p.render(at(25), REST);
  assert.equal(el.innerHTML, 'touched');
  p.render(at(26), REST);
  assert.notEqual(el.innerHTML, 'touched');
});

test('slip-text-true: while sliding the panel says friction is kinetic because B moves; the band clause only when true', () => {
  const inBand = lines(at(25), UP);
  assert.ok(inBand['sym-slip'].startsWith('B is sliding up the slope, so friction is kinetic'), inBand['sym-slip']);
  assert.ok(!inBand['sym-slip'].includes('&gt; f'), 'T = 25 N is inside the band');
  assert.ok(lines(at(80), UP)['sym-slip'].includes('|W sin θ − T| &gt; f<sub>max</sub> = μN'));
});
