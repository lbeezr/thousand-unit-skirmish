# Bellweather Sheep static preview — 3 October 2026

Baseline: fork main `9b6214605baf702d9f90ff61b3f2f9e5c77b9d9e`.
Owner scope: [pack](../assets/wildlife/bellweather-sheep-public-reference-v1/README.md),
[static loader](../src/sheep-static-preview.mjs), isolated
[preview page](../scripts/bellweather-sheep-preview.html), preparation and tests.
No edits to match client, HUD, environment bindings, authoritative gathering,
map resources, deployment or security configuration.

## Delivered and inspected

The selected Library lightweight archive was prepared by the current supported
resolved-reference flow, but the transfer helper exited 1 before creating local
readable bytes. Diagnosis: `Tunnel connection failed: 403 Forbidden`. Neither
the eight captured PNGs nor the original 44 MiB GLB were downloaded or admitted.
The [producer's public capture contract](../assets/wildlife/bellweather-sheep-public-reference-v1/cloud-capture-contract.json)
is metadata; its observations remain attributed to the producer.

The fallback uses only the verified already-public single-Sheep input from
commit `02e3ac9434ac0970dbe307f44791a40ffd61ba82`. Source SHA-256
`0ff688101304a7c10e181b3363ce767e8fb0082d0f754817edee81e04a9bf904`
and 1,457,172 bytes match the public preservation manifest. The original PNG
was opened at 1254 px; complete fleece, face, ears, four legs/hooves and tail were
visible. The normalized 512 px cutout was opened directly. The chosen matte
removed the neutral ground shadow and left the complete silhouette; fine edge
fringes remain provisional. This is direct image inspection, not in-game GPU evidence.

The source and runtime page pair validates against the existing sprite-atlas
contract. RGB bleed retains exact alpha. Root/scale remain explicit estimates;
neither alpha bounds nor per-frame fitting can move the root. One non-looping idle
clip and an empty animation list declare the actual coverage. Other nose headings,
moving/grazing/dispatch/carcass/depleted states and fog-hidden animals are suppressed.
No live idle Sheep is substituted for a carcass or a food node.

## Checks

- Five focused Node tests pass: source/manifest/page hashes, strict static state
  mapping, transparent margins/alpha preservation, root/common-scale invariance,
  and renderer load-path/mesh lifecycle with corrupted-byte rejection.
- The existing atlas validator and handoff report pass. Pivot status remains
  `unreviewed-estimate`; no reviewed ground-contact claim is made.
- Synthetic eight-view packer checks accept eight valid 512 px RGBA fixtures and
  reject a corrupted source hash and a missing view. They do not validate the
  inaccessible real model-rendered frames.
- Local HTTP loader check verifies manifest and page bytes, creates and updates
  the real Three.js mesh, hides unsupported/fog states and removes it on disposal.
  Its image shim reads decoded dimensions from the PNG header. This is CPU/load-path
  evidence, not browser image decoding or rendering.
- JavaScript syntax, Markdown links and whitespace checks pass.

The preview uses the existing Human Worker sprite renderer, the actual camera
direction, a 43-unit frustum, 1280 × 720/DPR 1, play zoom 0.91 and strategic zoom
0.48, plus a labelled 6.0 detail setting. The Worker is a comparison artifact,
not new sheep animation. The page is local-only and is not admitted to the production
server's public asset allowlist.

## Browser blocker and remaining proof

A bounded Playwright launch used `chromiumSandbox:true`. Chromium aborted because
the existing SUID sandbox helper is not configured correctly; crashpad also
reported an unavailable writable database. No sandbox bypass, mode/ownership
change or alternate unsafe launch was attempted. No successful WebGL screenshot,
ground-contact acceptance, ordinary/strategic readability or browser state/view
matrix is claimed.

Independent agent review is recorded with the branch. Integrate through ordinary
reviewed PR/merge rules within the author's two-unfinished-PR limit; no protection
bypass or hosted CI wait is introduced. The actual eight-view package remains
dependent on an authorized successful Library transfer and model/source admission.
This slice supplies no sheep simulation, gathering/depletion implementation,
movement, rigging, animation, approved carcass art or paid regeneration.
