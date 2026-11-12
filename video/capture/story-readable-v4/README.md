# Story readable v4 — native static captures

These are screenshots of existing scripted v1 conversation replies in the isolated native Webapp, not live model execution or 30 fps recordings. The user prompt and old session title are deliberately outside the public assets' crop; no source text was repainted, obscured or retyped. Full screenshots include the original user prompt and are evidence only, not public footage.

Public Appearance → Typography: UI Scale 150%, Chat Text Size 175% (see typography.png). Ego CDP Page.captureScreenshot PNG with deviceScaleFactor 2, each override applied in capture invocation; saved pixel dimensions measured below. The browser rendered and wrapped the text natively. Cropping used ffmpeg without scaling; playback holds each static PNG. Remotion presents all three at 1:1 source pixels.

| Role | Viewport CSS px | Source PNG px | Crop x,y,w,h in source pixels | Lines |
|---|---|---|---|---|
| Heimdall | 1000 × 1000 | 2000 × 2000 | 400,385,1500,400 | 4 |
| Loki | 800 × 1000 | 1600 × 2000 | 400,560,1120,320 | 3 |
| Odin | 800 × 1000 | 1600 × 2000 | 400,560,1120,230 | 2 |

Heimdall: heimdall-full.png; Loki: loki-full-800.png; Odin: odin-full-800.png. Odin-full.png is an earlier 1000 px viewport test, not the production source. Source glyphs are approximately 64 pixel font size at DPR 2; source pixels remain unaltered in the final crop. The main timeline remains 67 seconds; representative actual SessionCrewDemo frames at 330, 600 and 1020 are in video/out/story-readable-v4/.
