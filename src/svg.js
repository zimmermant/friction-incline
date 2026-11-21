export const NS = 'http://www.w3.org/2000/svg';

// One palette for the whole app (build.js puts every module in one scope, so one name per concept).
// Each force colour is a pair: [light top, dark bottom] of the arrow's vertical gradient.
export const COLORS = {
  ink:    '#1d2330',   // text and outlines
  muted:  '#5d6675',   // captions
  sky:    '#dde4ec',   // background above the floor
  wall:   '#7d848e',   // wall C
  T:      ['#5a9cf0', '#1450a0'],   // tension
  fs:     ['#f07a52', '#a2321a'],   // static friction
  fk:     ['#b07ff0', '#5d2a9e'],   // kinetic friction
  N:      ['#5cc06d', '#1c6a2a'],   // normal force
  W:      ['#8a909c', '#3a3f48'],   // weight
  NC:     ['#f2c14e', '#a87a0a']    // wall force
};

export function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const k in attrs) {
    const v = attrs[k];
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Text with a background-coloured halo so labels stay readable where they cross lines.
export function text(parent, x, y, str, opts = {}) {
  const node = el('text', {
    x, y,
    'font-size': opts.size || 16,
    'font-family': opts.serif ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, sans-serif',
    'font-style': opts.italic ? 'italic' : null,
    fill: opts.fill || COLORS.ink,
    'text-anchor': opts.anchor || 'start',
    'font-weight': opts.weight || 400,
    'paint-order': 'stroke',
    stroke: '#ffffff',
    'stroke-width': opts.halo === false ? 0 : 3.5,
    'stroke-linejoin': 'round'
  }, parent);
  node.textContent = str;
  return node;
}
