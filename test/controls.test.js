import test from 'node:test';
import assert from 'node:assert/strict';
import { stubElement } from './stub-dom.js';
import { FIELDS, fieldShow } from '../src/fields.js';
import { createControls, controlsView } from '../src/controls.js';
import { createState, DEFAULTS } from '../src/state.js';
import { nb } from './nb.js';
import { FIRST_SNAP, NEEDS_SNAP, FIRST_MARK, NEEDS_MARK } from './snap.js';

const SNAP = FIRST_SNAP;                         // the keyboard tests need a field with a snap zone: they skip themselves without one (NEEDS_SNAP)
const PLAIN = FIELDS.find(f => !f.snap);

function rig() {
  const parts = { reset: stubElement('button'), sliders: {}, readouts: {}, zeros: {}, marks: {} };
  for (const f of FIELDS) {
    parts.sliders[f.key] = stubElement('input');
    parts.readouts[f.key] = stubElement('b');
    if (f.snap) parts.zeros[f.key] = stubElement('span');
    if (f.mark) parts.marks[f.key] = stubElement('span');
  }
  const root = stubElement('section');
  const state = createState();
  const controls = createControls(root, state, parts);
  controls.render(state.getState());
  state.subscribe((st) => controls.render(st));   // as app.js does
  return { parts, root, state };
}
const drag = (parts, f, raw) => { parts.sliders[f.key].value = String(raw); parts.sliders[f.key].fire('input'); };

test('controlsView: one fixed-decimal text per field, and whether a snap field sits at its marked zero', () => {
  const v = controlsView(DEFAULTS);
  for (const f of FIELDS) assert.equal(v.text[f.key], fieldShow(f, f.default), f.key);
  assert.deepEqual(Object.keys(v.atSnap), FIELDS.filter(f => f.snap).map(f => f.key));
  for (const f of FIELDS.filter(g => g.snap)) {
    assert.equal(controlsView({ ...DEFAULTS, [f.key]: 0 }).atSnap[f.key], true, f.key);
    assert.equal(controlsView({ ...DEFAULTS, [f.key]: f.snap.jump }).atSnap[f.key], false, f.key);
    assert.equal(controlsView({ ...DEFAULTS, [f.key]: -f.snap.jump }).text[f.key], fieldShow(f, -f.snap.jump));
  }
});

test('controlsView: a field with mark reports whether the slider sits on the marked value', NEEDS_MARK, () => {
  const f = FIRST_MARK;
  assert.deepEqual(Object.keys(controlsView(DEFAULTS).atMark), FIELDS.filter(g => g.mark).map(g => g.key));
  assert.equal(controlsView({ ...DEFAULTS, [f.key]: f.mark.value }).atMark[f.key], true);
  assert.equal(controlsView({ ...DEFAULTS, [f.key]: f.mark.value === f.max ? f.min : f.max }).atMark[f.key], false);
});

test('the mark label lights while the slider sits on the marked value and goes out when it moves; it never snaps', NEEDS_MARK, () => {
  const f = FIRST_MARK;
  const { parts, state } = rig();
  const off = f.mark.value === f.max ? f.min : f.max;
  drag(parts, f, off);
  assert.equal(parts.marks[f.key].classList.contains('on'), false);
  drag(parts, f, f.mark.value);
  assert.equal(parts.marks[f.key].classList.contains('on'), true);
  assert.equal(state.getState()[f.key], f.mark.value);
  drag(parts, f, f.mark.value + f.step);
  assert.equal(parts.marks[f.key].classList.contains('on'), false);
  assert.equal(state.getState()[f.key], f.mark.value + f.step, 'a marked value is not a snap: its neighbour is reachable');
});

test('render shows thumbs, readouts, and aria-valuetext in words with the unit word (no-break space)', () => {
  const { parts, state } = rig();
  for (const f of FIELDS) {
    assert.equal(parts.sliders[f.key].value, String(f.default), f.key);
    assert.equal(parts.readouts[f.key].textContent, fieldShow(f, f.default));
    assert.equal(parts.sliders[f.key].attrs['aria-valuetext'], f.unit === '' ? `${f.symbol} = ${fieldShow(f, f.default)}` : nb(`${fieldShow(f, f.default)}~${f.unitWord}`));
    if (f.snap) assert.equal(parts.zeros[f.key].classList.contains('on'), false);
  }
  state.set({ [FIELDS[0].key]: FIELDS[0].max });
  assert.equal(parts.sliders[FIELDS[0].key].value, String(FIELDS[0].max));
});

