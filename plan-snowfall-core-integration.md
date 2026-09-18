# snowfall-core integration — final architecture

HD-region backgrounds running inside a snowfall-core book. This is the final
contract, good for reimplementation or for forking the engine; it does not
describe what was changed or refer to intermediate states.

Historical follow-up notes are archived in `archive/plan-snowfall-core-integration--followup.md`.
The engine subscriber contract is in `archive/plan-integration.md`.

## coordinate system

The engine scope (`#app`) is the full viewport width. Prose lives in a `.copy`
child wrapper that carries the reading-column constraint (`max-width: 42rem;
margin: 0 auto; padding: 0 1rem`); background wagons are direct children of
`#app` and span the full scope width. This makes the engine's
`width: 100%; height: var(--snow-vh)` wagon box exactly match the viewport
rectangle the HD-region math expects, with no additional origin offset.

The engine owns every style on the `.snow-bg` wagon element (box size, margins,
`transform`). The adapter owns only the two `<img>` children:

- `position: absolute; top: 0; left: 0` within the wagon;
- explicit pixel `width`/`height` and a `translate(x,y)` transform derived from
  `HDRegion.finalLayout(vw, vh, nbW, nbH, r, view, L)`.

`position: sticky` forms a containing block for absolutely-positioned
descendants, so the child's local transform composes rigidly with the engine's
`translate3d(dx, dy, 0)` on the wagon in every state (entering, parked, pushed,
exiting) with no second offset. At park the engine transform is
`translate3d(0,0,0)` and child translate(x,y) in wagon-local space is identical
to viewport space, which is what `finalLayout` computes.

## viewport policy (single source of truth in the engine)

One authoritative `vp = { width, height }` is maintained by the core:

- `vp.width`  = `document.documentElement.clientWidth` — layout viewport width,
  which excludes a vertical scrollbar and matches what `width: 100%` resolves
  against for block-level elements.
- `vp.height` = `window.innerHeight` — dynamic viewport height, which follows
  mobile URL-bar show/hide.

`measureViewport()` updates `vp` and writes `--snow-vh`/`--snow-vw` CSS custom
properties on `<html>`. It is called at the top of `wagonsMeasure()` (before
any subscriber measure runs), at every scroll event (mobile URL-bar changes
fire scroll), and on resize via `refresh()`.

Subscriber `frame(sY, vh, vw)` callbacks always receive these cached values.
`Snowfall.step(sY)` with only `sY` (no vh/vw) reuses the cached `vp`; adapters
do not read `window.innerWidth`/`clientWidth` themselves. The cached viewport
is exposed as `Snowfall.viewport` (read-only).

## JS-ready CSS

The no-JS fallback keeps images readable:

```css
.snow-hd { min-height: 60vh; }
.snow-hd img { display: block; width: 100%; max-height: 100vh; object-fit: contain; }
```

When JS boots, the adapter immediately adds `snow-ready` to `<html>` and the
demo stylesheet enables:

```css
html.snow-ready .snow-hd { min-height: 0; }
html.snow-ready .snow-hd img {
	max-width: none !important; max-height: none !important;
	object-fit: fill !important;
}
```

Without this, `max-height: 100vh` / `object-fit: contain` constrains the
replaced-element box after the adapter writes explicit pixel dimensions, making
correct math look mis-positioned.

## adapter (snowfall-hdregion.js)

Subscriber API: `Snowfall.use({ measure, frame, off })`.

- `measure()` collects `.snow-hd` wagons in scope order, resolves their `REGIONS`
  entries keyed by the base image `src` (normalised: strip query/hash/`./`),
  binds `load` listeners on both `<img>`s, pre-allocates typed arrays
  (wagonIdx, rx/ry/rw/rh, hasR, maxZ, zoom, vx/vy, nbW/nbH, nwH/nhH,
  lastWB/lastHB/lastWH/lastHH, lastSX/lastSY/lastSXH/lastSYH, hdLoaded), and
  grows them on wagon-count increase.
- `frame(sY, vh, vw)` walks wagons; reads `naturalWidth`/`naturalHeight` on the
  BASE image only (decode metadata, not layout — allowed in the hot path); if
  the natural size changed, invalidates size caches; calls
  `HDRegion.finalLayout(vw, vh, nbW, nbH, rgn, view, L)` with a module-level
  scratch `rgn`, `view`, and `L`; writes `width/height/transform` on the base
  and HD imgs only when values change (write-gated). The HD path has **zero
  DOM reads** — it uses `hdLoaded[]` (not `style.display`) and `nwH[]/nhH[]`
  (not `naturalWidth/naturalHeight`). Allocates no objects/arrays/closures/
  strings beyond the transform strings themselves, and only when the value
  changed.
