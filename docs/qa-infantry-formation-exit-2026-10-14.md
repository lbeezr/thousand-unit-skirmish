# Infantry starting formation exits — 14 October 2026

Owner: unit functionality chat `01a13a88-6b18-7821-9ca1-5856d78ad67b`.
This increment owns independent review, main integration, clean release inclusion
and hosted both-seat verification. The broader units goal remains active.

## Reproduction and result

On baseline `97202f4b6c8e81ed0cccb54ec5b7270445bac9c5`, select Azure's first
Infantry in the ordinary 24-unit opening on the 64-square Open Field-derived
`army-attack-continuation` map (seed 19, spawns at ±20). Move it from `(-20.5,.5)`
to `(.5,.5)` while the other units remain idle. After 2,000 simulation ticks it
still sits near `(-19.6815,.4499)`, with the original goal and unconsumed path.
Thirty ticks of movement covers 1.3 cells but makes only .0062 cells of net travel.
Ember's first Infantry reaches its corresponding destination. The same defect
caused 19 existing Azure stance setup cases to fail their `actors arrive` assertion.

The original detour accepted an exit when its first short step was clear, even
when the remaining exit crossed a parked body. Infantry rows also leave a
passage exactly one moving body's width; a diagonal toward its far end clips
the adjacent row. The candidate checks the full body sweep, aligns precisely
beside a clear gap, then crosses it. Clear passage continuation can start before
the existing 90-tick perimeter-retreat delay. Detour release uses the admitted
projected waypoint, since a parked body may occupy the raw cell center.
A diagonal Move can turn between two connected passages when a row gap ends
at a parked body; independent review reproduced the missing turn on Azure
Infantry ID 7 moving to `(-30.5,10.5)`, and that retained witness now arrives.

The search retains the nearest-eight parked-body limit, at most 28 pair checks
per axis and the caller's 64 point / 128 short-proposal budgets. Duplicate gap
alignments are removed; the four nearest lanes per axis bound connected
passage proposals to 32. All current neighbors still veto each body sweep and
each executed short step retains the host's terrain/body admission. No neighbor
position, order, saved schema, public command or spawn arrangement changes.
Transient alignment is reconstructed after cold recovery and invalidated by the
existing order, identity, route, navigation and observed-body changes.
Passage alignment applies only while every current neighbor is stationary.
A moving neighbor cancels the passage and restores existing crowd arbitration.

Write scope: private `src/crowd-parked-contour.mjs`, the production replay
regression, CI registration and behavior/evidence guides. The existing server
import closure includes this module in the release; no browser path is added.
Art backing is N/A for this internal steering correction. Existing Human Infantry
presentation and starting arrangement remain unchanged; no visual baseline is replaced.

## Validation and delivery

`scripts/infantry-formation-exit.test.mjs` covers 136 cases:
eight naturally spawned Infantry per seat, eight cardinal/diagonal Move directions,
plus both-seat cold continuation, Stop/new-Move replacement and unchanged
Tiny Terraced Vale geometry, plus whole-army Moves with active peers. Every observed
position write retains static and body admission (including monotonic inherited
overlap escape); parked units retain their complete poses and route/order state.
Original requested destinations remain unchanged through uninterrupted travel.
One Ember diagonal deflection beside the real Town Center uses the existing
static-route repair and increments its revision once; all cases allow at most
one such repair and retain the exact requested point.

The 144 selected crowd regressions pass, including choke, opposing columns,
bridge, parked-body journeys, projected routes and wait leases. Military stance
checks pass 139/140: all 19 reproduced Azure arrival failures now pass. The
remaining schema-25 fixture fails before migration because real Gather has not
transferred food into cargo; it reproduces on the previous pristine baseline.
That separate failure is retained and no full CPU-suite pass is claimed.

A broader 64-unit paid queued-gate check exposed interference with moving peers
in the initial candidate. Restricting passage alignment to stationary rows fixes
that regression. The final retained control repeats the baseline's 63/64 Azure
and 29/64 Ember arrivals after the original 2,700 ticks, with exactly identical
unfinished actor positions, goals and path indices. The parked builder stays
fixed and both runs retain zero invalid grid steps/unreachable goals. These
pre-existing incomplete large-group journeys remain open; the initial candidate's
0/64 Ember result is preserved as a rejected increment, not acceptance.
The [retained control receipt](qa-evidence/infantry-formation-exit-2026-10-14/crowd-controls.json)
separates baseline, rejected and corrected outcomes.

Architecture, strict types and documentation checks pass. Independent review
resolved the missing diagonal passage and group fixture contract, then passed
the formation/crowd scope and moving-neighbor activation/invalidation controls.
Clean pack, main integration and exact hosted verification are being completed.
The owner will record source SHA, clean pack digest and served deployment identity
separately. Native authority/transport evidence does not establish browser pixels;
ordinary rendered usability remains incomplete with no stopped Mac fallback.
