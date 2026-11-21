import { fmtFixed, withUnit } from './format.js';
import { alongSlope } from './physics.js';

// ======================================================================================================
// THE FIELDS TABLE: the one place that says what the learner can set. EDIT THIS TABLE for a new simulation.
// state.js, controls.js, presets.js, app.js, the unit lint, the browser harness's drift test and the template
// test all read it, so a new input is one new entry here (plus its markup in the template and its physics).
//
//   key       name in the state and in a URL preset (?x=0.2). Short, lower-case letters.
//   id        stem of the DOM ids: #<id>-slider, #<id>-readout (and #<id>-zero when `snap` is set)
//   label     the heading shown above the slider ("Position")
//   symbol    the physics symbol printed on the page and in notes ("x", "R₁"). A name with a digit uses a Unicode
//             subscript (₀-₉); an ASCII digit in a name is a bare number to the unit lint. Never the URL key.
//   min, max, step   the slider's range; min and max are whole multiples of step
//   unit      printed after a number ("N/m", "Ω"); must be listed in test/unit-rule.js UNITS, with its word in UNIT_WORDS
//   unitWord  the same unit in words, for aria-valuetext ("newtons per metre"); must be UNIT_WORDS[unit] and start with a word in UNITS
//             A DIMENSIONLESS input (a coefficient) has unit '' and unitWord '': it prints the bare number, and its aria text
//             is "<symbol> = <value>" (fieldAria). The unit lint accepts such a number only after "μ = " or as a factor "(0.40)".
//   default   the starting value (on the grid)
//   decimals  decimals printed and kept: 0.05 steps need 2, whole steps need 0 (step * 10^decimals is whole)
//   mark      OPTIONAL, any critical value that is NOT snapped to (45° of a launch angle, a resonance): { value, label }.
//             The template shows `label` under the slider at that value's place, lit while the slider sits on it:
//             <span id="<id>-mark" class="mark-label" style="left:P%">...</span>, P = 100 * (value - min) / (max - min).
//   pin       OPTIONAL (friction kit extension): a special value COMPUTED from the other inputs, { zone, at(s), label }.
//             A value within `zone` of at(s) lands exactly on at(s) (off the step grid); a keyboard nudge from it steps to
//             the grid just outside the zone. Changing another input never moves a pinned value (state.js).
//   snap      OPTIONAL, only for a slider symmetric about a special value 0 (position, charge): { zone, jump }.
//             |value| <= zone snaps to exactly 0; a keyboard nudge from 0 lands on +/-jump, just past the zone, so
//             the arrow keys can leave it. zone is a multiple of step; jump is on the grid and beyond the zone.
//             No snap: delete the property, nothing else changes (README "When there is no zero").
// ======================================================================================================
export const FIELDS = [
  { key: 't', id: 'tension', label: 'Tension', symbol: 'T', min: 0, max: 100, step: 0.5, unit: 'N', unitWord: 'newtons',
    default: 25, decimals: 1, pin: { zone: 0.75, at: (s) => alongSlope(s), label: 'W sin θ' } },
  { key: 'theta', id: 'theta', label: 'Incline angle', symbol: 'θ', min: 0, max: 40, step: 1, unit: '°', unitWord: 'degrees',
    default: 20, decimals: 0 },
  { key: 'mu', id: 'mu', label: 'Coefficient of friction', symbol: 'μ', min: 0.1, max: 0.8, step: 0.01, unit: '', unitWord: '',
    default: 0.4, decimals: 2 }
];

// Units that print WITHOUT the no-break space: an angle reads "40°", not "40 °". Every other unit is joined by U+00A0.
// Maps the unit to the text put between number and unit (only '' makes sense). The toy has no angle; for yours: { '°': '' }.
// Every place that prints a number and a unit goes through unitText / fieldText, so this one table is enough; write the
// same join in the template (`40°` where the toy has `40&nbsp;m`): test/template.test.js checks it.
export const UNIT_JOIN = { '°': '' };

