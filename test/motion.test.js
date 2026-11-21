import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, normalForce, alongSlope, frictionMax, kineticFriction, forces } from '../src/physics.js';
import { MOTION_START, S_MIN, S_MAX, motionCheck, motionStep } from '../src/motion.js';

// Sign convention: + is UP the slope. f > 0 means friction points up the slope.
// Hand-derived at theta = 20 deg, mu = 0.40: N = 98.1 cos 20 = 92.1838 N, W sin 20 = 33.5520 N, f_max = 36.8735 N.
// At theta = 30 deg: N = 84.9571 N, W sin 30 = 49.05 N, f_max (mu 0.40) = 33.9828 N.
const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);
const at = (t, theta = 20, mu = 0.4) => ({ t, theta, mu });
const rest = { ...MOTION_START };

test('physics: N = W cos theta, W sin theta down the slope, f_max = mu N, kinetic 0.75 mu N', () => {
  near(W, 98.1, 'W');
  near(normalForce(at(0)), 92.1838, 'N');
  near(alongSlope(at(0)), 33.5520, 'W sin theta');
  near(frictionMax(at(0)), 36.8735, 'f_max');
  near(kineticFriction(at(0)), 27.6551, 'mu_k N');
});

test('holds-at-zero: at 20 deg with no pull, friction holds B with f = W sin theta up the slope', () => {
  assert.equal(motionCheck(at(0), rest).mode, 'rest');
  near(forces(at(0), rest).f, 33.552, 'f up');
});

test('flip-at-Wx: friction is zero at T = W sin theta and points down the slope beyond it, B still at rest', () => {
  near(forces(at(33.552), rest).f, 0, 'f zero');
  const F = forces(at(60), rest);
  near(F.f, -26.448, 'f down'); assert.equal(motionCheck(at(60), rest).mode, 'rest');
});

test('slip-up: past W sin theta + mu N the block slides up, kinetic friction down the slope', () => {
  const m = motionCheck(at(71), rest);
  assert.equal(m.mode, 'slip'); assert.equal(m.dir, 1);
  near(forces(at(71), m).f, -27.6551, 'kinetic down');
});

test('slip-down-at-30deg: with no pull at 30 deg (tan 30 > 0.40) B slides down', () => {
  const m = motionCheck(at(0, 30), rest);
  assert.equal(m.mode, 'slip'); assert.equal(m.dir, -1);
  near(forces(at(0, 30), m).f, 0.75 * 33.9828, 'kinetic up');
});

test('stop-C: against the top stop, friction at its max down the slope and C takes the rest', () => {
  const F = forces(at(90, 30), { mode: 'top', s: S_MAX, v: 0, dir: 0 });
  near(F.f, -33.9828, 'f'); near(F.NC, 90 - 49.05 - 33.9828, 'N_C'); near(F.ND, 0, 'N_D');
});

test('stop-D: against the bottom stop, friction at its max up the slope and D takes the rest', () => {
  const F = forces(at(5, 30), { mode: 'bottom', s: S_MIN, v: 0, dir: 0 });
  near(F.f, 33.9828, 'f'); near(F.ND, 49.05 - 5 - 33.9828, 'N_D'); near(F.NC, 0, 'N_C');
});

test('at a stop within the limit the stop pushes with zero and f = W sin theta - T', () => {
  const F = forces(at(40, 30), { mode: 'bottom', s: S_MIN, v: 0, dir: 0 });
  near(F.f, 9.05, 'f'); near(F.ND, 0, 'N_D');
});

test('leaving a stop: a demand away from the stop beyond mu N starts a slide away from it', () => {
  const m = motionCheck(at(95, 30), { mode: 'bottom', s: S_MIN, v: 0, dir: 0 });
  assert.equal(m.mode, 'slip'); assert.equal(m.dir, 1);
  const m2 = motionCheck(at(0, 30), { mode: 'top', s: S_MAX, v: 0, dir: 0 });
  assert.equal(m2.mode, 'slip'); assert.equal(m2.dir, -1);
});

test('mu-drop-slips-down-slope: at 20 deg with no pull, lowering mu to 0.30 starts a slide down', () => {
  const m = motionCheck(at(0, 20, 0.3), rest);
  assert.equal(m.mode, 'slip'); assert.equal(m.dir, -1);
});

test('reverse-mid-slide: a slide up with the pull removed slows, comes to rest, then is re-checked and slides down', () => {
  let m = { mode: 'slip', s: 1.0, v: 0.5, dir: 1 };
  const seen = [];
  for (let i = 0; i < 2000 && !(m.mode === 'bottom'); i++) {
    m = motionCheck(at(0, 30), motionStep(at(0, 30), m, 1 / 60));
    if (seen[seen.length - 1] !== m.mode) seen.push(m.mode);
  }
  assert.ok(seen.includes('slip'), seen.join('>'));
  assert.equal(m.mode, 'bottom', seen.join('>'));
  assert.ok(!seen.includes('top'), 'never reached the top');
});

test('never-past-stops: random input changes and steps keep S_MIN <= s <= S_MAX', () => {
  let m = { ...MOTION_START }, seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let s = at(25);
  for (let i = 0; i < 2000; i++) {
    if (i % 37 === 0) s = { t: Math.round(rnd() * 200) / 2, theta: Math.round(rnd() * 40), mu: Math.round(10 + rnd() * 70) / 100 };
    m = motionStep(s, motionCheck(s, m), 1 / 30);
    assert.ok(m.s >= S_MIN - 1e-12 && m.s <= S_MAX + 1e-12, `s ${m.s}`);
  }
});

test('motion is pure: the input object is not changed', () => {
  const m = { mode: 'slip', s: 1, v: 0.4, dir: 1 };
  const copy = { ...m };
  motionStep(at(80), m, 1 / 60); motionCheck(at(80), m);
  assert.deepEqual(m, copy);
  assert.deepEqual(MOTION_START, { mode: 'rest', s: 0.8, v: 0, dir: 0 });
});

test('leaving a stop: a slide away from C or D is not ended by that stop on its first step (even dt = 0)', () => {
  assert.equal(motionStep(at(10, 30), { mode: 'slip', s: S_MAX, v: 0, dir: -1 }, 0).mode, 'slip');
  assert.equal(motionStep(at(95, 30), { mode: 'slip', s: S_MIN, v: 0, dir: 1 }, 0).mode, 'slip');
});

test('hold-band-edge: |W sin theta - T| exactly equal to mu N still holds (the limit is static)', () => {
  const s = { t: 0.4 * 98.1, theta: 0, mu: 0.4 };
  assert.equal(motionCheck(s, rest).mode, 'rest');
});

test('reversal-stops: one step that would reverse the velocity ends the slide at rest instead', () => {
  const m = motionStep(at(0, 30), { mode: 'slip', s: 1, v: 0.01, dir: 1 }, 1 / 60);
  assert.equal(m.mode, 'rest'); assert.equal(m.v, 0);
});
