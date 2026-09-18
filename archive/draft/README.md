# Curated historical draft

Only source material that helps rebuild or regression-test the original idea is kept
here:

- `prototypes/standalone/1BBG_hd_pan_zoom-1.htm` — the most complete pre-core
  standalone pan/zoom prototype;
- `prototypes/standalone/1BBG_hd_pan_zoom-legacy.htm` — an earlier useful comparison
  point for the positioning/zoom behavior;
- `fixtures/` — synthetic crop and photo assets used for visual alignment and filler
  experiments;
- `draft.txt` — the original problem statement and design notes;
- `proposed improvements by LLM.txt` plus `proposed-improvements-review.md` — the
  proposal and its implementation review;
- `generators/` — reproducible test-image generators, not generated outputs.

The curated prototype is self-contained relative to this directory and can be opened
from `file://`. Current runtime pages use the root `input/`, `img/`, and `regions.js`
artifacts instead.
