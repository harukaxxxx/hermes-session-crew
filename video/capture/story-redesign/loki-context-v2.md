# Loki dialogue context v2

- Native source: `loki-menu-native-v2.png`, 1920×1440, UI Scale 150%; real plugin popover over the empty Loki session titled `Jötunheim — Unwritten Mischief`.
- Editorial background: `../../public/footage/story-backgrounds/loki-menu-context.png`, exact native crop `(0,250,1920,1080)`, no resampling in the asset. Composition displays at 1.2×; this is editorial enlargement, not higher native resolution.
- The menu is genuinely Loki's, replacing the prior incorrect Odin opening background. No native message or interface text was repainted. This held background is **not** proof that the pending Quick create operation completed.
- Dialogue remains the approved full user and agent text. It is authored editorial typography, not a model execution recording.
- Preview: `../../out/loki-dialogue-context-v2.mp4`, main composition frames 870–1229 inclusive. ffprobe: 12.000000 s, 1920×1080, CFR 30, 360 encoded frames, no audio. Full ffmpeg decode passed. Reviewed a full-size representative still and a 12-tile contact sheet; not claiming real-time playback or audio listening.
- User phase 4.5 s, agent phase 7.5 s. Across all three dialogue chapters, main timeline now assigns Heimdall 3/9 s, Loki 4.5/7.5 s, Odin 7/4 s. The six exact lines remain unchanged and the main timeline remains 77 s.
- Word-count reading-time heuristic subtracts the actual 0.65 s entrance: approximately 158–187 words/minute for this Loki pair. This heuristic is not human readability acceptance. Regression tests check all six phases against a conservative ceiling, plus exact script and timeline continuity.
- Syntax/lint, TypeScript, timeline and ending tests passed. Quick create and actual project-entry shot acceptance remain separate and incomplete; this dialogue preview does not close them.
