# Play vs AI feedback runs

Play vs AI creates an isolated room with two unsigned 32-bit seeds. The map seed selects from the stable pool in [`src/pve-match.mjs`](../src/pve-match.mjs): Forked Vale and Woodland Expanse. Both authored maps start with 24 total units, resource nodes, and capture objectives; scale and fog differ. Stress and art-review maps are excluded.

The room URL carries both seeds so a feedback report can identify the same setup. The server uses the policy seed for its deterministic opponent and gives it the normal server command path. It reserves Team 1 and activates the opponent only after Team 0 is assigned. A rematch keeps the room, map, and seeds and resets the policy to its opening state. New Map creates a fresh room with newly generated seeds.

No model provider is used. The policy receives the Team 1 observation, including only enemy units and buildings visible through that team’s fog view.
