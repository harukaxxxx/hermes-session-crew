# Isolated SessionCrew state adapter — handoff

## Candidate and scope

- Worktree: `/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo`, branch `demo/video`, base `f332a4cd3faef17f119561fa836cba1935bf9b57`; **uncommitted** candidate. No commit/push.
- Deployed frontend baseline was byte-identical to commit `40bc67c871ab088370a3a12385b161ea19fd3ad1`. Its recent-list layout/scroll behavior was brought into the candidate before the adapter edits; backend baseline matched this worktree. Do not copy the older base frontend instead of the candidate.
- Only the exact resolved root and runtime home `/Users/haruka/SessionCrew-Demo`, with process environment `SESSIONCREW_SCRIPTED_DEMO=1`, can accept control. Starts **off** on each process start; changes are bounded process-local state. Keep Webapp's backend route on the root/default profile; a named-profile plugin host is rejected. No data/session/ledger files are written by this adapter. Completion observations use a separate ephemeral frontend store and query key; live storage is not used for synthetic observations.
- These are synthetic statuses, not native execution evidence. Source metadata is included in the API; as requested, no source badge or banner is rendered. The status response remains an array. Synthetic roster: `default` (Odin), `heimdall`, `loki`, `thor`, `tyr`, `freyja`, `frigg`, `baldr`; other roster entries are hidden only while synthetic status is selected.
- Stages: `idle`, `reminder` (Heimdall waiting + hand), `working` (Thor/Tyr/Freyja/Frigg), `overlap` (same four, Odin three shadow layers), `settled`; Baldr stays offline. Set `off` to return to live; set `idle` before replay. The hand is a bounded synthetic view, not a native completion. Source/stage metadata also appears on the synthetic completion snapshot. Render polls status every 5s and synthetic snapshot every 5s; allow settling after each change.

## Exact runtime files (only these two)

| Source relative to worktree | Destination relative to `/Users/haruka/SessionCrew-Demo/plugins/profile-rail` | SHA-256 candidate |
|---|---|---|
| `dashboard/plugin_api.py` | `dashboard/plugin_api.py` | `225d025cc048b5535954da1340fd1159a8afc83876bfa5d6b38bb80f9ca9c94f` |
| `desktop/plugin.js` | `desktop/plugin.js` | `9ce81387477f2733c49057e88fbb848f90d205a0967213d8a376877c06a19453` |

Before copying, confirm current destination hashes still equal baseline: backend `a3ae99d9a17b5b838d44872ea7c264d6fa361dad186086777bf81b077cf1402c`; frontend `dba36e4484fd27915e1460e60e9cc105eab430f3d044ac75610c100ef7b7d50e`. Stop if they changed. Parent should preserve those exact two current files in an isolated backup, copy the candidate two files to the exact targets (not generated desktop mirror), and verify both target hashes against the table. Avoid copying `.pyc`, tests or unrelated files. Ensure the new frontend entry has a fresh mtime if the public rescan uses marker timestamps.

## Parent activation and control (not performed by implementer)

1. Verify the isolated listener/process owner and that the lifecycle is unmanaged. A supported backend refresh is separate from frontend reload. Subject to lifecycle guards and the parent's authorized decision, an unmanaged isolated restart may be invoked with a clean environment, e.g.:

   ```sh
   env -i HOME=/Users/haruka PATH=/Users/haruka/.local/bin:/opt/homebrew/bin:/usr/bin:/bin \
     HERMES_HOME=/Users/haruka/SessionCrew-Demo HERMES_DISABLE_LAZY_INSTALLS=1 \
     SESSIONCREW_SCRIPTED_DEMO=1 /Users/haruka/.local/bin/hermes gateway restart --detach
   ```

   Do not use `--all`, `--force`, or bypass active-work/supervisor guards. Environment propagation and the actual serving backend have **not** been live-verified; confirm through the control/readback below. If service-managed, do not assume this shell environment reaches it.
