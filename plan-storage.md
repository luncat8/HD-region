# plan-storage — where region properties live

Final plan. Reimplementable from this file alone; drafts in `draft/` are background only.

## problem

The book is static files opened from `file://` (no server, no build, no modules — see AGENTS.md).
Every background image is an outpainted canvas; the viewer needs, per image, the rectangle of the
original artwork inside that canvas (`x, y, w, h` in base-image pixels) and optionally the path of
a hi-res crop (`hd`). This data must be:

	R1 readable by the page under `file://` in Chrome/Firefox/Safari (no CORS failure);
	R2 editable by book editors (humans) in any text editor, with comments;
	R3 rewritable by the Python scan/generate tools without destroying human edits;
	R4 synchronous at page load, so the very first paint is already positioned;
	R5 usable by node (experiments/tests), not only by the browser;
	R6 one place per book, scalable to many images and subfolders.

## data model (shared by all plans)

	img/scene.avif     outpainted, compressed full background ("base")
	img/scene_c.avif   sharp 1:1 crop of the original region ("hd")

A region entry = position and size of the crop inside the base, in base pixels.
`w/h` are the *detected crop* dims in base coordinates — not hand-typed numbers
(draft `1_c.png` is 804x1056 while notes said 768x1024; trust the crop, not the note).
`hd` is stretched over exactly that rect; its own pixel size may differ (still usually 1:1).

## candidates examined

	script src .js manifest   R1 yes — classic <script> is exempt from CORS; same-folder
	                          subresources load from file:// in all three browsers.
	                          R2 yes (comments, plain numbers). R3 yes (markers, below).
	                          R4 yes (synchronous). R5 yes (module.exports guard).  -> CHOSEN

	fetch('regions.json')     R1 NO: fetch/XHR from file:// is blocked (opaque origin).
	                          Killed by R1 alone.

	<img>/<object> SVG sidecar  R1 loads but unreadable: file:// makes the SVG document
	                          opaque, contentDocument/fetch blocked (this is exactly the
	                          dead end the CORS_* drafts hit). Inline SVG works but puts
	                          data inside markup (R2/R3 poor, one scene per edit).

	metadata in the image     R1 NO: needs fetch+parser or canvas getImageData; file://
	                          images taint canvas in Chrome. Also R2 NO (hex editor).

	coords in file names      R1 yes, R2 barely: no comments, renaming breaks links,
	                          precision edits are painful. Rejected.

	localStorage / url hash   opaque origins on file://, first-run empty. Rejected.

## decision

One generated classic script per book: `regions.js`, next to `index.html`, loaded before
`viewer.js`:

	<script src="regions.js"></script>
	<script src="viewer.js"></script>

### file format (exact contract)

	/* regions.js — scene region data for this book.
	   GENERATED part: rewritten by tools/scan.py. Do not edit it.
	   MANUAL part:    editors edit here; the generator preserves it byte-for-byte.
	   Fields (base-image pixels): x y w h  [hd]  [bw bh]  [title]  [maxZoom]
	   bw/bh = natural size of the base at scan time (drift detection). */
	var REGIONS = window.REGIONS = window.REGIONS || {};

	/* ===== GENERATED-BEGIN (tools/scan.py) ===== */
	REGIONS['img/1.png']   = { x: 512, y: 256, w: 768,  h: 1024, hd: 'img/1_c.png',  bw: 1920, bh: 1536 }; // from 1_c.png conf=0.99
	REGIONS['img/3.avif']  = { x: 476, y: 101, w: 1016, h: 900,  hd: 'img/3_c.avif', bw: 1984, bh: 1152 }; // from 3_c.avif conf=1.00
	/* ===== GENERATED-END ===== */

	/* ===== MANUAL-BEGIN ===== */
	/* Editors: override anything above, e.g.
	   REGIONS['img/3.avif'].maxZoom = 2;
	   REGIONS['img/3.avif'].title = 'Warehouse';
	   SCENES = ['img/1.png', 'img/3.avif'];   // custom order / subset; default = key order
	*/
	/* ===== MANUAL-END ===== */

	if (typeof module !== 'undefined') module.exports = { REGIONS: REGIONS, SCENES: typeof SCENES !== 'undefined' ? SCENES : null };

### rules

	1 key = POSIX path relative to index.html, any depth. The viewer must look up by that
	  full relative path (decoded, query/hash stripped) — never by basename
	  (drafts' `src.split('/').pop()` breaks with subfolders).
	2 generator rewrites only between GENERATED markers; MANUAL block is copied through.
	  Later assignments win, so manual lines override generated ones.
	3 SCENES (optional, manual) fixes order/subset; default `Object.keys(REGIONS)`.
	4 missing entry → viewer treats the whole image as the region (contain) and
	  console.warns: a forgotten image still shows, never a black screen.
	5 bw/bh mismatch at load → console.warn "image changed since scan", keep the rect
	  (guessing a rescale would hide real errors from the editor).
	6 no JSON.parse, no async, no promises: data exists when viewer.js starts (R4).

### editor workflow

	add image pair (scene.ext + scene_c.ext) anywhere under the book;
	run tools/scan.py once → GENERATED part updated, MANUAL part untouched;
	optional human polish inside MANUAL (titles, order, zoom caps);
	open index.html from disk. No HTML edit ever needed for new art.

### why not alternatives inside the chosen idea

	one .js per image      file:// cannot glob; the page needs an index anyway;
	                       editors would juggle N files instead of 1.
	json wrapped in script adds a parse step and kills comments for no gain.

## migration from drafts

`originals['1.png'] = { x:.., y:.., w:.., h:.. };` lines already produced by draft scan
scripts are the exact generated-line shape; rename the global to REGIONS, add hd/bw.

## verification

	node -e "console.log(require('./regions.js').REGIONS)" must print the table (R5).
	Browsers: the one-time probe below; sandbox has no browser, so this is a documented
	platform behaviour, not a sandbox-measured fact — run once per target browser:
	open a file:// page containing <script src="regions.js"> and a line that writes
	Object.keys(REGIONS).length into the body; expect the count, zero console errors.
