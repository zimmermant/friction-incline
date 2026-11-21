import { el, clear, text, COLORS } from './svg.js';
import { forces, alongSlope, normalForce, W, RAD } from './physics.js';
import { S_MAX } from './motion.js';

// The figure, viewBox 0 0 740 300: on the left (x 0-420) block B on an oak incline at angle theta, pulled up the slope by
// a string, between a low stop D at the bottom and a low stop C at the top; on the right (x 440-740) the free-body diagram
// of B drawn as a point, every force on ONE scale. Along-slope forces in the same direction are drawn tip-to-tail.
// Texts are class t (>= 16 units); every graphic sits in a top-level element of class g; decoration (the ground, the
// angle arc, the arrows over label letters, the dashed slope line and the W components) is class bg or vb.
const SCENE_W = 420;
const X0 = 26;                   // bottom corner of the incline
const BASE = 255;                // ground line (the strip below it holds the D and θ labels)
const L = 330;                   // slope length in units
const BW = 90;                   // block size along and across the slope
const BH = 48;
const STOP = 10;                 // stop thickness along the slope
const STOP_H = 20;               // lower than BH / 2, so the string at mid-height passes over stop C
const Q_MIN = STOP + BW / 2;     // block centre along the slope against D
const Q_MAX = L - STOP - BW / 2; // and against C
const BOARD = 10;                // thickness of the wooden board under the block (visible even at theta = 0)
export const FBD_CX = 590;
export const FBD_CY = 150;
export const K = 1.2;            // units per newton, every force
const LABEL = 16;

// The point at distance q (units) up the slope from the bottom corner.
export function sceneSlopePoint(thetaDeg, q) {
  const c = Math.cos(thetaDeg * RAD), sn = Math.sin(thetaDeg * RAD);
  return [Number((X0 + q * c).toFixed(3)), Number((BASE - q * sn).toFixed(3))];
}

// Where the block's centre sits along the slope for a slide position s (m).
function sceneBlockQ(s) {
  return Q_MIN + (Q_MAX - Q_MIN) * s / S_MAX;
}

export const SCENE_TRACKS = [
  { sel: 'g.force-W', measure: 'height', want: () => Number((W * K).toFixed(6)) }
];

export function arrowPoints(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const head = Math.min(16, len * 0.55), hw = 8, tw = 1.6, sw = 3.6, notch = 3;
  const bx = x2 - ux * head, by = y2 - uy * head;
  const pts = [[x1 + px * tw, y1 + py * tw], [bx + px * sw, by + py * sw], [bx + ux * notch + px * hw, by + uy * notch + py * hw],
    [x2, y2], [bx + ux * notch - px * hw, by + uy * notch - py * hw], [bx - px * sw, by - py * sw], [x1 - px * tw, y1 - py * tw]];
  return pts.map(p => p.map(c => Number(c.toFixed(2))).join(',')).join(' ');
}

