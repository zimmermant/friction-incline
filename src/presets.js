import { FIELDS, fieldSnap, fieldShow, fieldText, unitText } from './fields.js';

// Optional URL parameters that preset a setup, one per input in FIELDS, by its key:   ?x=0.2&k=50
// Presets are configuration read once at load, held OUTSIDE the state. Every number goes through the same
// snapping as its slider (fieldSnap) and a change you could see is reported. Notes print the field's SYMBOL
// (R₁), never its URL key (R1): an ASCII digit in a name is a bare number to the unit lint.

// No exponent, no hex, no empty. Written unambiguously (\d+(\.\d*)?, not \d+\.?\d*): the looser form backtracks
// quadratically on a long digit string with a bad last character.
const PRESET_NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const PRESET_SHOWN_MAX = 40;                      // characters of a rejected value echoed back

function presetNumber(text) {
  // The page prints a real minus sign (U+2212), so a number pasted from the screen starts with one.
  const s = text.trim().replace(/^−/, '-');
  if (!PRESET_NUMBER.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;           // 400 digits overflow to Infinity
}

// A rejected value is echoed back, but a 2,000-character one would overflow the page.
function presetShown(raw) {
  const chars = Array.from(raw);
  return chars.length > PRESET_SHOWN_MAX ? chars.slice(0, PRESET_SHOWN_MAX).join('') + '…' : raw;
}

// Reads one field's number. Returns the snapped value, or undefined (and an ignored note) when it is not a number.
function presetValue(f, raw, out) {
  const n = presetNumber(raw);
  if (n === null) {
    out.ignored.push(`${f.symbol}=${presetShown(raw)} (use a number${f.unit === '' ? '' : ` of ${f.unit}`})`);
    return undefined;
  }
  const s = fieldSnap(f, n);
  // Compare what would be PRINTED: a snap too small to show is no news.
  if (fieldShow(f, n) !== fieldShow(f, s)) {
    out.adjusted.push(f.unit === ''        // dimensionless: the symbol before each number, as the page prints it
      ? `${f.symbol} = ${fieldShow(f, n)} → ${f.symbol} = ${fieldShow(f, s)}`
      : `${f.symbol} ${unitText(fieldShow(f, n), f.unit)} → ${unitText(fieldShow(f, s), f.unit)}`);
  }
  return s;
}

// `fields` defaults to the real table; a test passes its own, to check a field whose key differs from its symbol (r1, R₁).
// -> { values: { key: snapped value, only for keys the link set }, adjusted: [...], ignored: [...] }
export function parsePresets(search, fields = FIELDS) {
  const q = new URLSearchParams(search || '');
  const out = { values: {}, adjusted: [], ignored: [] };
  // The first duplicate wins (get); a missing key is null. Notes follow the order of FIELDS.
  for (const f of fields) {
    const raw = q.get(f.key);
    if (raw === null) continue;
    const v = presetValue(f, raw, out);
    if (v !== undefined) out.values[f.key] = v;
  }
  return out;
}

export function describePresets(p, fields = FIELDS) {
  const set = fields.filter(f => p.values[f.key] !== undefined).map(f => `${f.symbol} = ${fieldText(f, p.values[f.key])}`);
  const parts = [];
  if (set.length) parts.push(`From the link: ${set.join(', ')}.`);
  else if (p.adjusted.length || p.ignored.length) parts.push('From the link: nothing set.');
  if (p.adjusted.length) parts.push(`Adjusted: ${p.adjusted.join('; ')}.`);
  if (p.ignored.length) parts.push(`Ignored: ${p.ignored.join('; ')}.`);
  return parts.join(' ');
}

// Pins (friction kit extension) act after the link is read, in the store, so the link's value can differ from the value
// the page uses. Given the parsed link and the values the page loaded with, put the loaded value in for every pinned
// field the link set, and report the move when it shows ("T 33.5 N → 33.6 N (W sin θ)"). Pure: returns a new object.
export function presetsPinned(p, loaded, fields = FIELDS) {
  const out = { values: { ...p.values }, adjusted: [...p.adjusted], ignored: [...p.ignored] };
  for (const f of fields) {
    if (!f.pin || p.values[f.key] === undefined || loaded[f.key] === p.values[f.key]) continue;
    out.values[f.key] = loaded[f.key];
    const from = fieldShow(f, p.values[f.key]), to = fieldShow(f, loaded[f.key]);
    if (from !== to) out.adjusted.push(`${f.symbol} ${unitText(from, f.unit)} → ${unitText(to, f.unit)} (${f.pin.label})`);
  }
  return out;
}
