# Planning work through playable outcomes

[Working rules](../AGENTS.md) · [Roadmap](roadmap.md) · [Art lanes](art-production-lanes.md) · [Adoption checklist](asset-adoption-checklist.md)

End-to-end ownership is already the repository's rule. This guide makes it
concrete when splitting work; it adds no approval queue. A small fix can put
these facts in two PR sentences. Larger work should use a short task note in
its existing issue, PR, or owning guide, rather than another parallel roadmap.

## A useful task

| Field | What to record |
| --- | --- |
| Outcome | A player-observable behavior, or an explicitly scoped source/experiment milestone. |
| Owner | The worker retaining responsibility through integration and verification. Role lanes identify primary owners, not exclusive files. |
| Acceptance/evidence | The normal entry path, map/action/state, focused checks and actual observation; record revisions and evidence links. |
| Dependencies | The concrete input/interface needed, its owner and readiness. Distinguish blocked work from independent work. |
| Write scope | Expected files/contracts and likely overlap with active owners. Update it when the implementation changes. |
| Delivery | Default binding, HTTP admission, release files, relevant user environment, deployment evidence and in-game verification. Mark non-applicable steps for source-only work. |

For example, "show the existing House Complete views in normal matches" is a
bounded integration task: the renderer owner consumes the preserved manifest,
retains construction/damage fallback, packages the eight images, and checks
both teams at normal/strategic zoom on an identified user build. The absent
lifecycle states remain building-production work with an explicit owner; they
do not make the Complete integration disappear from the plan. Producing another
contact sheet does not satisfy that in-game task.

## Split at usable boundaries

Prefer a small working path through the current game over disconnected loader,
asset, UI and deployment branches waiting to meet at the end. Source production
can be its own incremental milestone, provided its intended consumer and
unfinished admission work are named. Do not require unrelated concept art to
ship or a whole art matrix to finish before a useful scoped integration.

Run independent art production, renderer, gameplay, HUD and infrastructure
streams concurrently. One team's missing input should pause only dependent
work. Before changing a shared interface, read current main and agree with the
affected owner on the exact manifest/state/API boundary and smallest required
decision. Coordinate overlapping write scopes locally; do not broadcast routine
status requests or globally freeze other streams. The six Frontier Complete
bindings already have an active renderer owner; another worker should audit or
package independent work without duplicating that binding change.

Keep branches short-lived and PRs incremental. Refresh main before dependent
work and before merging. The author resolves conflicts, runs proportionate
checks, obtains independent review, merges under existing authority and handles
fix-forward work. Do not collect unrelated finished tasks into one large PR or
wait for a parent to grant permission already held. Respect actual branch/access
restrictions and identify their source, scope and next action when blocked.

## Closing and handing off

A generated artifact, passing test, source-only PR or merge is a useful
milestone. A requested gameplay outcome remains **incomplete** until default
use, release inclusion, identified deployment and actual in-game verification
are established. A screenshot of a preview or older build proves only that path
and revision. Automated import/hash/package checks do not establish GPU pixels,
listening acceptance, usability or a live deployment.

Record unfinished downstream work beside the delivery, with a named receiving
owner, concrete next action and linked task/artifact. Keep the implementation
owner responsible until that ownership is explicit; "QA later" is insufficient.
If no receiving owner is assigned, say **unassigned** and route that concrete
gap. Do not invent a manager approval requirement. An actual private-source,
publication, credential or production-promotion restriction applies only to its
specific action; continue authorized adjacent work.

Use the [PR checklist](../.github/pull_request_template.md). Update the owning
guide and current adoption ledger, retain dated evidence, and remove a temporary
preview gate when its stated experiment ends. Evidence can remain incomplete
while a scoped PR ships; its unfinished user outcome keeps an owner.