2. On the same authenticated Webapp, use Capabilities → Plugins → **Rescan**, then ⌘K → **Reload desktop plugins**; verify the generated mirror matches candidate bytes and the actual renderer reloaded. This does not reload the cached Python backend by itself.
3. Using the existing authenticated browser session's ordinary same-origin request facility (no credential extraction), POST JSON `{"stage":"idle"}` to `/api/plugins/profile-rail/scripted/control`; expect `{ "source": "synthetic", "stage": "idle" }`. Replace `idle` with the desired fixed stage. Invalid stage returns 422; missing opt-in or wrong root/home returns 403. Check `/api/plugins/profile-rail/status` remains an array of eight synthetic-tagged entries and `/api/plugins/profile-rail/completion-snapshot` has matching `source`/`stage`. Ensure the control request and renderer use the same default-profile route/process: state is not shared across plugin hosts. Parent must verify the visible eight, hand, four working, Odin shadows, Baldr offline, replay, and return to live in the actual Webapp.
4. To end the sequence POST `{"stage":"off"}`; wait for fresh status and snapshot, confirm original 15-profile live roster and no residual synthetic hand or layers. For full rollback, restore only the two backed-up files, read back hashes, restart the isolated backend **without** `SESSIONCREW_SCRIPTED_DEMO`, and repeat public Rescan/Reload; verify live endpoints and renderer. Do not edit `config.yaml`, native records, generated markers or host caches.

## Verification performed

### Parent activation subsequently exercised

- Corrected the four working roles to Thor/Tyr/Freyja/Frigg to match the brief; Python 126 tests and the JSDOM source-switch regression passed again after that change.
- Backed up the exact previous runtime files to `/Users/haruka/SessionCrew-Demo/backups/state-control-20261111-030804`, copied only the two files above, and compared target hashes.
- Executed the authorized isolated `gateway restart --detach` with opt-in; the port 4178 listener changed from PID 87897 to 26447. No installation or forced interruption flags were used.
- Used public Rescan and Reload desktop plugins. Generated `desktop-plugins/profile-rail/plugin.js` matches the frontend hash above.
- Authenticated control and reads passed in the same Webapp: idle returned eight tagged entries; overlap returned the four intended working roles and Odin presentation count three; off restored the original 15-entry live response; reminder returned Heimdall waiting and its synthetic unread marker.
- Parent visually confirmed green working frames and face/word bubbles, Odin shadows, Baldr grayscale, and then Heimdall's yellow frame, hand and first position. This establishes live renderer consumption of controlled data, not native model execution. Full bubble legibility, recorded transitions and final-film integration remain pending.
- Recording has been handed off with exclusive stage control. Do not independently change stages during that recording; it must end with off and a fresh live readback.

- `env -u PYTHONPATH TMPDIR=/Users/haruka/.hermes/profiles/shirogane-yuine/cache/scratch HERMES_DISABLE_LAZY_INSTALLS=1 /Users/haruka/.hermes/hermes-agent/.venv/bin/python -m pytest tests -q`: **126 passed**. Includes TestClient against the real plugin router with isolated roots and Hermes's actual loopback auth middleware (fixture token, no listener): 401 unauthenticated, 200 authenticated; invalid inputs, opt-in/scope, fixed stages, replay and live route regressions. It does not prove the deployed OAuth or actual routing path.
- `node --check desktop/plugin.js`: pass. Existing ESLint `--no-config-lookup` pass (parser-only, no configured rules).
- `HERMES_CHECKOUT=/Users/haruka/.hermes/hermes-agent node --experimental-vm-modules tests/scripted-rail.mjs`: pass (JSDOM mocked SDK/REST, source transition, eight-profile filtering, hand, four working, three owned shadow layers, no source text and separate storage). Prior existing `status-own.mjs`, `mark-all-source-switch.mjs`, and `completion.mjs` passed controlled mocks; not real Webapp evidence.
- The full controlled browser suite was not run because it starts test listeners, outside this delegate's scope. No installed-plugin refresh, live endpoint, live renderer, gateway restart, or recording was performed here. Parent's pre-change authenticated 15-profile GET is a baseline, not acceptance of this candidate.
