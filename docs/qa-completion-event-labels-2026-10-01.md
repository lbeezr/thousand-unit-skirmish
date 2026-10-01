# Completion-event waiting labels — 1 October 2026

Baseline: main `f2f970f9654f3edf7cde3858878a75628dea62ba`.
The research control names `infantry-attack` as `INFANTRY FORGING`, but its live
completion waiting card displayed `WAITING FOR infantry-attack · TEAM 1`.
Only that waiting branch now resolves existing building/technology labels and
Azure/Ember names. The example becomes `WAITING FOR INFANTRY FORGING · EMBER`;
an `either` completion condition displays `EITHER TEAM`.

The condition's team is absolute, independent of the viewing player or reward
recipient. No names are generated. A malformed/missing registered reference or
team yields neutral `WAITING FOR COMPLETION` rather than an invented name or
capture condition. Such invalid conditions remain rejected by existing map
validation. Internal IDs, event objects, serialization, arming and delivery
rules, editor diagnostics and authored scenarios are unchanged.

```sh
node --test scripts/completion-event-labels.test.mjs \
  scripts/objective-summary.test.mjs scripts/scenario-regions.test.mjs \
  scripts/scenario-authoring.test.mjs scripts/ci-sharding.test.mjs
```

Actual-source tests cover every registered building/technology with teams
0/1/either from both player seats and a spectator, preserved serialized events,
missing/unknown/prototype references, armed countdown, delivery, ended match,
rematch waiting and the other existing trigger labels. Five new test groups
fail on baseline; the unrelated trigger-label group already passes. These are
controlled source-function text checks, not rendered browser appearance,
human discoverability or a new authoritative-match proof.
