# Selected construction workers — 3 October 2026

## Reproduction and source boundary

Fork main `8c9a29fb732254b9940ff338f74cbc605cbd9fc5`, Node 24.19.0,
Linux cloud, ordinary published Open Field with 16 starting units and declared
500 food / 1,000 wood. Actual client selection, placement and serialization
functions run in a VM with supplied rendering/picking; their emitted command
goes to the real authoritative server over WebSocket.

Before the fix, selection `[0]` becomes `[0,1,2,3]` in
`src/main.js:beginBuildPlacement`. The serialized `build` command names all four
workers, with their generations. The server assigns all four exactly as
requested. The two unselected gatherers lose their node orders and the other
worker loses its Shift-queued movement. This is a client selection mutation;
`buildBuilding` derives builders from `commandUnits`, not an automatic roster
recruitment. The same broad client mutation exists in `resumeConstruction`.
The old function is also present at historical main `90ad320`; this is not
claimed as a newly introduced regression or as the observed production revision.

`node scripts/construction-selection-scenario.mjs --observe` records the trace
without asserting success. Ten focused client regressions reproduce the single,
cooperative, empty/ineligible, selection-change and helper boundaries for both
seats. The baseline fails the selection invariants.

## Correction and validation

Beginning placement preserves the explicit selection. Placement reads the live
selected living friendly workers at submission, with fresh generation metadata.
No eligible selection produces no command. Construction buttons require selected
workers and name that scope. A new build keeps the existing immediate-order
semantics; Shift does not introduce a new construction queue. Unselected units'
queued movement remains untouched.

Resume remains available: selected helpers route to the closest unfinished
friendly registered construction, measured from their mean position with stable
ID ties. Its label and action choose the same site. It preserves selection and
does not recruit other workers. Server interaction, cooperative build progress,
nearest builder access, palisade sequences and cargo-return logic are unchanged.
The wall line and single-cell menu preserve the same selected-worker scope;
the integrated PR #71 drag, keyboard, preview and wall payload behavior remains.

The native two-seat scenario verifies single and cooperative assignments,
unselected food/wood gathering and queued movement, empty/foreign/stale-generation
rejection, nearest selected-helper resume, checkpoint restart and paid completion.
Integrated source `d4945be32e05a77ab3a47cfd5ffa4a2350bda6d8` includes wall PR #71
and the current camera settings. Client SHA-256:
`67275cf8a110e43f51c0e3b734819b25a9cd8ebcefc2f8f7cef85c265e530089`.
Azure keeps selection/payload/assigned builder `[0]`; Ember keeps `[8]`.
Both unselected food/wood node IDs and the third Worker's queued destination
remain unchanged in the authoritative checkpoint. The paid palisade recovery
scenario and interrupted final sheep-cargo delivery also pass at this source.
74 focused selection, connection, HUD, affordability, roster, Return cargo,
palisade, wall gesture and CI-sharding tests pass. Rendering/picking are supplied in these checks; no Chrome
appearance or user's deployed session is claimed. Local browser sandbox/storage
is unavailable. Integration/review evidence is recorded in the owning PR.

## Exact Mac reproduction / acceptance

1. Use an identified build containing the fix. Open Fortified Crossing with two
   seats at 250 units; record the URL and displayed build. Have enough wood for
   two Houses. Staging and production may currently have different source builds.
2. Assign two Workers to food/wood and give a third Worker a Move followed by
   Shift + right-click ground. Single-click the fourth Worker so the selection
   count shows one.
3. Choose Build House and click a clear site. The selection must stay at one and
   only that Worker changes to construction. In DevTools → Network → WS →
   Messages, the outgoing `build.ids` must contain one ID and one generation.
   Before the fix, choosing Build alone expands the selection to all Workers.
4. Select two Workers explicitly and place a second House. Both cooperate;
   unselected gathering and queued movement continue. Cancel the placement
   preview, not the paid first site, if checking selection changes before submit.
5. Stop an assigned builder, select the desired helpers and choose Resume
   construction. They go to the nearest unfinished friendly site; other Workers
   retain their work. Reload/reconnect: server assignments resume without an
   extra client build command. Repeat as Ember. A screenshot alone cannot prove
   assignment scope; compare outgoing IDs and visible worker tasks.

This source check does not assert that an old Railway production session has
received the fix. Verify the deployed build before repeating the acceptance.
