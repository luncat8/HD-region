# plan-snowfall-core-integration — investigate and fix image positioning

Active follow-up for `snowfall-hdregion.js` and `snowfall-demo.html`. The goal is to
make the base image and its HD crop share one correct screen-space composition while
the snowfall-core wagon enters, parks, is pushed, and exits.

The completed engine contract is in `archive/plan-integration.md`. The standalone
layout math remains in `hdregion.js` and is covered by
`experiments/layout_test.js`; do not create a second layout algorithm in the adapter.
The historical proposal is reviewed in
`archive/draft/proposed-improvements-review.md`.

## problem and constraints

The demo currently places the wagons inside a centered, narrow `#app` (`max-width:
42rem`). snowfall-core sets each wagon's width to `100%`, so that width is the `#app`
content width, not the browser viewport width. The adapter, however, calls
`HDRegion.finalLayout()` with `window.innerWidth` and `window.innerHeight`, then writes
those viewport-space `x/y` values as transforms on absolutely positioned images whose
containing block is the wagon.

This creates two coordinate systems. At a parked position the likely horizontal error
is the wagon's left offset from the viewport; while the wagon is entering or leaving,
its local top also differs from the viewport top. The engine's transform on the wagon
then composes with the adapter's child transform. This is the primary hypothesis, not
a reason to change the proven `hdregion.js` math: prove the origin mismatch with actual
rects before selecting the fix.

Constraints:

- keep `vendor/snowfall.js` engine-owned wagon sizing, margins, sticky positioning, and
  transform; the adapter may style only children of `.snow-hd`;
- retain a file://-friendly classic-script/no-build runtime;
- preserve normal reading scroll, wagon chaining, the shift+wheel arbitration, and the
  inspect gesture mode;
- do not use ancestor `overflow` to freeze scrolling, and do not add layout reads or
  allocations to the subscriber frame path;
- the base and HD child must be positioned from the same region rect and scale, with
  no independent crop-specific offset.

## Core review: prerequisites that can block the fix

The current vendored core is usable, but its public geometry contract is too implicit
for a nested background integration. The adapter currently receives `window.innerWidth`
and `window.innerHeight` from `coreFrame()`, while `wagonsMeasure()` gives a normal wagon
`width:100%` and that percentage resolves against the wagon's parent. A vertical page
scrollbar can also make `window.innerWidth` differ from the actual CSS content width.
The plan must choose one authoritative viewport policy and use it in wagon sizing,
`frame(sY, vh, vw)`, `step()` defaults, and adapter math. For the current layout a
reasonable policy is the layout viewport width (`document.documentElement.clientWidth`)
and the engine's chosen dynamic viewport height; do not mix `clientWidth` and
`innerWidth` accidentally.

The demo has a second independent integration hazard: its no-JS rule
`.snow-hd img { max-height:100vh; object-fit:contain }` remains active after the adapter
writes explicit pixel dimensions. A base image taller than the viewport can therefore
be constrained or redrawn inside a different replaced-element box, making correct
math look incorrectly positioned. JS-ready styles must explicitly remove `max-width`,
`max-height`, and `object-fit` constraints from the two controlled children while
leaving the no-JS fallback intact.

Recommended core improvements, in priority order:

1. Expose/cache one viewport `{ width, height }` measured by the core and use it for
   wagon CSS and subscriber callbacks. Make `Snowfall.step()` with no arguments reuse
   that cached value. This prevents every adapter from re-solving scrollbar and mobile
   viewport policy independently.
2. Document subscriber ordering: built-in wagon measurement must run before external
   subscribers that consume `Snowfall.wagons`. Add a small ordering assertion or test
   if the public `Snowfall.use()` API is kept.
3. If constrained reading columns are a supported use case beyond this demo, add a
   first-class engine-owned full-bleed/viewport wagon mode that reports its local
   origin. Do not make every adapter read a transformed wagon's rect during `frame()`
   or override engine-owned margins and transforms. This can remain out of scope if
   the book contract requires all background wagons to be direct children of a
   full-width snowfall scope.
4. Keep the existing `wagons` typed-array state and sticky-chain math unchanged until
   geometry evidence requires otherwise. Neither the region clamp nor sticky chain is
   the likely cause of this defect.

These are contract improvements, not a reason to duplicate layout math in the core.
The standalone invariants remain the authority for region scale, clamp, and zoom pivot.

## 1. Reproduce and instrument the geometry

Use the current demo and the synthetic fixture with visible colored borders before
changing layout or math. Test both the demo's narrow centered `#app` and a temporary
full-width scope.

At each state capture, for every wagon:

- viewport size and `window.scrollY`;
- `Snowfall.wagons.y/free/pos/ext` and the wagon's computed width/height/transform;
- wagon `getBoundingClientRect()` and the base/HD child rects;
- the region entry, natural base dimensions, and the `finalLayout()` result;
- whether the wagon is entering, parked (`pos === 0 && free <= 0`), pushed, or exiting.

Rect reads belong in a debug harness or measurement callback only, never in
`snowfall-hdregion.js:frame()`. A temporary `?debug=1` overlay/log is preferable to
permanent console noise. Compare the expected screen-space rectangle from `L` with the
actual child rectangles. For a parked wagon, the expected base left/top are `L.x/L.y`
and the expected HD rect is `L.x + r.x*L.s`, `L.y + r.y*L.s`; record the residual
against those values rather than judging only by the photograph.

Reproduce at least these viewport/scope combinations:

