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

## style house rules that bite later (AGENTS.md)

	tabs, LF, no per-frame allocations: the viewer hot path must reuse scratch objects —
	the experiments file already models the pattern (module-level L1/L2).
