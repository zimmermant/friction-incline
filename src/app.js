import { FIELDS } from './fields.js';
import { createState } from './state.js';
import { createScene } from './scene.js';
import { createPanel } from './panel.js';
import { createControls, gaugeView, statusView, controlsView } from './controls.js';
import { parsePresets, describePresets, presetsPinned } from './presets.js';
import { MOTION_START, motionCheck, motionStep } from './motion.js';

const APP_TITLE = 'Block on an incline, pulled up the slope';
const ANIM_SPEED = 1;          // real time: a 2 m slide takes about 1.4-2 s, slow enough to watch (4 made it 0.35 s)
const ANIM_DT_MAX = 0.05;      // s of real time per frame at most (a hidden tab resumes without a jump)

// Everything is looked up by id here, once. The inputs live in the store; the block's history (rest, slipping,
// against the wall) lives in `motion`, stepped by an animation frame loop only while B slides.
function appStart() {
  document.title = APP_TITLE;
  const $ = (id) => document.getElementById(id);

  // Presets from the link: the store starts from (and resets to) the link's values over the defaults.
  const presets = parsePresets(location.search);
  const state = createState();
  state.set(presets.values);
  const loaded = state.getState();
  const store = createState(loaded);
  const note = describePresets(presetsPinned(presets, loaded));   // the note shows the values the page uses
  const link = $('from-link');
  link.textContent = note;            // text only: the link's own text can never become markup
  link.hidden = note === '';

  const scene = createScene($('fig'));
  const panel = createPanel($('calc'));
  const parts = { reset: $('reset'), sliders: {}, readouts: {}, zeros: {}, marks: {} };
  for (const f of FIELDS) {
    parts.sliders[f.key] = $(`${f.id}-slider`);
    parts.readouts[f.key] = $(`${f.id}-readout`);
    if (f.snap) parts.zeros[f.key] = $(`${f.id}-zero`);
    if (f.mark) parts.marks[f.key] = $(`${f.id}-mark`);
  }
  const controls = createControls($('controls'), store, parts);
  const g = { readout: $('f-readout'), band: $('gauge-band'), bar: $('gauge-bar'), wall: $('gauge-wall'), mark: $('gauge-mark'),
    label: $('gauge-mark-label'), status: $('status') };
  const comps = $('comps');                      // a view choice (not an input, not a preset)

  let motion = motionCheck(loaded, MOTION_START);
  let frame = null, last = null;

  function draw() {
    const s = store.getState();
    scene.render(s, motion, { comps: comps.checked === true });
    panel.render(s, motion);
    controls.render(s);
    const gv = gaugeView(s, motion), st = statusView(motion);
    const pct = (v) => `${Number(v.toFixed(4))}%`;
    const span = (lo, hi) => `left:${pct(lo)};width:${pct(hi - lo)}`;
    g.readout.textContent = gv.valueText;
    g.band.setAttribute('style', span(gv.bandLoPct, gv.bandHiPct));
    g.bar.setAttribute('style', span(gv.barLoPct, gv.barHiPct));
    g.bar.classList.toggle('kinetic', gv.kinetic);
    g.wall.setAttribute('style', span(gv.wallLoPct, gv.wallHiPct));
    g.mark.setAttribute('style', `left:${pct(gv.markPct)}`);
    g.label.setAttribute('style', `left:${pct(Math.min(85, Math.max(15, gv.markPct)))}`);
    g.label.innerHTML = `W sin θ = ${gv.markText}`;                   // built from our own formatted numbers only
    g.label.classList.toggle('on', controlsView(s).atPin.t === true);
    if (g.status.textContent !== st.text) g.status.textContent = st.text;
    g.status.setAttribute('class', `status ${st.cls}`);
  }

  function tick(now) {
    frame = null;
    if (motion.mode !== 'slip') { last = null; return; }
    const dt = last === null ? 0 : Math.min(ANIM_DT_MAX, (now - last) / 1000);
    last = now;
    motion = motionStep(store.getState(), motion, dt * ANIM_SPEED);
    if (motion.mode === 'rest') motion = motionCheck(store.getState(), motion);   // a reversal: may slide back at once
    if (motion.mode !== 'slip') last = null;
    draw();
    schedule();
  }
  function schedule() {
    if (motion.mode === 'slip' && frame === null && typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(tick);
  }
  function onInput() {
    motion = motionCheck(store.getState(), motion);
    draw();
    schedule();
  }

  store.subscribe(onInput);
  comps.addEventListener('change', draw);
  parts.reset.addEventListener('click', () => {
    motion = MOTION_START;
    store.reset();
    onInput();                         // also when reset changed no input: the block goes back to the start
  });

  // Test hook (tests and the browser harness only): run the slide to its end at once, in fixed 1/60 s steps.
  globalThis.__friction = {
    settle() {
      for (let i = 0; i < 100000 && motion.mode === 'slip'; i++) {
        motion = motionStep(store.getState(), motion, 1 / 60);
        if (motion.mode === 'rest') motion = motionCheck(store.getState(), motion);
      }
      draw();
    }
  };

  draw();
  schedule();
}

appStart();
