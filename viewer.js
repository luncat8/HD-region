/* viewer.js — standalone HD-region page (archive/plan-viewer.md). Math: hdregion.js.
   Gestures here are direct (no engine to arbitrate with): wheel zooms, drag pans,
   pinch zooms, double-tap resets. In snowfall books use snowfall-hdregion.js. */
(function () {
'use strict';

var hasDOM = typeof document !== 'undefined' && typeof window !== 'undefined';
if (!hasDOM) {
	if (typeof module !== 'undefined') module.exports = null;
	return;
}

var H = window.HDRegion;
var REGIONS = window.REGIONS || {};

document.body.classList.add('js-ready');

var img = document.getElementById('bg');
var imgHd = document.getElementById('bg_hd');
var nextButton = document.getElementById('nextButton');

var scenes = window.SCENES && window.SCENES.length ? window.SCENES : Object.keys(REGIONS);
var current = 0;

var view = { zoom: 1, x: 0, y: 0, maxZoom: 4 };
var region = { x: 0, y: 0, w: 1, h: 1 };
var haveRegion = false;
var baseW = 0, baseH = 0;

var VW = 0, VH = 0;
var L = {};
var dirty = false;

/* write gating: skip style writes when unchanged */
var wB = -1, hB = -1, tB = '';
var wH = -1, hH = -1, tH = '';

/* input state, allocated once */
var pointers = new Map();
var dragging = false;
var lastX = 0, lastY = 0;
var pinchDist = 0, pinchZoom = 1;
var pinchIdA = 0, pinchIdB = 0;

function measureViewport() {
	VW = document.documentElement.clientWidth;
	VH = document.documentElement.clientHeight;
}

function requestRender() {
	if (dirty) return;
	dirty = true;
	requestAnimationFrame(render);
}

function render() {
	dirty = false;
	if (!baseW || !baseH || !VW) return;

	H.finalLayout(VW, VH, baseW, baseH, region, view, L);

	if (L.w !== wB || L.h !== hB) {
		wB = L.w; hB = L.h;
		img.style.width = L.w + 'px';
		img.style.height = L.h + 'px';
	}
	var t = 'translate(' + L.x + 'px,' + L.y + 'px)';
	if (t !== tB) { tB = t; img.style.transform = t; }

	if (!haveRegion || !imgHd.naturalWidth) return;

	var hw = region.w * L.s, hh = region.h * L.s;
	if (hw !== wH || hh !== hH) {
		wH = hw; hH = hh;
		imgHd.style.width = hw + 'px';
		imgHd.style.height = hh + 'px';
	}
	var th = 'translate(' + (L.x + region.x * L.s) + 'px,' + (L.y + region.y * L.s) + 'px)';
	if (th !== tH) { tH = th; imgHd.style.transform = th; }
}

function applyEntry(entry) {
	haveRegion = !!entry;
	if (!entry) {
		console.warn('viewer: no region entry for ' + scenes[current] + ', using whole image');
		return;
	}
	region.x = entry.x; region.y = entry.y; region.w = entry.w; region.h = entry.h;
	view.maxZoom = entry.maxZoom || 4;
	if (entry.bw) {
		img.addEventListener('load', function check() {
			img.removeEventListener('load', check);
			if (img.naturalWidth !== entry.bw || img.naturalHeight !== entry.bh)
				console.warn('viewer: ' + scenes[current] + ' changed since scan (' +
					img.naturalWidth + 'x' + img.naturalHeight + ' != ' + entry.bw + 'x' + entry.bh + ')');
		});
	}
}

function loadScene(i) {
	current = i;
	view.zoom = 1; view.x = 0; view.y = 0;
	wB = hB = wH = hH = -1; tB = tH = '';
	baseW = baseH = 0;

	var key = scenes[current];
	applyEntry(REGIONS[key]);

	imgHd.style.display = 'none';
	var entry = REGIONS[key];
	if (entry && entry.hd) {
		imgHd.src = entry.hd;
	} else {
		imgHd.removeAttribute('src');
	}
	img.src = key;
}

function preloadNext() {
	if (scenes.length < 2) return;
	var key = scenes[(current + 1) % scenes.length];
	var p = new Image();
	p.src = key;
	var e = REGIONS[key];
	if (e && e.hd) { var q = new Image(); q.src = e.hd; }
}

/* ---------------- gestures ---------------- */

function onPointerDown(event) {
	if (event.target === nextButton) return;
	event.preventDefault();
	pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

	if (pointers.size === 1) {
		dragging = true;
		lastX = event.clientX; lastY = event.clientY;
	} else if (pointers.size === 2) {
		dragging = false;
		var ids = Array.from(pointers.keys());   /* only on down, not per move */
		pinchIdA = ids[0]; pinchIdB = ids[1];
		var a = pointers.get(pinchIdA), b = pointers.get(pinchIdB);
		pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
		pinchZoom = view.zoom;
	}
}

function onPointerMove(event) {
	var rec = pointers.get(event.pointerId);
	if (!rec) return;
	event.preventDefault();
	rec.x = event.clientX; rec.y = event.clientY;

	if (pointers.size === 1 && dragging) {
		view.x += event.clientX - lastX;
		view.y += event.clientY - lastY;
		lastX = event.clientX; lastY = event.clientY;
		requestRender();
		return;
	}
	if (pointers.size === 2 && pinchDist > 0) {
		var a = pointers.get(pinchIdA), b = pointers.get(pinchIdB);
		var dist = Math.hypot(a.x - b.x, a.y - b.y);
		H.zoomAround(VW, VH, baseW, baseH, region, view,
			(a.x + b.x) / 2, (a.y + b.y) / 2,
			pinchZoom * dist / pinchDist, L);
		requestRender();
	}
}

function onPointerUp(event) {
	pointers.delete(event.pointerId);
	if (pointers.size === 1) {
		var p = Array.from(pointers.values())[0];
		dragging = true;
		lastX = p.x; lastY = p.y;
		pinchDist = 0;
	} else if (pointers.size === 0) {
		dragging = false;
		pinchDist = 0;
	}
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

window.addEventListener('wheel', function (event) {
	event.preventDefault();
	if (!baseW) return;
	H.zoomAround(VW, VH, baseW, baseH, region, view,
		event.clientX, event.clientY,
		view.zoom * Math.exp(-event.deltaY * 0.001), L);
	requestRender();
}, { passive: false });

window.addEventListener('dblclick', function () {
	view.zoom = 1; view.x = 0; view.y = 0;
	requestRender();
});

/* ---------------- wiring ---------------- */

img.addEventListener('load', function () {
	baseW = img.naturalWidth;
	baseH = img.naturalHeight;
	if (!haveRegion) { region.x = 0; region.y = 0; region.w = baseW; region.h = baseH; }
	preloadNext();
	requestRender();
});

imgHd.addEventListener('load', function () {
	imgHd.style.display = 'block';
	requestRender();
});

nextButton.addEventListener('click', function () {
	loadScene((current + 1) % scenes.length);
});

function onResize() {
	measureViewport();
	requestRender();
}
window.addEventListener('resize', onResize);
if (window.visualViewport) {
	window.visualViewport.addEventListener('resize', onResize);
	window.visualViewport.addEventListener('zoom', onResize);
}

measureViewport();
if (scenes.length) loadScene(0);
if (typeof module !== 'undefined') module.exports = { scenes: scenes };
})();
