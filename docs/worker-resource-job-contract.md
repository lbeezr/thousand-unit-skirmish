# Bounded wood job continuation — proposal

Economy/content owns resource continuation. The user reported on 4 October 2026
at 12:24 that lumberjacks finish one tree, deposit, then stop. Both forest-cell
and ordinary resource-node economy branches explicitly stop after an exhausted
source's last delivery. The identified staging source is `64cc391e`; local replay
and current-source tests are distinct from an actual deployed observation.

## Shared construction boundary

Construction/resume owner `01a103f5-cb1f` retains construction resume and
right-click behavior. Proposed optional Worker field:

```js
gatherWorkArea: null | { type: 'wood', x: number, z: number }
```

The anchor is the player's original manually assigned wood source, never the
latest replacement or drop-off. Replacements must be live, visible, reachable
wood sources within eight world units of that anchor. They retain existing
forest/node identities and cargo. Exhaustion cannot expand the area or create
resources. Empty/inaccessible areas deliver remaining cargo once and become idle.

Internal deliveries/retargeting preserve the anchor. Explicit Move, Stop,
Attack, Return Cargo or another accepted assignment clears/replaces it; rejected
orders preserve the current job. Queued movement wins at the current source's
terminal delivery, ahead of automatic replacement. Construction's temporary
resume record must copy/restore this field with the existing gather target/phase;
it must not derive a new anchor from the latest target. Economy/content does not
own suspended construction state, click arbitration or broad combat/stance changes.

Missing legacy anchors initialize from the existing active wood target on cold
restore, since the prior source never retargets. New checkpoint input must reject
nonfinite/out-of-map/unsupported anchors and preserve the fixed area thereafter.

Concrete coordination needed before shared integration: construction owner
confirms this field/copy boundary or names the already planned job-record shape.
New helper and tests are independent. Server integration stays in an isolated
draft until that interface is coordinated; no peer response is asserted here.
The current executor cannot address the separate cloud thread through its team
messaging tool. This linked proposal is the reviewable coordination artifact.

Normal Worker gathering binds the eventual fix by default. Economy/content
retains review/merge/postmerge/native proof. Identified deployed revision and
ordinary-game observation remain receiving Railway/Mac work, without taking
browser control from animation baseline task `01a106da-40ec`.
