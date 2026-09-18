# findings / pitfalls / skills

Verified notes for agents working on this repo. Each item says how it was checked.

## file:// and CORS (platform behaviour; sandbox has no browser — verify once per browser)

	fetch()/XHR from file:// is blocked (opaque origin). JSON sidecars are a dead end.
	classic <script src>, <img>, <link> from the same tree DO load from file://.
	=> region data must ship as a .js manifest, not .json (archive/plan-storage.md).
	<object data="x.svg"> loads but contentDocument is opaque on file:// — the
	CORS_SVG drafts could never work; do not retry that road.
	canvas getImageData on a file:// image taints in Chrome — no metadata-in-image.

## draft scan scripts were inverted (checked by reading code + image dims)

	all archived draft scanner variants used the _c crop as container and the base as
	template; base (1920x1536) can never match inside its crop (804x1056) → always
	None → the "не находит" bug in draft.txt. scan.py additionally returned container
	dims as w/h. Fixes specified in archive/plan-tools.md.

## the draft clamp is NOT the bug (measured, experiments/layout_test.js)

	assumed the edge clamp of 1BBG_hd_pan_zoom-1.htm could clip the region; a 200k-case
	fuzz shows 0 visibility failures and 0 missed covers. The real zoom bug lived in
	the older pan_zoom.htm wheel handler (pivot from view.x alone, base translate
	ignored). Do not rewrite the -1 clamp; keep it and cite the experiment.

## trust the crop, not the notes (measured by parsing headers)

	draft notes say region 768x1024 for 1.png but 1_c.png is 804x1056 (overscan/border).
	3.avif notes 1016x900 == 3_c.avif exactly. => always store the detected crop rect.
	avif dims: scan bytes for the 'ispe' box — no codec needed for tooling checks.

## pip here is PEP-668 managed (observed)

	plain `pip install pillow` refuses; tools must use a venv (archive/plan-tools.md).

## snowfall-core integration (verified by reading snowfall.js, 2026-09 clone)

	shift+wheel is NOT inert: browsers map it to horizontal scroll — any zoom shortcut on
	shift+wheel must preventDefault.
	coreFrame runs only on scroll/resize/refresh: gesture-driven zoom must call
	Snowfall.step() or nothing repaints until the next scroll.
	the engine owns EVERY style on the wagon element (size, margins, transform); an
	integration may only style children of .snow-bg. Wagons are pointer-events:none, so
	all zoom/pan input lives on window-level listeners anyway.
	fixed HUD (the inspect checkbox) must be appended outside #app: the engine measures
	anchors inside its scope.
	never set overflow hidden/scroll/auto on any wagon ancestor to freeze scrolling —
	it traps position:sticky and kills parking. Suspend scroll by preventDefault instead.
	img.naturalWidth is decode metadata, not layout: legal to read in frame(); GBR is not.
	parked wagon = wagons.pos[i]===0 && wagons.free[i]<=0 (same test the events sub uses)
	— how the adapter picks which background a gesture zooms.

