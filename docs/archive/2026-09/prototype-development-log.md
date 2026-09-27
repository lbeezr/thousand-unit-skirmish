# Prototype development log

Historical version notes and local measurements extracted from the former root README at `e4a3731`. These results retain their original scope and are not current setup instructions or capacity promises.

## 2,000-unit server check

Prototype 0.14's live Stone Pass check completed the worker loop: four Azure workers gathered and deposited food, then the host trained infantry for 50 food (roster 1,000 → 1,001). A separate 10-second 2,000-unit movement run on the same map moved 1,994 units in its first checked snapshot; order assignment took 34.084 ms, and the 30 Hz simulation measured 2.259 ms p95 / 4.098 ms max tick work. That is one same-machine run, not a network or target-hardware guarantee. Waypoint travel now clamps to the remaining distance in the tick, preventing units from oscillating just short of a cell center.

Prototype 0.15 makes the shipped control zones win conditions. A captured victory objective freezes the simulation, blocks further gameplay orders at the server, and shows both players a persistent win/loss banner; the winner is part of room state so a reconnect sees the result. At that point, Map Studio let the host make its first capture zone a win condition or keep it as a non-terminal objective.

Prototype 0.16 adds one-shot attack-move on `M` or the **Attack move** button. Units advance along the same cooperative formation planner as ordinary move orders, acquire reachable enemies within 4.8 world units, pursue within an 8-unit leash, and resume their saved destination route after a target dies or leaves pursuit range. Acquisition checks at most 64 candidates per scan and rotates crowded bucket samples so an unreachable ID prefix cannot starve later targets. Direct move, attack, and gather orders cancel attack-move.

Prototype 0.17 makes all capture zones editable in Map Studio. The selected zone is highlighted on the map; adding a zone arms a placement drag, and removal targets only the selected zone. A map may contain up to 32 objectives; at that build, only one could be a victory objective.

Prototype 0.18 adds an optional per-zone capture announcement in Map Studio. Use `{team}` and `{objective}` in the message; leaving the field blank uses the default announcement. Messages are limited to 120 characters and are included in map JSON.

Prototype 0.19 lets each capture trigger award 0–10,000 food on a successful capture or recapture. The objective panel shows the reward, both clients see synchronized team food, and announcements can include `{reward}`. The trigger scenario verifies default/custom announcements, rewards, and a later-list victory effect with two clients.

Prototype 0.20 adds map-level `victoryMode: "any" | "all"`, supports multiple marked victory zones, and saves the winning trigger in room state. Map Studio exposes the rule and retains each zone's victory mark independently. The two-client trigger scenario covers both modes and their capture announcements/rewards.

Prototype 0.21 makes attack-move scans fair across crowded enemy formations. Each scan round-robins its 64-candidate budget across nearby spatial buckets, rotates the bucket window between scans, and advances a persistent cursor through units within each bucket. This prevents dense, unreachable groups from repeatedly occupying the whole scan budget while retaining the per-tick pathfinding limit. The standard two-client attack-move scenario checks target acquisition, combat route resumption, manual-order cancellation, and leash behavior; the focused fairness scenario checks a reachable target behind more than 64 earlier out-of-range candidates.

Prototype 0.22 adds wood gathering and a first production-building loop. Workers can build a server-placed Archery Range; buildings block movement and placements preserve spawn/resource connectivity. Completed ranges queue Archers for food and wood, with the unit state synchronized to both players. The two-client economy scenario covers gathering, rejected and accepted placements, construction progress, training debit/spawn, Archer ranged damage, and reset cleanup. In a 10-second, 2,000-unit local movement run, 1,994 units moved in the first checked state; order assignment took 37.831 ms and the 300-tick p95 / maximum work was 4.932 / 8.051 ms against the 33.333 ms budget. These are same-machine results, not a network or target-hardware guarantee.

Prototype 0.23 adds a **Resume construction** control for unfinished ranges and makes route validation aware of sliced move plans and active combat pursuits. Pending plans are recalculated against the updated map; an active route that reaches a newly blocked waypoint is repaired automatically. Attack-move units keep their advance destination while pursuit paths refresh. Building placement keeps every living unit and each range's access connected to its team's spawn, and a queue with no free spawn cell reports that it is waiting for space.

Prototype 0.24 adds selectable **Box**, **Line**, and **Column** destination layouts to move and attack-move. Line and column slots face the order direction, and each unit still receives a reachable reserved cell before cooperative path planning begins.

Prototype 0.25 adds a containerized internet-demo profile with Caddy HTTPS and shared-password access, same-origin WebSocket checks, connection and inbound-message limits, a cap on maps published during one server run, static-file allowlisting, a private health route, and graceful WebSocket draining on SIGTERM/SIGINT. Browser resume tokens travel in the WebSocket subprotocol header instead of the URL query. Server restarts still clear the match, resume tokens, and custom maps published in Map Studio.

Prototype 0.26 adds a selected-group worker/infantry/archer breakdown and makes the population limit count living units. Casualties free room for replacements; recycled server slots carry per-session generation tags so delayed selections and orders cannot affect the replacement, including after a server restart.

Prototype 0.27 replaces the broad BFS search for each formation destination with Manhattan A*. It keeps shortest four-way grid routes and cooperative planning slices while reducing wasted exploration on long orders.

Prototype 0.28 adds persistent command feedback for move, attack, gather, and construction orders. The command panel shows sending/planning progress and the server's applied or rejected result; per-client order tokens prevent delayed replies to older plans from replacing newer feedback. Pending feedback becomes an explicit unknown state if the connection drops or the server does not respond in time.

Prototype 0.29 fixes construction feedback when server replies arrive out of order. A delayed build rejection now releases only the matching placement request and still explains the rejection, without replacing newer command feedback or clearing a newer build request.

