# Wildlife metadata import/publication parity — 4 October 2026

Economy/content owns the actual client importer fix, focused native checks,
independent review, ordinary merge and postmerge verification. The client now
calls the already published `validWildlifeNodeDefinition` used by native map
publication. It adds no species, fields, schema, wildlife behavior or map content.
Frontier remains the implemented gameplay civilization.

## Existing contract, one consumer correction

The old importer accepted Wood nodes carrying Sheep identity and maps containing
room-only wildlife ownership/lifecycle metadata, although native publication
rejected them. `src/main.js` now imports the existing helper and includes it in
the normal `validateImportedMap` resource-node predicate. The existing Stone
importer fixture binds that real helper too; no validation rules are duplicated.

The [claims owner's boundary proposal](https://github.com/lbeezr/thousand-unit-skirmish/pull/194#issuecomment-5974850086)
and [Herd refresh](https://github.com/lbeezr/thousand-unit-skirmish/pull/194#issuecomment-5975013512)
record this consumer scope. Claims and Herd are already merged, with current
checkpoint schema 28. This slice changes none of their fields or interfaces;
those owners retain authority, ownership, selection and presentation work. No
owner response or interface approval is asserted by these coordination records.

## Observed acceptance

At clean integrated source `df0b518ff2314ccd2b4e7be5a8e54108287449b2`, Node
24.19.0, 90 focused wildlife tests and the existing actual Stone importer check
passed. The added parity suite exercises the real importer function extracted
from `src/main.js`, with the real shared helper, and a native room on shipped
Stone Defense Field. The smaller map is an admission regression input, preserving
the developing 160 × 160 gameplay floor.

- Sixteen malformed cases reject before import mutation: Wood Sheep, unknown or
  null species, runtime lifecycle/team/motion/activity/heading/Herd/grazing anchor,
  pose without Sheep identity, and negative/360/string/null nose poses.
- Legacy ordinary food/wood and optional authored Sheep poses retain exact
  resource bytes and legacy economy-profile omission. A further positive control
  admits Sheep with no nose pose, as required by the existing optional contract.
- Actual native publication rejects the same sixteen inputs without changing
  map identity/hash, banks, buildings or resource pools, and creates no rejected
  custom map file. The test reads the sequence after the rejection batch, then
  waits for a strictly newer checkpoint before comparing retained authority.
  Independent review caught and corrected an earlier stale-checkpoint assertion.
- Existing valid Food Sheep with a 90-degree authored pose imports and publishes,
  preserving resource bytes and banks. Already admitted wildlife state, motion
  and Herd modules return HTTP 200 from the actual native host.

```sh
node --test scripts/wildlife-import-parity.test.mjs scripts/wildlife-state.test.mjs scripts/wildlife-motion.test.mjs scripts/wildlife-claims.test.mjs scripts/wildlife-herding.test.mjs
node --test --test-name-pattern='actual client importer admits Stone' scripts/stone-map-profile.test.mjs
node scripts/check-client-imports.mjs
node scripts/check-runtime-imports.mjs
npm run check:types
node scripts/railway-release-scenario.mjs
node scripts/check-docs.mjs
```

CI registers the actual importer/native publisher suite. The normal importer is
bound by default, without a preview flag. Release/include and exact-source checks
are recorded on this slice's PR; those checks do not establish a deployed client.
The existing Railway delivery owner retains identified user-build delivery under
the [delivery ledger](asset-adoption-checklist.md#exact-deployment-evidence).
Economy/content retains the final ordinary Map Studio import observation at that
revision: a malformed Wood Sheep fails immediately, while a legal legacy map
still imports and can publish. That deployed editor observation is incomplete;
the source/native checks here make no rendered-usability claim.
