# Pod-vine low-stock integration · 1 October 2026

[Full](podvine-views-close.png), [worked](podvine-views-worked-close.png) and
[low](podvine-views-low-close.png) capture all four authored headings at the same
world pivots through the actual instanced atlas material. The fixed camera uses
the game's direction (0.78,1.12,0.78), 45° azimuth and 45.435902° elevation, with
zero card roll or mirroring. Registered cards retain 1.10431×0.55 dimensions.
Low foliage is markedly sparser and exposes more pale stems. There is no obvious
root jump at this capture scale; anatomical root registration and exact branch
continuity remain uncertified.

[Frame proof](podvine-views-proof.json) checks 80 instances across four headings
at stocks 5/3/2/1/0/6 (480 transitions), against the generated full/worked/low UV
rectangles. Stocks two and one select low, five through three select worked,
zero hides and six restores full. Every positive transition retains the exact
root matrix and heading. Repeated construction retains direction choice and
legacy single-view fallback loads. All three rows render without GL error.

[Plant contracts](plant-contract-proof.json) cover 26 registered plants and
21 companion identities, partial stock, clearing and reset.
[Occupation proof](forest-cover-proof.json) covers all nine land categories and
foundation restoration. [Margin proof](jungle-proof.json) retains the existing
79 specimens across four species and confirms parent clearing leaves their
matrices unchanged. The independent margin loader selects full with no forest
stock binding. [Mixed understory](understory-renderer.png) retains all four
Vesperra companion species. No resource, yield or collision rule changes.

[Release proof](release-proof.json) checks exact bytes for the server,
environment module, generated configuration and twelve-frame atlas in the
Docker release context. Temporary context, isolated browser and room supervisor
were stopped. The Bellweather Millrace baseline reports no browser errors.
This is local appearance/lifecycle evidence, not hosted or performance proof.

The source exporter checks all twelve decoded alpha frames, hashes, extraction
records, shared scale and generated config. The preceding full/worked exporter
still passes unchanged-output checks after its frame generation was factored
into a shared function. Cleared pod-vines still hide rather than showing a
separate depleted drawing. Independent pod harvesting remains absent.
