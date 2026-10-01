# Veilcap authored-view integration · 1 October 2026

[Close views](veilcap-views-close.png) and [strategic views](veilcap-views-strategic.png)
render front/right/rear/left through the actual instance material, using the
game's camera direction (0.78,1.12,0.78), 45° azimuth, 45.435902° elevation and
the registered 0.61614×0.65 bottom-pivoted card. Caps overlap differently and
side colonies have narrower footprints. The lilac/ivory/olive palette remains
recognizable in the [mixed understory](understory-renderer.png). Contact proxies
register the moss footprint; anatomical root positions and exact 3D rotations
are not certified by these captures.

[Veilcap proof](veilcap-views-proof.json) checks 80 instances across all four
directions at stocks 5/3/2/1/0/6 (480 transitions). Positive stock retains the full
view, zero hides, and reset restores the exact root matrix and view rectangle.
Direction choice is repeatable; mirroring and card yaw are suppressed; GL
renders without error. Legacy single-view mode loads.
[Pod-vine proof](podvine-views-proof.json) repeats the same 480-transition check
for its full/worked/low rows, confirming that the shared loader retains its
existing state behavior. The proof's historical `workedLifecycleChecks` field
counts all tested stock transitions, not Veilcap worked artwork.

[Plant contracts](plant-contract-proof.json) cover 27 registered plants and
22 companion identities, partial stock, clearing/reset and ground contact.
[Occupation proof](forest-cover-proof.json) covers all nine land categories and
foundation restoration. [Margin proof](jungle-proof.json) retains the existing
79 specimens and four species; parent clearing leaves margin matrices unchanged.
No placement, resource, collider, yield or scenario rule changes.

[Release proof](release-proof.json) verifies byte-identical server, environment
module, generated Veilcap config and atlas in the Docker context. Source/reference
hashes, extraction records and exact decoded atlas alpha pass the export checker.
Browser, isolated supervisor and temporary release context were cleaned up.
The Bellweather baseline boots without reported browser errors. This is local
appearance/lifecycle evidence, not hosted or performance proof.

Run the vegetation browser script with `RTS_VEGETATION_REGION=vesperra`,
`RTS_VEGETATION_PODVINE_VIEWS=1`, `RTS_VEGETATION_VEILCAP_VIEWS=1`,
`RTS_VEGETATION_UNDERSTORY=1`, `RTS_VEGETATION_JUNGLE=1`,
`RTS_VEGETATION_PLANT_CONTRACT=1`, and `RTS_VEGETATION_OCCUPATION=1` against an
isolated local Bellweather baseline. Veilcap worked/low drawings, independent
fungus harvesting and measured camera-orbit remapping remain absent.