Prototype 0.30 checks both axis-aligned shortest routes before starting A*. If either route is clear, the server uses it directly; blocked routes continue through A*. In two repeated 256 × 256 open-map runs with 1,000 units per team, median move-planning work fell from 39.412 ms to 4.361 ms (88.9% lower), and median order planning fell from 61.706 ms to 4.496 ms (92.7% lower). All 2,000 units received non-empty routes to unique destinations and moved after both orders. A separate 8-cell choke-map run exercised A* (552 searches per team order) and also moved all 2,000 units. These are same-machine Node 24.9.0 / arm64 captures, not online-latency or target-hardware guarantees; the harness does not admit hardware-performance evidence. The bounded record is `.game-dev/goals/multi-goal-path-search.json`.

On Node 24.9.0 on the local arm64 development machine, five separate 10-second Stone Pass runs moved at least 1,994 of 2,000 units in the first checked state. Each run used two browser-protocol clients and sampled 300 ticks. Results:

| Workload | Moved | Both-client order acknowledgement | Tick p95 / max |
| --- | ---: | ---: | ---: |
| Move · Box | 1,994 / 2,000 | 34.304 ms | 6.590 / 48.944 ms |
| Move · Line | 1,998 / 2,000 | 54.248 ms | 5.823 / 7.419 ms |
| Move · Column | 1,996 / 2,000 | 44.534 ms | 3.368 / 9.488 ms |
| Attack-move · Line | 1,998 / 2,000 | 57.322 ms | 6.407 / 16.701 ms |
| Attack-move · Column | 1,996 / 2,000 | 44.588 ms | 8.175 / 48.698 ms |

These were one local run per workload. Two runs had a single maximum tick above the 33.333 ms budget; p95 was below 8.2 ms in all five. This is a CPU-only baseline, not online latency or target-hardware evidence.

After the 0.25 transport and resume changes, a final 10-second Line move on the same machine moved 1,998 units; both order acknowledgements completed in 53.427 ms, and the 300-tick p95 / maximum was 6.154 / 7.402 ms. Both clients stayed connected with no queued or backpressured bytes.

On Node 24.9.0 on the local arm64 development machine, one 10-second 2,000-unit attack-move run moved 1,994 units in the first checked snapshot. Both attack-move orders were assigned in 33.273 ms; the 300-tick window measured 1.559 ms p50, 5.509 ms p95, and 14.314 ms maximum tick work against the 33.333 ms budget. This is one local run, not a network or target-hardware guarantee.

Check the shared map connectivity rules for resource nodes and capture zones:

```sh
node scripts/map-utils-scenario.mjs
```

Verify map-rule validation, including isolated zones, invalid single and multi-prerequisite references, blocked gates and recaptures, gate ownership transfer, simultaneous captures, capture rewards, both victory modes, and reconnect-safe winner state with two clients on a disposable room:

```sh
PORT=4174 node server.mjs
node scripts/trigger-scenario.mjs 4174
```

