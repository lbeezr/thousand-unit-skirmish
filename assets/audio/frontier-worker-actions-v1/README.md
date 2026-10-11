# Frontier Worker action voices v1

Owner: chat `01a12b6b-d181-79b1-97b4-05de79523245`, retaining default integration,
release/deployment and actual in-game listening for the full interaction-audio goal.

This is the second bounded recording increment. It continues the George voice
established in [the first interaction slice](../frontier-feedback-v1/README.md),
following [Frontier voice direction](../../../docs/civilization-voice-language-guide.md).
The [production plan](production-plan.json) preserves the exact fourteen lines,
node/session/generation identities and batch estimate. Four original performance
takes per line are retained; two suitable takes per meaning are provisionally
assigned after offline decoding/signal checks. Final creative listening remains
pending.

Sequence: player issues an order → existing server acknowledgement admits it →
one Worker speaks its actual task. Farm, shore fish and disclosed sheep carcass
use the existing food-job metadata; ordinary Food stays generic. The carcass line
says “I'll collect the meat.” It makes no claim that a live sheep was hunted.
Construction and repair lines acknowledge starting work, not finishing it.
Movement, patrol, follow, stop, hold and attack retain their existing routes.
Ready is limited to the existing authoritative newly-created-worker event.

All spoken applied-order/ready bindings have priority 1 and retain the shared
speech limiter. Initial Worker selection remains priority 0, allowing a following
accepted work order to interrupt it. No queued/rejected order speaks success.
Recorded captions are the spoken line, and existing master/voice mute, page
visibility, map replacement and disposal policies remain in force.

`node assets/audio/frontier-worker-actions-v1/build-manifest.mjs` verifies the
preserved originals and creates `frontier-feedback/v2`, extending the unchanged
v1 manifest. Selected files require exact HTTP admission and Docker inputs;
the source catalog, production plan and unassigned comparisons are not public.
No provider call runs during manifest construction.

Generation, signal checks, bindings, serving and CPU tests establish separate
boundaries from deployed ordinary-game listening. The
[interaction QA receipt](../../../docs/qa-interaction-audio-2026-10-11.md) retains
those boundaries and the existing publication blocker. Other unit voices and
building sounds remain with the same owner.
