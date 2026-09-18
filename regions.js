/* regions.js — scene region data for this book.
   GENERATED part: rewritten by tools (scan.py / make_scene.py). Do not edit it.
   MANUAL part:    editors edit here; the generator preserves it byte-for-byte.
   Fields (base-image pixels): x y w h  [hd]  [bw bh]  [title]  [maxZoom] */
var REGIONS = typeof window !== 'undefined'
	? (window.REGIONS = window.REGIONS || {})
	: {};

/* ===== GENERATED-BEGIN (tools) ===== */
REGIONS['img/1.avif'] = { x: 477, y: 239, w: 804, h: 1056, hd: 'img/1_c.avif', bw: 1920, bh: 1536 }; // rect=match conf=1.00
REGIONS['img/3.avif'] = { x: 476, y: 101, w: 1016, h: 900, hd: 'img/3_c.avif', bw: 1984, bh: 1152 }; // rect=match conf=0.99
/* ===== GENERATED-END ===== */

/* ===== MANUAL-BEGIN ===== */
/* Editors: override anything above, e.g.
   REGIONS['img/3.avif'].maxZoom = 2;
   SCENES = ['img/1.avif', 'img/3.avif'];   // custom order / subset; default = key order
*/
/* ===== MANUAL-END ===== */

if (typeof module !== 'undefined') module.exports = { REGIONS: REGIONS, SCENES: typeof SCENES !== 'undefined' ? SCENES : null };
