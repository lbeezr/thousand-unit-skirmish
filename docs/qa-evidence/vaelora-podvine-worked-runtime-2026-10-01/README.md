# Pod-vine woodland disturbance binding · 1 October 2026

The default pod-vine instance material now loads the eight-frame full/worked
atlas. Existing 1.10431×0.55 cards, fixed camera quaternion, bottom pivot and
placement are retained. The runtime card is roughly 1.5% shorter than the
aspect-matched review card; this uniform compression applies to both rows and
every direction. Root registration remains provisional, not anatomically
certified. No source repainting or per-view rescaling was used.

[Frame/lifecycle proof](podvine-views-proof.json) tests 80 instances across all
four cell-selected directions, with stock 5/3/1/0/6 (400 transitions). Positive
partial stock selects the worked row; zero stock hides the instance; six restores
full. Every nonzero transition retains the exact root matrix, selected heading
and no mirroring. Atlas UVs are checked against generated rectangles. Repeated
construction reproduces direction selection. Legacy single-view mode loads.

[Plant contract proof](plant-contract-proof.json) covers all 26 registered
plants and 21 companion identities, including partial stock, clearing and reset.
[Occupation proof](forest-cover-proof.json) checks the nine land categories and
foundation restoration. [Margin proof](jungle-proof.json) covers the existing
79-specimen, four-species Vesperra margin beds; parent clearing retains their
matrices. Independent margin plants are constructed full and have no woodland
stock-state call. [Understory capture](understory-renderer.png) includes the
worked pod-vine alongside the other three Vesperra understory species.

[Additional runtime capture](../vaelora-podvine-worked-close-2026-10-01/podvine-views-worked-close.png)
renders all four worked headings through the actual atlas shader at stock three.
Exposed stems and reduced foliage remain readable; there is no apparent tilt or
mirroring. The corresponding proof checks GL success. This is local renderer
and lifecycle evidence, not hosted deployment or a performance measurement.

[Release proof](release-proof.json) verifies byte-identical admission of server,
environment module, generated configuration and atlas into the Docker context.
Temporary release context, preview servers and successful QA browsers were
stopped. An initial server launch used incorrect isolation/map configuration;
it was stopped and corrected before browser assertions ran. No assertion was
relaxed. The final baseline boots Bellweather Millrace and reports no browser
errors.

Run the vegetation browser script with `RTS_VEGETATION_REGION=vesperra`,
`RTS_VEGETATION_PODVINE_VIEWS=1`, `RTS_VEGETATION_UNDERSTORY=1`,
`RTS_VEGETATION_JUNGLE=1`, `RTS_VEGETATION_PLANT_CONTRACT=1`, and
`RTS_VEGETATION_OCCUPATION=1` against an isolated local Bellweather server.
Independent pod harvesting, distinct low/depleted pod-vine drawings and exact
anatomical registration remain unfinished.
