import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const options = process.argv.slice(2);
const shardOption = options.find((arg) => arg.startsWith('--shard='));
const shard = shardOption?.match(/^--shard=(\d+)\/(\d+)$/);
if (options.some((arg) => arg !== '--list' && arg !== shardOption)
  || (shardOption && (!shard || Number(shard[1]) < 1 || Number(shard[1]) > Number(shard[2])
    || Number(shard[2]) > 16))) {
  throw new Error('Usage: node scripts/ci.mjs [--shard=INDEX/COUNT] [--list] (1 <= INDEX <= COUNT <= 16)');
}
const shardIndex = shard ? Number(shard[1]) - 1 : 0;
const shardCount = shard ? Number(shard[2]) : 1;
const checks = [];

function filesUnder(directory, extensions) {
  return readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return filesUnder(relativePath, extensions);
      return extensions.some((extension) => entry.name.endsWith(extension)) ? [relativePath] : [];
    });
}

function run(args, label) {
  checks.push({ args, label });
}

function execute({ args, label }) {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

const syntaxFiles = [
  'server.mjs',
  'room-supervisor.mjs',
  'src/main.js',
  ...filesUnder('src', ['.mjs']),
  ...filesUnder('scripts', ['.mjs']),
];

for (const file of syntaxFiles) run(['--check', file], `Syntax: ${file}`);

run(['--test', 'scripts/check-runtime-imports.test.mjs'], 'Runtime dependency checker regressions');
run(['scripts/check-runtime-imports.mjs'], 'Runtime dependency boundaries and cycle baseline');
run(['node_modules/typescript/bin/tsc', '--project', 'tsconfig.check-js.json', '--pretty', 'false'],
  'Strict checked JavaScript boundary');
run(['--test', 'scripts/check-types.test.mjs'], 'Checked JavaScript contract negative cases');
run(['node_modules/typescript/bin/tsc', '--project', 'tsconfig.check-node.json', '--pretty', 'false'],
  'Strict checked Node framing boundary');
run(['--test', 'scripts/check-node-types.test.mjs'], 'Node framing contract negative cases and ambient isolation');
run(['--test', 'scripts/resource-visual-state.test.mjs'], 'Resource stage membership and legacy transitions');

run(['--test', 'scripts/scenario-regions.test.mjs'], 'Named scenario regions');
run(['--test', 'scripts/scenario-authoring.test.mjs'], 'Visual scenario authoring contracts');
run(['scripts/completion-event-scenario.mjs'], 'Completion event recovery and host diagnostics');
run(['scripts/region-event-scenario.mjs'], 'Region event recovery and rematch');
run(['scripts/regional-ambience-scenario.mjs'], 'Regional ambience bus and lifecycle');
run(['scripts/audio-shore-profile-scenario.mjs'], 'Ordinary Shore Fishing regional audio selection and lifecycle');
run(['scripts/terrain-authoring-scenario.mjs'], 'Seeded terrain authoring and height surfaces');
run(['--test', 'scripts/map-scale-audit.test.mjs', 'scripts/confluence-grounds.test.mjs', 'scripts/confluence-opening-compat.test.mjs', 'scripts/confluence-opening-checkpoint.test.mjs', 'scripts/riven-escarpment.test.mjs', 'scripts/crownroads.test.mjs'], 'Source-bound scale audit, Confluence arena and Medium/Large layouts');
run(['scripts/landscape-authoring-scenario.mjs'], 'Organic regional landscape shapes');
run(['scripts/forest-habitat-scenario.mjs'], 'Graduated woodland habitat margins');
run(['scripts/forest-composition-scenario.mjs'], 'Regional dominant species groves');
run(['scripts/forest-age-scenario.mjs'], 'Seeded irregular canopy ages preserve every root');
run(['scripts/settlement-authoring-scenario.mjs'], 'Grounded starting settlements');
run(['--test', 'scripts/resource-cluster-authoring.test.mjs'], 'Seeded Millrace resource clusters');
run(['--test', 'scripts/stone-authoring-fixture.test.mjs'], 'Proposed Stone layout and legacy compatibility boundaries');
run(['--test', 'scripts/stone-map-profile.test.mjs'], 'Typed Stone layout and map profile compatibility');
run(['--test', 'scripts/resource-brush-authoring.test.mjs'], 'Resource brush preview and editor transactions');
run(['--test', 'scripts/resource-brush-controls.test.mjs'], 'Resource brush editor controls');
run(['scripts/check-docs.mjs'], 'Documentation links');
run(['--test', 'scripts/audit-asset-adoption.test.mjs'], 'Approved asset default bindings and release dependencies');
run(['--test', 'scripts/oak-depletion-atlas-runtime.test.mjs'], 'Generic oak depletion atlas loading, fallback and registration');
run(['--test', 'scripts/audio-shipped-loader.test.mjs', 'scripts/audio-execution.test.mjs', 'scripts/audio-worker-snapshot.test.mjs', 'scripts/audio-music-lifecycle.test.mjs', 'scripts/audio-cue-lifecycle.test.mjs', 'scripts/audio-synthesis-lifecycle.test.mjs', 'scripts/audio-decoded-cache.test.mjs', 'scripts/audio-shared-decode.test.mjs', 'scripts/audio-settings.test.mjs', 'scripts/audio-roster-notices.test.mjs'], 'Verified shipped audio and execution gates');
run(['--experimental-test-coverage', '--test-coverage-include=src/audio-shipped-response.mjs',
  '--test-coverage-lines=100', '--test-coverage-branches=100', '--test-coverage-functions=100',
  '--test', 'scripts/audio-shipped-response.test.mjs'], 'Shipped audio response coverage floor (100%)');
run(['--test', 'scripts/zone-audio-import-contract.test.mjs'], 'Zone audio import provenance');
run(['scripts/audio-shipped-serving-scenario.mjs'], 'Authoritative shipped audio serving');
run(['scripts/audio-wall-order-scenario.mjs'], 'Applied wall-line audio acknowledgement');
run(['--test', 'scripts/hosted-scale-profile.test.mjs'], 'Hosted scale measurement integrity');
run(['--test', 'scripts/unit-sprite-clock.test.mjs'], 'Sprite animation clock');
run(['--test', 'scripts/unit-animation-runtime.test.mjs'], 'Default unit action frames and lifetimes');
run(['--test', 'scripts/unit-presentation-client.test.mjs'], 'Client snapshot and unit presentation buffers');
run(['--test', 'scripts/villager-facing.test.mjs'], 'Villager movement and work facing');
run(['--test', 'scripts/worker-land-art.test.mjs'], 'Retained Worker land-action artwork and playback');
run(['--test', 'scripts/worker-nw-attack-art.test.mjs'], 'Public NW axe attack reuse and one-shot playback');
run(['--test', 'scripts/worker-north-west-actions-art.test.mjs'], 'NW hammer/pick/defeat artwork and default playback');
run(['--test', 'scripts/worker-east-axe-art.test.mjs'], 'East axe work/attack artwork and default playback');
run(['--test', 'scripts/worker-east-food-art.test.mjs'], 'East food artwork and default productive playback');
run(['--test', 'scripts/worker-east-hammer-art.test.mjs'], 'East hammer build/repair art and default productive playback');
run(['--test', 'scripts/worker-east-stone-defeat-art.test.mjs'], 'East dedicated Stone and terminal defeat art/default playback');
run(['--test', 'scripts/worker-north-actions-art.test.mjs'], 'North full land-action art/default playback');
run(['--test', 'scripts/worker-north-east-actions-art.test.mjs'], 'NE full land-action art/default playback');
run(['--test', 'scripts/worker-west-actions-art.test.mjs'], 'west full land-action art/default playback');
run(['--test', 'scripts/worker-south-west-actions-art.test.mjs'], 'south-west full land-action art/default playback');
run(['--test', 'scripts/worker-south-actions-art.test.mjs'], 'south full land-action art/default playback');
run(['--test', 'scripts/worker-performing-action.test.mjs'], 'Authoritative Worker positive-progress receipts');
run(['scripts/worker-performing-action-scenario.mjs', '--client-presentation'], 'Worker work receipt commands, client frames, exhausted repair delivery and recovery');
run(['--test', 'scripts/worker-fishing-presentation.test.mjs'], 'Worker fishing action and water-facing presentation');
run(['--test', 'scripts/worker-fishing-contact.test.mjs'], 'Worker fishing reach contact and bank/water picking');
run(['--test', 'scripts/unit-movement.test.mjs'], 'Unit separation terrain boundaries');
run(['--test', 'scripts/crowd-forward-progress.test.mjs'], 'Parked crowd route progress and preserved idle actors');
run(['--test', 'scripts/pathing-replay.test.mjs'], 'Obstructed formation goals and team reservation');
run(['--test', 'scripts/move-planning-slices.test.mjs'], 'Clock-independent route planning, stale results and fair queue turns');
run(['--test', 'scripts/move-planning-tick.test.mjs', 'scripts/move-planning-tick-error.test.mjs', 'scripts/pathing-arrival.test.mjs'], 'Opt-in planning tick budgets, order invalidation, topology and recovery');
run(['--test', 'scripts/tick-samples.test.mjs'], 'Opt-in whole-tick diagnostic chronology and values');
run(['--test', 'scripts/tick-attribution.test.mjs'], 'Disposable tick attribution preserves private wire bytes and vision bodies');
run(['scripts/pathing-native-scenario.mjs', 'dynamic-goal'], 'Native paid obstruction and formation arrival');
run(['--test', 'scripts/dynamic-wall-pathing.test.mjs'], 'Paid wall and closed gate queued formation destinations');
run(['scripts/dynamic-wall-native-scenario.mjs'], 'Native both-seat queued paid wall arrival');
run(['--test', 'scripts/stationary-worker-pathing.test.mjs'], 'Stationary Worker local detours and preserved Stop/Hold intent');
run(['scripts/stationary-worker-native-scenario.mjs'], 'Native both-seat parked Worker formation recovery');
run(['--test', 'scripts/fortified-site-clearance.test.mjs'], 'Fortified late-arrival construction clearance');
run(['--test', 'scripts/sheep-static-preview.test.mjs'], 'Sheep static reference integrity and state boundary');
run(['--test', 'scripts/sheep-eight-view-runtime.test.mjs'], 'Admitted eight-view Sheep source and default runtime');
run(['--test', 'scripts/sheep-directional-readiness.test.mjs'], 'Sheep directional source and anchor acceptance');
run(['--test', 'scripts/neutral-wildlife-renderer.test.mjs'], 'Neutral wildlife render lifecycle and fallback');
run(['--test', 'scripts/sheep-relocated-client.test.mjs'], 'Relocated Sheep actual-cell rendering, picking and minimap fog');
run(['--test', 'scripts/wildlife-client-state.test.mjs', 'scripts/wildlife-client-controls.test.mjs', 'scripts/sheep-placement-client.test.mjs'], 'Owned Sheep selection, normal Herd/Stop input and actual food placement');
run(['scripts/wildlife-render-scenario.mjs'], 'Live wildlife snapshots and production art paths');
run(['--test', 'scripts/terraced-vale.test.mjs', 'scripts/terraced-vale-sheep.test.mjs', 'scripts/terraced-vale-sheep-entry.test.mjs'], 'Tiny default Sheep balance, reachability, real entry and exact old-map recovery');
run(['scripts/terraced-vale-sheep-scenario.mjs'], 'Tiny default both-seat Sheep claim, shared food and recovery');
run(['--test', 'scripts/millrace-sheep.test.mjs'], 'Historical Millrace Sheep budget and exact legacy map compatibility');
run(['scripts/millrace-sheep-scenario.mjs'], 'Historical Millrace Sheep visibility, harvest, art and recovery');
run(['--test', 'scripts/sprite-pixel-bounds.test.mjs'], 'Sprite pixel clipping regressions');
run(['--test', 'scripts/building-sprites.test.mjs'], 'Default building sprites');
run(['--test', 'scripts/frontier-building-default.test.mjs'], 'Normal finished Frontier building art, fallback and shared depth');
run(['scripts/frontier-building-acceptance-map-scenario.mjs'], 'Ordinary building acceptance map admission and legal pads');
run(['--test', 'scripts/building-occlusion-fixture.test.mjs'], 'Building occlusion QA controls, HTTP assets and timing evidence');
run(['--test', 'scripts/captured-building-state-race.test.mjs', 'scripts/captured-building-manifest-retry.test.mjs', 'scripts/frontier-building-renderer.test.mjs', 'scripts/frontier-building-preview.test.mjs', 'scripts/building-lifecycle-validation.test.mjs'], 'Captured building lifecycle and source contracts');
run(['--test', 'scripts/ci-sharding.test.mjs'], 'CI shard coverage');
run(['--test', 'scripts/pve-reconnaissance.test.mjs'], 'Bounded Scout reconnaissance');
run(['--test', 'scripts/browser-performance-instrumentation.test.mjs'], 'Browser timing attribution');
run(['--test', 'scripts/browser-preflight.test.mjs'], 'Browser preflight diagnostics');
run(['--test', 'scripts/temporary-resources.test.mjs'], 'Owned temporary resource cleanup');
run(['--test', 'scripts/mature-settlement-scenario.test.mjs'], 'Paid settlement fixture ledger and layout');
run(['scripts/mature-settlement-scenario.mjs'], 'Paid settlement construction, composition and recovery');
run(['scripts/mature-settlement-scenario.mjs', '--reverse-seats'], 'Paid settlement reversed seat dispatch');
run(['--test', 'scripts/capture-checkpoint.test.mjs'], 'Capture checkpoint artifact contract');
run(['--test', 'scripts/performance-order-window.test.mjs'], 'Performance planning wave boundaries');
run(['--test', 'scripts/persistent-command.test.mjs'], 'Persistent tactical intent and bounded planning');
run(['--test', 'scripts/stationary-command.test.mjs'], 'Stationary command tasks and controls');
run(['--test', 'scripts/army-attack-continuation.test.mjs'], 'Focused military attack continuation and ordinary attack-move input');
run(['--test', 'scripts/military-stance.test.mjs'], 'Military stances, idle defense, bounded return and command precedence');
run(['scripts/military-stance-native-scenario.mjs'], 'Native two-seat stance commands and defensive return recovery');
run(['--test', 'scripts/waypoint-backpressure.test.mjs'], 'Waypoint metadata under backpressure');
run(['--experimental-test-coverage', '--test-coverage-include=src/networking/websocket-frame.mjs',
  '--test-coverage-lines=100', '--test-coverage-branches=100', '--test-coverage-functions=100',
  '--test', 'scripts/websocket-frame.test.mjs'], 'Outbound WebSocket frame coverage floor (100%)');
run(['--experimental-test-coverage', '--test-coverage-include=src/networking/websocket-deflate-offer.mjs',
  '--test-coverage-lines=100', '--test-coverage-branches=100', '--test-coverage-functions=100',
  '--test', 'scripts/websocket-deflate-offer.test.mjs'], 'WebSocket deflate-offer coverage floor (100%)');
run(['--test', 'scripts/worker-shutdown.test.mjs'], 'Signal-aware room worker shutdown');
run(['--test', 'scripts/check-client-imports.test.mjs'], 'Served client import graph');
run(['--test', 'scripts/snapshot-private-production.test.mjs'], 'Seat-private production snapshots');
run(['--test', 'scripts/snapshot-row-allocation.test.mjs'], 'Base-row allocation preserves exact snapshot fields and wire bytes');

run(['--test', 'scripts/battlefield-cursor.test.mjs'], 'Battlefield cursor states');
run(['--test', 'scripts/hud-action-icons.test.mjs'], 'Default HUD action glyphs and semantics');
run(['scripts/hud-action-icons-serving-scenario.mjs'], 'Default HUD action glyph HTTP bytes');
run(['--test', 'scripts/room-launch-options.test.mjs'], 'Room launch contract');
run(['--test', 'scripts/match-modes.test.mjs', 'scripts/match-mode-controls.test.mjs'], 'Versioned match modes and supported UI choices');
run(['--test', 'scripts/game-entry.test.mjs', 'scripts/game-navigation.test.mjs', 'scripts/room-presence.test.mjs', 'scripts/practice-entry.test.mjs'], 'Explicit main menu, mode-aware Practice, session entry and room presence');
run(['--test', 'scripts/bannerfall-rules.test.mjs'], 'Bounded Bannerfall waves, evolution and stronghold rules');
run(['--test', 'scripts/match-mode-checkpoint.test.mjs'], 'Match mode checkpoint identity and legacy preservation');
run(['scripts/game-menu-scenario.mjs'], 'Fresh menu matches and protected resume authority');
run(['--test', 'scripts/room-pregame.test.mjs', 'scripts/room-lobby-ui.test.mjs'], 'Pregame authority and lobby controls');
run(['--test', 'scripts/room-lobby-chat.test.mjs', 'scripts/room-lobby-chat-ui.test.mjs'], 'Bounded pregame room chat');
run(['scripts/room-lobby-chat-scenario.mjs'], 'Real two-client room chat isolation and recovery');
run(['--test', 'scripts/pve-entry.test.mjs'], 'PvE entry observer settling');
run(['--test', 'scripts/hud-layout.test.mjs'], 'Visible HUD layout');
run(['--test', 'scripts/combat-stance-ui.test.mjs'], 'Authoritative selected military stance controls');
run(['--test', 'scripts/minimap-orders.test.mjs'], 'Tactical map selected-unit movement');
run(['--test', 'scripts/minimap-browser-probe.test.mjs'], 'Minimap browser proof camera observation');
run(['--test', 'scripts/selection-center-shortcut.test.mjs'], 'Selection camera shortcut and preserved Space drag');
run(['--test', 'scripts/objective-summary.test.mjs', 'scripts/completion-event-labels.test.mjs'], 'Compact objectives and event feedback');
run(['--test', 'scripts/selection-context.test.mjs'], 'Contextual selection');
run(['--test', 'scripts/contextual-hud.test.mjs'], 'Empty selection HUD and command focus');
run(['--test', 'scripts/roster-production-ui.test.mjs'], 'Roster production choices');
run(['--test', 'scripts/building-placement-forest.test.mjs'], 'Disclosed forest building placement');
run(['--test', 'scripts/wall-line-planner.test.mjs'], 'Atomic modular wall-line authoring');
run(['--test', 'scripts/wall-construction-draft.test.mjs'], 'Draft paid palisade preparation and lifecycle contracts');
run(['--test', 'scripts/palisade-runtime.test.mjs'], 'Palisade order identity and placeholder connections');
run(['--test', 'scripts/wall-placement.test.mjs', 'scripts/wall-placement-client.test.mjs'], 'Atomic palisade drag and keyboard placement');
run(['--test', 'scripts/palisade-gate.test.mjs'], 'Palisade gate operation, recovery and controls');
run(['scripts/paid-gate-scenario.mjs'], 'Paid gate movement, safe closing and restart');
run(['scripts/paid-palisade-scenario.mjs'], 'Paid palisade atomic placement and Worker recovery');
run(['--test', 'scripts/population.test.mjs'], 'Population reservations and capacity');
run(['--test', 'scripts/population-readout.test.mjs'], 'Owned population presentation');
run(['--test', 'scripts/population-ai.test.mjs'], 'AI capacity construction and recovery');
run(['--test', 'scripts/pve-worker-recovery.test.mjs'], 'PvE last-slot Worker recovery and fixed-tick economy replay');
run(['--test', 'scripts/pve-farm-policy.test.mjs'], 'PvE finite paid Farm starvation recovery and replant replay');
run(['--test', 'scripts/pve-home-defense.test.mjs'], 'PvE visible economic raids, bounded defense and objective recovery replay');
run(['--test', 'scripts/pve-regroup.test.mjs'], 'PvE bounded regroup after wipeout, paid recovery and restart replay');
run(['--test', 'scripts/pve-skirmish-targets.test.mjs', 'scripts/pve-skirmish-replay.test.mjs'], 'Explicit Skirmish AI targets, fog fairness and paid producer restart replay');
run(['--test', 'scripts/pve-mode-adapter.test.mjs', 'scripts/pve-skirmish-checkpoint.test.mjs'], 'Authoritative AI mode activation and canonical Skirmish recovery');
run(['--test', 'scripts/fog-checkpoint-boundary.test.mjs', 'scripts/fog-checkpoint-forest.test.mjs', 'scripts/fog-checkpoint-reinforcement.test.mjs'], 'Full fog checkpoint parity across movement, geometry and scenario births');
run(['--test', 'scripts/pve-wildlife-disclosure.test.mjs'], 'Opponent actual-cell wildlife resource disclosure');
run(['--test', 'scripts/pve-skirmish-loss.test.mjs'], 'Canonical both-seat Skirmish paid army and producer loss recovery');
run(['--test', 'scripts/pve-tiny-search.test.mjs'], 'Tiny authored and native Skirmish: fog, paid production, exact replay and reset');
run(['--test', 'scripts/pve-fog-restart.test.mjs'], 'PvE publication control and immediate off-phase fresh-foundation recovery');
run(['--test', 'scripts/pve-objective-rotation.test.mjs'], 'PvE public objective rotation after paid obstruction and checkpoint replay');
run(['--test', 'scripts/production-queue.test.mjs'], 'Mixed production queue authority');
run(['--test', 'scripts/wildlife-state.test.mjs'], 'Neutral wildlife lifecycle');
run(['--test', 'scripts/wildlife-import-parity.test.mjs'], 'Actual client and native publisher wildlife metadata parity');
run(['--test', 'scripts/wildlife-motion.test.mjs'], 'Bounded deterministic Sheep motion');
run(['--test', 'scripts/wildlife-heading.test.mjs'], 'Canonical Sheep body headings and exact checkpoint conversion');
run(['--test', 'scripts/wildlife-claims.test.mjs'], 'Automatic Sheep claim ownership and legality');
run(['--test', 'scripts/wildlife-herding.test.mjs', 'scripts/sheep-herding-authority.test.mjs'], 'Owner-only Sheep Herd authority, live food occupancy and checkpoint recovery');
run(['scripts/sheep-herding-scenario.mjs'], 'Both-seat Sheep Herd, shared harvest, construction and recovery');
run(['scripts/sheep-claims-scenario.mjs'], 'Both-seat automatic Sheep claims and recovery');
run(['scripts/sheep-motion-scenario.mjs'], 'Historical Millrace both-seat Sheep motion and recovery');
run(['scripts/wildlife-food-scenario.mjs'], 'Both-seat wildlife gathering, depletion and recovery');
run(['scripts/fractional-cargo-return-scenario.mjs'], 'Both-seat sub-cent Sheep cargo and production-client return recovery');
run(['--test', 'scripts/shore-fishing.test.mjs', 'scripts/shore-fishing-placeholder.test.mjs'], 'Shore fish bank access and placeholder');
run(['--test', 'scripts/shore-fishing-placement.test.mjs'], 'Seeded shore fishing authoring and land/water positions');
run(['--test', 'scripts/water-surface-study.test.mjs', 'scripts/water-study-fish-binding.test.mjs'], 'Default water surface, quality and visible fish ripples');
run(['--test', 'scripts/shore-bank-shade.test.mjs'], 'Default low-bank shade, island topology and static geometry budget');
run(['--test', 'scripts/water-route-graph.test.mjs'], 'Isolated water route topology and clearance');
run(['--test', 'scripts/dock-placement.test.mjs'], 'Dock shoreline and water berth placement');
run(['scripts/dock-scenario.mjs'], 'Both-seat paid Dock construction and recovery');
run(['--test', 'scripts/water-unit-runtime.test.mjs', 'scripts/skiff-contracts.test.mjs'], 'Skiff water movement, paid queue and placeholder controls');
run(['--test', 'scripts/skiff-counterflow.test.mjs'], 'Reciprocal Skiff passing, interruption and recovery on Confluence');
run(['scripts/skiff-counterflow-scenario.mjs'], 'Paid Practice Skiff counterflow, Stop/replacement, cold recovery and owned Dock deposits');
run(['scripts/skiff-scenario.mjs'], 'Both-seat paid Skiff production, berth occupancy and recovery');
run(['--test', 'scripts/skiff-fishing.test.mjs'], 'Finite Skiff food, owned Dock delivery and conservation');
run(['scripts/skiff-fishing-scenario.mjs'], 'Both-seat Skiff/Worker shared fish stock and cargo recovery');
run(['--test', 'scripts/skiff-group-orders.test.mjs'], 'Exact selected Skiff group destinations and cargo conservation');
run(['scripts/skiff-groups-scenario.mjs'], 'Both-seat selected Skiff movement/fishing/Return and restart');
run(['--test', 'scripts/skiff-waypoints.test.mjs'], 'Selected Skiff water waypoint tails, cargo and recovery');
run(['--test', 'scripts/skiff-fishing-next-move.test.mjs'], 'Skiff one-load fishing completion before queued Move');
run(['scripts/skiff-waypoints-scenario.mjs'], 'Both-seat shipped minimap Skiff waypoints and selected Stop');
run(['scripts/water-route-map-scenario.mjs'], 'Water-only route components on shipped maps');
run(['--test', 'scripts/resource-format.test.mjs'], 'Resource display and affordability');
run(['--test', 'scripts/gameplay-presentation.test.mjs'], 'Gameplay presentation bindings');
run(['--test', 'scripts/base-lifecycle-ui.test.mjs'], 'Contextual cancellation and repair controls');
run(['--test', 'scripts/research-ui.test.mjs'], 'Registered research choices');
run(['--test', 'scripts/research-actions.test.mjs'], 'Shared technology availability');
run(['--experimental-test-coverage', '--test-coverage-include=src/gameplay-action-rules.mjs',
  '--test-coverage-lines=100', '--test-coverage-branches=100', '--test-coverage-functions=100',
  '--test', 'scripts/gameplay-action-rules.test.mjs'], 'Production/research shared-rule coverage floor (100%)');
run(['--test', 'scripts/siege-ai.test.mjs'], 'Bounded siege acquisition and assault');
run(['--test', 'scripts/combat-rules.test.mjs'], 'Shared combat classes, counters and effect scope');
run(['--test', 'scripts/attack-target-geometry.test.mjs'], 'Attack-target geometry, queued transitions and fog');
run(['--test', 'scripts/worker-combat-repath.test.mjs'], 'Both-seat moving-target pursuit across spawn orientations');
run(['scripts/worker-combat-repath-native-scenario.mjs'], 'Native Worker combat pursuit and recovery');
run(['scripts/attack-queue-native-scenario.mjs'], 'Native both-seat queued attack retreat and recovery');
run(['--test', 'scripts/watchtower-targeting.test.mjs'], 'Bounded defense targeting and sight');
run(['--test', 'scripts/economy-ledger.test.mjs'], 'Fractional cargo conservation');
run(['--test', 'scripts/return-cargo.test.mjs'], 'Explicit cargo return authority and controls');
run(['--test', 'scripts/queued-cargo-return.test.mjs'], 'Delivery completion, queued routes and preserved cargo');
run(['scripts/queued-cargo-return-native-scenario.mjs'], 'Native both-seat queued cargo delivery and restart');
run(['scripts/interrupted-cargo-return-scenario.mjs'], 'Interrupted final sheep-food delivery and restart');
run(['--test', 'scripts/depleted-resource-construction.test.mjs'], 'Disclosed depleted resource construction sites');
run(['scripts/depleted-resource-construction-scenario.mjs'], 'Paid construction on depleted resource sites and restart');
run(['--test', 'scripts/underbough-gathering-evidence.test.mjs'], 'Rootways gathering provenance before rewards');
run(['--test', 'scripts/base-lifecycle.test.mjs'], 'Cancel refunds and proportional repair');
run(['--test', 'scripts/storehouse-routing.test.mjs'], 'Reachable drop-off route selection');
run(['--test', 'scripts/mill-contract.test.mjs'], 'Food-only Mill routing, menu and placeholder contracts');
run(['--test', 'scripts/farm-harvest.test.mjs', 'scripts/farm-client.test.mjs'], 'Finite Farm stock, identity, ownership and controls');
run(['--test', 'scripts/economy-profile.test.mjs'], 'Explicit Stone profile and typed price/refund contracts');
run(['--test', 'scripts/economy-checkpoint.test.mjs', 'scripts/economy-server.test.mjs'], 'Typed economy payment, deposit and checkpoint conservation');
run(['--test', 'scripts/economy-client.test.mjs'], 'Typed economy client profile, cargo and affordability');
run(['--test', 'scripts/economy-recovery-native.test.mjs'], 'Native economy profile identity and exact rejected recovery preservation');
run(['scripts/farm-scenario.mjs', '--fog'], 'Both-seat paid Farm planting, finite depletion and recovery');
run(['scripts/farm-stone-paid-scenario.mjs'], 'Shipped paid Farm/Watchtower, natural Stone handoff and cold recovery');
run(['--test', 'scripts/depot-economy-analysis.test.mjs', 'scripts/depot-source-snapshot.test.mjs'], 'Depot measurement placements, accounting, payback math and source provenance');
run(['scripts/depot-economy-scenario.mjs', '--smoke'], 'Paid depot measurement smoke and both-seat conservation');
run(['scripts/farm-food-measurement.mjs', '--smoke'], 'Paired paid Farm versus neutral food opening and exact returned-cargo accounting');
run(['--test', 'scripts/roster-building-ui.test.mjs'], 'Registry building options');
run(['--test', 'scripts/ruleset-revision.test.mjs'], 'Resolved ruleset identity and prerequisites');
run(['--test', 'scripts/gameplay-definitions.test.mjs'], 'Gameplay definition validation');
run(['--test', 'scripts/client-build-recovery.test.mjs'], 'Build placement connection recovery');
run(['--test', 'scripts/construction-selection.test.mjs'], 'Selected-only construction client commands');
run(['scripts/construction-selection-scenario.mjs'], 'Both-seat selected builders and unselected work recovery');
run(['--test', 'scripts/client-rematch-recovery.test.mjs'], 'Client roster and ownership after rematch');
run(['--test', 'scripts/client-camera-recovery.test.mjs'], 'Camera ownership through seat recovery');
run(['--test', 'scripts/unit-health-visual.test.mjs'], 'Visible damaged-unit health indicators');
run(['--test', 'scripts/navigation-settings.test.mjs'], 'Camera navigation settings and controls');

const scenarios = [
  ['scripts/shore-fishing-scenario.mjs', 'Both-seat shore fishing, cargo and depletion recovery'],
  ['scripts/shore-fishing-authoring-scenario.mjs', 'Selectable seeded shore fishing pilot and recovery'],
  ['scripts/shore-fishing-adoption-scenario.mjs', 'Shipped pilot paid Dock/Skiff DOM choices and fishing Moves'],
  ['scripts/shore-fishing-adoption-scenario.mjs', 'Normal one-player Practice paid fishing, Stop/Return and recovery', '--practice'],
  ['scripts/millrace-resource-scenario.mjs', 'Millrace cluster gathering and recovery'],
  ['scripts/regional-objective-scenario.mjs', 'Millrace both-seat hold and rematch', 'bellweather-millrace'],
  ['scripts/regional-objective-scenario.mjs', 'Rootways both-seat hold and rematch', 'underbough-rootways'],
  ['scripts/underbough-gameplay-proof.mjs', 'Rootways 250-unit economy and recovery (winner 0)', '0'],
  ['scripts/underbough-gameplay-proof.mjs', 'Rootways 250-unit economy and recovery (winner 1)', '1'],
  ['scripts/building-production-cue-scenario.mjs', 'Building production cue'],
  ['scripts/client-asset-allowlist-scenario.mjs', 'Client static asset allowlist'],
  ['scripts/docker-ui-assets-context-scenario.mjs', 'Docker UI asset context'],
  ['scripts/origin-policy-scenario.mjs', 'Origin policy'],
  ['scripts/origin-proxy-scenario.mjs', 'Origin policy through room proxy'],
  ['scripts/audio-library.test.mjs', 'Audio library and portable originals'],
  ['scripts/validate-zone-audio.mjs', 'All-zone audio source coverage and integrity'],
  ['scripts/audio-composer-scenario.mjs', 'Audio composer and WAV scheduling'],
  ['scripts/audio-runtime-scenario.mjs', 'Audio profile routing and settings migration'],
  ['scripts/audio-runtime-playback-scenario.mjs', 'Sampled audio playback and fallback'],
  ['scripts/audio-composition-player-scenario.mjs', 'Audio composition clock and cancellation'],
  ['scripts/audio-lifecycle-scenario.mjs', 'Unit audio lifecycle'],
  ['scripts/audio-policy-scenario.mjs', 'Audio policy'],
  ['scripts/audio-recognition-check-scenario.mjs', 'Audio recognition check'],
  ['scripts/map-utils-scenario.mjs', 'Map utilities'],
  ['scripts/elevation-scenario.mjs', 'Elevation pathing and sight'],
  ['scripts/camera-controls-scenario.mjs', 'Camera controls'],
  ['scripts/objective-fog-visibility-scenario.mjs', 'Objective fog visibility'],
  ['scripts/unreachable-attack-scenario.mjs', 'Orders, 2k spawn clearance, and objective hold'],
  ['scripts/ranged-building-attack-scenario.mjs', 'Building attacks across disconnected terrain'],
  ['scripts/ranged-building-attack-scenario.mjs', 'In-range building attacks survive construction repair', '--edge-range-repair'],
  ['scripts/archer-firing-approach-scenario.mjs', 'Archers approach firing positions across gaps'],
  ['scripts/cliff-pursuit-scenario.mjs', 'Direct pursuit after unreachable retreats', '--direct'],
  ['scripts/cliff-pursuit-scenario.mjs', 'Attack-move alternatives across elevation'],
  ['scripts/simultaneous-lethal-combat-scenario.mjs', 'Simultaneous lethal combat fairness'],
  ['scripts/construction-connectivity-scenario.mjs', 'Construction preserves existing terrain connections'],
  ['scripts/elimination-scenario.mjs', 'Terminal elimination and reconnect'],
  ['scripts/victory-elimination-native-scenario.mjs', 'Existing elimination recovery and clock boundaries'],
  ['scripts/match-mode-native-scenario.mjs', 'Skirmish rewards, defeat and versioned recovery'],
  ['scripts/bannerfall-native-scenario.mjs', 'Bannerfall human waves, evolution, strongholds and recovery'],
  ['scripts/bannerfall-room-entry-scenario.mjs', 'Bannerfall real human/Practice room entry and fixed settings'],
  ['scripts/persistent-command-scenario.mjs', 'Patrol and Follow authority/recovery'],
  ['scripts/stationary-command-scenario.mjs', 'Stop and hold authority/recovery'],
  ['scripts/queued-waypoint-scenario.mjs', 'Queued waypoint checkpoint recovery'],
  ['scripts/hold-clock-recovery-scenario.mjs', 'Checkpoint hold clock recovery (Azure)'],
  ['scripts/hold-clock-recovery-scenario.mjs', 'Checkpoint hold clock recovery (Ember)', '1'],
  ['scripts/live-attack-move-repair-scenario.mjs', 'Live attack-move route repair'],
  ['scripts/worker-combat-scenario.mjs', 'Worker combat across both seats'],
  ['scripts/worker-production-spawn-scenario.mjs', 'Town Center worker exits across map orientations'],
  ['scripts/ruleset-checkpoint-scenario.mjs', 'Pinned ruleset checkpoint recovery'],
  ['scripts/siege-defense-scenario.mjs', 'Siege range and defended-position counter'],
  ['scripts/siege-ai-runtime-scenario.mjs', 'Paid AI siege acquisition and assault (Azure)', '0'],
  ['scripts/siege-ai-runtime-scenario.mjs', 'Paid AI siege acquisition and assault (Ember)', '1'],
  ['scripts/watchtower-scenario.mjs', 'Watchtower fire and simultaneous trade'],
  ['scripts/town-center-scenario.mjs', 'Town Center expansion and recovery'],
  ['scripts/expansion-ai-runtime-scenario.mjs', 'Paid live AI base expansion (both seats)'],
  ['scripts/base-lifecycle-scenario.mjs', 'Base cancel/refund and interrupted repair'],
  ['scripts/storehouse-scenario.mjs', 'Storehouse drop-off and cargo recovery'],
  ['scripts/mill-scenario.mjs', 'Both-seat paid Mill construction, food deposits and lifecycle recovery'],
  ['scripts/population-scenario.mjs', 'House population lifecycle'],
  ['scripts/progression-scenario.mjs', 'Military tier and technology recovery'],
  ['scripts/roster-options-scenario.mjs', 'Roster production and persistence'],
  ['scripts/roster-options-scenario.mjs', 'Mounted mixed production and persistence', '--mounted'],
  ['scripts/roster-options-scenario.mjs', 'Siege unlock, production and recovery', '--siege'],
  ['scripts/production-lifecycle-scenario.mjs', 'Producer destruction and population reservations'],
  ['scripts/infantry-seat-combat-scenario.mjs', 'Mirrored infantry combat parity', '--expect-parity'],
  ['scripts/opening-production-scenario.mjs', 'Mirrored construction and production', '--expect-builder-parity'],
  ['scripts/forked-vale-scenario.mjs', 'Forked Vale economy-to-victory (Team 0)', '0'],
  ['scripts/forked-vale-scenario.mjs', 'Forked Vale economy-to-victory (Team 1)', '1'],
  ['scripts/vaelora-map-layout-scenario.mjs', 'Vaelora roster with Town Center collisions', '--check-only'],
  ['scripts/forked-vale-layout.mjs', 'Forked Vale layout'],
  ['scripts/fortified-crossing-layout.mjs', 'Fortified Crossing layout'],
  ['scripts/fortified-construction-clearance-scenario.mjs', 'Fortified 2000-unit paid construction clearance'],
  ['scripts/fortified-crossing-combined.mjs', 'Fortified Crossing combined economy, orders, events, result and recovery', '0'],
  ['scripts/frontier-160-layout.mjs', 'Frontier 160 layout'],
  ['scripts/generate-highland-grove.mjs', 'Highland Grove playable layout', '--check'],
  ['scripts/three-crowns-layout.mjs', 'Three Crowns layout'],
  ['scripts/formation-assignment-scenario.mjs', 'Formation assignment'],
  ['scripts/unit-selection-scenario.mjs', 'Unit selection'],
  ['scripts/pve-opponent-scenario.mjs', 'PvE opponent seats'],
  ['scripts/field-roles-scenario.mjs', 'Forked Vale scouting and mounted counter response'],
  ['scripts/pve-decision-fairness-scenario.mjs', 'PvE tactical decisions during gather retries'],
  ['scripts/pve-tactical-retry-scenario.mjs', 'Bounded PvE tactical retries'],
  ['scripts/pve-reinforcement-recovery-scenario.mjs', 'Stranded PvE reinforcements retry independently'],
  ['scripts/pve-tactical-stall-runtime-scenario.mjs', 'PvE stalled-army recovery through the server'],
  ['scripts/pve-production-scenario.mjs', 'PvE production budgets and retry limits'],
  ['scripts/pve-barracks-recovery-scenario.mjs', 'PvE replacement after producer destruction'],
  ['scripts/pve-objective-recovery-runtime-scenario.mjs', 'PvE objective recovery (Azure)', '0', '20260925'],
  ['scripts/pve-objective-recovery-runtime-scenario.mjs', 'PvE objective recovery (Ember)', '1', '20260925'],
  ['scripts/pve-contested-match-scenario.mjs', 'Contested seeded PvE match', '300', '20260925', '4294967295'],
  ['scripts/pve-production-runtime-scenario.mjs', 'PvE production on Millrace', 'bellweather-millrace'],
  ['scripts/pve-production-runtime-scenario.mjs', 'PvE production on Rootways', 'underbough-rootways'],
  ['scripts/underbough-scout-scenario.mjs', 'Rootways paid Scout exploration, retreat and resumption'],
  ['scripts/underbough-woodland-shortcut-scenario.mjs', 'Rootways paid woodland shortcut and both-seat traversal'],
  ['scripts/pve-production-runtime-scenario.mjs', 'PvE production on Forked Vale', 'forked-vale'],
  ['scripts/pve-production-runtime-scenario.mjs', 'PvE production on Woodland Expanse', 'woodland-expanse'],
  ['scripts/visual-pack-path-safety-scenario.mjs', 'Visual pack path safety'],
  ['scripts/painted-material-atlas-scenario.mjs', 'Painted-material atlas manifest and file contract'],
  ['scripts/painted-material-atlas-uv-scenario.mjs', 'Painted-material atlas mirrored UV mapping'],
  ['scripts/painted-material-atlas-runtime.test.mjs', 'Default painted-ground atlas runtime'],
  ['scripts/sprite-atlas-handoff-scenario.mjs', 'Sprite-atlas handoff audit'],
  ['scripts/cast-sprite-atlas-scenario.mjs', 'Cast sprite-atlas candidates'],
  ['scripts/archery-range-sprite-atlas-scenario.mjs', 'Archery Range sprite-atlas handoff'],
  ['scripts/town-center-sprite-atlas-scenario.mjs', 'Town Center sprite-atlas handoff'],
  ['scripts/unit-lod-state-scenario.mjs', 'Unit LOD matrix updates'],
  ['scripts/unit-visual-state-scenario.mjs', 'Unit visual state'],
  ['scripts/resource-visual-state-scenario.mjs', 'Resource visual state'],
  ['scripts/terrain-atmosphere-scenario.mjs', 'Decorative ground mist coverage and foreground order'],
  ['scripts/terrain-blend-scenario.mjs', 'Soft terrain material masks and normalized joins'],
  ['scripts/water-surface-scenario.mjs', 'Batched water surface and shore geometry'],
  ['scripts/water-contour-scenario.mjs', 'Conservative connected water contours and topology'],
  ['scripts/meadow-vegetation-scenario.mjs', 'Seeded meadow flowers and protected economy markers'],
  ['scripts/garden-vegetation-scenario.mjs', 'Channel garden flowers and clear crossings'],
  ['scripts/shore-vegetation-scenario.mjs', 'Seeded shoreline vegetation and clear crossings'],
  ['scripts/validate-environment-plants.mjs', 'Regional plant source/runtime file contracts'],
  ['scripts/environment-plant-pack-scenario.mjs', 'Regional plant contract rejection cases'],
  ['scripts/harvestable-woodland-scenario.mjs', 'Harvestable woodland gameplay'],
  ['scripts/worker-cargo-return-scenario.mjs', 'Highland Grove forest route repair and deposits'],
  ['scripts/worker-cargo-return-scenario.mjs', 'Frontier Reach forest route repair and deposits', 'frontier-160'],
  ['scripts/room-supervisor-scenario.mjs', 'Room supervisor integration'],
  ['scripts/room-pregame-scenario.mjs', 'Pregame two-seat launch and recovery'],
  ['scripts/ordinary-map-floor-scenario.mjs', 'Ordinary Tiny floor, fresh modes and historical/Practice access'],
  ['scripts/small-skirmish-entry-scenario.mjs', 'Reviewed Small normal human paid entry and recovery'],
  ['scripts/medium-skirmish-entry-scenario.mjs', 'Reviewed Medium normal human paid entry, cold recovery and rematch'],
  ['scripts/large-skirmish-entry-scenario.mjs', 'Reviewed Large normal human paid entry, cold recovery, rematch and Skirmish Practice'],
  ['scripts/checkpoint-storage-recovery-scenario.mjs', 'Checkpoint storage failure and recovery'],
  ['scripts/room-expiry-scenario.mjs', 'Invite expiry and pending reconnect protection'],
  ['scripts/impaired-connection-scenario.mjs', 'Delayed two-seat transport and interrupted-order recovery'],
  ['scripts/pve-room-launch-scenario.mjs', 'PvE room launch and rematch integration'],
  ['scripts/tiny-skirmish-pve-entry-scenario.mjs', 'Fresh Tiny Skirmish AI admission, paid economy and cold resume'],
  ['scripts/pve-tiny-process-recovery-scenario.mjs', 'Normal Tiny PvE paid process restart, reconnect and rematch'],
  ['scripts/railway-release-scenario.mjs', 'Railway release integration'],
];

for (const [file, label, ...args] of scenarios) run([file, ...args], label);

const selected = checks.filter((_, index) => index % shardCount === shardIndex);
if (options.includes('--list')) process.stdout.write(`${JSON.stringify(selected)}\n`);
else {
  for (const check of selected) execute(check);
  process.stdout.write(`\nCI checks passed${shard ? ` (shard ${shardIndex + 1}/${shardCount})` : ''}.\n`);
}
