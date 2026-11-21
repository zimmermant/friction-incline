import { FIELDS, fieldByKey, fieldDefaults, fieldNextPinned, fieldSnap, fieldPin } from './fields.js';

export const DEFAULTS = fieldDefaults();

// Pure store: no DOM. Only the inputs in FIELDS are stored; everything else is derived (physics.js), never stored,
// so it can never disagree. Subscribers get a copy of the new state, and only when a stored value changed.
// initial: the values to start from and to reset to (the page passes the link's values over the defaults).
export function createState(initial = DEFAULTS) {
  const start = { ...DEFAULTS, ...initial };
  let cur = { ...start };
  const subs = new Set();

  function commit(next) {
    if (FIELDS.every(f => next[f.key] === cur[f.key])) return;
    cur = next;
    const snapshot = { ...cur };
    for (const fn of [...subs]) fn(snapshot);
  }

  return {
    getState: () => ({ ...cur }),
    // One field, snapped as its slider snaps (the keyboard jump only for a field with `snap`).
    setField: (key, raw, viaKeyboard) => {
      const f = fieldByKey(key);
      commit({ ...cur, [key]: fieldNextPinned(f, cur[key], raw, viaKeyboard, cur) });
    },
    // A batch (presets): each field is snapped, missing fields are kept, one notification.
    // Pins are applied after every field is snapped, so a pin sees the batch's own values whatever the key order.
    set: (p = {}) => {
      const snapped = Object.fromEntries(FIELDS.map(f => [f.key, p[f.key] === undefined ? cur[f.key] : fieldSnap(f, p[f.key])]));
      commit(Object.fromEntries(FIELDS.map(f => [f.key, p[f.key] === undefined ? snapped[f.key] : fieldPin(f, snapped[f.key], snapped)])));
    },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
    reset: () => commit({ ...start })
  };
}
