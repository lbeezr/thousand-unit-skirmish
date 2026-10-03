# Next content candidate: a finite Farm planting

[Roadmap](roadmap.md) · [Building atlas plan](building-atlas-production-plan.md)

This is the earlier 3 October planning assessment. The [finite Farm contract](farm-finite-planting.md)
records the adopted provisional prototype values and policies; the questions
below preserve the original scope discussion.

Farm was an existing planned building candidate, absent from the registry
and gameplay at this assessment. A useful first implementation would be one finite paid planting
that creates a local food source. This proposal narrows the atlas plan's future
renewable-food role to a testable cycle; replenishing, growth seasons and automatic
replanting are separate decisions. It supplies food stock for Workers to carry
to a completed friendly Mill, Storehouse or Town Center. It would grant no
passive bank credit or gather-rate bonus.

Mill's measured role is a cheap food drop-off; adding a dedicated wood drop-off
would overlap Storehouse. Farm instead tests how a player invests wood and
Worker time in local supply after nearby finite food runs out. Current forging
research already belongs to producers, so there is no missing Blacksmith
capability to infer from its artwork.

## Missing gameplay contract

Before implementing a Farm, select its footprint, price, planting work, finite
food yield, maximum gatherers and whether it occupies a building plus a separate
harvest target. Decide who may harvest an enemy planting, how destruction treats
remaining stock and carried food, and how an exhausted plot is removed or replanted.
These values and policies are open; the current proposal does not assign them.

The authoritative resource contract must support a source created by paid play.
Current checkpoint validation expects resource nodes to match the authored map.
Registering a building alone cannot create a recoverable harvest target. A bounded
implementation must preserve source identity/generation, owner, remaining finite
stock and the paid planting through checkpoint recovery. Distinguish authored
nodes from player-created sources explicitly, retaining existing map validation.

## Acceptance for one planting cycle

- Both seats pay the selected cost and complete planting through real Worker
  commands. Invalid sites and replayed orders neither spend twice nor create stock.
- Gather, delivery, Stop and Return cargo preserve stock + cargo + banks minus
  paid costs. Only existing friendly completed food drop-offs accept the cargo.
- Exhaustion leaves no new supply. Destruction follows the selected stock policy;
  carried food remains governed by existing cargo rules.
- Restart preserves unfinished work, completed stock, source generation and cargo
  without duplicate credit or replenishment. Rematch restores the authored map
  and clears player-created sources.
- UI and deterministic opponent behavior expose the implemented role within their
  existing bounded order paths. Registry/menu and complete-roster fixtures retain
  coverage; absence of finished art need not hide functional planting tests.

A field/shed art brief follows the selected footprint and stock states. No Farm
is implemented by this document, and no new paid model is requested. Use actual
map/stock observations and one planting cycle before expanding its economy.
