// The physics of a block B on an incline at angle theta, pulled UP the slope by a string with tension T, between a
// stop D at the bottom and a stop C at the top. Pure functions of the inputs s = { t, theta, mu } (N, degrees, static
// coefficient) and of the motion state m (motion.js). No DOM.
// Sign convention along the slope: + is UP the slope. f > 0 means friction points up the slope.
export const W = 98.1;               // weight of B in N (m = 10 kg), fixed
export const MASS = 10;              // kg
export const KINETIC_RATIO = 0.75;   // mu_k = 0.75 mu, fixed
export const FORCE_DP = 1;           // decimals printed for every force

export const RAD = Math.PI / 180;   // degrees to radians (one name for every module)

// The normal force balances the weight's component into the slope: N = W cos theta.
export function normalForce(s) {
  return W * Math.cos(s.theta * RAD);
}

// The weight's component down the slope: W sin theta.
export function alongSlope(s) {
  return W * Math.sin(s.theta * RAD);
}

// The largest static friction: f_max = mu N.
export function frictionMax(s) {
  return s.mu * normalForce(s);
}

// Kinetic friction while B slides: mu_k N.
export function kineticFriction(s) {
  return KINETIC_RATIO * s.mu * normalForce(s);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Every force on B. need = W sin theta - T is the friction (+ up the slope) that equilibrium asks for with no stop force.
// rest: f = need. slip: kinetic friction against the sliding direction m.dir. top (stop C pushes DOWN the slope) and
// bottom (stop D pushes UP the slope): static friction takes the load first, up to mu N; the stop takes any excess
// that pushes B into it. NC and ND are sizes (>= 0).
export function forces(s, m) {
  const T = s.t, N = normalForce(s), Wx = alongSlope(s), fmax = frictionMax(s), need = Wx - T;
  const base = { T, N, Wx, fmax, NC: 0, ND: 0, kinetic: false };
  if (m.mode === 'slip') return { ...base, f: -m.dir * kineticFriction(s), kinetic: true };
  if (m.mode === 'top' && need < -fmax) return { ...base, f: -fmax, NC: -need - fmax };
  if (m.mode === 'bottom' && need > fmax) return { ...base, f: fmax, ND: need - fmax };
  return { ...base, f: clamp(need, -fmax, fmax) };
}
