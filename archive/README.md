# Archive

This directory contains completed design artifacts and historical prototype material
useful for comparison, regression investigation, or rebuilding the project from the
base ideas. Runtime code, current scene assets, and active plans stay at the repository
root.

## Archived plans

- `plan-integration.md` — original snowfall-core integration contract
- `plan-storage.md` — `regions.js` storage contract
- `plan-tools.md` — image pipeline and AVIF decisions
- `plan-viewer.md` — standalone viewer contract

The active follow-up for the known snowfall positioning problem is
`../plan-snowfall-core-integration.md`.

## Curated draft material

`draft/prototypes/standalone/1BBG_hd_pan_zoom-1.htm` is the most complete pre-core
standalone pan/zoom prototype. `1BBG_hd_pan_zoom-legacy.htm` is retained as a useful
pre-fix comparison. Their fixture paths and crop coordinates were adjusted so the
curated prototype can still be opened directly from `file://`.

`draft/fixtures/` keeps the synthetic crop pair and the photo comparison assets used to
reason about crop placement and filler quality.

`draft/draft.txt` preserves the original problem statement and reconstruction notes.
`draft/proposed improvements by LLM.txt` preserves the proposal that led to the current
implementation; `draft/proposed-improvements-review.md` records which parts are
implemented and which remain snowfall integration work.

`draft/generators/` keeps the three useful test-image generators: the labeled full-canvas
fixture, the colored outpaint fixture, and the crop/grid fixture used by the matcher.
Transient generated files, obsolete CORS/SVG experiments, duplicate scanners, and
superseded generator outputs are not retained.