- 1280x720 and 1440x900 with the current centered `#app`;
- 360x780 and 768x1024 for narrow/tall behavior;
- 2560x1080 for ultrawide behavior;
- first paint, scroll into each wagon, parked, forward push, reverse scroll, and
  scene-to-scene transition;
- base-only, HD-loaded, and a deliberate missing-HD fallback.

The colored synthetic scene must show the crop border and the full base region. Do not
mistake the intentional low-quality/black-hole fixture for a positioning failure: the
HD border, not image detail, is the alignment oracle.

## 2. Establish the coordinate contract

Document the desired visual behavior for each wagon state:

- before parking, whether the image follows the wagon's flow position or is already
  viewport-composed;
- while parked, the region is centered/contained exactly as standalone mode;
- while pushed or exiting, the child remains rigidly attached to its wagon and does not
  acquire a second scroll translation;
- the HD crop remains exactly over the corresponding base pixels in every state.

Then choose one origin and use it consistently:

1. **Preferred minimal integration fix:** make the snowfall scope full viewport width and
   put the readable copy in a separate constrained child. In the demo, `#app` remains
   the engine scope but becomes full width; a `.copy` wrapper receives the `42rem`
   max-width, while `.snow-bg` wagons are direct full-width children. The engine's
   existing `width:100%` then has the same horizontal coordinate system as the adapter's
   `vw`. Keep the adapter's child transforms local to the wagon and leave wagon styles
   to the engine.
2. **If nested/constrained wagons are a required public use case:** extend the engine
   integration contract rather than guessing in the adapter. Provide a documented
   viewport-wide wagon mode or a cached wagon origin supplied during measurement. The
   adapter must convert the `HDRegion` viewport layout to wagon-local coordinates using
   that contract; it must not call `getBoundingClientRect()` from `frame()` and must
   not fight engine-owned `width`, margins, or transform.
3. **Only if state captures show a vertical requirement:** define how the engine's
   sticky transform and the child's local position compose for entering/exiting wagons.
   Prefer an engine-provided local frame/offset over a second scroll listener. Do not
   make a child `position:fixed` under a transformed wagon without testing its containing
   block behavior.

Do not change the layout clamp or zoom pivot until the origin comparison proves a math
error. The standalone invariants are already green; any new math must remain a pure
function and receive a focused test before it reaches the adapter.

## 3. Implement the smallest fix

Apply the selected contract in this order:

1. make the core's viewport source explicit and consistent, or add the smallest
   engine-owned viewport/bleed capability required by the evidence;
2. restructure `snowfall-demo.html` so prose width and wagon width are independent;
3. add a JS-ready child-image style that removes the no-JS `max-height`/`object-fit`
   constraints before the adapter writes explicit pixel dimensions;
4. update the adapter only where its coordinate assumptions require it;
5. keep the region lookup keyed by the base image path and keep the optional HD fallback;
6. remove any temporary debug instrumentation after the acceptance run, or keep it
   behind an explicit debug flag;
7. while touching the frame path, reuse a preallocated region/scratch object instead of
   constructing a `{x,y,w,h}` object for every wagon on every frame, and remove any
   other unnecessary frame-path work. Do not trade positioning correctness for a
   premature optimization.

The adapter's effective contract should be explicit in its header and in the demo:
engine owns the wagon box and transform; HD-region owns the two child image boxes and
local transforms; both use one viewport/local-origin definition.

## 4. Add regression coverage

Extend the repository's dependency-free checks with an integration geometry test or a
small deterministic harness. It must cover:

- narrow centered scope versus full-width scope, including the measured origin offset;
- a viewport with a vertical scrollbar, proving the chosen `clientWidth`/`innerWidth`
  policy is used consistently by the core, wagon, and adapter;
- base and HD rect alignment at zoom 1 and at a non-default zoom;
- computed JS-ready styles do not retain `max-height`/`object-fit` constraints;
- portrait, landscape, and ultrawide viewports;
- the four wagon states and reverse scroll;
- missing region/HD behavior without a blank image;
- no mutation of wagon `style.transform` by the adapter;
- no extra frame-time layout reads, and no new per-frame object/array/closure
  allocations.

If the engine needs a public viewport-wide mode, test that mode through the same harness
and keep the existing snowfall-core tests green. Avoid making the test depend on timing
or a particular browser's fractional-pixel rounding; use a 1px tolerance for rendered
rect comparisons and assert the crop/base edge residuals independently.

## 5. Browser acceptance checklist

Run the node checks first:

- `node experiments/layout_test.js`
- `node experiments/regions_load.js`
- `node experiments/snowfall-integration-test.js` (add this or use the final agreed
  test filename)

Then open `snowfall-demo.html` through file:// and through a static server. Verify in a
current desktop browser and a touch/emulation viewport:

- both scenes place their HD crop exactly over the base region on first paint;
- the region is visible at zoom 1 in every orientation and the viewport is covered when
  the geometry allows it;
- parked zoom follows the cursor; inspect pan/pinch follows the pointer/midpoint;
- ordinary wheel scroll remains reading scroll, shift+wheel does not create horizontal
  page scroll, and the inspect checkbox works without a mouse;
- entering/pushing/exiting and reverse scrolling do not introduce a jump or a second
  offset; text and unrelated wagons remain stationary relative to the engine;
- delayed base/HD loads, scene changes, resize/orientation changes, and missing HD all
  recover without stale transforms;
- no ancestor overflow workaround, console error, or repeated idle style churn appears.

Record the final coordinate contract in the active plan and keep the completed engine
plan in `archive/` once the implementation and checks are accepted.
