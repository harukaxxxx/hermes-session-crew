# Working bubble alignment — isolated frontend candidate

Candidate `desktop/plugin.js` SHA-256: `1d2a6600bd8072eaa0f8828d3cd537505f720698893e1bffab048841c57f7a01`. Baseline: `9ce81387477f2733c49057e88fbb848f90d205a0967213d8a376877c06a19453`. Not deployed or live-accepted.

A plugin-owned Chromium geometry probe reproduced a mismatch under `zoom: 1.5`: the original fixed bubble had an 80.5px gap and 46.5px top offset, versus 6px/6px at 100%. The plugin's `getBoundingClientRect()` values are viewport coordinates but its fixed CSS coordinates are scaled again by CSS zoom. The actual plugin fixture's new regression also failed at 150% before the change (stack right 85px, bubble left 136.5px).

The candidate derives effective scale from its own 37px row, computes scaled gaps and viewport visibility budget in viewport coordinates, and converts fixed left/top to local CSS pixels. It retains scroll/resize listeners and the existing rail boundary. The bubble now has padded, explicit line-height and a minimum rather than fixed height, allowing accents room without truncating text or changing the face/word data.

## Verification

- `node --check desktop/plugin.js`: pass.
- `HERMES_CHECKOUT=/Users/haruka/.hermes/hermes-agent node --experimental-vm-modules tests/scripted-rail.mjs`: pass (Node experimental VM warning).
- Existing-dependency Chromium fixture in an isolated copy, rebuilt from the candidate: `browser-bubble-alignment`, `browser-spinner-profiles`, `browser-working-pixels`, and `browser-floating-geometry`: pass. The new regression checks real bubble/stack bounding boxes at CSS zoom 100% and 150%, visible text boxes and all native face ink heights. It is registered in `tests/run-controlled.mjs`. Existing spinner test checks independence, selected hiding, localized combinations, and reduced motion; the floating test checks scroll/resize and the popover at 100%. Fixture build emitted existing esbuild `import.meta` IIFE warnings.
- Sibling investigation: a separate instantaneous 150% fixture check observed the SDK popover arrow 233.25px away from the avatar center; it was not waited to settle and does not establish root cause or live behavior. No sibling change was made. It warrants a timed follow-up if 150% popover acceptance is in scope.
- Controlled CSS zoom is not the real Webapp UI Scale or the recorded film. Actual 150% live renderer alignment, accent rendering, edge cases and the sibling popover remain unverified; parent should validate after authorized frontend-only deployment. No backend, SDK, host DOM/CSS, runtime, listener, or deployment was changed.
