# Review: proposed improvements by LLM

Source: `proposed improvements by LLM.txt`. The review distinguishes the standalone
viewer from the snowfall-core adapter; an item implemented in `hdregion.js` is not
automatically implemented in the wagon integration.

| Proposal | Status | Review |
| --- | --- | --- |
| Use the layout viewport (`documentElement.clientWidth`) | Partial | `viewer.js` measures `document.documentElement.clientWidth/clientHeight`. The snowfall adapter receives `window.innerWidth/innerHeight` from the current core frame, while the demo puts wagons inside a centered `#app`; the active snowfall plan must establish one authoritative viewport width and origin. |
| Avoid 50% plus translate stacking errors | Implemented in standalone/core | `hdregion.js` uses a top-left origin and `finalLayout()` returns one explicit translation. The 200,000-case layout test passes. Snowfall still composes a child transform with the engine's wagon transform, so that integration contract remains under investigation. |
| Prevent high-DPI sub-pixel drift | Mostly implemented | Layout values remain floating point and are recomputed from state rather than rounded or accumulated through CSS reads. Pointer deltas are accumulated in view state, so browser rect comparisons should use a small pixel tolerance rather than require integer coordinates. |
| Keep the original region always visible | Implemented in core/math | `finalLayout()` clamps each axis after the region-contain scale. `experiments/layout_test.js` verifies this invariant. The adapter can still violate the visual result if external CSS constrains an image box. |
| Use extra outpaint when available | Implemented in core/math | The full base image is positioned from the same scale; edge clamping covers the viewport whenever geometry permits and otherwise preserves the region with letterboxing. |
| Do not distort aspect ratio | Implemented by math, not fully by demo CSS | The base uses one scale and the HD child is mapped to the region rect. However, `snowfall-demo.html` currently leaves `max-height:100vh` and `object-fit:contain` on the images; those rules can constrain or redraw the explicitly sized child and must be disabled in the JS-ready integration style. |
| Vertical anchor preference | Not implemented | Current behavior centers the region. Top/bottom anchoring would need an explicit per-scene policy and new tests; it is not required to fix the current positioning defect. |
| Smooth pan between images | Not implemented, intentionally | Scene changes reset immediately and pan/zoom input is direct. Transitions could conflict with sticky wagon motion and should remain out of the positioning fix unless a concrete UX requirement appears. |
| CSS `object-fit` alternative | Not used by the runtime | Explicit pixel dimensions and transforms are the correct model for a crop overlay. `object-fit` is useful only for the no-JS fallback; keeping it active on JS-controlled snowfall children is a bug risk. |

## Conclusion

The main standalone improvements are implemented and regression-tested. The unresolved
work is not a replacement for the core layout math: it is a snowfall coordinate and CSS
ownership problem. The active plan should therefore fix, in order:

1. the constrained wagon origin versus the viewport origin;
2. the mismatch between `window.innerWidth` and the actual wagon/layout width;
3. the no-JS image rules that remain active after the adapter sets explicit dimensions;
4. the adapter's per-frame region-object allocation while the frame path is being edited.
