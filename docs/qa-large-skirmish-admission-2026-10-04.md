# Large Skirmish admission

[Crownroads map evidence](qa-crownroads-2026-10-04.md) · [Mode contract](match-mode-contract.md)

Owner: playable-modes runtime task `01a103cc`. Map
[PR265](https://github.com/lbeezr/thousand-unit-skirmish/pull/265) merged at
`1d380b0ae7acca140a6f4289837aa145fc50f34e`. This receiver adds only reviewed
`veyrholds-crownroads` to human Skirmish compatibility. Tiny remains the ordinary
default and only supported fresh PvE map. Canonical256×256 terrain, fog, ordinary
24-unit/150-food/250-wood opening and recovery-aware defeat remain unchanged;
this map already has no victory posts, events or deadline. No server, UI, AI,
timer, schema, economy, grid-limit or capacity change.

## Native ordinary acceptance

The [paid receipt](qa-evidence/large-skirmish-admission-2026-10-04/paid-entry.json)
uses clean source `95800de30ed9618f2ab3b4d3feca5226df6d7540`, based on the exact
map merge. Real Create Room starts Tiny Skirmish; ordinary map-only selection
chooses Large without another mode opt-in; both humans Ready/Launch and receive
16,384-byte packed fog. Both pay75 wood for completed Houses and deposit gathered
food. A real supervisor stop/start resumes both original seats and preserves
Skirmish, match ID, canonical map/hash and paid development. Host reset returns
to the same Large lobby and original opening. A separate one-human explicit
Skirmish Practice room selects Large, advances its clock and moves a Worker.
No grants, position injection, checkpoint edits or alternate fixture map occur.

The initial collector completed its human paid/cold/rematch assertions but waited
for an idle Practice state update before issuing movement. Idle clock advancement
need not emit a state broadcast. The corrected probe retains the same clock,
one-seat and movement assertions after the ordinary move command; the complete
clean run passes. No runtime clock or Practice change was made.

The [floor receipt](qa-evidence/large-skirmish-admission-2026-10-04/ordinary-entry.json)
passes eight real entry cases, now asserting the eight actual ordinary maps,
Large256 dimensions and human-only Skirmish catalog. Fresh AI remains Tiny-only;
exact historical Authored seeds/map/mode and cold recovery remain intact.
[44 focused tests](qa-evidence/large-skirmish-admission-2026-10-04/focused.txt)
pass for registry, controls, size, Crownroads and Confluence. Types/import checks
pass. Independent source review passes88 focused checks and approves the only
runtime allowlist change plus the corrected collector order.

Canonical map SHA256:
`0b62a9f967ef42c967eb9121e07395b75549d52d4a73dd16eaf29aebf19e3727`.
Saved canonical hash: `bhbpYUqxKtvWd846zJMJQT4mylfXRpsjelQbxadZBC0`.
The map owner's actual cross-base arrivals, resource conservation, paid Scout
and expansion evidence remain pinned to their original measured source in
PR265; this receiver does not relabel those as Skirmish or served measurements.

## Unchanged Confluence failure

An independent [baseline receipt](qa-evidence/large-skirmish-admission-2026-10-04/confluence-baseline-review.json)
and [raw failure](qa-evidence/large-skirmish-admission-2026-10-04/confluence-baseline.txt)
reproduce `node scripts/vaelora-map-layout-scenario.mjs --check-only` exit1 on
base `1d380b0a`. At line21 it requires a food/wood resource node within9 Euclidean
world units of each spawn. First failure:
`siltmouths-confluence-grounds.json: visible home food for seat 0`.
The predicate includes Sheep; contrary to the map report's explanation, their
nearest positions exceed the radius. Both mirrored seats have food distance
9.486833 (`s{team}-sheep-0`) and wood distance12.806248 (`s{team}-timber`). Fixing
food alone exposes wood. Confluence's separate focused tests pass5/5; all current
Crownroads layout assertions pass. No general/full CI pass is claimed.

Confluence, its generator/test and the layout script have zero diff from
`5bd23914` through this admission. The mode allowlist cannot affect this script,
which reads canonical maps directly. [Map-owner coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/265#issuecomment-5976633331)
records a mirrored coordinate proposal retaining the nine-unit assertion,
reachability, stock and static city space. It is not applied here; the map owner
retains canonical regeneration and refreshed paid/fog/recovery evidence.

## Delivery still owned

This is native paid entry/recovery/Practice proof, not full human balance,
capacity, browser pixels or deployed acceptance. Large PvE remains unsupported;
AI owner `01a10297` retains any future qualification. Runtime retains exact
containing release and ordinary served human/Practice acceptance; staging owner
`01a10227-2c6d` owns deployment execution. Parent explicitly requested no Railway
calls while approval is pending; none are made for this slice. The admission PR
records final reviewed/merged source and package separately from any deployed
revision. Next acceptance is identified served Large selection, fog, paid economy,
cold recovery/rematch and rendered map observation after authorized deployment.