function sceneArrow(svg, x1, y1, x2, y2, grad, cls) {
  const pts = arrowPoints(x1, y1, x2, y2);
  if (!pts) return null;
  const g = el('g', { class: `g force ${cls}`, filter: 'url(#arrow-shadow)' }, svg);
  el('line', { x1, y1, x2, y2, stroke: 'none' }, g);
  el('polygon', { points: pts, fill: `url(#${grad})`, stroke: 'rgba(0,0,0,0.25)', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, g);
  return g;
}

function sceneLabel(svg, x, y, letter, sub, color) {
  const t = text(svg, x, y, letter, { size: LABEL + 2, italic: true, serif: true, fill: color, anchor: 'middle' });
  t.setAttribute('class', 't');
  if (sub) {
    const ts = el('tspan', { 'font-size': 13, 'font-style': 'normal', dy: 4 }, t);
    ts.textContent = sub;
  }
  const g = el('g', { class: 'vb' }, svg);
  el('path', { d: `M${x - 7} ${y - 16} h12 m-3 -3 l3 3 l-3 3`, stroke: color, 'stroke-width': 1.4, fill: 'none' }, g);
}

function sceneCaption(svg, x, y, str, opts = {}) {
  const t = text(svg, x, y, str, { size: LABEL, ...opts });
  t.setAttribute('class', 't');
  return t;
}

function sceneDefs(svg, theta) {
  const defs = el('defs', {}, svg);
  for (const k of ['T', 'fs', 'fk', 'N', 'W', 'NC']) {
    const lg = el('linearGradient', { id: `grad-${k}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': COLORS[k][0] }, lg);
    el('stop', { offset: 1, 'stop-color': COLORS[k][1] }, lg);
  }
  const f = el('filter', { id: 'arrow-shadow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  el('feDropShadow', { dx: 0, dy: 1.5, stdDeviation: 1.2, 'flood-opacity': 0.3 }, f);
  const b = el('filter', { id: 'block-shadow', x: '-20%', y: '-20%', width: '140%', height: '160%' }, defs);
  el('feDropShadow', { dx: 0, dy: 3, stdDeviation: 3, 'flood-opacity': 0.28 }, b);
  // The oak texture, rotated so the grain runs along the slope.
  const pat = el('pattern', { id: 'wood', patternUnits: 'userSpaceOnUse', width: 420, height: 46,
    patternTransform: `translate(${X0} ${BASE}) rotate(${-theta})` }, defs);
  el('image', { href: '{{asset:wood_floor2.webp}}', x: 0, y: 0, width: 420, height: 46, preserveAspectRatio: 'none' }, pat);
}

function sceneWorld(svg, s, m) {
  const th = s.theta, c = Math.cos(th * RAD), sn = Math.sin(th * RAD);
  const nx = -sn, ny = -c;                                   // outward normal of the slope
  const P = (q) => sceneSlopePoint(th, q);
  const at = (q, h) => { const p = P(q); return [Number((p[0] + nx * h).toFixed(3)), Number((p[1] + ny * h).toFixed(3))]; };
  const rot = (q) => { const p = P(q); return `translate(${p[0]} ${p[1]}) rotate(${-th})`; };
  el('rect', { class: 'bg sky', x: 0, y: 0, width: SCENE_W, height: BASE, fill: COLORS.sky }, svg);
  el('rect', { class: 'bg ground', x: 0, y: BASE, width: SCENE_W, height: 300 - BASE, fill: '#c9d1db' }, svg);

  const top = P(L), b0 = at(0, -BOARD), b1 = at(L, -BOARD);
  const wedge = el('g', { class: 'bg wedge' }, svg);     // scenery: labels above the block sit inside its bounding box
  el('polygon', { points: `${X0},${BASE} ${top[0]},${BASE} ${top[0]},${top[1]}`, fill: 'url(#wood)', stroke: '#6b4a2a', 'stroke-width': 1 }, wedge);
  el('polygon', { points: `${X0},${BASE} ${top[0]},${top[1]} ${b1[0]},${b1[1]} ${b0[0]},${b0[1]}`, fill: 'url(#wood)', stroke: '#6b4a2a', 'stroke-width': 1 }, wedge);

  for (const [name, q0] of [['stop-D', 0], ['stop-C', L - STOP]]) {
    const g = el('g', { class: `g ${name}`, transform: rot(q0) }, svg);
    el('rect', { x: 0, y: -STOP_H, width: STOP, height: STOP_H, rx: 1.5, fill: COLORS.wall, stroke: '#3f444c', 'stroke-width': 0.8 }, g);
  }
  sceneCaption(svg, X0 + 2, BASE + 36, 'D', { weight: 700 });
  sceneCaption(svg, top[0] + 8, top[1] + 22, 'C', { weight: 700 });
  if (th > 0) {
    const r = 42, arc = el('g', { class: 'vb' }, svg);
    el('path', { d: `M${X0 + r} ${BASE} A${r} ${r} 0 0 0 ${(X0 + r * c).toFixed(2)} ${(BASE - r * sn).toFixed(2)}`, fill: 'none', stroke: COLORS.ink, 'stroke-width': 1.2 }, arc);
    sceneCaption(svg, X0 + 52, BASE + 36, 'θ', { italic: true, serif: true });
  }

  const q = sceneBlockQ(m.s), q1 = q + BW / 2, q2 = L + 20;      // L + 20 keeps the handle inside the figure at 40°
  const s1 = at(q1, BH / 2), hnd = at(q2, BH / 2);
  // The string is a thin line: decoration (vb), so a label beside it is not taken for one on top of its bounding box.
  const str = el('g', { class: 'vb string', transform: `translate(${s1[0]} ${s1[1]}) rotate(${-th})` }, svg);
  el('image', { href: '{{asset:string.webp}}', x: 0, y: -4.5, width: Number((q2 - q1).toFixed(3)), height: 9, preserveAspectRatio: 'none' }, str);
  const blk = el('g', { class: 'g block', transform: rot(q), filter: 'url(#block-shadow)' }, svg);
  el('image', { href: '{{asset:metal_block.webp}}', x: -BW / 2, y: -BH, width: BW, height: BH, preserveAspectRatio: 'none' }, blk);
  // B's label goes above the rotated block's bounding box (the harness measures boxes, not shapes).
  // If there is no room above (steep slope, block near the top), it goes to the left of the box instead.
  const ctr = P(q), cs = [[-BW / 2, 0], [BW / 2, 0], [-BW / 2, -BH], [BW / 2, -BH]];
  const ys = cs.map(([x, y]) => ctr[1] - x * sn + y * c), xs = cs.map(([x, y]) => ctr[0] + x * c + y * sn);
  const above = Math.min(...ys) - 8;
  if (above - 13 >= 2) sceneCaption(svg, ctr[0] - sn * BH / 2, above, 'B', { anchor: 'middle', weight: 700 });
  else sceneCaption(svg, Math.min(...xs) - 12, (Math.min(...ys) + Math.max(...ys)) / 2 + 6, 'B', { anchor: 'middle', weight: 700 });
  const h = el('g', { class: 'g pc handle' }, svg);
  el('circle', { cx: hnd[0], cy: hnd[1], r: 7, fill: COLORS.T[1], stroke: '#ffffff', 'stroke-width': 2 }, h);
}

// Candidate spots for an arrow's label: beside its middle at growing distances on either side, then past its tip.
// The first spot whose box (x +/- 15, y - 19 .. y + 9) touches no box in `boxes` and stays in the FBD area wins;
// if none does, the one that touches the fewest.
function scenePlaceLabel(a, boxes) {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2, c = [];
  for (const k of [22, 34, 48, 62, 78, 94]) for (const sd of [1, -1]) c.push([mx + sd * k * px, my + sd * k * py + 6]);
  for (const f of [0.25, 0.75]) for (const k of [22, 34, 48]) for (const sd of [1, -1]) {
    c.push([a.x1 + f * dx + sd * k * px, a.y1 + f * dy + sd * k * py + 6]);
  }
  for (const k of [18, 30, 44, 60]) for (const sd of [0, 1, -1, 2, -2]) c.push([a.x2 + k * ux + sd * 20 * px, a.y2 + k * uy + sd * 20 * py + 6]);
  const hits = ([x, y]) => {
    const b = { x0: x - 15, x1: x + 15, y0: y - 19, y1: y + 9 };     // the rendered label, measured in Chromium, with margin
    const out = b.x0 < 446 || b.x1 > 736 || b.y0 < 26 || b.y1 > 278 ? 1 : 0;
    return out + boxes.filter(o => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1).length;
  };
  let best = c[0], bestHits = Infinity;
  for (const p of c) { const h = hits(p); if (h === 0) return p.map(v => Number(v.toFixed(2))); if (h < bestHits) { best = p; bestHits = h; } }
  return best.map(v => Number(v.toFixed(2)));
}

function sceneFbd(svg, s, m, opts) {
  const F = forces(s, m), cx = FBD_CX, cy = FBD_CY, th = s.theta;
  const ux = Math.cos(th * RAD), uy = -Math.sin(th * RAD), nx = -Math.sin(th * RAD), ny = -Math.cos(th * RAD);
  sceneCaption(svg, 590, 17, 'Free-body diagram of B', { anchor: 'middle', weight: 600 });
  const guide = el('g', { class: 'vb slope-line' }, svg);
  el('line', { x1: cx - 125 * ux, y1: cy - 125 * uy, x2: cx + 125 * ux, y2: cy + 125 * uy, stroke: '#c3cad3', 'stroke-dasharray': '4 4' }, guide);

  const fGrad = F.kinetic ? 'grad-fk' : 'grad-fs', fCol = (F.kinetic ? COLORS.fk : COLORS.fs)[1];
  const up = [{ mag: F.T, grad: 'grad-T', cls: 'force-T', L: ['T', '', COLORS.T[1]] }];
  if (F.f > 1e-9) up.push({ mag: F.f, grad: fGrad, cls: 'force-f', L: ['f', 'A', fCol] });
  if (F.ND > 1e-9) up.push({ mag: F.ND, grad: 'grad-NC', cls: 'force-ND', L: ['N', 'D', COLORS.NC[1]] });
  const down = [];
  if (F.f < -1e-9) down.push({ mag: -F.f, grad: fGrad, cls: 'force-f', L: ['f', 'A', fCol] });
  if (F.NC > 1e-9) down.push({ mag: F.NC, grad: 'grad-NC', cls: 'force-NC', L: ['N', 'C', COLORS.NC[1]] });

  // Arrows first (remembering each one's bounding box), then labels placed where they touch no arrow box and no other label.
  const boxes = [{ x0: cx - 9, x1: cx + 9, y0: cy - 9, y1: cy + 9 }];
  const toPlace = [];
  const draw = (x1, y1, x2, y2, grad, cls, label) => {
    const g = sceneArrow(svg, x1, y1, x2, y2, grad, cls);
    if (!g) return;
    const pts = arrowPoints(x1, y1, x2, y2).split(' ').map(q => q.split(',').map(Number));
    boxes.push({ x0: Math.min(...pts.map(q => q[0])), x1: Math.max(...pts.map(q => q[0])), y0: Math.min(...pts.map(q => q[1])), y1: Math.max(...pts.map(q => q[1])) });
    if (label && Math.hypot(x2 - x1, y2 - y1) >= 8) toPlace.push({ x1, y1, x2, y2, label });
  };
  draw(cx, cy, cx + F.N * K * nx, cy + F.N * K * ny, 'grad-N', 'force-N', ['N', 'A', COLORS.N[1]]);
  draw(cx, cy, cx, cy + W * K, 'grad-W', 'force-W', ['W', '', COLORS.W[1]]);
  for (const [list, sg] of [[up, 1], [down, -1]]) {
    let d = 0;
    for (const it of list) {
      const d2 = d + it.mag * K;
      draw(cx + sg * d * ux, cy + sg * d * uy, cx + sg * d2 * ux, cy + sg * d2 * uy, it.grad, it.cls, it.L);
      d = d2;
    }
  }
  if (opts.comps) {
    const g = el('g', { class: 'vb comps' }, svg);
    const wx = alongSlope(s) * K, wn = normalForce(s) * K;
    el('line', { x1: cx, y1: cy, x2: cx - wx * ux, y2: cy - wx * uy, stroke: COLORS.W[1], 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g);
    el('line', { x1: cx, y1: cy, x2: cx - wn * nx, y2: cy - wn * ny, stroke: COLORS.W[1], 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g);
    sceneCaption(svg, 470, 286, 'dashed: W sin θ and W cos θ', { fill: COLORS.muted });
  }
  for (const a of toPlace) {
    const [x, y] = scenePlaceLabel(a, boxes);
    boxes.push({ x0: x - 15, x1: x + 15, y0: y - 19, y1: y + 9 });
    sceneLabel(svg, x, y, ...a.label);
  }
  const p = el('g', { class: 'g point' }, svg);
  el('circle', { cx, cy, r: 7, fill: COLORS.ink, stroke: '#ffffff', 'stroke-width': 2 }, p);
  if (!opts.comps) sceneCaption(svg, 590, 292, 'All forces to scale', { anchor: 'middle', fill: COLORS.muted });
}

// render(s, m, opts) clears the figure and redraws it. opts.comps: show the dashed components of W (a view choice, not an input).
export function createScene(svg) {
  return {
    render(s, m, opts = {}) {
      clear(svg);
      sceneDefs(svg, s.theta);
      sceneWorld(svg, s, m);
      sceneFbd(svg, s, m, opts);
    }
  };
}
