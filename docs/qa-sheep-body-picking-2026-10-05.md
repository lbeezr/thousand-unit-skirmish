# Sheep body picking — 5 October 2026

Owner: wildlife interaction task `01a10d83-3a7d`, retaining default integration,
clean packaging, identified staging delivery and ordinary rendered acceptance.

## Reproduced input defect and bounded change

At main `6ee1cce46d0ac4f4fcc4610a0d2b1a2bee928690`, both seats miss an actual
opaque pixel of the approved public Sheep atlas when clicking the body outside
the fixed26-pixel ground-root radius. The production camera/frustum43 and
supported maximum zoom2.3 at a2560×1440 viewport reproduce the failure through
real DOM pointer handlers. This is CPU/decoded-image/Three geometry evidence,
not a screenshot or observation from a rendered game.

The default resource picker now raycasts the currently displayed Sheep art,
live proxy or carcass marker before retaining its existing root-radius fallback.
Static art hits sample the verified decoded public atlas alpha with the same
threshold as its material, excluding transparent canvas padding. Current
snapshot pose/heading is applied before raycasting; a newly received relocation
cannot pick a vacated body. The same picker serves inspection and Worker Gather.
Owned-live Herd authority and shared-carcass Food remain unchanged; disclosure,
current fog, positive stock and selection authorization gate body hits.
Friendly units/buildings and Farm targeting retain their existing priority.

Visual backing is the unchanged [approved eight-view pack](../assets/wildlife/bellweather-sheep-static-v1/README.md).
The bounded comparison uses opaque body versus transparent gutter of those
bytes. No new art, rig, model transfer, collar, animation, private publication,
balance or checkpoint change belongs to this slice.

## Qualification and delivery boundary

[Focused body checks](../scripts/sheep-body-picking.test.mjs) reproduce the
baseline selection failure for both seats, then exercise body selection, Food
summary, Worker Gather, transparent padding, foreign/neutral live exclusion,
relocation before rendering, fog, omitted rows and depletion. PR488's merged
resource fixture contract is consumed unchanged; fixture owner `01a1085f`
retains [that completed repair](https://github.com/lbeezr/thousand-unit-skirmish/pull/488).
This slice adds a separate consumer and changes no shared fixture bindings.

Exact final source, independent review, focused totals, clean release digest
and platform deployment identity are recorded in the delivery PR. A source
merge or platform SUCCESS is not served-byte or playable acceptance.

Normal-sandbox cloud Chromium preflight at the baseline reports
`sandbox-unavailable` and `storage-unavailable`: zero game frames/screenshots.
Use a provider-provisioned supported browser runtime for actual in-game body
click, touch, gather, remaining Food and cleanup acceptance. Do not bypass the
sandbox or resume Mac work. The previously denied staging HTTPS route remains
a separate access boundary; no alternate-channel probe is authorized here.

## Ongoing queue

| Owner / step | Next action | Dependency and acceptance |
| --- | --- | --- |
| Wildlife interaction `01a10d83-3a7d` / body picking | Independently review and deliver this bounded default fix; retain identified in-game acceptance. | Exact source tests/package and identified platform deployment are separate from a working ordinary cloud renderer. |
| Wildlife interaction / next disjoint audit | Exercise the normal Tiny claimed/Herded Sheep through checkpoint recovery, Worker interruption and resumed wandering using existing public source and authoritative harnesses; change code only if a concrete failure reproduces. | Existing claim/motion/Herd contracts, current-cell disclosure and Food conservation; no duplicate fixture migration or speculative cleanup. |
| Sheep art `01a101a8-fba6-7323-a40c-27efd0112007` | Retain private walk/graze/prone/collar work and publication decision. | Private transfer/publication approval remains pending; existing public idle art and marker stay default. |
| Cloud renderer acceptance / wildlife retains outcome | Supply a permitted working sandbox and identified playable release; capture real default interaction. | Current executor cannot start Chromium. No rendered pass or private preview was produced by this slice. |
