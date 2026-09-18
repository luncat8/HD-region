# plan-viewer — the runtime page

Final plan. Base draft: `draft/C/1BBG_hd_pan_zoom-1.htm` (the most complete one).
Storage contract: `plan-storage.md`. Tooling: `plan-tools.md`.

## scope

	shows one scene at a time: base image + hd crop overlay on the region rect;
	region fully visible at any viewport/orientation, aspect kept;
	outpaint shown as far as it exists, never a black gap when avoidable;
	pan (drag / one finger), zoom (wheel / pinch) between 1 and maxZoom (default 4),
	zoom pivots on the cursor / pinch midpoint;
	Next button cycles SCENES;
	fallback without JS; file://, no build, no modules, vanilla ES5-ish.

Non-scope (deliberate, add later if wanted): inertia, double-tap zoom, keyboard,
deep links, transitions between scenes, tiles.

## files

	index.html   markup + css only
	viewer.js    all logic, classic script
	regions.js   data (plan-storage.md)

DOM:

	<img id="bg" class="background" src="">        z-index 1
	<img id="bg_hd" class="background" alt="" aria-hidden="true">   z-index 2
	<button id="nextButton" type="button">Next</button>

css essentials (draft -1 keeps these):

	.background { position: fixed; top:0; left:0; transform-origin: 0 0;
	              pointer-events: none; user-select: none; -webkit-user-drag: none; }
	body.js-ready { touch-action: none; }          /* page never scrolls or rubber-bands */

no-JS fallback: without JS, `body:not(.js-ready) .background { width:100%; height:100%;
object-fit: contain; }` so the bare page still shows a sane contained image
(drafts left the no-JS img unsized — fixed here).

## layout math (kept from draft -1, now proven)

baseLayout:  s = min(vw/r.w, vh/r.h) * zoom        /* region contain */
             image w/h = natural * s
             tx,ty center the region rect in the viewport

finalLayout: pan view.x/view.y added, then per axis:
             if image > viewport  clamp pos to [viewport - image, 0]
             else                 center image

Verified in `experiments/layout_test.js` (node, 200k random scenes + repo assets):

	I1 region fully visible at zoom 1 — always (0 failures);
	I2 viewport covered (no black gap) whenever geometrically possible (0 missed);
	I3 zoom pivot exact (pre-clamp); at borders the edge clamp may shift the visible
	   pivot — accepted, same as any map viewer.

So the clamp order of draft -1 is NOT a bug — do not "fix" it. Letterboxing
(ultrawide vs tall region) is correct: visibility outranks coverage.

Zoom pivot (kept from -1, this is the fix for the older pan_zoom.htm whose wheel
handler computed the cursor point from view.x alone, ignoring the base translate —
the "shifted left / wrong scale after gesture" bug from draft.txt):

	old = finalLayout(zoom)
	imagePoint = (screen - old.x) / old.s
	view.x = screenX - newBase.tx - imagePoint * newS     (y likewise)
	zoom clamped to [1, maxZoom] before solving

## input and hot path (AGENTS style: no allocations per frame)

	Pointer Events only (draft pan_zoom.htm wired mouse AND touch, applying pan twice
	on some devices — removed). One pointerdown/move/up/cancel set + Map of pointers;
	pinch = two pointers, pivot = midpoint, factor = dist/startDist.
	wheel: factor = exp(-deltaY * 0.001), pivot = cursor (kept from -1).
	Render is dirty-flag + one requestAnimationFrame: input events set `dirty`,
	the rAF callback runs finalLayout once and writes styles.
	Preallocate: module-level scratch objects L1/L2 (as in experiments), a Map for
	pointers created once, no object literals / arrays / template strings built per
	event except the two style strings written on change; skip style writes when
	values are unchanged.

style writes (both images, same transform family):

	bg:    width/height = natural * s ; transform: translate(x,y)
	bg_hd: width/height = r.w*s, r.h*s ; transform: translate(x + r.x*s, y + r.y*s)
	write width/height only when s changed; translate every dirty frame.

## hd overlay and the seam

	Hard fact: a sharp crop over a compressed base shows a visible rectangular seam.
	Runtime masking costs a filter and cross-browser mask quirks — rejected.
	Chosen: the seam is removed at BUILD time (plan-tools.md): the base image is
	stored already blurred outside the region with a ~300px distance-transform
	feather (technique proven in draft/C/img/b.py), so the hd edge lands on a smooth
	gradient and disappears. The viewer itself stays mask-free.
	hd load is lazy and cached: set src only when the key changes (dataset.src guard
	from -1 kept); until loaded, the base shows through.
	hd aspect is trusted from the region rect; the rect came from the crop itself
	(plan-storage), so ratio mismatch cannot happen for scanned pairs.

## scene switching and resilience

	next: view reset (zoom 1, pan 0), hd hidden, src swapped on load event;
	      preload next scene's base+hd with new Image() for instant Next.
	lookup by full relative path (plan-storage rule 1), decodeURIComponent,
	      strip location query/hash.
	missing entry → whole-image contain + console.warn (plan-storage rule 4).
	bw/bh mismatch → console.warn only (rule 5).
	resize + visualViewport resize/zoom → dirty flag.
	cached-image race: if (img.complete && img.naturalWidth) render once (kept).

## bugs of the drafts, resolved here (traceability)

	1B/1BB        50%-plus-translate stacking, region-vs-viewport aspect pick — replaced
	              by baseLayout/finalLayout.
	pan_zoom.htm  wheel pivot ignored base translate; dual mouse+touch pan; per-frame
	              object litter — replaced as above.
	-1            kept as the core; additions: path-correct lookup, no-JS sizing,
	              rAF/dirty render, pointer-only input, seam strategy, fallbacks.
	all drafts    data lived inside the html — moved to regions.js (plan-storage.md).

## verification

	node experiments/layout_test.js → exit 0 (I1/I2/I3 PASS).
	Manual browser checklist, opened via file:// (Chrome + Firefox + Safari):
	  first paint correct before any event; rotate phone → region intact;
	  wheel on a corner of the region → that corner stays under the cursor;
	  pinch midpoint pivot; drag to edge → no black gap while coverable;
	  ultrawide window → symmetric side letterbox, region intact;
	  Next cycles, hd appears sharp without visible seam on 3.avif;
	  image without entry → contained with a console warn, not blank;
	  JS disabled → contained image; console free of CORS/network errors.
