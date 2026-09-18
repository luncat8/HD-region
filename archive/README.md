# Archive

This directory contains completed design artifacts and the small set of historical
prototype material still useful for comparison or regression investigation. Runtime
code, current scene assets, and active plans stay at the repository root.

## Archived plans

- `plan-integration.md` — original snowfall-core integration contract
- `plan-storage.md` — `regions.js` storage contract
- `plan-tools.md` — image pipeline and AVIF decisions
- `plan-viewer.md` — standalone viewer contract

The active follow-up for the known snowfall positioning problem is
`../plan-snowfall-core-integration.md`.

## Curated draft material

`draft/prototypes/standalone/1BBG_hd_pan_zoom-1.htm` is the most complete pre-core
standalone pan/zoom prototype. Its fixture paths and crop coordinates were adjusted so
it can still be opened directly from `file://`.

`draft/fixtures/` keeps the synthetic crop pair and the photo comparison assets used to
reason about crop placement and filler quality. The duplicate scanners, clipboard-only
scripts, CORS/SVG experiments, speculative generators, and superseded HTML variants
were removed after their useful conclusions were captured in the plans and
`findings-pitfalls-skills.md`.
