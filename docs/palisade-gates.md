# Manual Palisade gates

This bounded foundation extends the [paid Palisade runtime](palisade-runtime.md).
The normal building menu offers a one-cell **Palisade Gate**. It reuses the
explicit configurable Palisade profile: 15 wood, five accumulated Worker-seconds,
300 HP, no food. These remain provisional engineering values, not final gate
balance. Gate construction, cancellation, damage and repair use ordinary
building rules. Building IDs advance only after successful paid admission.

## Operation and movement

An unfinished gate blocks movement and cannot open. A completed gate starts
closed. Its owner can select it and use **Open gate · both teams may pass** or
**Close gate · blocks both teams**. The authoritative command is
`{type: 'setGateOpen', buildingId, open: true|false}`. Desired states are
idempotent; duplicate requests do not toggle twice or invalidate navigation.
Enemy players and spectators cannot operate it. Operation consumes no resources
and recruits no Workers.

Opening clears the gate's existing building movement mask for **both teams**.
Closing stages that same mask and reuses the building connectivity and active
route checks, with restoration in `finally`. Closing rejects if any living unit
occupies the cell, or if an existing entity/active route loses access. A rejection
changes no gate state, bank, ID, navigation revision, cache or unit order.
A successful change increments navigation once and clears the existing vision
and attack flow caches; closing repairs affected paths through the existing
route repair function. Opening preserves current unit orders.

This conservative foundation cannot close the last passage between existing
entities. Trapping, team-specific access, automatic opening, locks, siege rules
and pathfinder changes are future decisions. Manual owner operation with
shared traversal was the recommendation reported before normal-menu behavior.

## Occupancy, connections and recovery

An open gate still reserves its building footprint. Neither ordinary buildings
nor an enemy wall line can occupy it. A friendly wall line reuses the gate cell
without payment or changing its open state. Gates and walls derive the same
same-team cardinal connections from disclosed buildings in each snapshot.
The preparation boundary admits Worker approach cells through an explicit,
bounded subset of existing completed-open gates; solid wall cells remain
excluded. Reserving a gate for placement does not prohibit standing in it.
Reusing an unfinished gate does not recruit its builder or turn it into a wall;
resume that gate through ordinary construction controls.

Schema 22 persists an explicit Boolean `gateOpen` on gate rows. The full restore
validator rejects missing/non-Boolean state, open unfinished gates and gate
fields on other buildings. Footprint overlap validation reserves every building
regardless of movement state. Restore derives the movement mask from completed
open state, without repaying, relocating a unit standing in an open gate, or
changing building identity. The exact preceding gate-free ruleset
`v1:561c62ccc67ac78cc067e8e639942a83fc6d6b1f89633e5b1c73aedc20f4a3a6`
is recognized as additive; gate rows/fields under that old identity are rejected.
Paid Docks from that exact preceding roster survive the migration.
Older Palisade/Mill/Dock migrations exclude invented gate state as well.

## Art interface

The runtime appearance is procedural placeholder timber, with two hinged leaves
and side posts. Both states fit the one-cell center pivot and half-cell edges;
timber height is 1.4. North/south-only joins rotate the visual ninety degrees;
east/west or no joins use its default orientation. Cardinal connection data and
`gateOpen` are the art interface, not a final mesh or sprite requirement. There
is no final gate/wall kit adoption in this slice. The independent modular art
lane can supply its own open/closed geometry under the existing Palisade
presentation profile. Corner/junction gate appearance and explicit authored
orientation remain later art decisions.

## Evidence

`scripts/palisade-gate.test.mjs` checks the pure planner, actual server operation
handler, exception-safe staging, actual lifecycle buttons, strict state and
ruleset migration, disclosed occupancy, and geometry bounds.
`scripts/paid-gate-scenario.mjs` uses actual paid commands and naturally
progressing Workers on both seats, closed routing, owner-independent open
traversal, occupied/last-route closing rejection, token/restart recovery and
corrupt-checkpoint preservation. See the [native Mac recipe](qa-palisade-gates-2026-10-03.md)
for the unclaimed human usability/appearance check.
