# PR529 first differing forest decision — 6 October 2026

[Movement workstream](movement-pathing-workstream.md) ·
[Rejected PR529 qualification](qa-crowd-directed-join-rejection-2026-10-06.md) ·
[Captured paired decision](qa-evidence/crowd-first-decision-2026-10-06/first-decision.json.gz) ·
[Offline replay result](qa-evidence/crowd-first-decision-2026-10-06/offline-replay.json)

The first differing decision occurs at **journey142 / production143**, serial
call21 (zero based), actor28 on seat1. Before this call, 4,906 compared calls and
141 whole-roster pose/route comparisons match. The immediately preceding call is
actor27 at the same tick/call20. This is earlier than the retained actor5 crossing
event at185 versus196; that downstream timestamp did not identify the cause.

Baseline is `31af0275698d369e83705771fdfa6983358a1742`; candidate is
`2882498c096e33549d5f4c52e7a176e5aacd2ed5`. One completed paired diagnostic
reuses the original public `forest-opposing-box-16` checkpoint, seed881,
64×48 map, zero elevation, forest gap1, actual IDs/generations and32 selected
actors. Both teams retain NoAttack and their original box Move commands. The
checkpoint SHA256 is
`aba4ea83b1a8fccf7ebbae1f80e6bf78663e22ab0d09cf2483a95b111629da6a`.
No fresh input, identity normalization, changed contract or new benchmark is used.
The original900-tick journey ceiling and150-tick fairness threshold are unchanged.

## Captured policy and actual write

At the first differing call, actor/query/controller inputs are identical:
actor28 generation1479530212, revision2, path index9, pose
`(4.22,-0.4764822299863555)`; its raw waypoint is `(4.5,.5)` and its projected
target is `(4.22,.001)`. The actual query makes12 bucket visits, returns10 bodies
without overflow and preserves the real serially updated peer poses.

Both selectors find exactly the same physically admitted northward best:
length`.043333333333333335`, fixed-waypoint gain`.041581473441066885`,
no-progress age33. Peer24 has lower ID, a far goal opposed to that northward
route direction, and a current direction that is not parallel enough for the
existing parallel-waypoint exemption. Its fresh controller is tick143,
revision6; it is one waypoint ahead on the same directed triple
`1572→1571→1570`.

| Captured operation | Baseline | Candidate |
| --- | --- | --- |
| Peer24 priority claim | true | false after `directedJoinStep(24)` returns true |
| `yieldingToPeer` | true | false |
| Same pre-priority admitted best | discarded; all10 recovery proposals fail | retained |
| Executor admission | `crowd-wait`, no write | `steering-admitted`, actual northward write |
| Actor28 resulting pose | unchanged | `(4.22,-0.43314889665302214)` |

The committed candidate substep is uniquely bound to the call's actor,
generation, order/navigation revision, production tick, pre-call pose and its
actual admission pose. It passes strict static-circle, cell-transition and
body-pair sweep checks; minimum margin against the10 queried bodies is
`+.0048433585961620285`. There is no independent military pre-write body query
in this source: the selector's body admission and the actual executor
static/cell guard remain distinct. This is not a universal body-clearance claim.

## Scope and reproducibility

The candidate stops immediately after that actual position write, at the
`steering-admitted` callback with `finalized:false`, **before** source clamp and
remaining-step budget finalization. The baseline completes only that same fixed
tick to supply the reference serial calls; neither advances to journey143.
This captures the first changed claimant/priority decision and its immediate
write. It does **not** explain the complete later fairness delay or qualify
liveness, repair, fairness, the64-actor gate, Stop priority, or deployed rendering.
PR529 remains rejected/unmerged. PR525 remains retired. No fix is implemented.

An initial observer start failed on baseline journey1 because its generated
server lacked the admission-hook import. Candidate had executed zero ticks.
The [failed-start receipt](qa-evidence/crowd-first-decision-2026-10-06/failed-start.json)
preserves that limit; only the test adapter import was corrected before repeating
the same paired input with the same185 cap. There were two starts, one completed
paired diagnostic, and no broad qualification rerun.

The compressed record contains only whitelisted fixture map, command,
actor/path identities, actual bucket-chain visits, complete returned-body
routes/controller histories, target/direction inputs, proposal/static/body
oracle results and visit sequences, scoring, each evaluated priority claimant,
selector/controller output, actual admission and write. Full checkpoint,
seat/session/match identifiers and credentials are excluded. Hash-verified
capture observer/driver source snapshots and the evidence seal accompany it.

With exact baseline and candidate checkouts available, run:

```sh
node scripts/crowd-first-decision-replay.mjs /path/to/baseline /path/to/candidate
```

This reconstructs only the two captured calls, with their actual route object
identity and transient WeakMap state. It verifies source/snapshot hashes,
production query order, complete host decisions, controller outputs, proposal /
body-visit / scoring / priority sequences and strict physical admission. It
starts no game fixture or journey. The query context uses production's bucket
dimensions `floor((width-.5)/1.2)+1`, including the53-column forest map.

Crowd owns the retained diagnostic and its independent replay review. Core
`01a107ba-7977-7764-9574-17cb0c3a102e` retains the next policy decision: use this
first changed claim/write as a causal boundary before proposing any refinement,
or retire the exception. The existing failed journey/fairness contracts and
source-versus-rendered acceptance remain open. Art backing, runtime binding,
packaging, deployment and in-game visual verification are N/A for this internal
evidence publication.
