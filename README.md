<p align="center"><img src="assets/sessioncrew-hero.png" width="100%" alt="Vintage editorial illustration of a crew organizing conversations across profiles"></p>

<h1 align="center">SessionCrew</h1>

<p align="center"><strong>Your profiles. Their sessions. One place.</strong></p>

<p align="center"><strong>English</strong> | <a href="README.zh-TW.md">繁體中文</a></p>

<p align="center"><a href="#features">Features</a> · <a href="#installation-and-requirements">Installation</a> · <a href="#basic-usage">Usage</a></p>

SessionCrew is a Hermes Desktop plugin that lets you view sessions from different profiles in one side panel. Select an avatar to open that profile's conversations, start a new conversation, or see its related projects. It's useful when you work with multiple Hermes profiles and don't want to keep switching between lists.

## Features

- **Browse conversations by profile**: Select an avatar to see recent sessions. Open an existing conversation or start one in Home or a related project.
- **View and create projects**: List projects associated with the selected profile's sessions, browse folders on the gateway, create folders, and add projects. Nonblank project ideas are saved as `IDEA.md` in the primary folder after creation, without overwriting an existing file.
- **Observe status**: See available statuses such as working, waiting, or offline; the status is unknown when there isn't enough data. The activity count beside an avatar reflects only what has been observed, not a complete count of all running work.
- **Session row activity**: A native-inspired arc marks positively identified working turns and some background work; a dot indicates a turn waiting for input. Unknown is not idle. The backend checks the displayed IDs against the fleet's session databases without reading messages.
- **Completion reminders**: A ✋ appears when newly completed work is observed. Open the conversation or use “Mark all as read” to acknowledge it. This is not a complete unread notification system: completions during interruptions or from incomplete sources may be missed. “Mark all as read” acknowledges known unread completions for the selected profile from verifiable sources in the current connection, including sessions not yet loaded in the list; it does not mark other profiles as read.
- **Personalize the display**: Edit short phrases for each status and control visible profiles, offline profiles, and cron conversations in settings. The interface is available in English and Traditional Chinese; Desktop versions without translation API support fall back to English.

## Installation and requirements

SessionCrew includes a Desktop interface and its own Python backend; both are required. The backend needs the dependency `ruamel.yaml`, listed in [`plugin.yaml`](plugin.yaml), and a Hermes environment that provides the required public plugin APIs. The controlled-tested minimum is Hermes 0.23.0 (`requires_hermes: >=0.23.0`); controlled compatibility and owner-routing tests do not establish live routing acceptance. Catalog admission remains subject to official CI and maintainer review.

The plugin ID is `sessioncrew`. Follow the [Hermes plugin installation instructions](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins) to review and install the plugin package in this repository. After installation, enable the SessionCrew interface under Desktop **Capabilities → Plugins**, and enable the plugin's backend separately for each profile that needs to provide data. Enabling the interface alone does not provide backend data.

## Basic usage

1. Open the SessionCrew panel in Hermes Desktop and select a profile avatar.
2. Select a session to open its conversation. Use the panel's add button to start a conversation in Home or a listed project.
3. Open the project list to see related projects, or choose to add a project and select a folder on the gateway.
4. Adjust display options under **Settings → Plugins → SessionCrew**; select the phrase in the bubble to edit the text for the current status.

If creating a conversation reports a failure, check the native session list first: the request may have succeeded even if the response was lost, and retrying immediately could create a duplicate. When the connection, data, or permissions are unavailable, the interface shows an error or an unknown state; it does not substitute local data for remote results.

## Data and permissions

