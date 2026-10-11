# Normal Tiny Farm capture preparation — 11 October 2026

[Farm rules and ownership](farm-finite-planting.md) ·
[B1 acceptance](gameplay-foundation-plan.md#recommended-starter-progression-and-executable-backlog) ·
[Qualified capture framework](renderer-qualification.md)

Farm owner `01a0f784-c5d7-72e0-82e8-1747b4c840c1` owns this bounded capture
slice through review, source packaging and ordinary-game verification. It starts
from public main `819044363ad0d4270fbb99e95777c40770d7c5c1` (the Worker HUD pilot).
Open PR639 remains audio-owned; this slice changes no audio or Farm gameplay.
Existing default Farm lifecycle artwork and HUD treatment are the visual backing
linked in [Farm rules](farm-finite-planting.md#manual-renewal-ownership-and-active-queue--5-october-2026);
this tooling adds no presentation or new art.

## Registered sequence and scope

The [Farm adapter](../scripts/renderer-tiny-farm-scenario.mjs) uses the existing
immutable version-1 context and shared screenshots. `tiny-farm` is an explicit
choice in the existing [ordinary workflow](../.github/workflows/ordinary-game-capture.yml).
Registration changes only the reviewed case choice and registry; permissions,
sandbox, services, runner lifetime and the three-minute case deadline remain
unchanged. No automatic trigger or arbitrary command/path input is added.

Normal Create Room, visible Tiny selection, ordinary second-seat invitation,
Ready and Launch admit the shipped fog-enabled Terraced Vale map. Neither a
studio fixture nor `publishMap`, preview entry, stock injection or direct
capture-command submission is used. Each seat selects its actual four opening
Workers and uses real pointer Build controls to pay 75 wood for a Mill and
60 wood for a Farm. Pointer Gather depletes the finite 200-food planting and
finishes actual cargo deliveries. The existing
[renewal step](../scripts/farm-renewal-capture-step.mjs) then uses the current
visible Idle control, selects the real exhausted plot, clicks **Replant · 60 wood**,
retains a fresh foundation and waits for the first automatic renewed depot credit.
Both seats must finish with 55 opening wood remaining and conserved crop/bank/cargo.

Eight shared checkpoint receipts per seat cover Mill/Farm foundations, complete
Farm, natural exhaustion, selected Replant, renewed foundation, renewed delivery
and strategic wheel zoom. Sidecars retain source SHA/release digest, map-file
hash, own-seat bank/crop/typed cargo, selected identities, decoded default art and
post-render WebGL2 readbacks. Frame observations bracket screenshots; this is
not a claim of a same-frame authoritative snapshot. Invitation URLs, session
tokens, raw socket envelopes and opponent banks are excluded.

Independent source review identified that the initial Farm pad overlapped Tiny's
home-food sheep. The corrected pad is `(spawn.x ± 6, spawn.z)`; the Mill remains
at `(spawn.x, spawn.z + 5)`. A registered both-seat control executes the real
client placement function and fixed-tick production server admission: corrected
Mill/Farm pads must accept, while the original sheep pad must refuse without
charging or creating a foundation. No gameplay placement rule was changed.

## Evidence boundaries and next transition

Preparation and CPU failure controls do not establish a rendered pass. The
unchanged native Farm renewal fixture passed on clean preceding source
`7524a0e13278cb9c3fb401c761827c2ec8559980` at 16:31:44 UTC on 11 October:
both seats depleted naturally, paid renewal exactly once, rejected stale replay,
survived a cold process restart and credited renewed Food. That authored 64×64
authority fixture remains behavior reference, separate from normal Tiny pixels.

The first exact-head Farm execution,
[run38157309567](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38157309567),
completed failure at 16:56:40 UTC on clean `603de03624a3fcb9913d23f2cb5b37214439e795`.
[Artifact11709575748](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38157309567/artifacts/11709575748)
was created at 16:56:37 UTC (one-day retention), ZIP digest
`sha256:6fc14e0d44c3d57285ad17ad7552cb872276618677f807910d4bece463f20619`.
Sandboxed Chrome154 preflight passed; clean pack digest was
`sha256:2150aab7428d5e24e6d8518fc491849ea636c60390c0a41be66c4cb379914fd5`
with 1,836 files. The Farm case failed after approximately 4.3 seconds, before
lifecycle entry, with zero frames/captures and one page still at menu, not ready
and without a canvas. The generic scenario Error does not identify a UI cause.
No deadline or readiness assertion is relaxed to get beyond it.

A Farm-only failure sidecar now covers served identity and each menu/lobby step,
retaining only a fixed stage, error category and safe DOM booleans/seat. Actual
entry expressions and pointer orchestration run in CPU controls using the real
menu and lobby modules with modeled CDP/network/layout boundaries; unavailable
menu, absent lobby readiness and unavailable Launch refuse. These are not pixels.
Paid foundation captures now enforce expected identity, unfinished state, zero
Farm crop and exact debit on both observations bracketing the screenshot. A
completion-during-capture control retains the failed partial evidence and refuses
to qualify it as a foundation phase.

The diagnostic [run38158673958](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38158673958)
at clean `a606e40574818cfe3964f1fdff3301a03158765e` failed at 17:13:42 UTC.
[Artifact11709403105](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38158673958/artifacts/11709403105)
was created at 17:13:39 UTC, ZIP digest
`sha256:fbe0cc58c5cf0479ac66b7d321e7e6a204d163b49b914035e221c46e291237a3`.
It retains zero frames and the safe receipt `entry-host-menu` / `browser-type`:
menu entry, no Create Room control, not ready. The unchanged clean pack and
normal-sandbox preflight passed. CPU reproduction of the actual entry predicate
throws TypeError while navigation has no document root and incorrectly accepts
a partial menu without Create Room. The Farm-only correction safely waits for
the document root and an explicitly present, enabled Create Room control. A
regression exercises missing document, partial menu and disabled Create Room
before the actual menu/lobby orchestration. It strengthens readiness; no deadline
or browser policy changes. Subsequent capture follows exact-head checks/review.

The existing supported Actions capability receipt is
[run38153340669](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38153340669),
artifact11706704507 created at 15:57:42 UTC: Linux uid1001, Chrome154.0.8037.97,
normal sandbox, ready WebGL2 readbacks and game boot on clean `b4ad36cf`. It is
older audio-owned evidence and contains zero gameplay frames; no new audio
execution or Farm acceptance follows from it. The local Chromium helper remains
the recorded `nobody`-owned sandbox blocker; this slice does not relaunch that
unchanged browser or modify its provisioning.

Next: independently review the exact Farm head, run focused registered controls,
pack clean source and dispatch only `tiny-farm` on that exact branch through the
existing authorized workflow. The draft PR retains exact head, check results,
pack digest and any run/artifact links. If dispatch is unavailable or denied,
record the precise failed action once and preserve the adapter without retries.

Even a successful automated capture leaves appearance inspection, touch input,
fresh-player Farm/Mill explanation and cold **process** recovery in the same
rendered scenario open. Version-1 context exposes no server restart hook; no
browser reload is substituted for process recovery. The native exact-source
fixture can establish authority recovery separately. Source, clean pack,
containing served/deployed release and ordinary rendered acceptance remain
distinct receipts. No completed B1 or deployment claim is made here.
