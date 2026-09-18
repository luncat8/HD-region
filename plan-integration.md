# plan-integration — HD regions inside snowfall-core

Final plan. Facts about the engine are verified against snowfall-core `snowfall.js`
(commit of 2026-09 clone): subscriber API `Snowfall.use({measure, frame, off})`,
`inst.step(sY,vh,vw)`, `inst.wagons = {n, els, y, free, pos, ext, dir}`, engine-owned
wagon box (`width:100%; height:var(--snow-vh)` for cover/contain), engine-owned margins
and `transform`, wagons `pointer-events:none; z-index:-1; position:sticky`, scope `#app`,
synchronous passive scroll handler (no rAF), `frame()` must not read layout or allocate.

## module split (single source of truth for the math)

	hdregion.js            DOM-agnostic core: layout/zoom math (the functions proven by
	                       experiments/layout_test.js), gesture math, per-scene view state.
	                       require()-able in node (module.exports guard), zero DOM at load.
	viewer.js              standalone wrapper: window gestures + Next button + preload
	                       (plan-viewer.md). QA page and books without snowfall.
	snowfall-hdregion.js   thin adapter: Snowfall subscriber + gesture arbitration with
	                       the engine + inspect HUD. This plan.

All three are classic `<script>` tags, loaded after `regions.js`; the adapter after
`snowfall.js`. No duplication of math (AGENTS).

QA surface in this repo: `vendor/snowfall.js` (vendored engine copy, node-requireable)
and `snowfall-demo.html` (prose + two .snow-hd wagons) — open via the static server or
file:// to exercise the arbitration in a real browser.

## authoring markup (book page)

	<div class="snow-bg snow-hd" data-gap="100vh">
		<img src="img/3.avif" alt="Warehouse">
		<img src="img/3_c.avif" alt="" aria-hidden="true">
	</div>

	first img = base, second = optional hd crop. Region data comes from REGIONS keyed by
	the base src (plan-storage lookup rules). No new data-* needed; humans write two tags.
	The wagon div itself stays 100% engine-owned: the adapter never writes the wagon's
	style (size/margins/transform are the engine's), only the two child imgs.
	The engine sizes the wagon to vw x vh and translates it rigidly with the text, so the
	fit math runs against (vw, vh) exactly as in the standalone viewer; composition with
	the engine's translate is free (children inherit it).
	no-JS: book stylesheet carries
		.snow-hd{min-height:100vh} .snow-hd img{width:100%;height:100vh;object-fit:contain}
	so the page still shows a contained picture; with JS the adapter overrides sizes.

## subscriber contract

	measure():  collect .snow-hd wagons + their imgs (in #app scope order), resolve
	            REGIONS entries, (re)allocate typed arrays zoom/vx/vy + last-write caches.
	            Image natural sizes are NOT layout: reading naturalWidth is allowed
	            anywhere; a 'load' listener only sets a dirty flag and calls Snowfall.step().
	frame(sY,vh,vw): for each wagon run hdregion layout with that view state; write child
	            img width/height only when s changed, translate on change (write-gated like
	            the engine). No layout reads, no allocations (scratch objects at module load).
	off():      clear child img styles.

	Gestures mutate state, then call Snowfall.step() — coreFrame does not run on its own
	without a scroll, and step() is the sanctioned manual-frame API.
	Target wagon for a gesture = parked one (pos[i]===0 && free[i]<=0) read from
	inst.wagons typed arrays; fallback the last i with free[i] <= sY-based visible test
	from cached y/ext (no layout reads in handlers either).

## gesture arbitration (the shortcuts)

Read mode (default; the page is for reading):

	wheel            page scroll — engine
	shift+wheel      zoom the parked background around the cursor (preventDefault!
	                 without it browsers map shift+wheel to HORIZONTAL scroll)
	everything else  engine / text selection (wagon is pointer-events:none anyway)

Inspect mode (for examining the art; the checkbox exists for no-mouse devices):

	toggle: checkbox in a fixed HUD + key "i"; Esc or uncheck exits; double-click /
	        double-tap resets zoom to 1
	wheel / shift+wheel   zoom around cursor
	drag / one finger     pan
	pinch                 zoom around midpoint
	page scroll suspended while on: window listeners preventDefault wheel + touchmove
	        (do NOT set overflow on html/ancestors — any overflow hidden/scroll/auto on a
	        wagon ancestor traps position:sticky and kills the engine, snowfall finding)
	keyboard paging still scrolls; accepted, the mode is user-chosen

HUD checkbox element is appended to <body> OUTSIDE #app (engine collects from #app; fixed
panels inside would be measured as anchors — snowfall layout contract).

Zoom clamps [1, maxZoom] from REGIONS entry (default 4); pan clamp = the proven
finalLayout ranges (region visible at zoom 1, cover when possible).

## what the engine must NOT be asked to do

	No changes to snowfall.js: everything fits the public subscriber API. If a future
	engine feature is wanted (e.g. engine-driven "parked" event routed to us), that is a
	snowfall-core plan 0.5 over there, not a fork here.
	data-dir lateral/bottom exits: zoom state per wagon just rides along; when a wagon
	exits, its imgs exit with it. Nothing special.

## verification

	node: require hdregion.js, run experiments/layout_test.js against it (math moved from
	      the experiment's local copy into the module; experiment keeps asserting).
	browser file://: scroll a two-wagon page; shift+wheel on the parked wagon zooms about
	      the cursor while the OTHER wagon and the text stay put; unzoom resets; checkbox
	      on a touch emulation pans/zooms without page scroll; reverse scroll after zoom
	      shows the same transform (pure function of state); engine diagnostics show no
	      extra writes from the adapter while idle.
