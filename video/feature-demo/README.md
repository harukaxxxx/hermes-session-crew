# SessionCrew — isolated scripted renderer demonstration

**Not native Webapp footage and not evidence of real agent work.** The renderer is genuine, but this standalone fixture uses synthetic profiles, synthetic status/snapshot responses, in-memory storage and an intentionally incomplete SDK. It has no host DOM, bridge, backend, model, credentials, or service. Popovers and navigation are not implemented. The visible face/word is decorative renderer text, not a model thought or tool output.

`renderer.js` is the unmodified deployed `/Users/haruka/SessionCrew-Demo/desktop-plugins/profile-rail/plugin.js`, identical to `git show 40bc67c:desktop/plugin.js`, SHA-256 `dba36e4484fd27915e1460e60e9cc105eab430f3d044ac75610c100ef7b7d50e`. The demo worktree renderer differs. `bundle.js` packages that renderer and this fixture SDK; no core, SDK, native profile or host was changed.

## Cast and provenance

Eight video-only copies of color illustrations in `avatars/` come from `/Users/haruka/SessionCrew-Demo/artwork/norse-color-v2/`; identity mapping follows `/Users/haruka/SessionCrew-Demo/profile-map.json`: Odin (`default`), Heimdall, Loki, Thor, Tyr, Freyja, Frigg and Baldr. Their states and children here are **scripted**, not observations. The fixture SDK returns these images as data URLs and substitutes only the external SDK interface needed for the preview. Original assets are untouched.

## Reproduce

From repo root, using existing dependencies only: `node video/feature-demo/build.mjs`, `node video/feature-demo/test.mjs`, `node video/feature-demo/sequence-test.mjs`. Build resolves esbuild/React/query from `$HERMES_CHECKOUT` (or `$HERMES_AGENT_ROOT`, default `~/.hermes/hermes-agent`); tests use its Playwright and local Chrome (`CHROME_PATH` overrides). Warnings report SDK components intentionally omitted from this preview. Open `index.html` directly with `file://`; `window.replay()` starts the scripted sequence. Capture framing is designed for 1920×1080; the fixture scales the real renderer and compensates for its fixed-position bubble without altering renderer code. The renderer's face/word clock is unchanged; reduced motion gives a repeatable face/word. Controls are visually hidden for recording.

## Feature provenance and timing

The actual renderer sorts `/status` responses by working, waiting, idle, unobserved and offline; it draws green/yellow/neutral outlines, child layers from `/completion-snapshot` metadata, and a face/word bubble only for a working, unselected profile. The real producer path is `dashboard/plugin_api.py::status` → `status.py::collect_status` and `waiting_status.py::read_waiting`, while `/completion-snapshot` uses `collect_snapshot`, `_collect_activity` and `_collect_child_metadata`; this fixture only supplies controlled responses. Queued/recent child metadata is not proof of execution.

- **0–4.8 s A:** Heimdall working with three visible fixture shadows and a bubble; Loki waiting; idle and unobserved peers; Baldr offline. Green/yellow and sorted statuses are simultaneous.
- **About 4.8–10.5 s B:** Odin, Loki, Thor and Tyr working; Odin has two visible child shadows. Heimdall moves to idle; Baldr remains offline. Working bubbles are the actual renderer's non-selected condition.
- **About 10.5–13.5 s:** last B image held for editing. Exact changes in the retained original Chromium event timestamps, not these rounded cue points.

The continuous CDP screencast and its raw JPEGs, timestamps and VFR master are in `capture/features/`; the 1920×1080 H.264 30 CFR editing copy is `video/public/footage/features-norse-take01.mp4`. CDP emits on compositor changes: this largely static shot produced 12 events over 12.49 seconds, **not 30 unique source frames per second**; the editing copy holds those real frames. An animated transport preflight produced 225 events over 2.99 seconds, demonstrating event delivery rather than implying this static take contained continuous motion. Representative original-size PNGs are `stage-a-2s.png`, `stage-b-7s.png`, and `hold-12s.png` under `capture/features/`. The renderer updates states abruptly; motion design and transitions are for the editor, not fake UI in this fixture.
