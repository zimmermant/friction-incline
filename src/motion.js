import { MASS, alongSlope, frictionMax, kineticFriction } from './physics.js';

// The block's history, which the inputs alone cannot say: at rest on the slope, slipping (up or down), or resting
// against stop C (top) or stop D (bottom). m = { mode: 'rest' | 'slip' | 'top' | 'bottom', s, v, dir }: s in m along the
// slope from S_MIN (against D) to S_MAX (against C), v in m/s (+ up the slope), dir the sliding direction (+1 up,
// -1 down, 0 when not sliding). Pure: every function returns a new object.
export const S_MIN = 0;
export const S_MAX = 2.0;
export const MOTION_START = Object.freeze({ mode: 'rest', s: 0.8, v: 0, dir: 0 });

// After an input change. At rest: |W sin theta - T| beyond mu N starts a slide in the direction the net push points
// (T beyond W sin theta: up). Against a stop: a push AWAY from the stop beyond mu N starts a slide away from it.
export function motionCheck(s, m) {
  const need = alongSlope(s) - s.t, fmax = frictionMax(s);
  const slide = (dir) => ({ mode: 'slip', s: m.s, v: m.v, dir });
  if (m.mode === 'rest' && Math.abs(need) > fmax) return slide(need < 0 ? 1 : -1);
  if (m.mode === 'top' && need > fmax) return slide(-1);
  if (m.mode === 'bottom' && need < -fmax) return slide(1);
  return { ...m };
}

// One time step of a slide (dt in s): a = (T - W sin theta - dir mu_k N) / m along the slope. If the velocity would
// change sign (the push no longer drives the slide) B stops: rest, re-checked by motionCheck. A stop ends the slide.
export function motionStep(s, m, dt) {
  if (m.mode !== 'slip') return { ...m };
  const a = (s.t - alongSlope(s) - m.dir * kineticFriction(s)) / MASS;
  const v = m.v + a * dt;
  if (v * m.dir < 0) return { mode: 'rest', s: m.s, v: 0, dir: 0 };
  const pos = m.s + v * dt;
  // A stop ends a slide only one moving INTO it (a slide away from C starts at S_MAX).
  if (m.dir > 0 && pos >= S_MAX) return { mode: 'top', s: S_MAX, v: 0, dir: 0 };
  if (m.dir < 0 && pos <= S_MIN) return { mode: 'bottom', s: S_MIN, v: 0, dir: 0 };
  return { mode: 'slip', s: pos, v, dir: m.dir };
}
