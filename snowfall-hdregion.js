/* snowfall-hdregion.js — HD-region controller for snowfall-core (archive/plan-integration.md).
   Subscriber only: never adds scroll listeners of its own, never reads layout in frame,
   writes only the child imgs of .snow-hd wagons (the engine owns the wagon element).

   Coordinate contract:
     engine owns wagon box, margins, transform; wagons are direct children of a
     full-viewport-width scope (#app), so width:100% matches vw.
     adapter writes only the two <img> children: absolute positioning local to the
     wagon, pixel sizes, translate from finalLayout(vw, vh, ...).
     vw/vh come from the core's cached Snowfall.viewport (vw=clientWidth, vh=innerHeight),
     never re-measured here; children compose rigidly with the wagon's transform in
     every state (entering, parked, pushed, exiting) with no second offset.

   Gestures: read mode = shift+wheel zoom; inspect mode (checkbox / key i) = full pan-zoom. */
(function () {
'use strict';

var hasDOM = typeof document !== 'undefined' && typeof window !== 'undefined';
var SF = hasDOM && typeof Snowfall !== 'undefined' ? Snowfall : null;
var H = typeof HDRegion !== 'undefined' ? HDRegion : null;
if (!hasDOM || !SF || !H) {
	if (typeof module !== 'undefined') module.exports = null;
	return;
}

var REGIONS = window.REGIONS || {};

/* JS-ready: remove the no-JS max-height/object-fit so explicit pixel sizes win. */
document.documentElement.classList.add('snow-ready');

/* .snow-bg is position:sticky which already forms a containing block for
   absolutely positioned children; no need to fight engine styles. */
var CSS = '.snow-hd img{position:absolute;top:0;left:0;transform-origin:0 0;' +
	'pointer-events:none;user-select:none;-webkit-user-drag:none}' +
	'.snow-hd img:nth-child(2){z-index:2}';

/* per-wagon state, reallocated only on growth at measure */
var N = 0;
var wagonEls = [], baseEls = [], hdEls = [];
var wagonIdx = new Int32Array(0);      /* index into Snowfall.wagons, -1 none */
var rx = new Float64Array(0), ry = new Float64Array(0), rw = new Float64Array(0), rh = new Float64Array(0);
var hasR = new Uint8Array(0), maxZ = new Float64Array(0);
var zoom = new Float64Array(0), vx = new Float64Array(0), vy = new Float64Array(0);
var nbW = new Float64Array(0), nbH = new Float64Array(0);
var nwH = new Float64Array(0), nhH = new Float64Array(0);
var lastWB = new Float64Array(0), lastHB = new Float64Array(0);
var lastWH = new Float64Array(0), lastHH = new Float64Array(0);
var lastSX = new Float64Array(0), lastSY = new Float64Array(0);
var lastSXH = new Float64Array(0), lastSYH = new Float64Array(0);
var hdLoaded = new Uint8Array(0);

/* reused scratch objects — never allocated in frame */
var view = { zoom: 1, x: 0, y: 0, maxZoom: 4 };
var rgn = { x: 0, y: 0, w: 0, h: 0 };
var L = { x: 0, y: 0, w: 0, h: 0, s: 0, tx: 0, ty: 0, px: 0, py: 0, ix: 0, iy: 0 };
var lastVW = 0, lastVH = 0;

var inspect = false;
var hud = null;

/* input scratch, allocated once */
var pointers = new Map();
var dragging = false, lastX = 0, lastY = 0;
var pinchDist = 0, pinchZoom = 1, pinchIdA = 0, pinchIdB = 0, pinchWagon = -1;

function normKey(src) {
	if (!src) return '';
	return decodeURIComponent(src).split('?')[0].split('#')[0].replace(/^\.\//, '');
}

function onImgLoad() {
	/* image natural dimensions are now known; invalidate size caches and
	   request a frame. No layout read here — naturalWidth is decode metadata. */
	var el = this;
	for (var i = 0; i < N; i++) {
		if (baseEls[i] === el) { lastWB[i] = -1; break; }
		if (hdEls[i] === el) {
			if (hdLoaded[i]) return;           /* already processed */
			hdLoaded[i] = 1;
			lastWH[i] = -1;
			if (hdEls[i]) hdEls[i].style.display = 'block';
			break;
		}
	}
	SF.step();
}

function attachLoad(i) {
	var b = baseEls[i], h = hdEls[i];
	if (b && !b.__snowBound) {
		b.__snowBound = 1;
		b.addEventListener('load', onImgLoad);
		if (b.complete && b.naturalWidth) { nbW[i] = b.naturalWidth; nbH[i] = b.naturalHeight; }
	}
	if (h && !h.__snowBound) {
		h.__snowBound = 1;
		h.addEventListener('load', onImgLoad);
		/* hd starts hidden until decoded; if the image is already cached
		   (complete and naturalWidth known) the load event will not fire
		   again — mark loaded and unhide now so it isn't stuck on none. */
		if (h.complete && h.naturalWidth) {
			h.style.display = 'block';
			hdLoaded[i] = 1;
			nwH[i] = h.naturalWidth; nhH[i] = h.naturalHeight;
		} else {
			h.style.display = 'none';
			hdLoaded[i] = 0;
		}
	}
}

function measure() {
	var scope = document.getElementById('app') || document;
	var found = scope.querySelectorAll('.snow-hd');
	var n = found.length;
	if (n > N) {
		var oldN = N;
		N = n;
		wagonIdx = growI32(wagonIdx, N);
		rx = growF64(rx, N); ry = growF64(ry, N);
		rw = growF64(rw, N); rh = growF64(rh, N);
		hasR = growU8(hasR, N); maxZ = growF64(maxZ, N);
		zoom = growF64(zoom, N); vx = growF64(vx, N); vy = growF64(vy, N);
		nbW = growF64(nbW, N); nbH = growF64(nbH, N);
		nwH = growF64(nwH, N); nhH = growF64(nhH, N);
		lastWB = growF64(lastWB, N); lastHB = growF64(lastHB, N);
		lastWH = growF64(lastWH, N); lastHH = growF64(lastHH, N);
		lastSX = growF64(lastSX, N); lastSY = growF64(lastSY, N);
		lastSXH = growF64(lastSXH, N); lastSYH = growF64(lastSYH, N);
		hdLoaded = growU8(hdLoaded, N);
		/* seed invalid */
		for (var k = oldN; k < N; k++) {
			lastWB[k] = -1; lastWH[k] = -1;
			lastSX[k] = NaN; lastSY[k] = NaN; lastSXH[k] = NaN; lastSYH[k] = NaN;
		}
	}
	wagonEls.length = n; baseEls.length = n; hdEls.length = n;
	var W = SF.wagons || { els: [], n: 0 };
	for (var i = 0; i < n; i++) {
		var el = found[i];
		wagonEls[i] = el;
		var imgs = el.getElementsByTagName('img');
		baseEls[i] = imgs[0] || null;
		hdEls[i] = imgs[1] || null;
		zoom[i] = 1; vx[i] = 0; vy[i] = 0;
		lastWB[i] = -1; lastWH[i] = -1;
		lastSX[i] = NaN; lastSY[i] = NaN; lastSXH[i] = NaN; lastSYH[i] = NaN;
		var wi = -1;
		for (var k2 = 0; k2 < W.n; k2++) if (W.els[k2] === el) { wi = k2; break; }
		wagonIdx[i] = wi;
		var e = baseEls[i] ? REGIONS[normKey(baseEls[i].getAttribute('src'))] : null;
		if (e) {
			hasR[i] = 1;
			rx[i] = e.x; ry[i] = e.y; rw[i] = e.w; rh[i] = e.h;
			maxZ[i] = e.maxZoom || 4;
		} else {
			hasR[i] = 0;
			maxZ[i] = 4;
		}
		attachLoad(i);
		/* hide HD if no region entry or no hd src; otherwise let load listener show it */
		if (hdEls[i]) {
			if (!e || !e.hd) { hdEls[i].style.display = 'none'; hdLoaded[i] = 0; }
		}
	}
}

/* typed-array growers */
function growF64(a, n) { var b = new Float64Array(n); b.set(a); return b; }
function growI32(a, n) { var b = new Int32Array(n); b.set(a); return b; }
function growU8(a, n) { var b = new Uint8Array(n); b.set(a); return b; }

function frame(sY, vh, vw) {
	lastVH = vh; lastVW = vw;
	for (var i = 0; i < N; i++) {
		var b = baseEls[i];
		if (!b) continue;
		/* naturalWidth is decode metadata — legal to read in frame. */
		var nw = b.naturalWidth, nh = b.naturalHeight;
		if (!nw) continue;
		if (nw !== nbW[i]) { nbW[i] = nw; lastWB[i] = -1; lastSX[i] = NaN; }
		if (nh !== nbH[i]) { nbH[i] = nh; lastWB[i] = -1; lastSY[i] = NaN; }

		if (!hasR[i]) { rx[i] = 0; ry[i] = 0; rw[i] = nbW[i]; rh[i] = nbH[i]; }
		rgn.x = rx[i]; rgn.y = ry[i]; rgn.w = rw[i]; rgn.h = rh[i];
		view.zoom = zoom[i]; view.x = vx[i]; view.y = vy[i]; view.maxZoom = maxZ[i];
		H.finalLayout(vw, vh, nbW[i], nbH[i], rgn, view, L);

		if (L.w !== lastWB[i] || L.h !== lastHB[i]) {
			lastWB[i] = L.w; lastHB[i] = L.h;
			b.style.width = L.w + 'px';
			b.style.height = L.h + 'px';
		}
		if (L.x !== lastSX[i] || L.y !== lastSY[i]) {
			lastSX[i] = L.x; lastSY[i] = L.y;
			b.style.transform = 'translate(' + L.x + 'px,' + L.y + 'px)';
		}

		var hEl = hdEls[i];
		if (!hEl) continue;
		/* HD is only painted when we have a region entry that declares an hd src
		   and the hd image has decoded. Missing-HD / no-region: skip cleanly.
		   hdLoaded is the authoritative flag — never read style.display here.
		   nwH/nhH are populated by attachLoad/onImgLoad — never read
		   naturalWidth/naturalHeight in the hot path (they are decode metadata,
		   but still a DOM read that costs style recalc). */
		if (!hasR[i] || !hdLoaded[i]) continue;
		var hw = rw[i] * L.s, hh = rh[i] * L.s;
		var hx = L.x + rx[i] * L.s, hy = L.y + ry[i] * L.s;
		if (hw !== lastWH[i] || hh !== lastHH[i]) {
			lastWH[i] = hw; lastHH[i] = hh;
			hEl.style.width = hw + 'px';
			hEl.style.height = hh + 'px';
		}
		if (hx !== lastSXH[i] || hy !== lastSYH[i]) {
			lastSXH[i] = hx; lastSYH[i] = hy;
			hEl.style.transform = 'translate(' + hx + 'px,' + hy + 'px)';
		}
	}
}

function off() {
	for (var i = 0; i < N; i++) {
		if (baseEls[i]) {
			baseEls[i].style.width = '';
			baseEls[i].style.height = '';
			baseEls[i].style.transform = '';
		}
		if (hdEls[i]) {
			hdEls[i].style.width = '';
			hdEls[i].style.height = '';
			hdEls[i].style.transform = '';
			hdEls[i].style.display = '';
		}
		lastWB[i] = -1; lastWH[i] = -1;
		lastSX[i] = NaN; lastSY[i] = NaN; lastSXH[i] = NaN; lastSYH[i] = NaN;
	}
}

/* the parked wagon the gesture applies to; -1 none */
function activeWagon() {
	var W = SF.wagons;
	if (!W || !W.n) return -1;
	var best = -1;
	for (var i = 0; i < N; i++) {
		var wi = wagonIdx[i];
		if (wi < 0) continue;
		if (W.pos[wi] === 0 && W.free[wi] <= 0) return i;   /* parked wins */
		if (W.free[wi] <= lastVH) best = i;
	}
	return best;
}

function setView(i, z, x, y) {
	zoom[i] = z; vx[i] = x; vy[i] = y;
	SF.step();
}

function zoomWagon(i, sx, sy, nz) {
	rgn.x = rx[i]; rgn.y = ry[i]; rgn.w = rw[i]; rgn.h = rh[i];
	view.zoom = zoom[i]; view.x = vx[i]; view.y = vy[i]; view.maxZoom = maxZ[i];
	H.zoomAround(lastVW, lastVH, nbW[i], nbH[i], rgn, view, sx, sy, nz, L);
	setView(i, view.zoom, view.x, view.y);
}

function resetWagon(i) {
	setView(i, 1, 0, 0);
}

/* ---------------- arbitration (archive/plan-integration.md) ---------------- */

function onWheel(event) {
	if (!inspect && !event.shiftKey) return;      /* read mode: engine scrolls */
	event.preventDefault();                        /* also kills shift+wheel h-scroll */
	var i = activeWagon();
	if (i < 0 || !nbW[i]) return;
	zoomWagon(i, event.clientX, event.clientY, zoom[i] * Math.exp(-event.deltaY * 0.001));
}

function onPointerDown(event) {
	if (!inspect) return;
	if (hud && hud.contains(event.target)) return;
	event.preventDefault();
	pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	if (pointers.size === 1) {
		dragging = true;
		lastX = event.clientX; lastY = event.clientY;
		pinchWagon = activeWagon();
	} else if (pointers.size === 2) {
		dragging = false;
		var ids = Array.from(pointers.keys());
		pinchIdA = ids[0]; pinchIdB = ids[1];
		var a = pointers.get(pinchIdA), b = pointers.get(pinchIdB);
		pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
		if (pinchWagon < 0) pinchWagon = activeWagon();
		pinchZoom = pinchWagon >= 0 ? zoom[pinchWagon] : 1;
	}
}

function onPointerMove(event) {
	if (!inspect) return;
	var rec = pointers.get(event.pointerId);
	if (!rec) return;
	event.preventDefault();
	rec.x = event.clientX; rec.y = event.clientY;
	if (pinchWagon < 0) return;

	if (pointers.size === 1 && dragging) {
		vx[pinchWagon] += event.clientX - lastX;
		vy[pinchWagon] += event.clientY - lastY;
		lastX = event.clientX; lastY = event.clientY;
		SF.step();
		return;
	}
	if (pointers.size === 2 && pinchDist > 0) {
		var a = pointers.get(pinchIdA), b = pointers.get(pinchIdB);
		var dist = Math.hypot(a.x - b.x, a.y - b.y);
		zoomWagon(pinchWagon, (a.x + b.x) / 2, (a.y + b.y) / 2, pinchZoom * dist / pinchDist);
	}
}

function onPointerUp(event) {
	if (!inspect) return;
	pointers.delete(event.pointerId);
	if (pointers.size === 1) {
		var p = Array.from(pointers.values())[0];
		dragging = true; lastX = p.x; lastY = p.y; pinchDist = 0;
	} else if (pointers.size === 0) {
		dragging = false; pinchDist = 0; pinchWagon = -1;
	}
}

function onTouchMove(event) {
	if (inspect) event.preventDefault();   /* suspend page scroll in inspect mode */
}

function setInspect(on) {
	inspect = on;
	if (hud) hud.querySelector('input').checked = on;
	/* scroll stays suspended via preventDefault only — overflow tricks trap sticky */
}

function buildHud() {
	hud = document.createElement('label');          /* appended to body, outside #app */
	hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:60;' +
		'font:14px system-ui;color:#fff;background:rgba(0,0,0,.45);' +
		'padding:6px 10px;border-radius:6px;cursor:pointer;user-select:none';
	hud.innerHTML = '<input type="checkbox" style="margin-right:6px">inspect bg (i)';
	hud.querySelector('input').addEventListener('change', function (e) {
		setInspect(e.target.checked);
	});
	document.body.appendChild(hud);
	window.addEventListener('keydown', function (e) {
		if (e.key === 'i') setInspect(!inspect);
		else if (e.key === 'Escape') setInspect(false);
	});
	window.addEventListener('dblclick', function (e) {
		if (!inspect) return;
		var i = activeWagon();
		if (i >= 0) resetWagon(i);
	});
}

var st = document.createElement('style');
st.textContent = CSS;
document.head.appendChild(st);
buildHud();

SF.use({ measure: measure, frame: frame, off: off });
window.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
window.addEventListener('touchmove', onTouchMove, { passive: false });
SF.refresh();

if (typeof module !== 'undefined') module.exports = { active: true };
})();
