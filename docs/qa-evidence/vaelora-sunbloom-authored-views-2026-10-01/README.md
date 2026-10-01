# Ellionar Sunbloom authored views · 1 October 2026

[Close](sunbloom-views-close.png) and [strategic](sunbloom-views-strategic.png)
captures show front/right/rear/left at the same four pivots, using the actual
instanced material and fixed camera direction (0.78,1.12,0.78), 45° azimuth,
45.435902° elevation and registered 0.88654×0.85 cards. The rear exposes flower
backs and the side profiles narrow. Lapis flowers and warm foliage read against
Ellionar's brown garden soil without the reference's diffuse halo. These are
approximate interpretations; anatomical root alignment and exact 3D continuity
remain uncertified.

[Heading proof](sunbloom-views-proof.json) tests 80 instances across four views
at stocks 5/3/2/1/0/6 (480 transitions). Positive stock retains full, zero hides,
and reset restores the exact matrix/UV. Selection is repeatable, mirroring and
card yaw are suppressed, GL renders successfully, and legacy single-view mode
loads. The historical `workedLifecycleChecks` field counts stock transitions,
not worked flower artwork. Sunbloom has no worked/low atlas rows.

[Garden proof](garden-proof.json) retains 15 channel-side beds, with Sunbloom
and garden vine as two existing batches. [Ordinary](garden-ordinary.png) and
[strategic](garden-strategic.png) captures show their layout beside irrigation.
Parent woodland clearing leaves independent garden matrices unchanged.
[Mixed understory](understory-renderer.png) checks Sunbloom alongside the vine.
[Plant contracts](plant-contract-proof.json) cover all 27 registered plants and
22 companion identities, partial stock, clearing/reset and ground contact.
[Occupation](forest-cover-proof.json) covers nine land categories and foundation
restoration. Regional texture checks admit the uniquely named Sunbloom atlas
only in Ellionar fixtures; no yield, collider, placement or map rule changes.

[Release proof](release-proof.json) verifies exact bytes for the server,
environment module, generated configuration and atlas in the Docker context.
The exporter verifies selected source/reference hashes, frame extraction and
exact decoded alpha. Browser, supervisor and temporary release context were
stopped. Bellweather baseline boot reports no browser errors. This is local
appearance/lifecycle evidence, not hosted or performance proof.

Run the vegetation browser script against an isolated local Bellweather server
with `RTS_VEGETATION_REGION=ellionar`, `RTS_VEGETATION_SUNBLOOM_VIEWS=1`,
`RTS_VEGETATION_GARDEN=1`, `RTS_VEGETATION_UNDERSTORY=1`,
`RTS_VEGETATION_PLANT_CONTRACT=1` and `RTS_VEGETATION_OCCUPATION=1`.
Independent flower harvesting, worked/low flower art and free-camera remapping
remain absent.
