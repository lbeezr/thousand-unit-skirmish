# QA checkpoint — 25 September 2026

This checkpoint supplements the [vertical-slice acceptance record](qa-vertical-slice.md). It separates the `f1d6482` staging browser run, the `322e68e` historical staging check, the latest verified staging deployment at `8c05fde` (smoked at 18:04 UTC), production identity, local synthetic runs, and human playtests. QA did not initiate a deployment or conduct an external human session. Staging advanced automatically after PRs #24, #28, #31, #23, #25, #29, #34, #26, #27, and #35 merged.

## Deployment identity

| Environment | Deployment and source | Read-only checks | Conclusion |
| --- | --- | --- | --- |
| Staging | Latest successful deployment: `18781003-f0bb-4fe5-bbc4-c7803611c01b`, source `8c05fdeaa0453bc223223b7a9dc950c7de490436` (PR #35); [staging host](https://game-staging-21f9.up.railway.app). Latest prior verified deployment: `f6ff8979-427d-44ec-a03d-60f05d831f74`, source `216a4667253b5507add161a58e53a5acb45f7e8b` (includes origin-policy Docker-context fix `693992167acc5a6b30bbb8cbbeee3663b4c9e0c0` from PR #34). Earlier failed builds were `d21e05aa` (`17ca4f7`), `4a2b9ec4` (`b6be72a`), `9b882cf3` (`b56360b`), and `ccfcdb75` (`3755fb5`). | Read-only live smoke on `18781003` at 18:04 UTC: `/ready` 200 `{ok:true}`, authenticated `/health` 200, `/` 200. Served asset hashes match `origin/main` at `8c05fde`: `index.html` `817b528c5c2e6eeedf59ddf55b89f8415a144a20a1fc753aaed605859eee89e0`, `src/main.js` `c26d8816872ca8e89c0450a5980687f4be93d8ca615abe408f99bb3df47123d6`, and `style.css` `377acd7cf3b28f9a41260de5d8658545d3326948781758bd8cf68d77f4927bd2`. Health reported 8/8 room records and zero connected invite peers. Same-origin WSS request with spoofed forwarded headers and a random nonexistent room returned 404; attacker Origin with forged forwarded host/proto returned 403. | This is the latest verified staging checkpoint, not a claim about later deployments. No valid invite-room handshake was attempted because no safe seat/room was available at the 8-room cap. The candidate's local proxy test had already verified a real 101 / 403 pair. The two-seat result/rematch browser evidence remains tied to `f1d6482`. |
| Production | `014448c3-4a3b-4942-9d96-6d77515d0d61`; successful manual redeploy, but Railway deployment metadata contains no source SHA or branch; [production host](https://game-production-99c1.up.railway.app) | `/ready` and `/health` returned 200. Served `index.html` SHA-256 `607256b758a75e280482fa2b397eed10642ec1e11f3b4d069f83831b791b4ab0` matches file content at `b5d00f3`; `src/main.js` SHA-256 `03ac45670ad10805fe74464c05abf5989e1bbc85a7994c36e381cb7b0a40d478` matches file content at `1850233`. Both differ from staging's served HTML and JavaScript. | Readiness passes; exact production source identity and production browser/WSS smoke remain unresolved. The static hashes do not identify the full runtime commit. |

The current staging health response reported 8/8 room records and zero connected invite peers. The default Stone Pass worker was left untouched. One disposable QA invite room remains stored. There is no delete endpoint; do not create another invite room until the room-cap follow-up establishes safe expiry and capacity. The origin smoke used a fresh random valid-format room ID that was not present and created no room.

## Merged-baseline synthetic rechecks

QA-003 builder parity, the worker counter, and QA-005 seat parity were retested against `322e68e`. The separate both-winner Forked Vale scenario ran on PR #28 head `bbfdc81` before that change merged; its map/scenario update is included in `322e68e`. These local two-seat fixtures are synthetic protocol checks, not human matches or hosted network evidence. PR #35 subsequently changed objective visibility in `server.mjs`; its new test is part of the merged CI set, but QA has not run a synthetic test on `8c05fde`. Infrastructure deferred the optional local performance run while PR #35 used the host. QA will wait for an explicit host release before local simulations.

| Gate | `322e68e` result | Evidence boundary |
| --- | --- | --- |
| QA-003 builder parity | Four swapped Forked Vale Barracks/Range builds completed at 10.9 s; first infantry/archer appeared at 23.0/18.0 s on either seat. Both workers were 0.5 units from the building edge at the 10 s sample. | Local scripted protocol result; contested human opening pace remains unknown. |
| Worker counter | Infantry beat workers with 60 HP remaining for the winner under both team assignments. | Local controlled combat fixture; does not establish raid value or full-match worker survival. |
| QA-005 seat parity | All four 8v8 attack-move cases passed at 12.3 s. The 3/4-survivor, 300/350-HP edge followed spawn side; command order did not change results. | Local scripted fixture; no strategic win-rate or human balance claim. |
| Forked Vale winner/reset follow-up | Both winner assignments passed the objective sequence, 20 s hold, and paired reset to the authored 24-unit opening roster. | Scenario branch `bbfdc81`, later merged into `322e68e`; runner time is wall-clock process time, not in-game match duration. |

The detailed `322e68e` results and scenario definitions are recorded in the [balance evidence PR #23](https://github.com/lbliii/thousand-unit-skirmish/pull/23). These passes close the specific local builder and simulation-order regressions at that baseline. They do not close the human-playtest gates. Infrastructure deferred the clean `3755fb5` repeat while gameplay PR #35 uses the host; QA is holding all new local simulation work until an explicit release.

## Staging result and rematch

Two isolated headless Chrome 153 profiles used the staging `f1d6482` default Stone Pass room at 1280 × 600. Both showed `ROOM LIVE`, `2 / 2 PLAYERS`, and the same map. A scripted game-protocol order moved eight Azure infantry into the capture zone; the authoritative match ended with Azure as winner. The flow preceded staging's redeploy to `322e68e`; that commit changed no app code or Stone Pass data, and the served UI asset hashes are unchanged. This is browser-rendered staging evidence with a synthetic order, not a human playtest or a fresh WSS run on `322e68e`.

| Seat | Result and reason | Result-card bounds | Action bounds | Dock bounds |
| --- | --- | --- | --- | --- |
| Azure | `VICTORY` — `AZURE SECURED CONTROL THE PASS` | x=440–840, y=90–284 | `Play again`, y=221–263 | y=316–586 |
| Ember | `DEFEAT` — `AZURE SECURED CONTROL THE PASS` | y=104–270 | `WAITING FOR HOST TO RESET`, y=235–249 | y=316–586 |

Both result areas remained visible and hit-testable above the dock. Clicking Azure's real `Play again` action returned both clients to neutral objectives and the full 1,000-unit total roster (500 per seat). QA-004's original 1280 × 600 overlap no longer reproduces on staging.

| Capture | Resolution |
| --- | --- |
| [Azure result](qa-evidence/qa-004-staging-f1d6482-azure-result-1280x600.png) | 1280 × 600 |
| [Ember result](qa-evidence/qa-004-staging-f1d6482-ember-result-1280x600.png) | 1280 × 600 |
| [Azure after rematch](qa-evidence/qa-004-staging-f1d6482-azure-rematch-1280x600.png) | 1280 × 600 |
| [Ember after rematch](qa-evidence/qa-004-staging-f1d6482-ember-rematch-1280x600.png) | 1280 × 600 |

## Team-identity and readability gate

Staging baseline captures show the current HUD and armies on both surfaces below. They are 1440 × 900; their filenames distinguish the captured camera states, but this run did not record numeric zoom values, so they do not prove two measured zoom scales.

| Map and capture | Resolution |
| --- | --- |
| [Stone Pass — default camera state](qa-evidence/qa-ux-staging-stone-pass-default-1440x900.png) | 1440 × 900 |
| [Stone Pass — strategic camera state](qa-evidence/qa-ux-staging-stone-pass-strategic-1440x900.png) | 1440 × 900 |
| [Cinder Ridge — default camera state](qa-evidence/qa-ux-staging-cinder-ridge-default-1440x900.png) | 1440 × 900 |
| [Cinder Ridge — strategic camera state](qa-evidence/qa-ux-staging-cinder-ridge-strategic-1440x900.png) | 1440 × 900 |

The last successful `322e68e` staging image has `AZURE` and `EMBER` text labels, but both minimap markers are 5 × 5 px circles with a 50% border radius; the legend text is 7 px at this viewport. The latest verified `8c05fde` deployment includes the merged `3755fb5` UI code with square Azure markers and diamond Ember markers; its served JavaScript hash matches current main. Candidate captures at zoom values 0.91 and 0.48 on meadow and Cinder Ridge were reported in the UI task but are not saved in this evidence PR. Keep the hue-independent cue gate open until QA can inspect four labeled captures. Human army-readability review also remains open.

## QA-007 — WebSocket origin guard deployed and no-state checks pass (P0)

On a disposable local supervisor at `f1d6482`, QA sent a WebSocket upgrade with `Origin: https://attacker.example`:

| Local request | Status |
| --- | ---: |
| Malicious Origin, no forwarded-header spoof | 403 |
| Same request with `X-Forwarded-Host: attacker.example` and `X-Forwarded-Proto: https` | 101 |

The successful local upgrade reached a temporary default worker. The supervisor used temporary room/map directories and was shut down; the data was removed. No real credentials or persistent state were used.

Read-only staging checks used a syntactically valid, nonexistent 32-character room ID. An accepted Origin reaches the room lookup and returns 404; a rejected Origin returns 403. The observed responses were:

| Staging request | Status |
| --- | ---: |
| Malicious Origin, no spoof | 403 |
| Malicious Origin with both forwarded-header spoofs | 403 |
| Staging same-origin control | 404 |
| Staging same-origin with forged host only | 404 |
| Staging same-origin with forged proto only | 404 |

At the time of these probes, the staging edge prevented client-supplied values from changing the origin decision; the statuses cannot distinguish whether it strips or overwrites those headers. The requests did not create a room, start an invite worker, or connect to a match. Railway's edge defense does not fix the app-level bypass if exposed behind a proxy that passes the spoofed values.

**Candidate retest:** Exact PR #31 head `3b8d2a26fadf7c1d51a5e9538bbd00f63959da45` passed `node scripts/origin-policy-scenario.mjs` (14 assertions), including a negative `Origin: http://attacker.example:4173` / `Host: attacker.example:4173` DNS-rebinding case and positive 127.0.0.1, localhost, and ::1 cases. `node scripts/origin-proxy-scenario.mjs` passed through the disposable supervisor and worker: the configured staging domain returned 101 despite forged forwarded headers, while attacker Origin plus spoofed X-Forwarded-Host/Proto returned 403. The full `npm test` suite passed. The clean release pack reported source `3b8d2a2`, `sourceDirty:false`, and included `origin-policy.mjs`. PR #31 subsequently merged; verification on the current staging image is recorded below.

**Staging retest:** PR #34 merged the Docker-context allowlist correction and the release-packer guard. Railway later deployed PR #35 as `18781003-f0bb-4fe5-bbc4-c7803611c01b`, source `8c05fde`, successfully. In a producer-authorized read-only smoke at 18:04 UTC, `/ready`, authenticated `/health`, `/`, `/src/main.js`, and `/style.css` all returned 200. The three served asset hashes matched the corresponding `origin/main` files at `8c05fde`.

The allowed staging Origin plus forged forwarded headers and a random valid-format nonexistent room returned 404 at room lookup, showing the deployed origin check accepted the allowlisted Origin without starting a worker. An attacker Origin plus forged `X-Forwarded-Host` and `X-Forwarded-Proto` returned 403. The probes created no room and no connection. A current-deployment 101 was not attempted: the service is at its 8-room cap and connecting to either the active default match or a stored invite room could claim a seat or alter match activity. The exact candidate's isolated local supervisor/worker test already passed a real allowed-origin 101 and forged-attacker 403.

**Routing:** The merged code uses an explicit public-origin allowlist and restricts unconfigured local fallback to loopback hosts. Railway documents `RAILWAY_PUBLIC_DOMAIN` as the bare public service domain, which the candidate normalizes to HTTPS; see the [Railway variables reference](https://docs.railway.com/variables/reference). The Docker-context blocker is resolved and deployed. The live no-state allow/reject checks pass; a valid invite-room 101 remains unverified on this deployment until a safe reusable room and seat are available.

## QA-006 — Hue-independent minimap team markers (P1)

**Finding:** The historical `322e68e` staging image uses same-shape circular minimap markers, leaving hue as the only team cue in the minimap. PR #29 merged as `3755fb5` with square Azure and diamond Ember markers; latest verified staging source `8c05fde` includes that code.

**Evidence boundary:** Deployment and served JavaScript identity are verified for the `8c05fde` checkpoint, but QA still has no saved staging captures of the new markers. The UI owner reported captures at zoom 0.91 and 0.48 on meadow and Cinder Ridge, but QA did not receive them as saved evidence with the candidate. Do not treat those reported captures as an independent QA visual pass.

**Pass condition:** Inspect four labeled captures from current staging covering meadow and Cinder Ridge at zooms 0.91 and 0.48; verify the shape cue remains distinct from color and marker/legend placement stays legible. Then complete the separate human two-army readability review.

## Next acceptance work

1. **P0 — valid staging WSS:** When infrastructure identifies a safe reusable QA room and confirms both seat tokens, verify a current-main same-origin WSS upgrade returns 101 and run the reload/restart seat-recovery sequence. The current no-state 404/403 origin probes passed; do not connect to the active default match or create another invite room while staging is at its 8-room cap.
2. **P0 — production identity:** Obtain the exact source SHA or immutable image/artifact digest for the manually promoted deployment, compare its release manifest and served asset hashes to that artifact, then perform read-only production asset and WSS smoke. `/ready`, `/health`, or matching individual static files alone do not prove a complete build identity.
3. **P0 — human playtest:** Run two novice pairs through the authored Forked Vale scenario, swap seats between rounds, and record unprompted team/objective/route/control identification within two minutes, first building/contest, win time, starvation, and two viable responses per seat. Mark observations as spontaneous or prompted; finish each pair with the decision/alternative exit interview. Keep these results separate from scripted protocol checks.
4. **P1 — scale/network:** One local attack-move diagnostic exceeded the 99.999 ms ceiling at 187.704 ms. A later 170.599 ms bundle may have overlapped a balance run and is not a clean repeat; see QA-002. The planned isolated `3755fb5` repeat is deferred until gameplay PR #35 releases the host; QA will wait before starting any simulation. For hosted validation, first agree the 80 ms RTT / 1% loss profile, Railway machine, CPU and egress budgets, hard stop thresholds, and room-capacity window with infrastructure.
5. **P1 — accessibility/readability:** Review square/diamond minimap cues at both numeric zooms on meadow and Cinder Ridge, then conduct the human two-army readability review. QA has no saved current-staging screenshots.
