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

## tools/make_scene.py — the editor pipeline

The typical author flow it must serve, end to end:

	draw/paint the HD artwork (e.g. 1024x1024) -> input/x_c.png (~1 MB);
	ComfyUI outpaints it to a canvas (1080p or 2K, author's single choice) -> input/x.png;
	run one command; scene is ready.

	make_scene.py --name 3 [--rect 476,101,1016,900] [--maxw 2048]
	              [--filler-q 28] [--hd-q 85] [--hole remnant|black|full] [--book .]

	inputs  = input/x.ext (outpaint) + input/x_c.ext (original). rect = position of the
	        original inside the outpaint: CV-detected by matching x_c inside x (same
	        matcher as scan.py, direction fixed), or explicit --rect from the ComfyUI
	        workflow. Missing input/x_c.ext → explicit --rect required, hd skipped.
	outputs = img/x.avif (filler), img/x_c.avif (hd), regions.js GENERATED upsert
	        (shared writer tools/regions_writer.py with scan.py).

	filler = the outpaint with the ROI replaced by a "hole", avif at filler-q (low).
	hd     = exact 1:1 crop of the rect, avif at hd-q (high), never rescaled.

### hole strategy (measured, experiments/encode_test.py, real photo outpaint 3.avif)

	KB at q40 / q25, ROI = 40% of canvas:
	  full (no hole)      45 / 24
	  black hole          33 / 18
	  remnant hole (1)    36 / 19
	  blur hole           36 / 19
	  4 tiles L/R/T/D     34 / 18
	(1) ROI replaced by its own 1/16 downscale upscaled — ultra-low-detail "remnant".

	Decision: remnant hole, default.
	  quality is the dominant lever (q40→q25 halves); at real filler qualities black
	  beats remnant by ~1 KB per scene — not worth what black costs: a hard contrast
	  edge the encoder rings around (halo just outside the hd border), and a black
	  rectangle in no-JS / hd-missing fallbacks. Remnant keeps colour continuity under
	  the hd edge and degrades to "blurry but complete" without hd.
	  --hole black for authors who want the absolute floor; --hole full for art where
	  the ROI may stay uncovered (transparent use).
	Rejected, with data:
	  4 tiles: same bytes as black but 4 files, 4 positioned imgs, subpixel crack risk.
	  blur hole: same bytes as remnant but destroys edge colour continuity; and blur is
	  the losing trick from the author's own test — full q25 (24 KB) beats blur q40
	  (36 KB) at a sharper look.
	  single avif, per-region quality: stock AVIF encoders have no ROI quality (gain
	  maps are HDR tone mapping, no browser support). Impossible today.

### policies

	Resolution: ONE resolution per scene (--maxw downsamples; default 2048). Book bytes
	count once; every device stretches; per-device variants multiply weight for nothing.
	The visible quality step at the ROI border is intended: the reader's attention stays
	on the artist's area, the filler reads as filler (author decision).
	Formats: avif primary (all evergreen browsers); png accepted for test scenes.

## tools/scan.py acceptance values

	Verified runs (the acceptance gate):
	  make_scene on the clean photo pair (outpaint + crop) reports
	    x476 y101 w1016 h900, conf >= 0.99 (CV match of crop in pre-compression source).
	  scan on the synthetic pair 1.png + 1_c.png reports
	    x477 y239 w804 h1056, conf 1.00.
	Old draft assets (holed 3.avif etc.) are references only — never build assumptions
	on them; pick clean pairs for experiments.

## experiments/ (node, not loaded by the page)

	layout_test.js        shipped; fuzz-verifies I1/I2/I3 of plan-viewer.md (exit 0).
	encode_test.py        shipped; AVIF byte measurements behind the hole decision
	                      (.venv/bin/python experiments/encode_test.py).
	regions_load.js       (added with implementation) requires regions.js, asserts every
	                      entry has integer x,y,w,h and existing files; proves R5.

## order of implementation (for the fork that executes the plans)

	1 tools/regions_writer.py + scan.py; run over draft/C/img → regions.js; acceptance =
	  the values above (3.avif → 476,101,1016,900).
	2 make_scene.py; run on draft assets; filler size within the encode_test table's
	  range; boundary reads as the intended quality step.
	3 hdregion.js (math out of experiments) + viewer.js + index.html per plan-viewer.md;
	  experiments/layout_test.js requires hdregion.js and stays green.
	4 snowfall-hdregion.js adapter per plan-integration.md; test inside a snowfall page.
	5 move implemented plans to archive/ (AGENTS.md).
