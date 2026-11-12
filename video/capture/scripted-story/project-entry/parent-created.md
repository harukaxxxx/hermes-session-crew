# Native Ragnarök project creation — parent verified

The parent created the project through the existing authenticated Webapp's native command palette: Cmd+K → Open folder as project → Choose remote folder → SessionCrew-Demo → New folder `Ragnarök` → Select folder.

Created isolated folder: `/Users/haruka/SessionCrew-Demo/Ragnarök`.
Native readback: the sidebar now shows a separate `Ragnarök` project and the bottom workspace indicator shows Ragnarök. Screenshot: `/Users/haruka/.hermes/profiles/shirogane-yuine/cache/scratch/project-parent-created-readback.png` and `project-parent-move-menu.png`.

Existing scripted Odin session `sessioncrew-scripted-story-odin-v1` still appears under Home. No successful move or project ID readback claimed. A blank Untitled draft was opened by the native folder-as-project flow; no inference was submitted.

Important UI observation: with application UI Scale 150%, the native sidebar context menu appeared far below its clicked row. Move to project submenu was outside a normal viewport. Temporarily using a tall 1920×2160 setup viewport revealed the destination Ragnarök, screenshot `project-parent-submenu-taller.png`. Selecting it did NOT produce verified movement; the current row remains in Home. Do not claim success. Emulation was cleared afterward. This is only a setup workaround, not an accepted filming aspect ratio or host UI fix.

Source references for a future bounded public-transport investigation: native app store `/Users/haruka/.hermes/hermes-agent/apps/desktop/src/store/projects.ts`, public RPC contracts `/Users/haruka/.hermes/hermes-agent/tui_gateway/contracts/projects_pets.py`. Reading implementation is not permission to invoke internal handlers or manipulate host runtime state.

## Successful native session assignment (supersedes move-pending above)

The parent temporarily changed public Appearance → Typography → UI Scale to 100% for setup, leaving Chat Text Size 110%. This made the native session context menu and Move to project destination visible at their actual coordinates. Selected the existing `Scripted demo: Ragnarök` row → Move to project → Ragnarök. After reloading and allowing the view to settle, screenshot `/Users/haruka/.hermes/profiles/shirogane-yuine/cache/scratch/project-settled-reload.png` shows that exact title nested under the separate Ragnarök group, while Home lists Rainbow Bridge and Nine Realms instead. Native assignment is verified; no direct database write or private handler was used. No project ID was extracted.

Restore 150% UI Scale before filming. The current post-reload UI shows Backend checking and did not open Settings on two observed attempts; further blind clicks were stopped. Current screenshot `project-scale-ready.png` retains the verified group membership but is not recording-ready. No project-entry footage has yet been recorded.
