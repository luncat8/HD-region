# findings / pitfalls / skills

Verified notes for agents working on this repo. Each item says how it was checked.

## file:// and CORS (platform behaviour; sandbox has no browser — verify once per browser)

	fetch()/XHR from file:// is blocked (opaque origin). JSON sidecars are a dead end.
	classic <script src>, <img>, <link> from the same tree DO load from file://.
	=> region data must ship as a .js manifest, not .json (plan-storage.md).
	<object data="x.svg"> loads but contentDocument is opaque on file:// — the
	CORS_SVG drafts could never work; do not retry that road.
	canvas getImageData on a file:// image taints in Chrome — no metadata-in-image.

## draft scan scripts were inverted (checked by reading code + image dims)

	all of draft/{C/img,D}/scan*.py used the _c crop as container and the base as
	template; base (1920x1536) can never match inside its crop (804x1056) → always
	None → the "не находит" bug in draft.txt. scan.py additionally returned container
	dims as w/h. Fixes specified in plan-tools.md.

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

	plain `pip install pillow` refuses; tools must use a venv (plan-tools.md).

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