Measure client-visible snapshot sizes, actual WebSocket egress, and 30 Hz server tick timing with both 1,000-unit teams moving on a no-fog open map. The server negotiates browser-transparent [per-message compression](https://www.rfc-editor.org/rfc/rfc7692.html) with clients that offer it; clients without the extension keep the uncompressed JSON protocol. Use a fresh disposable server so reserved reconnect seats from a prior run do not affect the two clients:

```sh
PORT=4174 node server.mjs
node scripts/network-snapshot-scenario.mjs 4174 10
node scripts/network-snapshot-scenario.mjs 4174 40
```

A 40-second Node 24.9.0 / arm64 run delivered 754 compressed state frames across two clients (377 per client) for 2,000 units. Combined JSON WebSocket egress was 247 KiB/s, compared with 2,144 KiB/s for the same JSON frames at their uncompressed sizes, an 88.5% reduction before TCP/TLS overhead. Tick p95 / maximum in the final 10-second window was 3.573 / 5.867 ms. The scenario verifies the clients still parse full state and that server tick p95 remains within its 33.333 ms budget. These are local measurements, not internet-hosting guarantees.

Check consecutive attack-move targets plus combat and shared-node harvest spacing on a disposable open-field server:

```sh
RTS_MAP=maps/open-field.json PORT=4174 node server.mjs
node scripts/interaction-spacing-scenario.mjs 4174
```

Verify that attack-move acquires a reachable enemy after 65 earlier out-of-range candidates in one crowded spatial bucket:

```sh
PORT=4174 node server.mjs
node scripts/attack-move-cursor-scenario.mjs 4174
```

For the 2,000-unit load, pass `attack-move` as the performance workload mode; it issues simultaneous 1,000-unit attack-move orders and records a full 300-tick window:

```sh
node scripts/performance-scenario.mjs 4174 10 3 attack-move
```

These scenarios replace the current local match state; use a disposable server process.

To measure team-filtered state delivery on the fog-enabled Open Field map, start the server with `RTS_MAP=maps/open-field.json` and run the movement workload. The harness checks that at least 950 of each team's 1,000 units move in the first snapshot; attack-target benchmarks remain on the non-fog map because guessed enemy IDs are correctly rejected outside vision.

```sh
RTS_MAP=maps/open-field.json PORT=4178 node server.mjs
node scripts/performance-scenario.mjs 4178 10 1 move
```

On Node 24.9.0 on the local arm64 development machine, three 10-second Stone Pass runs moved 1,994 of 2,000 units in their first checked snapshot. The combined two-client acknowledgement time for simultaneous 1,000-unit attack-move orders was 31.450–37.102 ms (32.805 ms median). Tick p95 was 6.021–6.171 ms (6.145 ms median) across three full 300-tick windows; maximum tick work was 22.936 ms, 7.680 ms, and 8.260 ms, respectively, against the 33.333 ms budget. These are local server measurements, not online latency or target-hardware guarantees.

Run this only against a disposable match; the scenario resets both teams to 2,000 units and issues movement orders:

```sh
PORT=4174 node server.mjs
node scripts/performance-scenario.mjs 4174 10 3
```

Pass `line` or `column` after the workload mode to measure those formations; omit it or pass `box` for the default layout. Move and attack-move runs require at least 1,900 of 2,000 units to have moved in the first checked snapshot and assert that every unit either receives a route or already occupies its assigned destination cell:

```sh
node scripts/performance-scenario.mjs 4174 10 1 move line
node scripts/performance-scenario.mjs 4174 10 1 move column
```

The scenario confirms that units move, times when both clients receive their move-order acknowledgements, and records three 10-second windows of 30 Hz server tick work. On Node 24.9.0 on the development machine, the median of the three p95 tick measurements fell from 2.786 ms with string-keyed buckets to 1.660 ms with integer typed-array buckets (40.4% lower). In build 0.8, before unique formation-slot assignment, the two-client move-order acknowledgement roundtrip was 11.656–15.268 ms (14.850 ms median); tick p95 was 1.668–2.073 ms. Each p95 window contained 300 ticks and included simulation, trigger evaluation, and state broadcast work; the 33.333 ms tick budget was unchanged. These are same-machine prototype measurements, not cross-network or target-hardware guarantees.

On the corrected 80 × 56 Cinder Ridge map, the 2,000-unit movement scenario moved 1,937 units within the first checked snapshot in all three runs. The two-client move-order acknowledgement roundtrip was 16.324–23.234 ms (17.626 ms median); p95 tick work was 1.805–2.050 ms and max was 2.695–6.844 ms. An earlier 54.054 ms maximum did not recur in these repeats, so longer tail-latency checks remain open.

Add `slow` after the workload mode to test a paused spectator connection while both players move 2,000 units:

```sh
node scripts/performance-scenario.mjs 4174 20 1 move slow
```

The slow-reader run coalesced 178 stale snapshots while the Node socket write queue peaked at 95,901 bytes. Both players stayed connected, and after the spectator resumed reading the server returned to 0 queued bytes and 0 backpressured peers. Queue metrics describe Node's writable buffers, not data already accepted by the operating system's TCP buffers.

To exercise large map broadcasts against a paused team client and verify session recovery:

```sh
node scripts/performance-scenario.mjs 4174 10 1 map-backpressure slow
```

This workload repeatedly publishes a schema-valid map near the 900 KB client upload limit until the server closes the slow reader at its 4 MiB writable-queue cap. It then reconnects with the saved session token and verifies that the same team receives the latest map and full room state.

Verify that a backpressured client does not receive a coalesced old-map state after a map change. Start a fresh server and run the focused two-client scenario:

```sh
PORT=4174 node server.mjs
node scripts/map-change-backpressure-scenario.mjs 4174
```

For simultaneous opposing 1,000-unit attack orders, use the same command with `attack` as the final argument:

```sh
node scripts/performance-scenario.mjs 4174 10 3 attack
```

Attack orders now share a reverse breadth-first flow field per target cell, retained in a small bounded cache. On Stone Pass, three 10-second runs on the same development machine reduced the median p95 tick work from 12.009 ms to 3.738 ms (68.9% lower). The combined client-side wait from sending both orders until both clients received their acknowledgements measured 95.168/107.069/81.020 ms before the change and 7.849/4.174/1.287 ms after it; the first candidate run builds the fields, and later runs reuse the cache. All runs moved 2,000 units. On corrected Cinder Ridge, an opposing attack run moved 1,937 units, acknowledged both orders in 7.744 ms, and measured 3.305 ms p95 / 6.424 ms maximum tick work. These are local prototype measurements, not network-latency or target-hardware guarantees.

## 256 × 256 move-order pathfinding

`game-dev scenario run pathfinding-256 --project . --input '{"map":"open","repeats":2}' --confirm --allow-performance` starts a disposable loopback server, generates an open or choke map, resets to 2,000 units, issues simultaneous 1,000-unit move orders, checks that every unit has a non-empty path and a distinct destination, verifies that all 2,000 units move, and captures two full 10-second tick windows. Set `.game-dev/pathfinding-mode.json` to `per-unit` to capture the baseline or `shared-start` to capture the candidate; the project ships with `shared-start` selected. The temporary map is removed when the scenario exits.

Sharing one breadth-first path tree between units that begin on the same map cell cut work on both generated maps. The baseline ran 1,000 searches per team order; the candidate ran 495, exactly matching the 495 distinct starting cells. Each map and mode was repeated twice with 1,000 units per team on Node 24.9.0 on the local arm64 Mac.

| 256 × 256 map | Median server planning time per team order | Median two-client acknowledgement time | Median tick p95 |
| --- | ---: | ---: | ---: |
| Open · per-unit baseline | 938 ms | 1,899 ms | 4.03 ms |
| Open · shared-start candidate | 434 ms · 53.8% lower | 867 ms · 54.4% lower | 4.54 ms |
| 8-cell choke · per-unit baseline | 919 ms | 1,836 ms | 4.46 ms |
| 8-cell choke · shared-start candidate | 452 ms · 50.8% lower | 904 ms · 50.7% lower | 5.25 ms |

The first post-order 2,000-unit state matched between baseline and candidate on both maps, while every unit received a path and all formation destinations stayed unique. Tick p95 remained well below the 33.333 ms budget. Those build 0.10 pathfinding captures used synchronous order planning; build 0.11 addressed the resulting event-loop pause with cooperative slices in the section below. The results are local diagnostics rather than target-hardware or online-network guarantees. The sealed runs are under `assets/generated/.game-dev/runs/`: open baseline `run_1790196622395_00547bc768de49b8a706bb764daa43e5`, open candidate `run_1790196663062_79545f9243da41e5960240df7a4b08c2`, choke baseline `run_1790196706454_bdf5a84eb8944c4e9a411fec84291b0f`, and choke candidate `run_1790196742269_b3af4fd02560459e999d38e28fc2d07b`.

## Sustained Stone Pass flow

`game-dev scenario run choke-flow-2000 --project . --confirm --allow-performance` sends both 1,000-unit teams toward opposite sides of the centered eight-cell passage for 60 seconds. It records units that cross the center line, units inside the passage, average forward progress, and the count that advances less than 24 world units. It also captures the final 10-second tick window. The run requires at least 950 crossings per team and no more than a 50-unit team gap. On SIGTERM or SIGINT, it closes both clients and the child server and removes the temporary map. This is ordinary movement without combat damage, so it isolates crowd and passage flow from combat balance.

## Responsive move orders on 256 × 256 maps

Build 0.11 splits grouped path searches into short event-loop slices. On the same open 256 × 256 map with two simultaneous 1,000-unit orders, the median longest uninterrupted planning slice fell from 449.5 ms to 6.36 ms (98.6% lower). All 2,000 units received non-empty paths, each team had 1,000 unique destinations, and all 2,000 had moved in a state snapshot taken after both orders were acknowledged. The server can continue servicing simulation ticks and network commands while the route work runs.

| Metric | Synchronous baseline | Cooperative planning |
| --- | ---: | ---: |
| Longest planning slice, median | 449.5 ms | 6.36 ms |
| Both-client order acknowledgement, median | 896.5 ms | 957.8 ms |
| Simulation tick p95, median | 4.458 ms | 4.093 ms |
| Units moved after both orders | 2,000 / 2,000 | 2,000 / 2,000 |

The trade-off is about 6.8% higher combined acknowledgement time in this local run, while eliminating the roughly half-second server stall. Total path-planning work increased about 4.6% from scheduling overhead. Measurements used Node 24.9.0 on the local arm64 Mac; they are CPU-only diagnostics, not network-latency or target-hardware guarantees. The sealed baseline is `run_1790197397030_7e7f52a2a112446491bae83eaf540121`, and the corrected cooperative capture is `run_1790197876218_d0a98e35784f45ef9b4eeeb40975ff29`, under `assets/generated/.game-dev/runs/`. The bounded optimization record is `.game-dev/goals/move-planning-responsiveness.json`.

Prototype 0.27's sealed open-map run repeats the same two-client 256 × 256 workload with 1,000 units per team. Median server order-planning time fell from 715.5 ms to 61.7 ms (91.4%); median local two-client acknowledgement fell from 960.8 ms to 85.9 ms (91.1%). The median longest planning slice fell from 6.46 ms to 5.12 ms, and tick p95 stayed near 6.2 ms. All 2,000 units moved, all 1,000 per-team routes were non-empty, and each side received 1,000 unique destinations. The attack-move pursuit, route-resume, and manual-order regression also passed on Stone Pass. This is local CPU evidence on Node 24.9.0 / arm64, not internet latency or target-hardware proof. The verified baseline and candidate captures are `run_1790216459673_c3d92d966d444dfdaa07ae474401ad02` and `run_1790216791700_e4abeeeb7ad34776b90f7369a8d8a82c`; the one-iteration record is `.game-dev/goals/move-order-latency.json`.

Prototype 0.30's verified open-map baseline and candidate captures are `run_1790216791700_e4abeeeb7ad34776b90f7369a8d8a82c` and `run_1790223004858_94306a4cd6154420acc339b61f948c0c`. The distinct 8-cell choke-map check is `run_1790223059669_f3a0337593cf4c8894638db7d03bf0bf`.

Prototype 0.31 adds elimination victories for maps without a marked capture victory objective. Queued units and affordable infantry or Archer production reserves keep a team alive; a same-tick wipeout is recorded as a draw. The result reason is included in room snapshots and survives reconnects. `maps/open-field.json` is the first shipped elimination map.

Prototype 0.32 adds optional team-shared fog of war. Living units reveal a radius of eight map cells; explored cells remain dimly visible, unseen enemy units and production buildings are omitted from a player's state, and direct attacks against unseen targets are rejected without exposing whether a guessed unit ID exists. Enemy economy, unit counts, and gameplay notices outside shared vision are hidden. Map Studio exposes the per-map setting.

Prototype 0.33 makes stone and forest blocks obstruct vision, lets buildings contribute team sight, and keeps clear terrain, water, and enemy snapshots under the same server-authoritative visibility mask. The fog scenario verifies a ridge shadow, reveal after moving around it, and an Archery Range revealing an enemy after its builders retreat. The 2,000-unit performance harness now measures own-army movement correctly when opponent units are hidden.

Prototype 0.34 factors obstacle elevation into sight: stone and forest at least 1.0 world units high block vision, while low outcrops and water do not. The two-client fog scenario covers tall-ridge occlusion, attack-move filtering against hidden enemies, visibility over a low stone outcrop, sight through water, and building vision after its builders leave.

Prototype 0.35 saves maps published from Map Studio as validated JSON in `custom-maps/` and reloads them into the map picker after server restart. Saved maps retain terrain, spawns, resources, fog settings, and capture triggers. The Compose demo mounts a named volume at that location so custom maps persist while the container filesystem remains read-only.

Prototype 0.36 adds route-assignment diagnostics to each 1,000-unit movement order. A route can be empty when a unit already occupies its assigned destination cell; the performance scenario distinguishes those cases from actual route failures and requires zero failures. Each row below is one 10-second Stone Pass run on Node 24.9.0 / arm64:

Prototype 0.37 makes simultaneous use of one reconnect token visible and recoverable. A second connection with a token whose seat is still live joins as a spectator while retaining that token; when the original socket releases the seat, the server signals the waiting connection and the browser reconnects to reclaim its team. This avoids opaque WebSocket upgrade failures and prevents the duplicate from taking the opponent's empty seat.

Prototype 0.38 adds invite-only rooms behind a supervisor. Each room runs in a separate match process, with an opaque 192-bit invite code, room-scoped resume storage, room-local custom-map storage, a four-room default cap, and six-hour idle cleanup. Invite IDs and maps survive supervisor restart; match state and player seat tokens do not. The browser can create rooms, copy invite links, and join from a code or link.

Prototype 0.39 adds timed supply drops as a second safe, data-authored scenario event. The authoritative clock begins when both team seats are connected; each one-shot event can reward Azure, Ember, or both and can broadcast a placeholder-based announcement. Map Studio edits, imports, exports, and saves the events, while the HUD displays their countdown and delivered state. Match resets replay events, and reconnect snapshots preserve their fired state and current rewards.

Prototype 0.40 restarts a crashed default match worker on the next health check or client request, using a single-flight startup path so concurrent reconnects share one replacement. Each match worker reports a process-instance ID in its welcome; tabs detect a changed ID and tell players that their match reset. The supervisor scenario kills the worker under two connected clients and verifies both seats recover while an invite room stays live.

Prototype 0.41 preserves spawn and resource grid cells when Map Studio grows or shrinks a map. Cropped markers move to the nearest edge with a review notice, and clipped capture zones are reported so resizing no longer silently shifts game-critical locations away from painted terrain.

Prototype 0.42 adds a **Select infantry** action alongside worker and archer quick selection. It selects only living friendly units of that type, updates its disabled state with the roster, and feeds the selected IDs through the normal order path.

Prototype 0.43 adds versioned, validated match checkpoints at tick boundaries. A serialized single-writer queue coalesces newer snapshots while atomic temporary-file writes are in flight; JSON serialization is deferred out of the simulation callback. Recovery restores map and scenario state, economy, buildings, units and routes, fog exploration, match clock/outcome, and hashed seat records before the worker accepts connections. Recovered sessions have a two-minute reclaim grace. The supervisor scenario covers crash recovery for both seats, custom-map state, room isolation, and malformed checkpoint fallback.

Prototype 0.44 extends timed supply drops with optional per-team worker, infantry, or archer reinforcements. Reinforcements use open cells near each recipient base, respect live and queued roster caps, and report the actual delivery count even when custom announcement text omits it. Existing food-only event definitions remain valid and keep their original map hash for checkpoint recovery.

Prototype 0.45 adds server-authoritative worker task status and an **Idle** quick-select action. The economy panel keeps its idle-worker count current, and the selection filters out gathering, returning, moving, building, attacking, dead, enemy, and unknown workers. Fog-of-war snapshots omit enemy task details; worker tasks are derived from existing order state and do not add checkpoint fields.

Prototype 0.46 lets capture zones grant workers, infantry, or archers each time control changes. The server shares open-cell placement and live-roster limits with timed reinforcement drops; capture and recapture notices report the actual delivery, and checkpoint recovery preserves the delivered units without replaying the reward.

Prototype 0.47 adds mixed control-group assignment. `Ctrl`/`⌘` + `1`–`9` replaces a group, while `Shift` + `1`–`9` adds the current friendly selection without duplicating members. This makes it quick to combine unit classes and fold reinforcements into an existing squad; numbered recall and double-tap camera centering keep their existing behavior.

Prototype 0.48 adds Map Studio resource selection and stock editing. Food and wood nodes keep their 300 / 500 stock defaults, while the selected node can be adjusted or removed directly on the grid. Imports, exports, map resizing, and published custom maps preserve each node's configured stock.

Prototype 0.49 lets capture zones and timed supply drops grant wood as well as food. The `{wood}` message placeholder reports `+N WOOD` on capture and the bare amount in timed-event messages. Older maps omit zero wood rewards, preserving their serialized map hashes and checkpoint compatibility.

Prototype 0.50 rejects capture zones without walkable cells connected to both teams' spawn regions. The same topology check runs in Map Studio import validation and authoritative server map validation, so custom-map walls cannot isolate an objective from either team.

Prototype 0.51 prepares each room-state view and WebSocket frame once per broadcast, then reuses that frame for peers who share the view. Fog mode builds only views with recipients, and slow-peer latest-state coalescing keeps working with prepared frames. A local 10-second 2,000-unit fog move with three connected peers, including one paused spectator, moved 1,998 units, coalesced 90 stale snapshots, peaked at 106,263 queued bytes, and recovered to zero queued bytes without disconnecting. Tick p95 / maximum was 20.829 / 28.471 ms. These measurements include a paused spectator, so they are not directly comparable with earlier two-player runs.

Prototype 0.52 turns each team's existing Town Center into an authoritative worker-production queue. Workers cost 50 food, train for 25 seconds, spawn on the team's connected starting area, and count toward team and global population caps while queued. The HUD shows queue progress and spawn-space blocking; checkpoints preserve each queue through a room-worker restart.

Prototype 0.53 adds bounded per-unit waypoints. Shift-right-click appends the selected formation's destinations without interrupting its current move or attack-move route; after each unit reaches its current destination, the server starts ready routes in a shared path-planning batch. Direct move, attack, gather, and construction orders clear queued waypoints. Up to eight future waypoints per unit are validated, checkpointed, and restored after a worker restart. Existing prototype 0.52 checkpoints migrate with empty waypoint queues.

Prototype 0.55 extends disconnect seat retention to two minutes by default, matching checkpoint recovery; both windows can be tuned with `RTS_SESSION_GRACE_MS`. The resume scenario covers successful reclaim inside the grace window, seat handoff after expiry, and denial of an expired token.

Prototype 0.56 protects invite-room saves when `rooms.json` is missing, malformed, or from an unsupported version. The supervisor recovers room IDs from valid on-disk directories and rebuilds the index without deleting checkpoints or custom maps. It also recovers valid room directories omitted by a stale index. Saved rooms remain accessible if the configured room cap is reduced; the cap only blocks new room creation.

Prototype 0.57 adds same-type local selection for mixed-army micro. Double-click a friendly unit to select living, visible units of that type whose screen positions are inside the current viewport; hold Shift to add them. The unit-selection scenario covers click timing, same-unit matching, pointer tolerance, visibility, and viewport filtering. Overlapping units can now be picked by repeating a click on the same spot; candidate ranking uses screen distance and camera depth, and the fast double-click gesture stays on its first unit.

Prototype 0.58 adds prerequisite control gates for capture objectives. Map Studio can link a zone to another objective; only the team currently holding that prerequisite may capture or recapture the gated zone. The HUD names the prerequisite and shows which team must hold it, while map validation rejects missing links, self-links, and cycles. The trigger scenario verifies locked presence, same-team unlock and capture, and invalid prerequisite rejection.

Prototype 0.59 adds optional deadline victory to custom maps. Map Studio selects the decisive capture zone and match-clock deadline; at time, its current owner wins or an unclaimed zone draws. Same-tick capture victories resolve first, and the authoritative result survives reconnect and worker recovery. The in-game objective panel shows the synchronized countdown.

Prototype 0.60 lets a custom-map capture zone arm a delayed one-shot supply drop. The delay and capturing team survive reconnect and worker recovery; Map Studio exposes the trigger, zone, delay, and capturing-team recipient, and a match reset rearms the event. A 2,000-unit Stone Pass baseline also shows 1,999 units crossing the center in 60 seconds with 4.713 ms tick p95 on Node 24.9.0 / arm64; this is one local CPU sample, not target-hardware evidence.

Prototype 0.61 rejects capture-triggered supply drops linked to victory zones, which end the match on capture before the delay can elapse. Map Studio filters victory zones from the event selector and converts linked drops to match-clock events if a zone is marked as a victory objective.

Prototype 0.62 adds a one-click **Select military** command for living friendly infantry and archers. It leaves workers out of the selection so they can keep gathering or building while the combat force receives orders; the selection panel shows the selected mix.

Prototype 0.63 lets custom capture zones require control of multiple prerequisite zones at once. Map Studio uses checkboxes to author an AND gate; server capture checks every prerequisite against ownership at the start of the tick, and the HUD names every unsatisfied gate. Existing single-prerequisite maps still use the original `requires` shape, while imports reject duplicate, missing, self, or cyclic links. The new snapshot benchmark measured 98 state frames in 10 seconds at full size (9.8 Hz), with 105,681 average / 106,985 maximum JSON payload bytes and 1,011 KiB/s per client, or 2,023 KiB/s combined egress, including WebSocket headers but before TCP/TLS overhead. This single Node 24.9.0 / arm64 localhost sample is a baseline for later network changes, not an internet-hosting guarantee.

Prototype 0.64 replaces instant infantry spawning with a constructed Barracks. Workers build its 3 × 3 site for 175 wood; a completed Barracks queues Infantry for 50 food each, takes 12 seconds per unit, and reserves population slots while queued. Infantry waits in the queue if no production spawn cell is open, and existing building checkpoints carry the queue through room-worker recovery. Map and economy controls now expose Barracks construction and production status alongside the Archery Range.

Prototype 0.65 validates aggregate living and queued populations before restoring a match checkpoint, so a corrupted save cannot restart with production over the team or global cap. The two-client economy scenario exercises Barracks placement, incomplete-building rejection, Infantry cost and timing, synchronized spawning, and an Infantry queue reserving the last team slot at 1,000 living units. The room-supervisor scenario kills and restarts a worker with both Infantry and worker production pending, verifies both units spawn exactly once, and checks that an over-cap checkpoint falls back to a fresh match.

Prototype 0.66 adds the standard `0` control-group slot, giving players ten local groups on `1`–`0`. Top-row digits and numpad digits support recall, `Ctrl`/`⌘` replacement, and `Shift` addition; the displayed group labels and feedback match those keys.

Prototype 0.67 adds server-authoritative production rally points to Barracks and Archery Ranges. Select a friendly building, right-click open ground to set its destination, and clear it from the command panel. Newly trained Infantry and Archers use the shared move planner to reach the rally. Checkpoints preserve rally cells with migration from earlier formats; later building placement relocates or clears points that are no longer reachable, and fog snapshots hide enemy rally orders.

Prototype 0.68 makes Barracks and Archery Ranges destructible. Right-click a visible enemy production building to send selected military units to the nearest reachable perimeter; the server applies structure damage, synchronizes health, cancels a destroyed building's queue and builders, and removes its pathing footprint. Attack-move acquisition remains focused on units. Checkpoints migrate prior building records to full structure health and restore separate building attack targets.

Prototype 0.90 adds event-to-event scenario links. A completed scenario event can arm a follow-up with its own delay, repeating sources finish all deliveries before the next event starts, and capture-rooted chains can pass the capturing team through. Map Studio previews the links and server validation rejects missing sources, cycles, and invalid capturing-team roots. Checkpoint migration and recovery preserve pending chains.

Prototype 0.91 starts the recovery grace period for connected seats when the worker restores, so a long server outage no longer consumes the time players have to reclaim their seats. Seats already disconnected at checkpoint time still expire on their saved deadline. The supervisor recovery scenario ages both connected-seat deadlines beyond the grace period before restarting and confirms both players reclaim their original identities; the ordinary disconnect scenario still verifies expiry and seat handoff.

Prototype 0.92 lets Map Studio join event branches with an all-of completion trigger. The server starts the joined event's delay only when every source has finished its repeat deliveries, preserves partially completed joins through checkpoints, rejects cycles and duplicate or missing sources, and carries the capturing team only when all branches share the same capture-root event.

Prototype 0.93 adds standard directional RTS box selection. Left-to-right selects units enclosed by the box; right-to-left selects friendlies whose projected footprint crosses it. The box color and dashed outline show crossing mode while dragging, Shift adds either selection to the current group, and the crossing radius scales with camera zoom and viewport size.

Prototype 0.96 places Town Centers and newly trained workers on the home side of each spawn, using the direction from the opposing spawn instead of assuming team 0 is west and team 1 east. Reversed and diagonal Map Studio layouts now keep production exits away from mid-map; normal shipped map placement stays the same. A two-seat server scenario checks both queues, the 50-food cost, one-worker roster change, and the produced worker's home-side position.

Prototype 0.95 hardens the sustained Stone Pass scenario with explicit per-team flow and balance thresholds, failure messages that report observed counts and child-server logs, and cleanup on SIGTERM/SIGINT. A sealed 60-second Node 24.9 arm64 run passed with 1,000/1,000 units crossing per side and zero units below 24 world units of forward progress. Tick p95 was 8.741 ms and max 11.804 ms, within the 33.333 ms p95 and 100 ms max budgets; the earlier local capture read 7.177 ms p95 and 9.133 ms max. These are single local samples with no admitted hardware-performance evidence.

Prototype 0.94 assigns move and attack-move formation slots by each unit's current position in the destination formation's local axes, with unit IDs as a stable tie-break. Shuffled selection and control-group order no longer scramble a formation's spatial assignment; a focused scenario checks 1,000-unit order invariance across box, line, and column layouts and verifies that line regrouping removes avoidable crossing routes. The two-client 2,000-unit open-map pathfinding scenario now permutes both command ID lists; it passed with 1,000 unique destinations and paths per side, all 2,000 units moving, 7.44 ms median order planning and 6.57 ms tick p95 in one local Node 24.9 arm64 sample. This is a local engineering measurement, not a target-hardware or network guarantee.

Prototype 0.89 adds scheduled repeat deliveries to custom-map supply events. Map Studio can repeat the full reward bundle up to 20 additional times, and capture-triggered schedules retain their original capturing team. The authoritative next-delivery timer and repeat count survive checkpoint recovery; a final victory cancels the remaining deliveries. The 0.88 control-group role-presence bars remain part of this build.

Prototype 0.88 adds a three-segment worker, infantry, and archer role-presence strip to each control-group slot, so even a small subgroup is visible in the ten-slot grid. The button label and tooltip include exact counts and retain the existing total and replace/add/recall actions. The unit-selection scenario checks that composition counts include only living friendly members.

Prototype 0.87 clears any coalesced pre-change snapshot before broadcasting a map change, whose payload already contains the new authoritative state. The client also discards state frames tagged for a different active map. The map-change backpressure scenario pauses a client after welcome, drives a 2,000-unit move until state frames coalesce, changes to another map, then confirms that no old-map state arrives after the map-change frame.

Prototype 0.86 bounds unit-separation scans to the spatial buckets intersecting the 0.56-unit separation radius. This keeps every possible separation contributor while avoiding distant neighboring buckets. In paired 10-second, diagnostics-on Dense Clash runs, peak neighbor visits per tick fell from 52,064 to 22,141 for movement, 303,615 to 163,964 for attack, and 221,587 to 111,115 for attack-move. Peak candidates per movement call fell from 161 to 87, 243 to 148, and 348 to 172 respectively. Both combat workloads still moved all 2,000 units; attack-move damaged 127 units after the change. One diagnostics-off attack-move run moved all 2,000 units, damaged 133, and measured 8.348 ms tick p95 / 13.043 ms max. These are single-run local samples; timing varies and does not establish target-hardware or internet capacity. Normal servers leave the counters disabled.

Prototype 0.85 adds opt-in separation-work telemetry and a trigger-free Dense Clash map for two 1,000-unit armies fighting through a four-cell choke. Three 10-second local runs with diagnostics enabled passed at 9.389–9.975 ms tick p95 / 10.847–21.991 ms max, with per-call fan-in peaks of 224–262 candidates. A 40-second run passed; its final 10-second window measured 8.342 ms p95 / 10.243 ms max, 45,283 neighbor visits in one tick, and 268 candidates in one movement call. A diagnostics-off 2,000-unit Stone Pass move measured 8.425 ms p95 / 10.627 ms max with 1,994 units moving. These local samples do not establish target-hardware or internet capacity; normal servers leave the counters disabled.

Prototype 0.84 adds zoom-scaled camera edge scrolling, clamped to the map and paused during selection drags, manual panning, building placement, and Map Studio use. Scenario-event rows now summarize their clock or capture trigger, source zone, recipients, and food, wood, unit, and technology rewards.

Prototype 0.83 lets one-shot match-clock or capture events award Infantry Forging or Archer Fletching to their configured recipient teams. The grant completes matching active research immediately, appears in Map Studio and objective cards, and persists with the event across map saves and worker recovery.

Prototype 0.82 adds Infantry Forging and Archer Fletching. A completed Barracks researches a one-time infantry attack upgrade for 100 food and 75 wood; a completed Archery Range researches the archer upgrade for 125 food and 125 wood. Each takes 25 seconds, increases attack damage by 20%, and is team-wide. Research progress survives reconnect and worker recovery, stays hidden from the opponent under fog, and is canceled if its building is destroyed.

Prototype 0.81 adds symmetric starting food and wood for custom maps. Map Studio and imported JSON author the stocks; publishing a map, switching to it, or resetting the match gives both teams the configured amounts.

Prototype 0.80 adds a configurable victory hold timer for custom scenarios. In any mode, one marked victory zone must remain owned; in all mode, one team must retain every marked zone. Losing that condition resets that team's progress. Map Studio authors the duration, the objective HUD tracks progress, and checkpoints preserve an active hold through server recovery.

Prototype 0.79 adds first-capture and opponent-recapture conditions for capture-triggered supply drops. Map Studio authors the condition, the objective panel distinguishes waiting for a first capture from waiting for a recapture, and server validation rejects unknown values. The `capturing` recipient follows the team that completed the selected capture.

Prototype 0.78 lets a delayed supply drop follow a victory zone's first capture in **Hold all** scenarios with multiple marked zones. A first crown can arm its drop while play continues; final capture still wins before a pending drop can pay. Map Studio options and server validation stay aligned when victory mode or objectives change.

Prototype 0.77 bounds each peer's pending command queue by count and decoded bytes. Excess orders receive a tokenized `ORDER REJECTED · SERVER BUSY · TRY AGAIN` notice, closed peers no longer execute queued commands, and `/health` reports pending work and queue-limit rejections. The Map Studio grid remains visible while scrolling its properties on desktop, and a slow Three.js startup no longer leaves a stale timeout alert after initialization succeeds.

Prototype 0.76 caps inbound WebSocket control frames at 120 per second per peer, so ping and pong traffic cannot bypass the text-message limits. `/health` reports received control-frame totals, the active window count, and rate-limit disconnects.

Prototype 0.75 negotiates RFC 7692 per-message compression for clients that offer it, while clients without compression continue to use plain JSON text frames. The inbound parser accepts compressed and fragmented text messages with interleaved control frames and caps decompressed input. A 40-second 2,000-unit snapshot run reduced measured JSON WebSocket egress by 88.5% while keeping tick p95 at 3.573 ms in the final window. Compressed fragmented input with ping interleaving, a decoded-byte-limit case, legacy uncompressed framing, and a simultaneous compressed/uncompressed two-player match were checked; this is local transport evidence, not an internet capacity result.

Prototype 0.74 records a sustained local rendering profile for three 40-second waves with 2,000 units: 118.21 seconds of measured frames, 16.8 ms interval p95, 1.0 ms animation callback p95, and no long tasks over 50 ms. Server tick p95 remained under 4.8 ms in all three final 10-second windows. This is an Apple M2 headless sample, not an internet or target-hardware guarantee.

Prototype 0.73 adds a repeatable two-client Three Crowns scenario on the default 1,000-unit roster. Both teams are tested as the winner; each run verifies the keep remains locked until both prerequisite zones share an owner and confirms the all-objectives result reaches both players.

Prototype 0.72 adds Three Crowns, a fog-of-war map with three linked capture objectives, all-objectives victory, central-zone prerequisites, and a timed food, wood, and archer supply drop for both teams.

Prototype 0.71 fixes focused-fire and archer visuals after an army reset. Reset-created units now reserve focus-ring instance slots and keep the bow mesh count in sync with the roster. The gold focus ring is larger so it stands out better in dense formations. An isolated headless Chrome 153 / Apple M2 engagement confirmed a server-reported four-attacker focus target writes a nonzero transform and renders after reset. This checks one local scene, not target-hardware performance.

Prototype 0.70 adds focused-fire feedback for unit engagements. Units targeted by multiple friendly attackers get one instanced focus ring, and surviving units briefly flash when damaged. The attacker count is included in each unit snapshot and filtered by team under fog, so the same cue does not reveal the opponent's attack orders. The two-client queued-waypoint scenario confirms that the attacker sees all 16 units focusing a target while the defender sees zero, then completes the queued order and a 1,000-unit move. After making focus-ring matrix updates conditional on active targets, a headless Chrome 153 / Apple M2 run rendered 2,000 moving units at 16.7 ms frame-interval p95 and 4.5 ms animation-callback p95, with no 50 ms browser long tasks; server tick p95 was 5.396–5.605 ms across three 10-second waves. This is a single local movement sample with no active focus rings, not a target-hardware or windowed-display guarantee.

Prototype 0.69 makes building sieges easier to read. Visible target buildings show a pulsing ring and the server-synchronized number of friendly attackers; health loss triggers a brief impact flash above the structure. Under fog of war, only the attacker sees their own count, while the defender learns about damage through the building's health and impact cues.

Prototype 0.54 lets a queued route follow a direct attack through the target's death, including attackers already in firing range with no path left. The selection panel reports queued waypoint totals for the selected group. Queue counts stay team-private on both fog and no-fog maps. The two-player scenario checks direct-attack completion into its queued move, checkpoint migration and recovery, replacement behavior, queue limits, count privacy, and the 1,000-unit order-ack workload.

One local Node 24.9.0 / arm64 run queued an attack-move waypoint for all 1,000 Azure units after a 1,000-unit move; both order acknowledgements arrived in 9 ms. This is a single same-machine processing sample, not a network-latency or target-hardware guarantee.

| Formation | Units moved in first checked state | Non-empty routes, Azure / Ember | Already in goal cell, Azure / Ember | Route failures | Order acknowledgement | Tick p95 / max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Box | 1,994 / 2,000 | 997 / 997 | 3 / 3 | 0 / 0 | 29.323 ms | 5.424 / 7.666 ms |
| Line | 1,998 / 2,000 | 999 / 999 | 1 / 1 | 0 / 0 | 27.616 ms | 6.482 / 8.904 ms |
| Column | 1,996 / 2,000 | 997 / 999 | 3 / 1 | 0 / 0 | 19.716 ms | 6.395 / 8.280 ms |

Each team received 1,000 unique destinations in all three runs. Tick work stayed below the 33.333 ms budget; these are single local samples, not internet-latency or target-hardware guarantees.

With the height check enabled, a 10-second fog-enabled 2,000-unit run moved 1,998 units in the first checked snapshot. Combined order acknowledgement was 9.018 ms, tick p95 was 19.351 ms, and max tick work was 22.495 ms against the 33.333 ms budget. This is one local same-machine sample.

A 10-second local 2,000-unit fog run moved 1,998 units in the first checked snapshot. Combined order acknowledgement was 8.685 ms; tick p95 was 17.309 ms and max was 29.553 ms against the 33.333 ms budget. This is a single same-machine sample, not a network-latency or target-hardware guarantee.

It remains a local engineering prototype rather than a public game service. It has no player accounts, internet matchmaking, slope-aware sight geometry or vegetation attenuation, a full resource economy or broad technology tree, dynamic formation cohesion or crowd handling, or a general-purpose conditional trigger editor. Scenario events support timed, capture, single-event, and all-of event-completion links. The food loop is a small skirmish mechanic, not a complete AoE-style economy. Ordinary disconnects and worker recovery allow a seat reclaim for up to two minutes. Default custom maps persist under `custom-maps/`; invite-room maps and match checkpoints persist under `room-data/rooms/<room-id>/`. The supervisor binds only to `127.0.0.1` unless `RTS_HOST` is set.