test('a drag sets that field only: the state, the readout and the thumb follow', () => {
  for (const f of FIELDS) {
    const { parts, state } = rig();
    const to = f.default === f.max ? f.min : f.max;
    drag(parts, f, to);
    assert.equal(state.getState()[f.key], to);
    assert.equal(parts.readouts[f.key].textContent, fieldShow(f, to));
    for (const g of FIELDS) if (g !== f) assert.equal(state.getState()[g.key], g.default, `${f.key} moved ${g.key}`);
  }
});

test('a pointer drag snaps: a value inside the zone lands on 0, the thumb is put back, the zero label lights', NEEDS_SNAP, () => {
  const { parts, state } = rig();
  drag(parts, SNAP, SNAP.snap.zone / 2);
  assert.equal(state.getState()[SNAP.key], 0);
  assert.equal(parts.sliders[SNAP.key].value, '0');
  assert.equal(parts.readouts[SNAP.key].textContent, fieldShow(SNAP, 0));
  assert.equal(parts.zeros[SNAP.key].classList.contains('on'), true);
  drag(parts, SNAP, SNAP.snap.jump);
  assert.equal(parts.zeros[SNAP.key].classList.contains('on'), false, 'and goes out again');
});

test('a keyboard nudge from 0 jumps past the zone; the next nudge back lands on 0', NEEDS_SNAP, () => {
  const { parts, root, state } = rig();
  const { zone, jump } = SNAP.snap;
  state.set({ [SNAP.key]: 0 });
  root.fire('keydown', { key: 'ArrowRight' });
  drag(parts, SNAP, SNAP.step);
  assert.equal(state.getState()[SNAP.key], jump);
  assert.equal(parts.sliders[SNAP.key].value, String(jump), 'the thumb follows the jump');
  root.fire('keydown', { key: 'ArrowLeft' });
  drag(parts, SNAP, zone);
  assert.equal(state.getState()[SNAP.key], 0);
});

test('a drag that snaps back to the value the state already has still puts the thumb right', () => {
  for (const f of FIELDS) {
    const { parts, state } = rig();
    const at = state.getState()[f.key];
    const nearby = f.snap && at === 0 ? f.step / 3 : at + f.step / 4;      // snaps back to `at`
    drag(parts, f, nearby);
    assert.equal(state.getState()[f.key], at, f.key);
    assert.equal(parts.sliders[f.key].value, String(at), `${f.key}: the thumb must be put back to ${at}`);
  }
});

test('a key press marks ONE input: the next drag, with no key, is a pointer drag', NEEDS_SNAP, () => {
  const { parts, root, state } = rig();
  state.set({ [SNAP.key]: 0 });
  root.fire('keydown', { key: 'ArrowRight' });
  drag(parts, SNAP, SNAP.step);
  assert.equal(state.getState()[SNAP.key], SNAP.snap.jump, 'the key input jumps');
  state.set({ [SNAP.key]: 0 });
  drag(parts, SNAP, SNAP.step);
  assert.equal(state.getState()[SNAP.key], 0, 'the following drag only snaps');
});

test('a key that changed nothing does not make the next drag a keyboard one', NEEDS_SNAP, () => {
  const { parts, root, state } = rig();
  state.set({ [SNAP.key]: 0 });
  root.fire('keydown', { key: 'ArrowRight' });
  root.fire('keyup', { key: 'ArrowRight' });
  drag(parts, SNAP, SNAP.step);
  assert.equal(state.getState()[SNAP.key], 0, 'a pointer drag only snaps');
});

test('losing focus or a pointer press also clears a pending key mark', NEEDS_SNAP, () => {
  for (const clear of ['focusout', 'pointerdown']) {
    const { parts, root, state } = rig();
    state.set({ [SNAP.key]: 0 });
    root.fire('keydown', { key: 'ArrowRight' });
    root.fire(clear);
    drag(parts, SNAP, SNAP.step);
    assert.equal(state.getState()[SNAP.key], 0, clear);
  }
});

