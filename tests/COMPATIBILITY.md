# Candidate compatibility and test boundaries

This candidate is based on SessionCrew `c0454fd2f327c1b33b021c8e50294a8800ad7f98`.
It is not a deployed or catalog-approved release.

## Functional regressions

- `test_status_database_lifecycle.py` exercises the public FastAPI `/status`
  endpoint with synthetic databases. Literal `?`, `#`, `%`, spaces and Unicode
  paths must report the correct aggregates without creating/changing files.
  Rename/recreate, unlink/recreate, corrupt replacement, atomic replacement and
  a healthy sibling profile are covered.
- `request-priority.mjs` renders the plugin through the public SDK boundary.
  Opening/retrying recent sessions and creating sessions use foreground;
  subsequent interval/focus query callbacks and legacy scope fallback use
  background. Project-list warming is background. Explicit project creation,
  LLM generation and post-create/retry refresh retain foreground; the dialog
  regression checks the write/generation calls. No layout/CSS redesign.
- `sdk-route-contract.mjs` tests the plugin's public `host.requestProfile` and
  `host.openSession` arguments, preserving the complete descriptor including a
  different backend target. Incomplete and ambiguous routes must issue no RPC.
  It does **not** import the SDK working tree or certify downstream transport.

The complete local controlled suite passed **72/72 commands**, including
Chromium; independent pytest passed **120 tests**. Counts overlap and must not
be summed. Existing dependencies/native fixtures came from Hermes checkout
`2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`, whose working tree was dirty.
`run-controlled.mjs` now records this source provenance in its JSON and uses
an environment allowlist. These results are not clean official compatibility
or live authentication/renderer acceptance.

## Official routing: reproduced failure; compatibility gate remains OPEN

**Current status:** a subsequent clean-official selected-function integration
reproduced a connection A → B wrong-target send on v0.23.1 while A readiness
was pending and the window primary changed to B. The stable control exited 0;
the owner-safety assertion in the route-change case exited 1. This is not the
older `options.targetProfile` forwarding-shape failure described below.
See the [known issue](../docs/known-issues/hermes-v0.23.1-routing-race.md) for
fixed source links, triggering interleaving, actual serialized frames, root
cause and evidence limitations. It is selected-function integration with
simulated HTTP/WebSocket and in-process IPC, not a complete release host,
canonical/native transport or live Desktop test. No upstream issue was filed
and no core fix was made.

### Earlier adapter-only gate (retained, not wire-target proof)

Source-only baseline (no dependency installation or Hermes CLI):

- Official release [v0.23.1](https://github.com/NousResearch/hermes-agent/releases/tag/v0.23.1),
  tag resolved to `3b421578588243f920886e6fe79a6faa87ea026e`.
- Previously reviewed official main `553595b9839209650632efffac4d5c92675fa1aa`.
- The tested `sdk/profile-request.ts`, `sdk/index.ts` and `store/gateway.ts`
  have identical SHA-256 values between these two revisions. Digests are pinned
  in `sdk-upstream-baseline.mjs`. Source inputs must be explicitly supplied;
  mismatched/locally modified SDK bytes are rejected, never silently accepted.

Run this **separate mandatory compatibility gate**, in addition to the
functional runner, using source downloaded from the exact official revision:

```sh
node --experimental-vm-modules tests/sdk-upstream-baseline.mjs \
  /absolute/official/source 3b421578588243f920886e6fe79a6faa87ea026e
```

`HERMES_CHECKOUT` supplies existing `esbuild` dependencies only for this gate;
SDK source is read exclusively from the explicit source argument and hash-checked.
At both official revisions this exits **1**: the adapter forwards connection,
Desktop profile and foreground priority, but not an explicit `targetProfile`
option to its downstream gateway helper. The earlier safety-related forwarding
expectation remains asserted in this separate test, not removed to obtain green.
The public-boundary mock cannot discharge this gate. Supplying the local dirty
SDK instead also exits 1, at the source-integrity assertion.

This adapter-only result is **not itself proof of a wrong wire target**:
downstream registry resolution could provide equivalent targeting. The later
selected-function integration now demonstrates a specific shared-primary
route-change race through the real registry and serializer; it does not rely
on the adapter option shape. That run used identical Desktop/backend profile
names on two sources. Distinct names, secondary routing and the remaining
route-change matrix are still unverified. A fake final gateway cannot replace
those checks, and the controlled suite's green result cannot close this gate.
The old contract test also fails earlier on official malformed-route error text
(TypeError rather than its hardcoded message); the new plugin test asserts the
public fail-closed behavior instead of host-internal exception wording.

## `requires_hermes`: deliberately not guessed

`plugin.yaml` remains unchanged. v0.23.1 is a verified official source baseline,
**not a supported floor for the required owner-routing guarantee**: the later
integration reproduced a wrong-source send at this revision. No complete clean
official release matrix/backend integration was run. Before declaring a floor:

1. Obtain an upstream-fixed official revision and rerun the route-change red
   regression, then complete the remaining owner-routing matrix. Do not patch
   local core/SDK or treat an adapter-only assertion as wire evidence.
2. Exercise all required backend public helpers and frontend contracts on a
   complete official release using an authorized dependency environment.
3. Choose a tested passing release as the real SemVer floor and match any
   catalog entry. Claim an earliest passing release only if earlier releases
   were also checked; finding the historical earliest version is not required
   to state a conservative tested floor.

No install, validator/CLI launch, activation, deployment, restart, commit/push,
live account, live session or production-data operation was performed here.
