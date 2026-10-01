# Sunbloom low runtime · 1 October 2026

[Full](sunbloom-views-close.png), [worked](sunbloom-views-worked-close.png),
[low](sunbloom-views-low-close.png) and [strategic](sunbloom-views-strategic.png)
show the twelve-frame atlas in the actual fixed camera (45.436° elevation,
45° azimuth, zero screen roll). Low foliage reveals copper branching and
retains lapis flowers. No obvious crown jump is visible at this capture scale;
anatomical registration and measured rotations remain uncertified.

[State proof](sunbloom-views-proof.json) checks 80 instances across four headings
through stock 5/3/2/1/0/6: 480 transitions, exact UV selection, repeatable heading,
unchanged positive-stock matrices, zero-scale clearing and full reset. The
legacy switch loads the original single-view plant. Captures report no GL or
browser errors. These are interface/state checks, not a new live-worker proof.

[Garden proof](garden-proof.json) retains 15 independent beds (nine Sunblooms,
six vines), two batches and independent clearing. [Plant contracts](plant-contract-proof.json)
cover 27 plants and 22 companion identities; [occupation](forest-cover-proof.json)
covers nine categories. Resource ownership, routes and gathering rules remain.

Command: `RTS_QA_URL=http://127.0.0.1:4178 RTS_VEGETATION_REGION=ellionar RTS_VEGETATION_SUNBLOOM_VIEWS=1 RTS_VEGETATION_GARDEN=1 RTS_VEGETATION_UNDERSTORY=1 RTS_VEGETATION_PLANT_CONTRACT=1 RTS_VEGETATION_OCCUPATION=1 RTS_VEGETATION_OUTPUT=docs/qa-evidence/vaelora-sunbloom-low-runtime-2026-10-01 node scripts/qa-vegetation-browser.mjs`.

This is isolated local appearance evidence, not hosted or performance evidence.
Depleted plants hide; no independently harvestable flower resource exists.

Full release packaging passed; [byte proof](release-proof.json) matches the
server, environment module, configuration and atlas to its isolated snapshot.
The temporary snapshot was removed and room workers shut down cleanly.