- For authorized profiles, the backend reads profile settings, status, and session metadata from the Hermes data root to display names, statuses, and completion reminders. Completion snapshots do not read conversation message content; conversation and project lists are obtained through Hermes interfaces.
- The folder picker starts at the gateway's Hermes data root, but can browse other absolute paths accessible to the process and create folders in writable locations. It exposes folder names and is not a sandbox limited to the Hermes root; it does not read file contents or follow symbolic links. Only POSIX paths are currently implemented.
- Display settings, phrases, and completion reminder records are stored in the current client's plugin storage and do not automatically sync across devices. Switching connections or reloading establishes a new completion observation baseline; completions during interruptions are not backfilled.
- On Linux, the backend reads `/proc/self/ns/pid` and may inspect process liveness and start times to assess lease status; unavailable information is treated as unknown. On POSIX, `dashboard/waiting_status.py` may run `ps` as a subprocess (`subprocess.run(['ps', '-o', 'state=', '-p', str(pid)], ...)`, with Python's default `shell=False`) for a best-effort zombie check when its earlier probes are unavailable; this does not invoke a shell.
- When generating project ideas, the project name is sent to the selected profile's model; network and data handling depend on that profile's model provider settings. The plugin does not itself read credentials, execute shell commands, open a separate HTTP listener, update itself, or collect telemetry. Hermes itself may start profile plugin-host subprocesses on demand.

## Limitations

- Status and activity counts are limited observations; an unknown status or no observed activity does not mean there is no work.
- Row decorations require a connected gateway, an unambiguous same-name owner route, and an authority-shaped `session.active_list` row: its ID must equal its `session_key`, and its nonempty `source` must match the uniquely owning database record. At the inspected Hermes revision, the authority emits this shape from durable live entries; the process-wide legacy list does not include `source` and is not sufficient, even when its fallback ID equals the key. This is a version-specific shape check, not an explicit producer attestation. The strict inventory fails closed on unsupported profile entries or unreadable databases; duplicate IDs, source or owner mismatch, missing records, stale observations and failed requests suppress decorations. No lineage aliases are inferred. Background counts from `subagent.roster` are shown only for an identified active row with a non-waiting status; starting alone is not execution. These observations do not cover all native states or background work and have not been live-validated.
- The conversation list is not a complete chronological ordering across sources and is subject to backend return limits and permissions.
- Completion reminders are not a replayable event log; completions may be missed when a source is truncated or unreadable, or when the connection is interrupted. When ⚠️ indicates a source error, you can retry manually.
- Folder operations and idea saving modify the gateway filesystem. Ideas are limited to 65,536 UTF-8 bytes; an existing `IDEA.md` is never overwritten. Identical-content retries can confirm a save; a different existing file or an uncertain result leaves the text available for copying or an idea-only retry. Check the actual file before retrying. A busy directory returns an error rather than waiting.
- Idea writes check runtime and directory identities, reject symlinks, hardlinks, common credential directories and the Hermes management root, and read back the file. These checks are not a sandbox: other processes can move directories or change files, and the lock only coordinates cooperating writers. The backend echoes the project ID and owner but does not independently authenticate project ownership. Owner RPC and REST filesystem routing, including connection changes, remain unverified live; a request already sent can race a scope change. If creation finishes after a connection change, the dialog preserves the known project and text without saving across scopes.

## Development

The Desktop entry point is [`desktop/plugin.js`](desktop/plugin.js), and the backend is [`dashboard/plugin_api.py`](dashboard/plugin_api.py). The controlled test entry point is [`tests/run-controlled.mjs`](tests/run-controlled.mjs). It requires an existing Hermes checkout, JavaScript dependencies, a Python environment, Chrome, and a scratch directory outside the repo. Set `HERMES_CHECKOUT`, `CHROME_PATH`, and `RAIL_TEST_SCRATCH`, then run `node tests/run-controlled.mjs` with Node 22.

Syntax and mock tests, catalog validation, live Desktop/backend acceptance, and official catalog review are separate gates. Passing one does not establish the others. The current candidate's live routing and Desktop/backend acceptance and official review remain incomplete; review the validator's security and Desktop-surface warnings before submission.

## License

SessionCrew's own code is licensed under the [MIT License](LICENSE). For the sources and terms of third-party assets and code, see the [Office license notice](dashboard/OFFICE-LICENSE), [Hermes folder picker license notice](desktop/HERMES-REMOTE-PICKER-LICENSE), [Hermes spinner license notice](desktop/HERMES-SPINNER-LICENSE), and [Hermes row arc license notice](desktop/HERMES-ARC-LICENSE).
