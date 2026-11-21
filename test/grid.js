import { FIELDS, fieldSnap } from '../src/fields.js';

// A test helper (not a test file): the grid of states the lints and the rounding test walk through. Built from FIELDS,
// so a new input or a new range needs no edit here.
//
// Per input: every slider position if there are at most GRID_MAX of them, otherwise GRID_MAX positions spread over
// the range, always including both ends, the default and (for a field with `snap`) zero and the two jump values, and (for a field with `mark`) the marked value.
// Positions inside a snap zone collapse to 0 (the slider cannot stop there). The states are the cartesian product, so
// the count multiplies: the toy's 17 and 10 values give 170 states; three inputs with 21 values each give 9,261. Lower GRID_MAX if the suite becomes slow.
export const GRID_MAX = 21;

export function gridValues(f) {
  const n = Math.round((f.max - f.min) / f.step);
  const at = (i) => Number((f.min + i * f.step).toFixed(f.decimals));
  const idx = [];
  if (n + 1 <= GRID_MAX) for (let i = 0; i <= n; i++) idx.push(i);
  else for (let j = 0; j < GRID_MAX; j++) idx.push(Math.round(j * n / (GRID_MAX - 1)));
  const values = new Set(idx.map(i => fieldSnap(f, at(i))));      // a position inside a snap zone IS 0: the slider cannot stop there
  values.add(f.default);
  if (f.snap) for (const v of [0, f.snap.jump, -f.snap.jump]) values.add(v);      // only values the slider can really reach
  if (f.mark) values.add(f.mark.value);                                          // and the marked value
  return [...values].sort((a, b) => a - b);
}

export const VALUES = Object.fromEntries(FIELDS.map(f => [f.key, gridValues(f)]));

// The cartesian product: [{ x: -0.5, k: 10 }, ...]
export const STATES = FIELDS.reduce(
  (acc, f) => acc.flatMap(s => VALUES[f.key].map(v => ({ ...s, [f.key]: v }))), [{}]);

// Friction on the incline: every state paired with each motion state it can show. Rest only within the static band;
// slides both ways and both stops (with or without a stop force) are always included.
import { MOTION_START, S_MIN, S_MAX } from '../src/motion.js';
import { frictionMax, alongSlope } from '../src/physics.js';
export const MOTIONS = {
  rest: MOTION_START,
  up: { mode: 'slip', s: 1, v: 0.3, dir: 1 },
  down: { mode: 'slip', s: 1, v: -0.3, dir: -1 },
  top: { mode: 'top', s: S_MAX, v: 0, dir: 0 },
  bottom: { mode: 'bottom', s: S_MIN, v: 0, dir: 0 }
};
export const STATE_MOTIONS = STATES.flatMap(s => [
  ...(Math.abs(alongSlope(s) - s.t) <= frictionMax(s) ? [{ s, m: MOTIONS.rest }] : []),
  { s, m: MOTIONS.up }, { s, m: MOTIONS.down },
  // B can rest against C only while the net push does not pull it down the slope past mu N (else it slides away), and
  // against D only while the push does not pull it up past mu N.
  ...(alongSlope(s) - s.t <= frictionMax(s) ? [{ s, m: MOTIONS.top }] : []),
  ...(s.t - alongSlope(s) <= frictionMax(s) ? [{ s, m: MOTIONS.bottom }] : [])]);
