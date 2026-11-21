import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLines } from '../src/panel.js';
import { NUMBER } from './unit-rule.js';
import { unfmt } from '../src/format.js';
import { STATE_MOTIONS } from './grid.js';
import { FORCE_DP } from '../src/physics.js';

// A PATTERN to copy: printed arithmetic must add up. The page prints rounded numbers, and a reader with a calculator
// checks them: a printed 0.063 V + 0.938 V = 1 V is a lie at the printed precision. So for every numbers line that
// states a relation, over every state of the grid: the result computed from the PRINTED numbers must equal the
// PRINTED result exactly when the sign is "=", and must be off by at most one unit of its last printed digit when the
// sign is "≈". And the sign must not be "≈" when the printed numbers do agree.
//
// >>> EDIT THIS: one entry per numbers line that prints a relation. <<<
//   key     the line's key in calcLines
//   dp      the decimals the RESULT is printed with: the precision constant your panel uses (ENERGY_DP), never read back from
//           the printed text (fmt drops trailing zeros, so "5" or "8.66" would silently loosen the tolerance)
//   exact   gets the printed numbers on the left of the final sign, in order of appearance, and returns what a calculator gives
//   expect  which signs must occur over the grid: 'both' (the pattern needs both to be shown to work), '=' (always exact),
//           '≈' (never exact). A line that cannot reach the sign you expect is a vacuous test: change the table, not the code
// Friction: f_max = mu N and mu_k N are products of a 2-decimal coefficient and 98.1 N, never exact at 1 decimal;
// N_C = T - f is a difference of printed values, always exact. Lines absent in a state (no wall force) are skipped.
const RELATIONS = [
  { key: 'num-n', dp: FORCE_DP, exact: ([w, th]) => w * Math.cos(th * Math.PI / 180), expect: 'both' },
  { key: 'num-wx', dp: FORCE_DP, exact: ([w, th]) => w * Math.sin(th * Math.PI / 180), expect: 'both' },
  { key: 'num-f', dp: FORCE_DP, exact: ([wx, t]) => wx - t, expect: 'both' },
  { key: 'num-max', dp: FORCE_DP, exact: ([mu, n]) => mu * n, expect: 'both' },
  { key: 'num-k', dp: FORCE_DP, exact: ([mu, n]) => 0.75 * mu * n, expect: 'both' },
  { key: 'num-stop', dp: FORCE_DP, exact: ([a, b, c]) => a - b - c, expect: 'both' }
];

const plain = (html) => html.replace(/<[^>]*>/g, '');

// Splits a line "LHS sign RHS" at its LAST " = " or " ≈ " (the first " = " after the symbol belongs to the left side).
function parseRelation(html) {
  const text = plain(html);
  const i = Math.max(text.lastIndexOf(' = '), text.lastIndexOf(' ≈ '));
  assert.ok(i > 0, `no relation sign in "${text}"`);
  const lhs = text.slice(0, i), sign = text[i + 1], rhs = text.slice(i + 3);
  const numbers = (lhs.slice(lhs.indexOf(' = ') + 3).match(NUMBER) || []).map(unfmt);   // after "F = ": the printed factors
  const result = rhs.match(NUMBER)[0];
  return { text, sign, numbers, result };
}

test('rounding: on every state, "=" means the printed numbers reproduce the printed result, "≈" means close but not equal', () => {
  const tally = Object.fromEntries(RELATIONS.map(r => [r.key, { '=': 0, '≈': 0 }]));
  for (const { s, m } of STATE_MOTIONS) {
    const lines = Object.fromEntries(calcLines(s, m).map(l => [l.key, l.html]));
    for (const { key, dp, exact } of RELATIONS) {
      if (!lines[key]) continue;
      const { text, sign, numbers, result } = parseRelation(lines[key]);
      assert.ok(numbers.length >= 2, `${text}: found ${numbers.length} printed numbers`);
      const diff = Math.abs(exact(numbers) - unfmt(result));
      const lastDigit = 10 ** -dp;
      if (sign === '=') assert.ok(diff < 1e-9, `${text}: sign "=" but a calculator gives ${exact(numbers)}`);
      else {
        assert.equal(sign, '≈', text);
        assert.ok(diff >= 1e-9, `${text}: sign "≈" but the printed numbers reproduce the result exactly`);
        assert.ok(diff <= lastDigit + 1e-9, `${text}: sign "≈" but the result is off by ${diff}, more than one last digit (${lastDigit}): print more decimals`);
      }
      tally[key][sign]++;
    }
  }
  // Non-vacuity: each relation must show the signs its `expect` promises.
  for (const { key, expect } of RELATIONS) {
    const t = tally[key];
    if (expect === 'both') assert.ok(t['='] > 0 && t['≈'] > 0, `${key}: expected both signs, got ${JSON.stringify(t)}`);
    else if (expect === '=') assert.ok(t['='] > 0 && t['≈'] === 0, `${key}: expected "=" in every state that has it, got ${JSON.stringify(t)}`);
    else assert.ok(t['≈'] > 0 && t['='] === 0, `${key}: expected "≈" in every state that has it, got ${JSON.stringify(t)}`);
  }
});

test('rounding: the parser reads the printed numbers the way a person would (true minus, units, parentheses)', () => {
  const r = parseRelation('F = −(50 N/m) × (−0.30 m) = <b>15 N</b>');
  assert.deepEqual(r.numbers, [50, -0.3]);
  assert.equal(r.sign, '=');
  assert.equal(r.result, '15');
  assert.equal(parseRelation('U = ½ × (10 N/m) × (0.15 m)² ≈ <b>0.11 J</b>').sign, '≈');
  assert.equal(parseRelation('U = ½ × (10 N/m) × (0.15 m)² ≈ <b>0.11 J</b>').result, '0.11');
});