- `off()` clears child img styles for clean engine disable.

The HD `<img>` starts hidden (`display: none`); its `load` listener marks it
loaded, unhides it, invalidates the size cache, and calls `Snowfall.step()`.
Base `<img>` dimensions populate from `complete && naturalWidth` at bind time
so a pre-decoded image (e.g. from cache) is sized on the first frame.

Missing-region / missing-HD: if no `REGIONS` entry exists the fallback treats
the whole base as the "region" and the HD stays hidden (no second `<img>`
src set); if a region exists but declares no `hd`, HD is hidden. No blank
image or broken transform results.

## gesture arbitration

Read mode (default):

- plain wheel → engine scrolls;
- shift+wheel → zoom the parked wagon around the cursor (calls
  `event.preventDefault()` — without this browsers map shift+wheel to
  horizontal page scroll).

Inspect mode (toggle via HUD checkbox or key `i`; `Esc` exits; double-click
resets the active wagon to zoom 1):

- wheel → zoom;
- drag / single-finger → pan;
- pinch → zoom around midpoint;
- `touchmove` is `preventDefault`'d so the page does not scroll while panning;
  no ancestor `overflow: hidden` trick is used (any overflow on a sticky
  ancestor breaks parking).

The active wagon for a gesture is the parked one (`wagons.pos[i]===0 &&
wagons.free[i]<=0`); if no wagon is parked the last wagon with `free<=vh` is
used (a wagon entering or exiting). Gesture handlers never read layout; they
mutate per-wagon `zoom/vx/vy` and call `Snowfall.step()`.

HUD is appended to `<body>` outside `#app` so the engine does not measure it as
an anchor.

## tests

- `node experiments/layout_test.js` — 200k-fuzz proof of hdregion.js invariants
  I1 (region always visible at zoom 1), I2 (cover viewport when possible),
  I3 (zoom pivot preserved pre-clamp).
- `node experiments/regions_load.js` — regions.js sanity (integer fields,
  referenced files exist).
- `node experiments/snowfall-integration-test.js` — integration-specific:
  viewport contract (`vp.width=clientWidth`, consistent across
  `step/refresh/frame` subscribers), HD alignment at zoom 1 and zoom 2 across
  six viewports (portrait, landscape, desktop, ultrawide), missing-region
  fallback, no per-frame object/array allocations in adapter `frame()`, no
  scroll listener or wagon-transform write by the adapter, snow-ready CSS
  overrides present, layout invariants still green.

## engine changes from stock snowfall-0.4

The vendored `vendor/snowfall.js` adds four fixes over upstream 0.4 — these
should be proposed upstream:

1. **Cached viewport.** A single `vp = { width, height }` measured via
   `measureViewport()` is used for `--snow-vh`/`--snow-vw` CSS vars, wagon
   sizing, gap parsing, morph default range, and subscriber `frame()`
   callbacks. `vw = clientWidth; vh = innerHeight`. Adapters no longer need to
   guess about scrollbar or mobile URL-bar policy.
2. **Exposed `Snowfall.viewport`.** Read-only getter on the instance and on
   the default namespace so subscribers and debug tools can read the
   authoritative viewport without duplicating measurement.
3. **`step()` defaults.** Calling `Snowfall.step(sY)` with only a scroll
   position reuses cached `vp` instead of re-reading `window.innerWidth/Height`.
4. **Pos-clamp to parent bottom.** After `chain()`, each wagon's `pos[i]` is
   clamped to `cap = pBot[i] − sY − ext[i] − mb[i]`. Without this, once the
   parent scope scrolls past the viewport the chain position stays at 0
   (parked) while `stickyShown`'s cap goes to −∞, so `dy = pos − sh` grows
   linearly with scroll: the wagon is translated back onto the screen and the
   scroll range inflates ("never-ending scroll"). With the clamp, `pos` tracks
   `cap` past the parent and `dy` converges to 0 — the wagon follows its
   sticky position off-screen. Max |dy| is bounded by `ext` (the chain's
   maximum push). Verified: `experiments/chain_sim.js`.

These are contract cleanups, not a new layout mode. The sticky-chain math,
wagon sizing, and subscriber ordering are unchanged; built-in subscribers
(wagons, morph, events) are registered before user `use()` calls so user
subscribers always see fully-populated state in `frame()`.
