# Parked construction and exact military endpoints

This caller-owned audit first reproduced the existing contract on main
`252abb29cc0a8638ec7a68844f4f631bc01123dc`, including crowd PR443, then qualified
it with merged core PR438 on `16047ce2e8885b84275589578da2f037ef918c3e`. It changes
no runtime behavior. The [crowd finding](qa-crowd-forward-yield-2026-10-05.md#parked-builder-and-exact-endpoint-contract)
and [core's proposed seam](https://github.com/lbeezr/thousand-unit-skirmish/pull/443#issuecomment-5989473200)
describe a physical conflict, distinct from remaining crowd final-approach stalls.

## Decisive real-command witness

The open version of the existing four-infantry baseline map removes the choke
so this witness isolates endpoint occupancy. Both seats issue normal production
commands: move one selected Worker to `(2.5,.5)` and one infantry to
`(-20.5,.5)`; pay for a House at `(6.5,.5)`; move the infantry exactly to
`(4.5,.5)` and queue `(-8.5,8.5)`. Both military-before-build and
build-before-military ordering reproduce the conflict. Both seats also cover
explicit builder Stop and Hold after completion.

The House costs exactly 75 Wood and completes. Its sole selected builder parks
at `(4.5,.5)`, the same position as the accepted military point. With physical
radii `.18` and `.22`, exact arrival there is impossible while preserving the
parked body. During 700 fixed ticks the military retains its original exact
point, goal, generation, revision and queued instruction; it does not pretend
to arrive. Its observed gap is about `2.0333` cells: this is the existing crowd
target-occupancy wait, not a claim that every wait stops exactly at `.4`.

The normal checkpoint validator accepts the state. A separate production
module restores it and waits another 100 ticks: the builder's pose/Hold state
and the military intent remain unchanged. Only an independently accepted Move
for that selected builder to `(2.5,8.5)` releases the endpoint. An observed
admitted substep reaches the original exact military point, then the original
queued endpoint completes. HP and all unselected poses/orders remain unchanged;
the site is neither repaid nor refunded.

[Full commands and observations](qa-evidence/construction-endpoint-contract-2026-10-05/commands.json)
retain all eight cases. The collector records source revision/dirty state and
the production server hash; collection adds only audit/test/docs files over
the named runtime source. All 10,532 observed builder/infantry substeps pass
shared static-body admission and have zero swept pair contacts using the
existing `sweptBodyPairMargin` oracle. The exact-point observation resets at
builder departure, so setup cannot satisfy the resumed-arrival assertion.
These are command-body/tick and separate-module cold-recovery witnesses, not
native WebSocket/process or rendered evidence.

Run `node scripts/construction-endpoint-audit.mjs OUTPUT.json`. The eight strict
cases are also part of the existing registered
`scripts/construction-work-intent.test.mjs` check. The initial focused six-file
run passes 148/148, including construction selection/targeting, stationary
orders, fractional endpoints and crowd module regressions. Exact-head review,
types/imports and package receipts belong to the PR.

The separate [native witness](qa-evidence/construction-endpoint-contract-2026-10-05/native.json)
runs both actual WebSocket seats on `8030aff3c180f4a7a6fec9c5311c3b74411c44c9`
with military-before-build commands and two cold process restarts. Each seat
retains the completed builder pose, exact military point/revision and queue
after reconnect and another 60 ticks, then completes the original queued
endpoint after selecting and commanding only the builder away. Both sites
retain the once-only 75 Wood debit and military HP. This transport/process
witness supplements the CPU geometry observations; it records no game frames.

## Existing semantics and the next interface

The game bible's [Stop/Hold contract](game-bible.md#stationary-army-orders)
preserves idle/held Workers until another accepted order. The movement
workstream's [route-result contract](movement-pathing-workstream.md#universal-movement-contract-and-rollout)
distinguishes temporary occupancy from arrival. This audit verifies their
compatible behavior: a physically occupied exact endpoint remains pending;
its point/queue do not change, and no command may silently shove the builder,
overlap it, relocate a military destination or weaken exact-arrival assertions.
It does not promise bounded eventual arrival while the endpoint stays occupied.

Construction access currently prefers the nearest same-component cell and
reserves only cells assigned within its own command. Core's source inspection
also identifies that work can occur at any pose within the unchanged `1.4`
building-edge interaction range, and completion clears targets without moving
builders. Reserving only assigned final access cells would therefore not
establish a general no-new-conflict guarantee.

[The exact allocation discussion](https://github.com/lbeezr/thousand-unit-skirmish/pull/443#issuecomment-5989535783)
keeps core's operation-local accepted/pending military endpoint availability
query separate from caller-owned construction access selection and actual work
pose admission. The subsequent [exact core proposal](https://github.com/lbeezr/thousand-unit-skirmish/pull/443#issuecomment-5989632712)
and [caller agreement](https://github.com/lbeezr/thousand-unit-skirmish/pull/443#issuecomment-5989678024)
define `createOrdinaryMilitaryEndpointAvailability` with operation-local census
and `available/blocked/deferred` queries, plus a construction-owned dynamic
occupancy extension of existing transient retries. Occupancy must retain paid
intent, consume no static-failure attempts, enqueue no repair until a safe
candidate exists, and resume on release without requiring a navigation revision.
Core's query implementation and the separately reviewed construction consumer
remain the next dependency and increment. Any future change
must retain paid site/area intent, range/rate/cost, queue, replacement and cold
recovery, including completion before approach exhaustion. It must preserve
already parked conflicts as waits. No runtime edit precedes that agreement.

The existing wait contract is verified; choosing a different new construction
access/work pose to prioritize accepted military endpoints belongs to that
separately agreed increment. This audit does not enact that preference.
Worker economy publication stays with core PR438, and crowd yielding stays
with the crowd owner. The full paid-house suite's three final-arrival failures
and original deadlines remain open; this small witness neither removes those
assertions nor claims that all stalls share this cause.

## Acceptance limits

This is a source-only contract/evidence increment with no new visual treatment
(art backing N/A). Clean runtime packing verifies inclusion and identity only;
deployment and real ordinary-game rendered acceptance remain OPEN under the
existing [staging/capture ownership](https://github.com/lbeezr/thousand-unit-skirmish/pull/432#issuecomment-5988158549).
The retained cloud renderer block produced zero game frames. No renderer,
provider, authentication or dispatch retry is implied, and no metadata-only
visual pass is claimed.
