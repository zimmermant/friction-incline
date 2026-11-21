import { FIELDS, fieldByKey, fieldShow, fieldAria, unitText } from './fields.js';
import { forces } from './physics.js';
import { forceText } from './panel.js';

// Pure: what the controls show for state s. text[key] is the readout; atSnap[key] (only for a field with `snap`)
// says whether the slider sits at its marked zero; atMark[key] (only for a field with `mark`) whether it sits on its mark.
export function controlsView(s) {
  const text = {}, atSnap = {}, atMark = {}, atPin = {};
  for (const f of FIELDS) {
    if (f.pin) atPin[f.key] = Math.abs(s[f.key] - f.pin.at(s)) < 1e-9;
    text[f.key] = fieldShow(f, s[f.key]);
    if (f.snap) atSnap[f.key] = s[f.key] === 0;
    if (f.mark) atMark[f.key] = s[f.key] === f.mark.value;
  }
  return { text, atSnap, atMark, atPin };
}

// The friction gauge, on the T slider's own scale (0 to its max), so a value on the gauge sits right above the same
// value on the slider. A mark at W sin theta; a band W sin theta +/- mu N (the tensions static friction can hold); the
// friction bar from the mark toward T, |f| long; against a stop, the stop's share continues from the bar's end to T.
// Pure. Percentages of the slider's range (clamped to it); texts with units.
export function gaugeView(s, m) {
  const F = forces(s, m), tf = fieldByKey('t');
  const pct = (v) => Math.max(0, Math.min(100, 100 * (v - tf.min) / (tf.max - tf.min)));
  const end = F.Wx - F.f;                                   // where the friction bar ends (T when no stop pushes)
  const share = F.NC > 0 ? F.NC : (F.ND > 0 ? -F.ND : 0);  // stop C adds to T's side above the mark, D below
  const shown = forceText(F.f), zero = Number(shown.replace('−', '-')) === 0;
  return {
    markPct: pct(F.Wx), bandLoPct: pct(F.Wx - F.fmax), bandHiPct: pct(F.Wx + F.fmax),
    barLoPct: Math.min(pct(F.Wx), pct(end)), barHiPct: Math.max(pct(F.Wx), pct(end)),
    wallLoPct: Math.min(pct(end), pct(end + share)), wallHiPct: Math.max(pct(end), pct(end + share)),
    kinetic: F.kinetic, markText: unitText(forceText(F.Wx), 'N'),
    valueText: zero ? unitText('0.0', 'N') : `${unitText(forceText(Math.abs(F.f)), 'N')} ${F.f > 0 ? 'up' : 'down'} the slope`
  };
}

// The status pill: a class for its colour and words, so colour is never the only cue.
export function statusView(m) {
  if (m.mode === 'slip') return { cls: 'slip', text: `Slipping ${m.dir > 0 ? 'up' : 'down'} the slope — kinetic friction` };
  if (m.mode === 'top') return { cls: 'wall', text: 'At rest against stop C' };
  if (m.mode === 'bottom') return { cls: 'wall', text: 'At rest against stop D' };
  return { cls: 'rest', text: 'At rest' };
}

// Keys that move a range input; a pointer drag is everything else.
const CONTROLS_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];

function controlsSetText(node, str) {
  if (node.textContent !== str) node.textContent = str;
}

// root: the controls container (key and pointer events are heard here).
// parts: { reset, sliders: { key: el }, readouts: { key: el }, zeros: { key: el }, marks: { key: el } } -- the page's
// elements, one of each per input in FIELDS; `zeros` only for the fields with `snap`, `marks` only for those with `mark`.
// Binds the sliders and the reset button to state; render(s) shows state s in them.
export function createControls(root, state, parts) {
  let viaKeyboard = false;

  function showSlider(slider, readout, text, value, f) {
    // Move the thumb when the state's value differs from it: a snap, or the keyboard's jump past the zero zone.
    if (Number(slider.value) !== value) slider.value = String(value);
    slider.setAttribute('aria-valuetext', fieldAria(f, text));
    controlsSetText(readout, text);
  }

  function render(s) {
    const v = controlsView(s);
    for (const f of FIELDS) {
      showSlider(parts.sliders[f.key], parts.readouts[f.key], v.text[f.key], s[f.key], f);
      if (f.snap) parts.zeros[f.key].classList.toggle('on', v.atSnap[f.key]);
      if (f.mark) parts.marks[f.key].classList.toggle('on', v.atMark[f.key]);
    }
  }

  // A key marks the NEXT input event as a keyboard one; that event clears the mark. A key that changes nothing
  // (a slider already at its end) fires no input, so a key release, a pointer press and losing focus clear it
  // too, or the next drag would be taken for a key press.
  const clearKey = () => { viaKeyboard = false; };
  root.addEventListener('keydown', (e) => { if (CONTROLS_KEYS.includes(e.key)) viaKeyboard = true; });
  root.addEventListener('keyup', clearKey);
  root.addEventListener('pointerdown', clearKey);
  root.addEventListener('focusout', clearKey);
  if (typeof window !== 'undefined') window.addEventListener('blur', clearKey);

  for (const f of FIELDS) {
    const slider = parts.sliders[f.key];
    slider.addEventListener('input', () => {
      const kb = viaKeyboard;
      viaKeyboard = false;
      state.setField(f.key, Number(slider.value), kb);
      render(state.getState());   // the state may not have changed (a snap back to 0): still put the thumb right
    });
  }
  parts.reset.addEventListener('click', () => state.reset());

  return { render };
}
