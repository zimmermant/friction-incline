import test from 'node:test';
import assert from 'node:assert/strict';
import { W, MASS, KINETIC_RATIO, FORCE_DP, RAD, normalForce, alongSlope, frictionMax, kineticFriction } from '../src/physics.js';

// The fixed physics of the block on the incline (forces in every state are tested in test/motion.test.js).
test('fixed values: W = 98.1 N for m = 10 kg, mu_k = 0.75 mu, forces printed with 1 decimal', () => {
  assert.equal(W, 98.1); assert.equal(MASS, 10); assert.equal(KINETIC_RATIO, 0.75); assert.equal(FORCE_DP, 1);
  assert.equal(RAD, Math.PI / 180);
});

test('level ground (theta = 0): N = W, no component along the slope', () => {
  assert.equal(normalForce({ t: 0, theta: 0, mu: 0.4 }), 98.1);
  assert.equal(alongSlope({ t: 0, theta: 0, mu: 0.4 }), 0);
});

test('components add back to W, and f_max and mu_k N scale with mu and with cos theta', () => {
  for (const theta of [0, 10, 20, 30, 40]) for (const mu of [0.1, 0.4, 0.8]) {
    const s = { t: 0, theta, mu };
    assert.ok(Math.abs(Math.hypot(normalForce(s), alongSlope(s)) - 98.1) < 1e-9);
    assert.ok(Math.abs(frictionMax(s) - mu * normalForce(s)) < 1e-12);
    assert.ok(Math.abs(kineticFriction(s) - 0.75 * mu * normalForce(s)) < 1e-12);
  }
});
