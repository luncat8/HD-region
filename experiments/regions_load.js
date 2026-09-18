#!/usr/bin/env node
/*
	regions_load.js — proves regions.js is valid under node (R5) and consistent:
	every entry has integer x,y,w,h; referenced files exist next to regions.js.

	Run: node experiments/regions_load.js   (exit 0 = ok)
*/

'use strict';

var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var data = require(path.join(root, 'regions.js'));

var REGIONS = data.REGIONS;
var keys = Object.keys(REGIONS);
if (!keys.length) {
	console.log('FAIL: no entries');
	process.exit(1);
}

var fails = 0;
for (var i = 0; i < keys.length; i++) {
	var k = keys[i], e = REGIONS[k];
	var ints = ['x', 'y', 'w', 'h', 'bw', 'bh'];
	for (var j = 0; j < ints.length; j++) {
		var v = e[ints[j]];
		if (v !== undefined && (typeof v !== 'number' || v !== Math.round(v) || v < 0)) {
			console.log('FAIL', k, ints[j], v);
			fails++;
		}
	}
	if (!(e.w > 0) || !(e.h > 0)) { console.log('FAIL', k, 'bad w/h'); fails++; }
	if (!fs.existsSync(path.join(root, k))) { console.log('FAIL', k, 'file missing'); fails++; }
	if (e.hd && !fs.existsSync(path.join(root, e.hd))) { console.log('FAIL', k, 'hd missing'); fails++; }
	console.log('ok', k, '->', e.x, e.y, e.w, e.h, e.hd || '(no hd)');
}

process.exit(fails ? 1 : 0);