test('keys that do not move a slider (a letter) are not keyboard input', NEEDS_SNAP, () => {
  const { parts, root, state } = rig();
  state.set({ [SNAP.key]: 0 });
  root.fire('keydown', { key: 'a' });
  drag(parts, SNAP, SNAP.step);
  assert.equal(state.getState()[SNAP.key], 0);
});

test('a field without snap is never moved by the keyboard flag', { skip: !PLAIN }, () => {
  const { parts, root, state } = rig();
  root.fire('keydown', { key: 'ArrowRight' });
  drag(parts, PLAIN, PLAIN.min + PLAIN.step / 3);
  assert.equal(state.getState()[PLAIN.key], PLAIN.min);
});

test('reset restores the defaults and the display of every field', () => {
  const { parts, state } = rig();
  for (const f of FIELDS) drag(parts, f, f.default === f.max ? f.min : f.max);
  parts.reset.fire('click');
  assert.deepEqual(state.getState(), DEFAULTS);
  for (const f of FIELDS) {
    assert.equal(parts.sliders[f.key].value, String(f.default), f.key);
    assert.equal(parts.readouts[f.key].textContent, fieldShow(f, f.default));
  }
});

// ---- the friction gauge (incline) ----------------------------------------------------------------------------------
import { gaugeView, statusView } from '../src/controls.js';
import { MOTION_START as GREST, S_MIN as GSMIN, S_MAX as GSMAX } from '../src/motion.js';
const gnear = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, `${msg}: ${a} vs ${b}`);

test('gauge-default: mark at W sin theta, hold band W sin theta +/- mu N, friction bar from T to the mark (0-100 N scale)', () => {
  const g = gaugeView({ t: 25, theta: 20, mu: 0.4 }, GREST);
  gnear(g.markPct, 33.552, 'mark'); gnear(g.bandLoPct, 0, 'band low (clamped)'); gnear(g.bandHiPct, 70.4255, 'band high');
  gnear(g.barLoPct, 25, 'bar low'); gnear(g.barHiPct, 33.552, 'bar high');
  assert.equal(g.wallLoPct, g.wallHiPct, 'no stop share');
  assert.equal(g.valueText, nb('8.6~N up the slope'));
  assert.equal(g.markText, nb('33.6~N'));
});

test('gauge-down: past W sin theta the bar runs from the mark to T and friction points down the slope', () => {
  const g = gaugeView({ t: 60, theta: 20, mu: 0.4 }, GREST);
  gnear(g.barLoPct, 33.552, 'bar low'); gnear(g.barHiPct, 60, 'bar high');
  assert.equal(g.valueText, nb('26.4~N down the slope'));
  assert.equal(gaugeView({ t: 33.552, theta: 20, mu: 0.4 }, GREST).valueText, nb('0.0~N'));
});

test('gauge at a stop: the friction bar is mu N long and the stop share runs on to T', () => {
  const g = gaugeView({ t: 90, theta: 30, mu: 0.4 }, { mode: 'top', s: GSMAX, v: 0, dir: 0 });
  gnear(g.barLoPct, 49.05, 'bar from the mark'); gnear(g.barHiPct, 49.05 + 33.9828, 'bar to the limit');
  gnear(g.wallLoPct, 49.05 + 33.9828, 'share from the limit'); gnear(g.wallHiPct, 90, 'share to T');
  const d = gaugeView({ t: 5, theta: 30, mu: 0.4 }, { mode: 'bottom', s: GSMIN, v: 0, dir: 0 });
  gnear(d.wallLoPct, 5, 'D share from T'); gnear(d.wallHiPct, 49.05 - 33.9828, 'to the limit');
});

test('statusView names each state', () => {
  assert.deepEqual(statusView({ mode: 'rest' }), { cls: 'rest', text: 'At rest' });
  assert.deepEqual(statusView({ mode: 'slip', dir: 1 }), { cls: 'slip', text: 'Slipping up the slope — kinetic friction' });
  assert.deepEqual(statusView({ mode: 'slip', dir: -1 }), { cls: 'slip', text: 'Slipping down the slope — kinetic friction' });
  assert.deepEqual(statusView({ mode: 'top' }), { cls: 'wall', text: 'At rest against stop C' });
  assert.deepEqual(statusView({ mode: 'bottom' }), { cls: 'wall', text: 'At rest against stop D' });
});
