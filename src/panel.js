import { fieldByKey, fieldShow, unitText } from './fields.js';
import { fmtFixed, unfmt } from './format.js';
import { forces, W, KINETIC_RATIO, FORCE_DP, RAD } from './physics.js';

// The worked calculation for the current state (x up the slope, y perpendicular to it): symbolic lines, then numbers
// lines with the printed values. Relation sign "=" only when the printed numbers give the printed result exactly.
export function panelRel(fromPrinted, printed) {
  return Math.abs(fromPrinted - unfmt(printed)) < 1e-9 ? '=' : '≈';
}

// A force as printed: FORCE_DP decimals, rounded half up on the exact decimal value (49.05 prints 49.1).
export function forceText(v) {
  const k = 10 ** FORCE_DP;
  return fmtFixed(Math.sign(v) * Math.round(Math.abs(v) * k + 1e-7) / k, FORCE_DP);
}
const PANEL_ZERO = unitText('0', 'N');
const fN = (text) => unitText(text, 'N');
const fB = (text) => `<b>${unitText(text, 'N')}</b>`;
const dirWords = (v) => (Math.abs(unfmt(forceText(v))) === 0 ? '' : v > 0 ? ' (up the slope)' : ' (down the slope)');

export function panelHeading(m) {
  if (m.mode === 'slip') return 'Worked calculation — slipping';
  if (m.mode === 'top') return 'Worked calculation — at rest against stop C';
  if (m.mode === 'bottom') return 'Worked calculation — at rest against stop D';
  return 'Worked calculation — at rest';
}

// The printed pieces every state uses.
function panelParts(s) {
  const F = forces(s, { mode: 'rest' });
  const mu = fieldShow(fieldByKey('mu'), s.mu), th = fieldShow(fieldByKey('theta'), s.theta), w = forceText(W);
  const n = forceText(F.N), wx = forceText(F.Wx), fm = forceText(F.fmax), t = forceText(s.t);
  return {
    mu, th, n, wx, fm, t,
    numN: { key: 'num-n', html: `N = W cos θ = (${fN(w)})(cos ${th}°) ${panelRel(unfmt(w) * Math.cos(unfmt(th) * RAD), n)} ${fB(n)}` },
    numWx: { key: 'num-wx', html: `W sin θ = (${fN(w)})(sin ${th}°) ${panelRel(unfmt(w) * Math.sin(unfmt(th) * RAD), wx)} ${fB(wx)}` },
    numMax: { key: 'num-max', html: `f<sub>max</sub> = μN = (${mu})(${fN(n)}) ${panelRel(unfmt(mu) * unfmt(n), fm)} ${fB(fm)}` }
  };
}

// s = { t, theta, mu }, m = motion state -> [{ key, html }]. Pure.
export function calcLines(s, m) {
  const F = forces(s, m), P = panelParts(s);
  const axes = { key: 'sym-axes', html: '<b>Axes</b>: x up the slope, y perpendicular to it' };
  const symY = { key: 'sym-y', html: `<b>Along y</b>: ΣF<sub>y</sub> = ${PANEL_ZERO}, so N − W cos θ = ${PANEL_ZERO} and N = W cos θ` };
  const symX = { key: 'sym-x', html: `<b>Along x</b>: ΣF<sub>x</sub> = ${PANEL_ZERO}, so T + f − W sin θ = ${PANEL_ZERO} and f = W sin θ − T (+ up the slope)` };
  const fr = forceText(F.f);
  const numF = { key: 'num-f', html: `f = W sin θ − T = ${fN(P.wx)} − ${fN(P.t)} ${panelRel(unfmt(P.wx) - unfmt(P.t), fr)} ${fB(fr)}${dirWords(F.f)}` };

  if (m.mode === 'slip') {
    const fk = forceText(Math.abs(F.f)), way = m.dir > 0 ? 'up' : 'down';
    return [
      { key: 'sym-slip', html: `B is sliding ${way} the slope, so friction is kinetic` +
        (Math.abs(F.Wx - F.T) > F.fmax ? ' (|W sin θ − T| &gt; f<sub>max</sub> = μN: static friction could not hold it).' : '.') },
      { key: 'sym-k', html: '<b>Kinetic friction</b>: f = μ<sub>k</sub>N against the sliding, with μ<sub>k</sub> = ¾ μ' },
      P.numN,
      { key: 'num-k', html: `f = μ<sub>k</sub>N = (¾)(${P.mu})(${fN(P.n)}) ${panelRel(KINETIC_RATIO * unfmt(P.mu) * unfmt(P.n), fk)} ${fB(fk)}${dirWords(F.f)}` },
      { key: 'note', html: `ΣF<sub>x</sub> ≠ ${PANEL_ZERO}: no equilibrium; B accelerates.` }
    ];
  }
  if (m.mode === 'top' || m.mode === 'bottom') {
    const C = m.mode === 'top', name = C ? 'C' : 'D', push = C ? F.NC : F.ND;
    if (push > 1e-9) {
      const r = forceText(push);
      const [lhs, a, b] = C ? ['T − W sin θ − f<sub>max</sub>', P.t, P.wx] : ['W sin θ − T − f<sub>max</sub>', P.wx, P.t];
      return [
        { key: 'sym-stop', html: `Static friction is at its maximum (${C ? 'down' : 'up'} the slope) and stop ${name} takes the rest.` },
        axes, symY,
        { key: 'sym-x', html: `<b>Along x</b>: ΣF<sub>x</sub> = ${PANEL_ZERO}, so ${C ? `T + f − W sin θ − N<sub>C</sub>` : `T + f − W sin θ + N<sub>D</sub>`} = ${PANEL_ZERO}` },
        P.numN, P.numWx, P.numMax,
        { key: 'num-stop', html: `N<sub>${name}</sub> = ${lhs} = ${fN(a)} − ${fN(b)} − ${fN(P.fm)} ${panelRel(unfmt(a) - unfmt(b) - unfmt(P.fm), r)} ${fB(r)}` }
      ];
    }
    return [
      { key: 'sym-stop', html: `|W sin θ − T| ≤ μN: static friction alone holds B; stop ${name} pushes with ${PANEL_ZERO}.` },
      symY, symX, P.numN, P.numWx, numF, P.numMax
    ];
  }
  return [axes, symY, symX, P.numN, P.numWx, numF, P.numMax];
}

export function createPanel(el) {
  let last = null;
  return {
    render(s, m) {
      const html = `<h3 class="calc-head">${panelHeading(m)}</h3>` +
        calcLines(s, m).map(l => `<div class="cl ${l.key}">${l.html}</div>`).join('');
      if (html === last) return;
      last = html;
      el.innerHTML = html;
    }
  };
}
