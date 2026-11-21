# Lab notebook: Block on an incline, pulled up the slope

Newest entry first. Write each entry so that another reader (or another LLM) with no other context could understand the current state and continue the work.

## 2026-11-21 (incline)

**Summary.** Built the second friction simulation, a copy of `friction_block_string` at 62edb9f with its physics, motion, scene, gauge, panel and harness replaced. Block B on an incline, string up the slope, stops D (bottom) and C (top). Suite 190 pass; harness clean at 800 × 750 and 1280 × 720 including all link probes, and five settled stop states checked by hand.

**Decisions made.**
- Sign convention: + up the slope; at rest f = W sin θ − T. Default θ = 20° (spec 12.1) so T = 0 holds and Part B's four cases (T = 0, small T, T = W sin θ, T = 60 N) all keep B at rest.
- Motion state adds `dir` (+1 up, −1 down) so a slide from rest knows its direction while v is 0; a velocity reversal returns B to rest and is re-checked.
- Stops: static friction first up to μN, the stop takes the excess (same rule as Sim 1). B leaves a stop when the push away from it exceeds μN.
- FBD: one scale for all forces (1.2 units/N); along-slope forces chained tip-to-tail per direction; labels placed by a small search that avoids every arrow's bounding box and every other label (tested over 600 states).
- The wedge and the string are scenery (classes bg, vb): the harness measures bounding boxes, and a diagonal shape's box covers labels that do not touch it.
- The T slider pins to W sin θ (friction exactly zero there).

**Problems encountered.**
- `RAD` declared in three modules broke the one-scope build; one exported constant now.
- The test grid paired every state with both stops, including states where B cannot rest there (it would slide away), which produced impossible printed arithmetic; the grid now keeps only reachable pairs.
- At 40° the handle went off the top (string end moved to L + 20, base line to 255) and B's label left the figure at stop C (it now goes left of the block when there is no room above).
- A rejected-link note pushed the controls to 667 px; gauge and control spacing tightened (controls end at 613 px at 1280 × 720).

**Open questions / next steps.**
- Mutation audit to run and record.
- Publish only on Todd's explicit go-ahead.


## 2026-11-21 (inherited: the block-and-string simulation this repo was copied from)

**Summary.** Built the first of two friction simulations for a PHYS-291 in-class tutorial (Day 37, 2026-12-02), starting from the building-physics-simulations kit (block-on-spring toy, 157 tests green on copy). Block B on a wooden floor, pulled by a string toward a low wall C. Point free-body diagram with stylized arrows; a friction gauge on the tension slider's own scale; a worked calculation per state (at rest, slipping, at the wall with and without a wall force). Suite: 179 tests pass (13 kit tests skip themselves: they need a `snap` field). Harness clean at 800 × 750 and 1280 × 720 (0 violations, sensitivity flagged, budget ok), including the worst wall state (?t=60&mu=0.10, settled). Work is on branch `build`; `main` holds only the kit copy.

**Decisions made.**
- Physics: W = 98.1 N; μ (slider) is the static coefficient; μₖ = ¾ μ fixed. At rest f = T; past μN B slides on μₖN; at the wall, static friction takes the load first up to μN and the wall takes the excess (Todd's rule). No indeterminacy note (Todd).
- The block's history (rest, slip, wall) lives in `src/motion.js`, outside the inputs-only store; `app.js` steps it on animation frames only while B slides. Slide runs in real time (ANIM_SPEED 1, about 1.4–2 s); a time warp of 4 made it 0.35 s, too fast to watch.
- Kit extensions (generic modules, with tests and mutation rows): a dimensionless input (unit '' prints a bare number; aria text "μ = 0.40"; the unit lint accepts a coefficient only after "μ = " or as a "(0.40)" factor); a `pin` (snap to a value computed from the other inputs, here f_max); `createState(initial)` so Reset returns to the link's values.
- Printed forces round half up (`forceText`): 0.50 × 98.1 = 49.05 prints 49.1. f_max = μN always prints "≈" (never exact at 1 decimal); N_C = T − f always "=".
- Layout: one 740 px column (figure, then controls, then calculation); the side-by-side kit layout was dropped so the gauge can sit right above the tension slider. Harness budget changed to "figure and controls end within 650 px; the calculation may scroll" (Todd).
- Images (steel block, oak floor, cotton string) are copies of `friction_tutorial/assets/`, inlined by `build.js` as data URIs; a test checks the copies against the source when that folder exists.

**Problems encountered.**
- The harness flagged labels on shapes: the sky and the small arrows over label letters were measured as graphics (now classes `bg` and `vb`, not measured); "B" moved above the block; N_A and W labels moved clear of their arrows; T and f labels kept 24 units from the vertical arrows; wall C's label moved right of the wall below the string (the string crossed it at the wall).
- `#calc` was clipped by 2 px (a subscript on the last line); 3 px bottom padding.
- The kit's build and mutation tests copy the project without `assets/`; both copy lists now include it (and `dist/` for the mutation engine).

**Open questions / next steps.**
- Mutation audit result to record (running).
- Sim 2 (block on an incline) starts as a copy of this repo.
- Publish only on Todd's explicit go-ahead.

**Sources.**
- Design spec and approved mockups: friction_tutorial/docs/superpowers/specs/ (local only)
- [Close (2005) thesis record](https://digital.lib.washington.edu/researchworks/items/00d8fe84-e5ae-4d43-b9a2-ce483c7d7c8c) (the block-and-string tasks)
- [Lin & Singh (2011)](https://doi.org/10.1063/1.3680042) (students read f ≤ μN as "cannot exceed" only)
