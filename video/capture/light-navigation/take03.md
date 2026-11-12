# Real Ego/CDP navigation take 03

## Capture and scope
- Source: authenticated isolated native Webapp at http://192.168.1.100:4178/, Ego task space 64 / p1.
- Light mode, eight visible profiles; existing synthetic transcripts. No inference, work-state changes, completion or delegation was generated.
- Browser compositor CDP screencast, not screenshot polling. Capture settings in `video/tools/ego-screencast.js`: CSS viewport 1920×1080, device scale factor 1, JPEG quality 95. Source JPEGs measured 1920×1080; do not claim 4K/retina capture. A previous factor-2 experiment delivered insufficient width and was rejected without encoding.
- Raw source audit directory: `/Users/haruka/.hermes/profiles/shirogane-yuine/cache/scratch/ego-screencast-dUCVQV` (temporary).
- Capture: 66 content-change frames over 7.163819833 seconds; first-to-last event span 6.678004980 s. Static UI does not continuously emit frames. Do not describe the event average as guaranteed motion fps.
- Transport preflight on a separate, explicitly labeled local animated test page received 355 real 1920×1080 frames in 4.754029125 seconds. That establishes real event forwarding, not product playback quality.

## Observed navigation
- Begins with Loki menu open over Heimdall transcript.
- Selects existing Loki synthetic conversation; frame at 2 seconds visibly shows Loki's transcript.
- Opens Heimdall menu and returns to Heimdall transcript, visible in final contact-sheet section.
- No black frame or resume error seen in representative stills. No continuous human playback QA claimed.

## Outputs
- `public/footage/light-navigation-take03.mkv`: timestamp-preserving VFR master.
- `public/footage/light-navigation-take03.mp4`: delivery copy, ffprobe measured 1920×1080, 30/1 fps, 7.666667 seconds. CFR conversion repeats held frames, does not invent movement. Duration differs from capture wall time; not yet suitable for exact scripted timeline placement without trimming/verification.
- `capture/light-navigation/take03-contact.png`, `take03-loki.png`: inspected representative frames.
- Full MP4 decode: `ffmpeg -v error -i public/footage/light-navigation-take03.mp4 -f null -` exit 0.

This is real native navigation footage with synthetic data, not the approved Ragnarök dialogue, model performance evidence or a finished submission film. Do not replace missing story scenes with this clip without an explicit edit decision.
