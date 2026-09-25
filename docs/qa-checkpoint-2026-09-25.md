# QA checkpoint — 25 September 2026

This checkpoint supplements the [vertical-slice acceptance record](qa-vertical-slice.md). It separates the `f1d6482` staging browser run, the latest `322e68e` read-only staging check, production identity, local synthetic runs, and human playtests. QA did not initiate a deployment or conduct an external human session; staging automatically advanced to `322e68e` after PRs #24 and #28 merged.

## Deployment identity

| Environment | Deployment and source | Read-only checks | Conclusion |
| --- | --- | --- | --- |
| Staging | Latest: `5b29dfbb-2672-44be-a38a-b53418cc54da`, branch `main`, source `322e68e`; prior browser run: `a51591f2-4300-4e22-8aad-07f6a12f673b`, source `f1d648205aa9523aa055e711553bf139e5bd909f`; [staging host](https://game-staging-21f9.up.railway.app) | Latest `/ready` and authenticated `/health` returned 200. Authenticated `index.html`, `src/main.js`, and `style.css` hashes match the prior `f1d6482` bundle. The two-seat WSS/result/rematch browser flow was run on the prior deployment, where WSS upgrades returned 101. `322e68e` changes only documentation, Forked Vale map data, and scenario scripts relative to `f1d6482`. | Latest deployment identity and read-only health/assets verified; browser result/rematch evidence is from the preceding `f1d6482` deployment. |
| Production | `014448c3-4a3b-4942-9d96-6d77515d0d61`; successful manual redeploy, but Railway deployment metadata contains no source SHA or branch; [production host](https://game-production-99c1.up.railway.app) | `/ready` and `/health` returned 200. Served `index.html` SHA-256 `607256b758a75e280482fa2b397eed10642ec1e11f3b4d069f83831b791b4ab0` matches file content at `b5d00f3`; `src/main.js` SHA-256 `03ac45670ad10805fe74464c05abf5989e1bbc85a7994c36e381cb7b0a40d478` matches file content at `1850233`. Both differ from staging's served HTML and JavaScript. | Readiness passes; exact production source identity and production browser/WSS smoke remain unresolved. The static hashes do not identify the full runtime commit. |

Staging's latest health response reported 8/8 room records and zero connected invite peers. The default Stone Pass worker had one connected seat, so QA did not join it or change its match. One disposable QA invite room remains stored. There is no delete endpoint; do not create another invite room until the room-cap follow-up establishes safe expiry and capacity.

## Current-main synthetic rechecks

QA-003 builder parity, the worker counter, and QA-005 seat parity were retested against current main `322e68e`. The separate both-winner Forked Vale scenario ran on PR #28 head `bbfdc81` before that change merged; its map/scenario update is now included in `322e68e`. These local two-seat fixtures are synthetic protocol checks, not human matches or hosted network evidence. The `f1d6482` to `322e68e` delta did not change `server.mjs`.

| Gate | Current-main result | Evidence boundary |
| --- | --- | --- |
| QA-003 builder parity | Four swapped Forked Vale Barracks/Range builds completed at 10.9 s; first infantry/archer appeared at 23.0/18.0 s on either seat. Both workers were 0.5 units from the building edge at the 10 s sample. | Local scripted protocol result; contested human opening pace remains unknown. |
| Worker counter | Infantry beat workers with 60 HP remaining for the winner under both team assignments. | Local controlled combat fixture; does not establish raid value or full-match worker survival. |
| QA-005 seat parity | All four 8v8 attack-move cases passed at 12.3 s. The 3/4-survivor, 300/350-HP edge followed spawn side; command order did not change results. | Local scripted fixture; no strategic win-rate or human balance claim. |
| Forked Vale winner/reset follow-up | Both winner assignments passed the objective sequence, 20 s hold, and paired reset to the authored 24-unit opening roster. | Scenario branch `bbfdc81`, later merged into `322e68e`; runner time is wall-clock process time, not in-game match duration. |

The detailed current-main results and raw scenario definitions are recorded in the [balance evidence PR #23](https://github.com/lbliii/thousand-unit-skirmish/pull/23). These passes close the specific local builder and simulation-order regressions. They do not close the human-playtest gates.

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

The current staging DOM has `AZURE` and `EMBER` text labels, but the two minimap markers are both 5 × 5 px circles with a 50% border radius. The legend text is 7 px at this viewport. Team identity therefore still depends on hue at the minimap. The interface owner reports a candidate with square Azure markers and diamond Ember markers, including zoom values 0.91 and 0.48 on meadow and Cinder Ridge; QA has not reviewed saved candidate screenshots yet. Keep the hue-independent cue gate open until those four labeled screenshots and the candidate code are available together. Human army-readability review also remains open.

## QA-007 — WebSocket origin guard trusts client forwarded headers (P0 release blocker)

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

This shows the staging edge prevents client-supplied values from changing the origin decision; the statuses cannot distinguish whether it strips or overwrites those headers. The requests did not create a room, start an invite worker, or connect to a match. Railway's edge currently protects staging, but that does not fix the app-level bypass if exposed behind a proxy that passes the spoofed values.

**Candidate retest:** Exact PR #31 head `3b8d2a26fadf7c1d51a5e9538bbd00f63959da45` passed `node scripts/origin-policy-scenario.mjs` (14 assertions), including a negative `Origin: http://attacker.example:4173` / `Host: attacker.example:4173` DNS-rebinding case and positive 127.0.0.1, localhost, and ::1 cases. `node scripts/origin-proxy-scenario.mjs` passed through the disposable supervisor and worker: the configured staging domain returned 101 despite forged forwarded headers, while attacker Origin plus spoofed X-Forwarded-Host/Proto returned 403. The full `npm test` suite passed. The clean release pack reported source `3b8d2a2`, `sourceDirty:false`, and included `origin-policy.mjs`. QA did not initiate or perform an origin-fix deployment. The candidate passes; the release blocker remains until the fix is merged and verified in a deployment.

**Routing:** The verified candidate uses an explicit public-origin allowlist and restricts unconfigured local fallback to loopback hosts. Railway documents `RAILWAY_PUBLIC_DOMAIN` as the bare public service domain, which the candidate normalizes to HTTPS; see the [Railway variables reference](https://docs.railway.com/variables/reference). Staging's current edge result is defense in depth, not a fix for direct app exposure. Keep the gate open until the change is merged and the release's public-origin configuration is confirmed.

## Next acceptance work

1. **P0 — QA-007 release integration:** PR #31's exact local head already passes policy, proxy, full-suite, and release-pack checks. After direct merge authorization, the release owner must confirm the public-origin configuration in staging and repeat the allowlisted-origin and forged-attacker-origin handshake checks. Do not promote production as part of this QA checkpoint.
2. **P0 — seat recovery:** After infrastructure confirms a safe reusable invite room and preserves both seat tokens, use two separate browser profiles to test reload and worker restart one step at a time. Confirm the original seat and match state return and the other client remains in control. The failed attempt after the profiles lost their tokens is inconclusive; staging is currently at its 8-room cap.
3. **P0 — production identity:** Obtain the exact source SHA or immutable image/artifact digest for the manually promoted deployment, compare its release manifest and served asset hashes to that artifact, then perform read-only production asset and WSS smoke. `/ready`, `/health`, or matching individual static files alone do not prove a complete build identity.
4. **P0 — human playtest:** Run two novice pairs through the authored Forked Vale scenario, swap seats between rounds, and record unprompted team/objective/route/control identification within two minutes, first building/contest, win time, starvation, and two viable responses per seat. Mark observations as spontaneous or prompted; finish each pair with the decision/alternative exit interview. Keep these results separate from scripted protocol checks.
5. **P1 — scale/network:** One local attack-move diagnostic exceeded the 99.999 ms ceiling at 187.704 ms. A later 170.599 ms bundle may have overlapped a balance run and is not a clean repeat; see QA-002. After all local suites and server processes exit, run one isolated local repeat. For hosted validation, first agree the 80 ms RTT / 1% loss profile, Railway machine, CPU and egress budgets, hard stop thresholds, and room-capacity window with infrastructure; current staging is at its 8-room cap.
6. **P1 — accessibility/readability:** Review the square/diamond minimap candidate at both numeric zooms on meadow and Cinder Ridge, then conduct the human two-army readability review. Candidate screenshots remain inline in the UI task and were not included with these staging-baseline captures.
