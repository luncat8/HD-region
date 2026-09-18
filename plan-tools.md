# plan-tools — build-time python + node experiments

Build-time only. Nothing here is loaded by the page. Contract for regions.js: plan-storage.md.

## environment

	System pip is PEP-668 externally managed (verified in sandbox: plain `pip install`
	refuses) → tools run from a venv:
		python3 -m venv .venv && .venv/bin/pip install numpy opencv-python pillow pillow-avif-plugin pyperclip
	`.venv/` stays out of git (snapshot ignores it; add to .gitignore if committing locally).
	pyperclip optional: import in try/except, clipboard is a convenience, not a dependency.

## tools/scan.py  (rewritten from draft/C/img/scan*.py)

Walks the book dir for `stem_c.ext` crops, matches each crop inside its base image,
rewrites the GENERATED block of regions.js.

	Fix 1 — direction. Every draft scan searched the BASE inside the _c crop
	        (container=_c, template=base) → template larger than container → always
	        "Not found!" (the "баг в поиске файлов" of draft.txt). Correct: container =
	        base `stem.ext`, template = crop `stem_c.*`.
	Fix 2 — size. draft scan.py returned the CONTAINER dims as w/h. Correct: w/h =
	        template (crop) size; x/y = match location in the container.
	Keep  — avif via PIL (pillow-avif-plugin) → numpy → cv2 BGR, since cv2.imread
	        cannot decode avif (scan.py had this right).
	Keep  — TM_CCOEFF_NORMED; warn < 0.95, reject < 0.8.
	Keep  — skip animated webp (PIL n_frames > 1, cheaper than cv2.VideoCapture).
	Change— animated check and pairing accept mixed extensions (1.png + 1_c.webp ok).

	Pairing: for each file whose stem ends `_c`: base = same dir, stem without `_c`,
	         any supported extension (prefer same). No base → warn, skip.
	Output:  key  = base path relative to book root, POSIX slashes;
	         line = REGIONS['key'] = { x, y, w, h, hd: 'crop relpath', bw, bh }; // from crop conf=0.99
	         rewrite between GENERATED-BEGIN/END markers, MANUAL block byte-preserved;
	         create regions.js from the plan-storage template when absent;
	         entries sorted by key for stable diffs; also copy block to clipboard.

	`--check` mode: parse existing GENERATED entries, verify files exist, bw/bh still
	match, re-match confidence still >= 0.8; print a report, change nothing. This is
	the drift detector for editors who re-exported art.

## tools/make_region.py

Assembles a scene from an outpainted SOURCE image + a rect (x,y,w,h in source pixels):

	base = SOURCE, but outside the rect replaced by a heavy gaussian blur, blended over
	       a ~300 px feather built with cv2.distanceTransform (the proven technique of
	       draft/C/img/b.py). This is what makes the hd seam invisible (plan-viewer.md).
	hd   = exact 1:1 crop of the rect from SOURCE (no rescale).
	then appends/updates the GENERATED entry (same writer as scan.py — one shared
	function `write_regions(book, entries)` in tools/regions_writer.py, no duplication).

	Editor path: outpaint elsewhere (any tool) → drop source → run make_region with the
	rect → done. Or drop base+_c pair made by hand → scan.py finds the rect.

## experiments/ (node, not loaded by the page)

	layout_test.js        shipped; fuzz-verifies I1/I2/I3 of plan-viewer.md (exit 0).
	regions_load.js       (added with implementation) requires regions.js, asserts every
	                      entry has integer x,y,w,h and existing files; proves R5.

## order of implementation (for the fork that executes the plans)

	1 tools/regions_writer.py + scan.py; run over draft/C/img → regions.js; compare with
	  known values (3.avif → 476,101,1016,900) as acceptance test.
	2 make_region.py; regenerate a base from 3_full.avif to prove seamlessness visually.
	3 viewer.js + index.html per plan-viewer.md; run experiments before and after.
	4 move implemented plans to archive/ (AGENTS.md).
