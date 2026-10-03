# Automatic Sheep ownership — 3 October 2026

Owner: authoritative wildlife worker (`codex/sheep-automatic-claims-v1`), retaining
integration, package/deployment and actual ordinary-game acceptance.

## Contract

A living land roster unit automatically claims an alive Sheep within1.4 world
units when the team currently sees its cell and the whole short segment is legal
land. Walls/water/buildings/TC masks, map bounds, impassable elevation and blocked
diagonal corners prevent claiming. Dead/water/distant units cannot claim.
Any eligible nearby current-owner unit retains ownership. Otherwise the nearest
eligible unit wins, exact ties by stable lower unit ID. No eligible contender
means the last owner remains. Only alive Sheep change teams.

`wildlifeTeam: null|0|1` is authoritative (neutral/Azure/Ember), persisted in
schema26 and disclosed only with visible Sheep rows. It creates no food, cargo,
bank, sight, population, motion, gather restriction, decay or currency. Shared
Gather rights and frozen carcass/depletion remain. Exact absent-team schema25
migration (after existing motion/stance upgrades) initializes neutral labels without changing existing motion/economy;
current-state malformed teams reject. Rematch restores neutral authored Sheep.

## Evidence

- `node --test scripts/wildlife-claims.test.mjs`: both seats, owner presence,
  recapture, no-contender retention, nearest/ties, radius, dead/water/blocked
  exclusion, immutable food/units/banks/motion, whole land segment and exact25
  migration/forged-owner refusal.
- `node --test scripts/wildlife-state.test.mjs`: authoring rejects runtime teams;
  own living Worker validation/Gather still succeeds against the other team label.
- Motion/renderer/depleted-site regression checks continue to pass.
- `node scripts/millrace-sheep-scenario.mjs`: actual default both-seat food/art,
  legacy pre-Sheep identity migration and restart preserve stock/cargo/banks.
- `node scripts/sheep-claims-scenario.mjs`: real default both-seat Move claims,
  owner retention, recapture, hidden-row omission/no claimed sight, opposing
  Gather, shared partial/depleted harvest, frozen labels and restart/Return
  cargo conservation. Independent final-head review is recorded in
  [PR194](https://github.com/lbeezr/thousand-unit-skirmish/pull/194).

## Delivery and remaining ownership

The normal authoritative runtime enables claiming without a preview switch.
No client ownership UI/collar is claimed: the active Sheep art owner (task
`01a101a8-fba6-7323-a40c-27efd0112007`) receives real `wildlifeTeam` plus existing
position/heading/activity through the state rows; the shared
[Sheep guide](wildlife-bellweather-sheep.md) is the integration contract.
The UI owner owns HUD/environment bindings and needs an agreed selection/order
contract for controllable herding. That dependent client flow stays unfinished.

Release revision and package/HTTP evidence belong in the PR; active Railway
owner delivers staging and records exact source/deployment in the
[adoption ledger](asset-adoption-checklist.md). Wildlife worker retains normal
claim/reclaim and collar appearance verification at that identified revision.
The existing Chromium SUID sandbox configuration blocks native screenshots in
this executor; no sandbox-disable flag or elevated configuration change is used.
A merge or source-only assertion does not close deployed appearance/herding.
