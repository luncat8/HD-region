#!/usr/bin/env node
/* simulate engine chain for the new demo layout. checks whether the page
   is finite and the push chain terminates. */
'use strict';

var SF = require('../vendor/snowfall.js'); /* loads only the pure math under node */

function chain(n, free, ext, pos) {
	if (n <= 0) return pos;
	pos[n - 1] = free[n - 1] > 0 ? free[n - 1] : 0;
	for (let i = n - 2; i >= 0; i--) {
		const park = free[i] > 0 ? free[i] : 0;
		const ceil = pos[i + 1] - ext[i];
		pos[i] = ceil < park ? ceil : park;
	}
	return pos;
}
function stickyShown(free, ext, pBotC, pH, mb) {
	const park = free > 0 ? free : 0;
	const cap = pBotC - ext - mb;
	return cap < park ? cap : park;
}

/* new demo layout (1425x900 viewport):
   s1: section.copy padding 40vh*2 = 80vh = 720 (content inside contributes negligible)
   w1: wagon, height=vh=900, data-gap=100vh => mb=900-900=0
   s2: section.copy, height=720
   w2: wagon, height=900, mb=0
   s3: section.copy, height=720
   trailing-pad: height=100vh=900
   total flow height = 720+900+720+900+720+900 = 4860

   flow Y positions (top of each element in document flow, measured
   from parent top with margins applied):
     s1: 0 (height 720)
     w1: 720 (height 900)      y=720
     s2: 1620 (height 720)
     w2: 2340 (height 900)     y=2340
     s3: 3240 (height 720)
     pad:3960 (height 900)
   parent (#app) content-box bottom = 4860
*/
var n = 2;
var y = [720, 2340];
var ext = [900, 900];
var mb = [0, 0];
var pBot = [4860, 4860];   /* parent content-bottom in doc-space for each wagon */
var pH = [4860, 4860];     /* parent content height */

var free = new Array(n), pos = new Array(n);

console.log('Page flow height:', 4860);
console.log('Wagon y:', y, 'ext:', ext, 'mb:', mb);
console.log('');

/* sweep scroll from 0 to 6000; show pos/dy per wagon at a few points */
var sYs = [0, 200, 720, 1200, 1620, 2000, 2340, 3000, 3240, 3500, 3960, 4500, 5000, 5500, 6000];
for (var k = 0; k < sYs.length; k++) {
	var sY = sYs[k];
	for (var i = 0; i < n; i++) free[i] = y[i] - sY;
	chain(n, free, ext, pos);
	var parts = [];
	for (var i = 0; i < n; i++) {
		var sh = stickyShown(free[i], ext[i], pBot[i] - sY, pH[i], mb[i]);
		var dy = pos[i] - sh;
		parts.push('w'+i+': free='+Math.round(free[i])+' pos='+Math.round(pos[i])+' sh='+Math.round(sh)+' dy='+Math.round(dy));
	}
	console.log('sY=' + sY + '  ' + parts.join(' | '));
}

/* check that for sY > page height, pos remains finite and dy is bounded */
var maxDY = -Infinity, minDY = Infinity, maxPOS = -Infinity;
for (var sY2 = 0; sY2 < 100000; sY2 += 10) {
	for (var i = 0; i < n; i++) free[i] = y[i] - sY2;
	chain(n, free, ext, pos);
	for (var i = 0; i < n; i++) {
		var sh = stickyShown(free[i], ext[i], pBot[i] - sY2, pH[i], mb[i]);
		var dy = pos[i] - sh;
		if (dy > maxDY) maxDY = dy;
		if (dy < minDY) minDY = dy;
		if (pos[i] > maxPOS) maxPOS = pos[i];
	}
}
/* also test WITHOUT trailing pad (matches the pre-fix state for the final bug) */
var yNP = [820, 820+900+820];   /* rough, sections ~820 tall with text */
var pBotNP = yNP[1] + 900 + 820;
var maxDYN = -Infinity, minDYN = Infinity, scrollEndNP = -1;
for (var sY3 = 0; sY3 < 10000; sY3++) {
	for (var i = 0; i < n; i++) free[i] = yNP[i] - sY3;
	chain(n, free, ext, pos);
	for (var i = 0; i < n; i++) {
		var sh = stickyShown(free[i], ext[i], pBotNP - sY3, pBotNP, mb[i]);
		var dy = pos[i] - sh;
		if (dy > maxDYN) maxDYN = dy;
		if (dy < minDYN) minDYN = dy;
	}
	if (pos[1] <= -ext[1]) { scrollEndNP = sY3; break; }
}
console.log('\nWithout trailing pad: scroll end ~sY=' + scrollEndNP + ' (pBot='+pBotNP+'), max dy=' + maxDYN);
console.log('(If scrollEndNP=-1, page appears "infinite" because the last wagon never fully exits)');

console.log('\nOver sY=[0,100000] (with trailing pad): max dy=' + maxDY + ' min dy=' + minDY + ' max pos=' + maxPOS);
if (!isFinite(maxDY) || !isFinite(minDY) || Math.abs(maxDY) > 1e6 || Math.abs(minDY) > 1e6) {
	console.log('FAIL: dy/pos grows unboundedly');
	process.exit(1);
} else {
	console.log('OK: chain terminates, transforms are bounded.');
}