## avif filler strategies (measured: experiments/encode_test.py, photo outpaint, ROI 40%)

	KB q40/q25: full 45/24, black hole 33/18, remnant hole 36/19, blur hole 36/19,
	4 tiles 34/18, hd crop q80 45.
	quality is the dominant lever; at real filler q the black-vs-remnant gap is ~1 KB —
	remnant wins on ringing (no hard edge) and no-JS/hd-missing grace.
	blur pre-filter loses to plain quality drop (author's independent test agrees):
	blur q40 = 36 KB and blurry vs full q25 = 24 KB and sharper.
	4 tiles match black on bytes but cost 4 files + positioned imgs + crack risk.
	per-region quality in ONE avif: stock encoders cannot (gain maps = HDR only).
	the visible quality step at the ROI border is an intended attention cue, not a defect.

## implementation lessons (first build-out)

	regions writer must UPSERT: a per-scene make_scene that rewrites the whole GENERATED
	block wipes earlier scenes; scan (full rewrite) and make_scene (upsert) now differ by
	a replace flag.
	CV crop matching fails on compressed or holed bases (conf 0.28 on 3.avif): match in
	the PRE-compression source (make_scene does); scan only works on lossless pairs.
	.venv is snapshot-excluded: rebuild it in every fresh sandbox
	(python3 -m venv .venv && pip install pillow pillow-avif-plugin numpy opencv-python-headless).

## style house rules that bite later (AGENTS.md)

	tabs, LF, no per-frame allocations: the viewer hot path must reuse scratch objects —
	the experiments file already models the pattern (module-level L1/L2).

## snowfall-core viewport policy (plan-snowfall-core-integration.md fix)

	window.innerWidth differs from document.documentElement.clientWidth when a vertical
	scrollbar is present (typically 15px on desktop). Using innerWidth for vw while
	sizing wagons with width:100% (which resolves against clientWidth) creates a
	horizontal coordinate mismatch between engine and adapter.
	=> engine now uses clientWidth for vw (layout viewport, scrollbar-excluded) and
	innerHeight for vh (dynamic viewport, follows mobile URL bars), caches it once per
	measure/scroll, exposes it on Snowfall.viewport, and feeds it to every subscriber
	frame() callback. step() with no args reuses the cached value.
	position:sticky creates a containing block for position:absolute descendants —
	absolutely-positioned child imgs compose correctly with the engine's translate3d
	on the wagon, no extra wrapper needed.

## no-JS vs JS-ready CSS (image sizing)

	.no-js img { max-height:100vh; object-fit:contain } is necessary for readable prose
	before JS runs but FIGHTS explicit pixel width/height/transform written by JS
	(replaced-element sizing overrides; the image appears contained inside a different
	box, making correct math look misplaced).
	=> add a html.snow-ready class immediately when the adapter boots, and scope
	max-width/max-height/object-fit overrides to it. !important is acceptable because
	no other code owns those properties on the controlled children.

## img load listeners in an adapter

	attachEventListener('load', ...) is cheap and only fires once per image. Reading
	img.naturalWidth in frame() is allowed (it is decode metadata, not layout); but
	when the image is not yet decoded naturalWidth is 0 and writing a 0px size/translate
	produces a one-frame flash. Hide the hd img until its load event fires, and seed
	nbW/nbH from already-complete images at attach time. invalidate the last-size cache
	on load and call SF.step() — no rAF needed (coreFrame is synchronous).

## subscriber ordering in snowfall-core

	subscribers are invoked in the order they were use()'d. The built-in wagons subscriber
	is registered immediately inside createCore(), before user subs run, so a user sub's
	frame() sees fully-populated Snowfall.wagons state. No extra ordering assertion needed.

## full-width scope + constrained copy (coordinate contract)

	the minimal fix for nested-background positioning is to make the engine scope (#app)
	full viewport width and place constrained prose in a child wrapper (.copy) with
	max-width/margin:0 auto/padding. The engine's width:100% wagons then resolve to vw,
	matching the adapter's finalLayout(vw,vh,...) output exactly in the horizontal axis.
	No engine changes for per-wagon origin were needed.

## pos-clamp: chain position vs parent bottom boundary (wagonsFrame bug, fixed)

	after chain(), a wagon's pos can stay at 0 (parked) even when the parent #app has
	scrolled entirely past the viewport. stickyShown's cap goes to −∞ in that case,
	so dy = pos − sh grows linearly with scroll, producing translate3d(0, 5800px, 0)
	at sY=10000.  The visual position stays at sh+dy = pos = 0 (viewport top!) — the
	wagon never leaves the screen. Browsers extend the scroll range for large composited
	transforms, creating the "never-ending scroll" symptom.
	Fix: after chain(), clamp W.pos[i] to cap = pBot − sY − ext − mb.  Once the
	parent has scrolled past, pos tracks cap and dy converges to 0 — the wagon just
	follows its sticky position off-screen.  Max |dy| is bounded by ext (the chain's
	maximum push).  Verified: experiments/chain_sim.js, experiments/layout_test.js.

## adapter: no DOM reads in frame() hot path (hdLoaded vs style.display)

	frame() must never read hEl.style.display, hEl.naturalWidth, or
	hEl.naturalHeight — all three are DOM reads that force style recalc.
	Instead: use the hdLoaded[] array flag (set by attachLoad/onImgLoad), and
	nwH[]/nhH[] arrays (populated by attachLoad and invalidated on load).
	The style.display === 'none' check was the primary cause of the HD-region
	not being visible: if the image loaded before the listener was attached (cached
	image race) and h.complete was false at bind time (pending decode), display
	stayed 'none' forever.  The hdLoaded flag is set correctly in both paths:
	(1) cached: attachLoad sets hdLoaded=1 and display='block';
	(2) not cached: load listener sets hdLoaded=1 and display='block'.
	After fix, frame() has zero DOM reads for the HD path (only typed array
	lookups and arithmetic).  The base img still reads naturalWidth/naturalHeight
	(decode metadata, not layout — explicitly allowed in the contract).
