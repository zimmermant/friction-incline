import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, fieldNext, fieldSnap } from '../src/fields.js';
import { DEFAULTS, createState } from '../src/state.js';

// A value different from the field's default, and a raw value that is NOT on its grid (snapping must act on it).
const other = (f) => (f.default === f.max ? f.min : f.max);
const offGrid = (f) => f.min + f.step * 2.4;

test('the store starts at DEFAULTS, which is every field\'s default, and stores the inputs only', () => {
  assert.deepEqual(createState().getState(), DEFAULTS);
  assert.deepEqual(DEFAULTS, Object.fromEntries(FIELDS.map(f => [f.key, f.default])));
  assert.deepEqual(Object.keys(createState().getState()).sort(), FIELDS.map(f => f.key).sort());
});

test('getState returns a copy; mutating it does not change the store', () => {
  const st = createState();
  for (const f of FIELDS) {
    st.getState()[f.key] = other(f);
    assert.equal(st.getState()[f.key], f.default);
  }
});

test('subscribers get a copy of the new state', () => {
  const st = createState();
  let got = null;
  st.subscribe((s) => { got = s; });
  const f = FIELDS[0];
  st.setField(f.key, other(f));
  got[f.key] = 12345;
  assert.equal(st.getState()[f.key], other(f));
});

test('setField snaps through the field\'s own rule, field by field, leaving the others alone', () => {
  for (const f of FIELDS) {
    const st = createState();
    st.setField(f.key, offGrid(f), false);
    assert.equal(st.getState()[f.key], fieldSnap(f, offGrid(f)), f.key);
    for (const g of FIELDS) if (g !== f) assert.equal(st.getState()[g.key], g.default, `${f.key} moved ${g.key}`);
  }
});

test('setField passes the keyboard flag through (a nudge from 0 jumps, only for a field with snap)', () => {
  for (const f of FIELDS) {
    const st = createState();
    st.setField(f.key, 0, false);
    const from = st.getState()[f.key];
    st.setField(f.key, f.step / 2, true);
    assert.equal(st.getState()[f.key], fieldNext(f, from, f.step / 2, true), f.key);
  }
});

test('setField with an unknown key throws', () => {
  assert.throws(() => createState().setField('no-such-input', 1), /no input called/);
});

test('a no-change set does not notify; a change does; a snap back to the same value does not', () => {
  const st = createState();
  let calls = 0;
  st.subscribe(() => { calls++; });
  for (const f of FIELDS) st.setField(f.key, f.default);
  st.set({ ...DEFAULTS }); st.set({}); st.set();
  assert.equal(calls, 0);
  const f = FIELDS[0];
  st.setField(f.key, other(f));
  assert.equal(calls, 1);
  st.setField(f.key, other(f) + (other(f) === f.max ? -f.step / 4 : f.step / 4));   // snaps to the same value: no change
  assert.equal(calls, 1);
});

test('a batch (presets) notifies once, snaps each field, and keeps the fields it lacks', () => {
  const st = createState();
  let calls = 0;
  st.subscribe(() => { calls++; });
  st.set(Object.fromEntries(FIELDS.map(f => [f.key, offGrid(f)])));
  assert.equal(calls, 1);
  for (const f of FIELDS) assert.equal(st.getState()[f.key], fieldSnap(f, offGrid(f)), f.key);
  if (FIELDS.length > 1) {
    const [a, ...rest] = FIELDS;
    const before = st.getState();
    st.set({ [a.key]: other(a) });
    assert.equal(st.getState()[a.key], other(a));
    for (const g of rest) assert.equal(st.getState()[g.key], before[g.key], 'a field the batch lacks is kept');
  }
});

test('unsubscribe stops notifications; reset restores the defaults with one notification', () => {
  const st = createState();
  const f = FIELDS[0];
  let calls = 0;
  const off = st.subscribe(() => { calls++; });
  st.setField(f.key, other(f));
  off();
  st.setField(f.key, f.default);
  assert.equal(calls, 1);
  st.subscribe(() => { calls++; });
  for (const g of FIELDS) st.setField(g.key, other(g));
  const n = calls;
  st.reset();
  assert.deepEqual(st.getState(), DEFAULTS);
  assert.equal(calls, n + 1);
});

// ---- pin: snap to W sin theta, computed from the other inputs (friction kit extension) -----------------------------------
import { fieldPin } from '../src/fields.js';
import { controlsView } from '../src/controls.js';
const tField = FIELDS.find(f => f.key === 't');
const WX20 = 98.1 * Math.sin(20 * Math.PI / 180);         // 33.5522 N, where friction changes direction at the defaults

test('pin-snaps-to-Wx: a T within 0.75 N of W sin theta lands exactly on it (friction exactly zero)', () => {
  const st = createState();
  st.setField('t', 33.5);
  assert.ok(Math.abs(st.getState().t - WX20) < 1e-9, String(st.getState().t));
  assert.ok(controlsView(st.getState()).atPin.t);
});

test('pin-zone-edge: just outside the zone the slider value stands', () => {
  const st = createState();
  st.setField('t', 32.5);
  assert.equal(st.getState().t, 32.5);
  assert.equal(fieldPin(tField, 32.7, { t: 32.7, theta: 20, mu: 0.4 }), 32.7);
});

test('pin-follows-theta: changing theta never moves T; the on-pin highlight goes out', () => {
  const st = createState();
  st.setField('t', 33.5);
  st.setField('theta', 25);
  assert.ok(Math.abs(st.getState().t - WX20) < 1e-9);
  assert.equal(controlsView(st.getState()).atPin.t, false);
});

test('keyboard-leaves-pin: a key press from the pinned value steps to the grid just outside the zone', () => {
  const st = createState();
  st.setField('t', 33.5);
  st.setField('t', 34, true);
  assert.equal(st.getState().t, 34.5);
  st.setField('t', 33.5);
  st.setField('t', 33, true);
  assert.equal(st.getState().t, 32.5);
});

test('preset-pins-after-all-fields: a batch pins T to W sin theta of the batch\'s own theta, whatever the key order', () => {
  const wx30 = 98.1 * 0.5;
  for (const p of [{ theta: 30, t: 49 }, { t: 49, theta: 30 }]) {
    const st = createState();
    st.set(p);
    assert.ok(Math.abs(st.getState().t - wx30) < 1e-9, JSON.stringify(st.getState()));
  }
});

test('reset-returns-to-loaded: a store made with initial values resets to them, not to the defaults', () => {
  const st = createState({ t: 80, theta: 30, mu: 0.4 });
  st.setField('t', 10);
  st.reset();
  assert.deepEqual(st.getState(), { t: 80, theta: 30, mu: 0.4 });
});
