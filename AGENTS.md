# AGENTS.md


## style

	use a single tab indentation. LF end

	avoid deep nesting of braces { } and long if-else.
	flatten with early returns, helper functions, or flat data tables.

	avoid duplication of code.

	avoid allocations in the hot path (per-frame loop, sim, render).
		no new {}, [], object literals, closures, or string concat
		inside the frame loop.
		reuse preallocated buffers / typed arrays / scratch objects.
		allocate once at setup, mutate in place per frame.
		these are not strict rules, use best.

	plan*.md is NOT the implementation log. if need - update/improve plan, but keep final plan as artifact for possible fork or reimplementation without referring of what was and what done, without referring chat, etc.

	only essential concise comments in code that really helpful i.e. explain why and decision. prefer descriptive naming.

	no legacy support, no old versions, no outdated browsers, no leftovers and no over protecting from unreal edge cases. we need clean architecture.

## runtime

	file:// friendly, classic <script> tags, no modules, no build.
	guard module.exports so files also run under node.
	no internet links: vendor any lib as a local js file.

## concepts

	base image (`img/x.ext`)  - outpainted, compressed full background
	crop (`img/x_c.ext`)      - sharp 1:1 original region ("hd")
	region                    - crop rect in base pixels {x,y,w,h}; trust detection, not notes
	storage                   - regions.js, classic <script>, GENERATED + MANUAL blocks (archive/plan-storage.md)
	layout invariants         - region always visible at zoom 1; cover viewport when possible;
	                            proven by experiments/layout_test.js
	integration               - hdregion.js core + viewer.js standalone + snowfall-hdregion.js
	                            adapter (Snowfall.use subscriber; gestures: shift+wheel zoom,
	                            inspect checkbox for no-mouse devices) — plan-snowfall-core-integration.md
	pipeline                  - one resolution per scene; make_scene.py emits blurred-low-q base
	                            + high-q 1:1 hd crop + regions entry — archive/plan-tools.md


## files

findings-pitfalls-skills.md - notes and pitfalls for LLM agents. write here if found good way to do something.

archive/ - completed plans and curated historical prototypes
plan-snowfall-core-integration.md - active follow-up for snowfall image positioning

experiments/ - measurement scripts (node), not loaded by the page.
experiments/logs/ - keep useful;

hdregion.js - core layout/zoom math (node-testable, single source)
viewer.js, index.html - standalone book page (QA + no-engine books)
snowfall-hdregion.js, snowfall-demo.html, vendor/snowfall.js - engine integration + QA page
regions.js - GENERATED + MANUAL scene data (archive/plan-storage.md)
tools/ - build-time python (scan, make_scene, regions_writer, match)
input/ - scene sources (outpaint + hd crop); img/ - generated scene assets

## sandbox

git push returns "Invalid username or token" is ok, no need to investigate or report - i will apply manually
