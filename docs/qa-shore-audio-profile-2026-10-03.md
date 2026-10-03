# Shore Fishing public regional profile — 2026-10-03

Audio owner retains this adoption outcome through delivery and actual in-game
listening. This slice assigns existing approved public material; it generates
no audio and publishes no private audition files.

## Ordinary-game binding

`maps/shore-fishing.json` now selects the registered `vaelora-siltmouths` /
`landscape` / `v2` reference with manifest SHA-256
`1d64164f3d97048f3e68ef2b094d04359281da7ddafed86cbeee628b83ce8c44`.
The existing profile loads its **score and reed-wind terrain bed**. The sources,
manifest, shipped catalog, loader and client hooks are unchanged. Both seats
receive the reference through normal map selection and reconnect welcomes;
input unlock starts the layers without a local import or preview switch.
Worker selection and food orders keep the synthesized feedback.

This is a provisional aesthetic choice. The retained [Shore comparison](qa-shore-audio-audition-2026-10-03.md)
used a separate water **contrast** bed, so its measurements do not accept this
terrain-bed mix. Contrast and signature sources remain unbound/audition-only.

## Focused regression proof

`node scripts/audio-shore-profile-scenario.mjs` first reproduced the missing
ordinary-map reference, then passed with the assignment. It starts the real
server and two WebSocket seats, selects Shore Fishing through `selectMap`, and
loads the received references through the existing hash-verifying HTTP loader.
It rejects any local Audio Studio import and checks that only the existing
music and terrain sources are adopted.

The scenario verifies pre-unlock silence, single activation despite repeated
unlock, synthesized selection/food cues, independent seat mixing and mute,
visibility cancellation/return, ordinary map switching away/back, resumed
welcomes, and disposal. Its Web Audio context models scheduling and identifies
buffers by the SHA-256 of actual HTTP bytes; it does not decode in a browser or
establish hearing. The check is registered in `scripts/ci.mjs`.

Final registered audio/supporting checks, clean release receipt and independent
review are recorded on the integrating PR. These focused checks are not a claim
that the entire aggregate suite passed.

## Remaining delivery and listening

Audio owner retains the next action: identify a settled staging deployment
whose source contains this merge, verify the manifest and both originals over
that release's authenticated HTTP path, then run the [short Mac listening session](audio-design.md#short-mac-listening-session)
on ordinary Shore Fishing. Record exact source/deployed revision, input unlock,
score/terrain contrast against food cues, independent mute controls, visibility
return and an audible loop seam. Railway delivery owner owns staging delivery;
its current shared receipt is in the [adoption checklist](asset-adoption-checklist.md#exact-deployment-evidence).

At implementation time staging was building source `00ff45d9702dfbcf9da6f6ac88e0ca4381e374dc`,
which predates this slice; production was settled at
`67b166748f6cc82c0a76319478f4475da1ab9083`. Neither proves this profile delivered.
The cloud browser's provider sandbox cannot launch Chromium, and this tool
environment cannot hear the retained audio. Deployment and actual listening
therefore remain incomplete until exact-build evidence is attached to the PR.

After that bounded session, keep or adjust this provisional assignment. Only
then consider a separate small adoption of the existing water contrast bed or
signature; generation is not required for that backlog.
