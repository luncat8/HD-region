/* snowfall-hdregion.js — HD-region controller for snowfall-core (plan-integration.md).
   Subscriber only: never adds scroll listeners of its own, never reads layout in frame,
   writes only the child imgs of .snow-hd wagons (the engine owns the wagon element).
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

var CSS = '.snow-hd img{position:absolute;top:0;left:0;transform-origin:0 0;' +
	'pointer-events:none;user-select:none;-webkit-user-drag:none}' +
	'.snow-hd img:nth-child(2){z-index:2}';

/* per-wagon state, reallocated only on growth at measure */
var N = 0;
var baseEls = [], hdEls = [];
var wagonIdx = new Int32Array(0);      /* index into Snowfall.wagons, -1 none */
var rx = new Float64Array(0), ry = new Float64Array(0), rw = new Float64Array(0), rh = new Float64Array(0);
var hasR = new Uint8Array(0), maxZ = new Float64Array(0);
var zoom = new Float64Array(0), vx = new Float64Array(0), vy = new Float64Array(0);
var nbW = new Float64Array(0), nbH = new Float64Array(0);
var lastWB = new Float64Array(0), lastHB = new Float64Array(0);
var lastWH = new Float64Array(0), lastHH = new Float64Array(0);
var lastTB = [], lastTH = [];

var view = { zoom: 1, x: 0, y: 0, maxZoom: 4 };   /* reused scratch */
var L = {};
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

function measure() {
	var scope = document.getElementById('app') || document;
	var found = scope.querySelectorAll('.snow-hd');
	var n = found.length;
	if (n > N) {
		N = n;
		wagonIdx = new Int32Array(N); rx = new Float64Array(N); ry = new Float64Array(N);
		rw = new Float64Array(N); rh = new Float64Array(N);
		hasR = new Uint8Array(N); maxZ = new Float64Array(N);
		zoom = new Float64Array(N); vx = new Float64Array(N); vy = new Float64Array(N);
		nbW = new Float64Array(N); nbH = new Float64Array(N);
		lastWB = new Float64Array(N); lastHB = new Float64Array(N);
		lastWH = new Float64Array(N); lastHH = new Float64Array(N);
		lastTB = new Array(N); lastTH = new Array(N);
	}
	baseEls.length = n; hdEls.length = n;
	var W = SF.wagons || { els: [], n: 0 };
	for (var i = 0; i < n; i++) {
		var el = found[i];
		var imgs = el.getElementsByTagName('img');
		baseEls[i] = imgs[0] || null;
		hdEls[i] = imgs[1] || null;
		zoom[i] = 1; vx[i] = 0; vy[i] = 0;
		lastWB[i] = -1; lastTB[i] = '';
		var wi = -1;
		for (var k = 0; k < W.n; k++) if (W.els[k] === el) { wi = k; break; }
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
		if (hdEls[i] && (!e || !e.hd)) hdEls[i].style.display = 'none';
		else if (hdEls[i] && !hdEls[i].naturalWidth) hdEls[i].style.display = 'none';
	}
}

function frame(sY, vh, vw) {
	lastVH = vh; lastVW = vw;
	var W = SF.wagons;
	for (var i = 0; i < baseEls.length; i++) {
		var b = baseEls[i];
		if (!b || !b.naturalWidth) continue;
		if (b.naturalWidth !== nbW[i]) { nbW[i] = b.naturalWidth; lastWB[i] = -1; }
		if (b.naturalHeight !== nbH[i]) { nbH[i] = b.naturalHeight; lastWB[i] = -1; }
		if (!hasR[i]) { rx[i] = 0; ry[i] = 0; rw[i] = nbW[i]; rh[i] = nbH[i]; }

		view.zoom = zoom[i]; view.x = vx[i]; view.y = vy[i]; view.maxZoom = maxZ[i];
		H.finalLayout(vw, vh, nbW[i], nbH[i], { x: rx[i], y: ry[i], w: rw[i], h: rh[i] }, view, L);

		if (L.w !== lastWB[i] || L.h !== lastHB[i]) {
			lastWB[i] = L.w; lastHB[i] = L.h;
			b.style.width = L.w + 'px';
			b.style.height = L.h + 'px';
		}
		var t = 'translate(' + L.x + 'px,' + L.y + 'px)';
		if (t !== lastTB[i]) { lastTB[i] = t; b.style.transform = t; }

		var hEl = hdEls[i];
		if (hEl && hEl.naturalWidth) {
			if (hEl.style.display === 'none') hEl.style.display = 'block';
			var hw = rw[i] * L.s, hh = rh[i] * L.s;
			if (hw !== lastWH[i] || hh !== lastHH[i]) {
				lastWH[i] = hw; lastHH[i] = hh;
				hEl.style.width = hw + 'px';
				hEl.style.height = hh + 'px';
			}
			var th = 'translate(' + (L.x + rx[i] * L.s) + 'px,' + (L.y + ry[i] * L.s) + 'px)';
			if (th !== lastTH[i]) { lastTH[i] = th; hEl.style.transform = th; }
		}
	}
}

function off() {
	for (var i = 0; i < baseEls.length; i++) {
		if (baseEls[i]) baseEls[i].style.cssText = '';
		if (hdEls[i]) hdEls[i].style.cssText = '';
	}
}

/* the parked wagon the gesture applies to; -1 none */
function activeWagon() {
	var W = SF.wagons;
	if (!W || !W.n) return -1;
	var best = -1;
	for (var i = 0; i < baseEls.length; i++) {
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
	view.zoom = zoom[i]; view.x = vx[i]; view.y = vy[i]; view.maxZoom = maxZ[i];
	H.zoomAround(lastVW, lastVH, nbW[i], nbH[i], { x: rx[i], y: ry[i], w: rw[i], h: rh[i] }, view, sx, sy, nz, L);
	setView(i, view.zoom, view.x, view.y);
}

function resetWagon(i) {
	setView(i, 1, 0, 0);
}

/* ---------------- arbitration (plan-integration.md) ---------------- */

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
