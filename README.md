# Block on an incline, pulled up the slope

**Live:** https://zimmermant.github.io/friction-incline/dist/friction_incline.html

A teaching simulation for the direction of static friction. A steel block B rests on a wooden incline at angle θ; a string pulls it up the slope with tension *T*. While B stays put, friction is whatever equilibrium needs: f = W sin θ − *T* (positive = up the slope). Raise *T* and friction shrinks, passes through zero at *T* = W sin θ, and then points **down** the slope, all while B never moves. Friction does not simply oppose the pull, or "the motion": it opposes the way B would slide without it. Past W sin θ ± μ*N* B slides (kinetic friction μₖ*N*, μₖ = ¾ μ) into a low stop: C at the top, D at the bottom, where static friction returns and the stop takes whatever friction cannot.

Open `dist/friction_incline.html` in any browser. It is one self-contained file (about 93 KB, images embedded): no server, no network, no external URL.

## What the page shows

- **The scene**: the incline (wood grain along the slope), B, the string and its handle, stops D and C, the angle θ. The block animates while it slides.
- **The free-body diagram of B, drawn as a point**, every force on one scale (1.2 units per newton): *T⃗*, *f⃗*_A (orange static, purple kinetic), *N⃗*_A perpendicular to the slope, *W* straight down, and the stop force (gold). Forces along the slope in the same direction are drawn tip-to-tail. "Show components of W" adds W sin θ and W cos θ as dashed lines.
- **The friction gauge**, directly above the tension slider and on the same 0–100 N scale: a mark at W sin θ, a green band W sin θ ± μ*N* (the tensions static friction can hold), the friction bar from the mark to the thumb, and against a stop the stop's share (gold, hatched).
- **The status** and the **worked calculation** for the state (axes along and across the slope; symbols first, numbers last; "≈" where the printed numbers do not reproduce the printed result).

## The controls

| Control | What it does |
|---|---|
| **Tension *T*** | 0 to 100 N, step 0.5 N. Within 0.75 N of W sin θ it lands exactly on it (friction exactly zero; the W sin θ label lights). |
| **Incline angle θ** | 0° to 40°, step 1°. Default 20°: tan 20° < 0.40, so B holds with no pull. |
| **Coefficient of friction μ** | 0.10 to 0.80 (static; μₖ = ¾ μ fixed). |
| **Show components of W** | A view choice; not part of a link. |
| **Reset** | Back to the values the page was loaded with, block at its start. |

## URL presets

| Key | Input | Range, step, unit |
|---|---|---|
| `t` | tension *T* | 0 to 100, step 0.5, N |
| `theta` | angle θ | 0 to 40, step 1, degrees |
| `mu` | coefficient μ | 0.10 to 0.80, step 0.01, no unit |

`dist/friction_incline.html?t=60&theta=20&mu=0.40` shows friction pointing down the slope with B at rest; `?t=0&theta=30` slides B down into stop D.

## Run, build, test

```
node build.js
node --test test/*.test.js
node tools/mutations.mjs --coverage --strict
```

Built and tested with Node 22. Figure and controls fit in the first 650 px of an 800 × 750 window or a 1280 × 720 laptop; the calculation may scroll.

## Source

Second simulation of a PHYS-291 Statics tutorial on two static friction misconceptions; started as a copy of the block-and-string simulation. Physics: Coulomb friction on an incline (Hibbeler, *Engineering Mechanics: Statics*, ch. 8). Education research: Boudreaux & Elby (2020, Phys. Rev. Phys. Educ. Res. 16, 020144, https://doi.org/10.1103/PhysRevPhysEducRes.16.020144), on friction opposing "the most obvious applied force"; Kızılcık et al. (2021, https://doi.org/10.1103/PhysRevPhysEducRes.17.023107). Images generated with OpenAI Codex image generation.
