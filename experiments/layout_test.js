#!/usr/bin/env node
/*
	layout_test.js — fuzz-verifies the math hdregion.js ships (single source).

	  I1  at zoom 1 the original region is ALWAYS fully inside the viewport;
	  I2  the viewport is covered (no black gaps) whenever covering is
	      geometrically possible without breaking I1;
	  I3  zoomAround keeps the image point under the cursor fixed pre-clamp
	      (at edges the clamp may shift it, by design).

	Run: node experiments/layout_test.js   (exit 0 = all invariants hold)
*/

'use strict';

var H = require('../hdregion.js');

function regionVisible(vw, vh, r, L) {
	var e = 1e-6;
	var x0 = L.x + r.x * L.s, y0 = L.y + r.y * L.s;
	return x0 >= -e && y0 >= -e &&
		x0 + r.w * L.s <= vw + e && y0 + r.h * L.s <= vh + e;
}

/* does ANY placement exist that covers the viewport and keeps region visible? */
function coverPossible(vw, vh, r, L) {
	if (L.w < vw - 1e-9 || L.h < vh - 1e-9) return false;
	var loX = Math.max(vw - (r.x + r.w) * L.s, vw - L.w);
	var hiX = Math.min(-r.x * L.s, 0);
	var loY = Math.max(vh - (r.y + r.h) * L.s, vh - L.h);
	var hiY = Math.min(-r.y * L.s, 0);
	return loX <= hiX + 1e-9 && loY <= hiY + 1e-9;
}

function covers(L, vw, vh) {
	var e = 1e-6;
	return L.x <= e && L.y <= e && L.x + L.w >= vw - e && L.y + L.h >= vh - e;
}

var seed = 424242;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function scene() {
	var bw = 100 + rnd() * 4000, bh = 100 + rnd() * 4000;
	var rx = rnd() * (bw - 10), ry = rnd() * (bh - 10);
	return {
		bw: bw, bh: bh,
		r: { x: rx, y: ry, w: 10 + rnd() * (bw - rx - 10), h: 10 + rnd() * (bh - ry - 10) },
		vw: 100 + rnd() * 4000, vh: 100 + rnd() * 4000
	};
}

var N = 200000, f1 = 0, f2 = 0, f3 = 0, clampShifts = 0;
var L = {}, view;

for (var i = 0; i < N; i++) {
	var c = scene();
	view = { x: 0, y: 0, zoom: 1, maxZoom: 4 };
	H.finalLayout(c.vw, c.vh, c.bw, c.bh, c.r, view, L);
	if (!regionVisible(c.vw, c.vh, c.r, L)) { f1++; if (f1 < 4) console.log('I1 FAIL', c); }
	if (coverPossible(c.vw, c.vh, c.r, L) && !covers(L, c.vw, c.vh)) {
		f2++; if (f2 < 4) console.log('I2 FAIL', c);
	}

	var sx = rnd() * c.vw, sy = rnd() * c.vh;
	H.zoomAround(c.vw, c.vh, c.bw, c.bh, c.r, view, sx, sy, 1 + rnd() * 3, L);
	if (Math.abs(L.px - sx) > 1e-6 || Math.abs(L.py - sy) > 1e-6) {
		f3++; if (f3 < 4) console.log('I3 FAIL', L.px - sx, L.py - sy);
	}
	var qx = L.x + L.ix * L.s, qy = L.y + L.iy * L.s;
	if (Math.abs(qx - sx) > 0.5 || Math.abs(qy - sy) > 0.5) clampShifts++;
}

console.log('I1 region always visible at zoom 1 :', f1 === 0 ? 'PASS' : f1 + ' FAILS');
console.log('I2 cover whenever possible        :', f2 === 0 ? 'PASS' : f2 + ' FAILS');
console.log('I3 zoom pivot preserved (pre-clamp):', f3 === 0 ? 'PASS' : f3 + ' FAILS');
console.log('   (edge clamp shifted visible pivot in', clampShifts, 'of', N, 'random zooms - expected at borders)');

var repo = [
	[1920, 1080, 1920, 1536, { x: 512, y: 256, w: 768, h: 1024 }, 'img/1.png'],
	[1984, 1152, 1984, 1152, { x: 476, y: 101, w: 1016, h: 900 }, 'img/3.avif'],
	[360, 780, 1920, 1536, { x: 512, y: 256, w: 768, h: 1024 }, 'phone portrait'],
	[2560, 1080, 1984, 1152, { x: 476, y: 101, w: 1016, h: 900 }, 'ultrawide']
];
for (i = 0; i < repo.length; i++) {
	var q = repo[i];
	H.finalLayout(q[0], q[1], q[2], q[3], q[4], { x: 0, y: 0, zoom: 1, maxZoom: 4 }, L);
	console.log(
		(q[5] + '                    ').slice(0, 20),
		'visible=' + regionVisible(q[0], q[1], q[4], L),
		'covers=' + covers(L, q[0], q[1])
	);
}

process.exit(f1 === 0 && f2 === 0 && f3 === 0 ? 0 : 1);