// ------------------------------------------------------------------------------------------------------
// Below this line everything is generic: no edit needed.
// ------------------------------------------------------------------------------------------------------

export function fieldByKey(key) {
  const f = FIELDS.find(g => g.key === key);
  if (!f) throw new Error(`no input called "${key}"`);
  return f;
}

export function fieldDefaults() {
  return Object.fromEntries(FIELDS.map(f => [f.key, f.default]));
}

// Raw slider value -> allowed value: clamp, round to whole steps and clean the float noise (3 * 0.05 is
// 0.15000000000000002) by rounding to the field's decimals; a snap zone collapses to a literal 0.
// Non-finite input becomes 0 for a snap field and the minimum otherwise. The result is never -0: Math.round(-0.3)
// is -0, but (-0).toFixed(2) is "0.00", so the Number(toFixed) step turns it into +0.
export function fieldSnap(f, v) {
  if (!Number.isFinite(v)) return f.snap ? 0 : f.min;
  const clamped = Math.max(f.min, Math.min(f.max, v));
  const stepped = Number((Math.round(clamped / f.step) * f.step).toFixed(f.decimals));
  return f.snap && Math.abs(stepped) <= f.snap.zone ? 0 : stepped;
}

// Slider input handler. A pointer drag just snaps. One arrow-key step can be smaller than the snap zone, so a
// slider sitting at 0 could never leave it: a keyboard nudge from 0 that would land back at 0 jumps past the zone.
// Only a field with `snap` does this.
export function fieldNext(f, prev, raw, viaKeyboard) {
  const snapped = fieldSnap(f, raw);
  if (f.snap && viaKeyboard && prev === 0 && snapped === 0 && raw !== 0 && Number.isFinite(raw)) {
    return raw > 0 ? f.snap.jump : -f.snap.jump;
  }
  return snapped;
}

// The value as printed: fixed decimals, true minus sign, never -0.
export function fieldShow(f, v) {
  return fmtFixed(v, f.decimals);
}

// A printed number and its unit, joined by a no-break space or as UNIT_JOIN says. `joins` is a parameter only so a test can
// try another table.
export function unitText(text, unit, joins = UNIT_JOIN) {
  if (unit === '') return text;                   // a dimensionless value has no unit and no separator
  return withUnit(text, unit, Object.hasOwn(joins, unit) ? joins[unit] : undefined);
}

// The value with its unit.
export function fieldText(f, v, joins = UNIT_JOIN) {
  return unitText(fieldShow(f, v), f.unit, joins);
}

// The slider's aria-valuetext: the value and its unit in words, or "<symbol> = <value>" for a dimensionless input.
export function fieldAria(f, text) {
  return f.unit === '' ? `${f.symbol} = ${text}` : withUnit(text, f.unitWord);
}

// The pin rule: v within f.pin.zone of the computed value at(s) becomes exactly that value. No pin: v unchanged.
export function fieldPin(f, v, s) {
  if (!f.pin) return v;
  const p = f.pin.at(s);
  return Math.abs(v - p) <= f.pin.zone + 1e-9 ? p : v;
}

// Slider input for a pinned field: snap to the grid, then pin; a keyboard nudge from the pinned value that would land
// back on it steps to the first grid value outside the zone, in the direction of the key.
export function fieldNextPinned(f, prev, raw, viaKeyboard, s) {
  const p = f.pin ? f.pin.at(s) : null;
  const pinned = fieldPin(f, fieldNext(f, prev, raw, viaKeyboard), s);
  if (f.pin && viaKeyboard && Math.abs(prev - p) < 1e-9 && Math.abs(pinned - p) < 1e-9 && raw !== prev) {
    const edge = raw > prev ? p + f.pin.zone : p - f.pin.zone;
    const g = raw > prev ? Math.ceil(edge / f.step + 1e-9) * f.step : Math.floor(edge / f.step - 1e-9) * f.step;
    return fieldSnap(f, g);
  }
  return pinned;
}
