# Terraced Vale surround: delivery and appearance evidence

[Runtime treatment](battlefield-surround.md) · [Source board](art-direction/battlefield-setting-2026-10-14/README.md) · [Acceptance rules](testing-strategy.md)

Owner: **Explore map edge atmosphere**, chat `01a13aba-1a70-7322-9b8e-f71bb213dccd`.
Map: `veyrholds-terraced-vale`, 160×160, seed 93025. Scope: the user-selected
connected rocky landscape and static valley-cloud experiment, with default
binding on this map alone.

## Checkpoint

Implementation is on `codex/terraced-vale-surround`, over baseline
`a22819577ae1d93c84b8df1b44718019ffc4ec3a`. Source SHA, clean release digest and
deployed revision will be recorded as those steps complete. No in-game
appearance pass is claimed.

[Focused source receipt](qa-evidence/battlefield-surround-2026-10-14/focused-source.json)
retains tested-file hashes and 38/38 focused scenery, cliff, Terraced Vale,
camera recovery and client-import checks. Both type configurations, runtime
boundaries (263 modules/512 local edges, no cycles), docs and whitespace pass.
The first sandboxed focused attempt had two loopback `listen EPERM` failures;
the authorized loopback rerun passed all 38.

[First fast report](qa-evidence/battlefield-surround-2026-10-14/fast-first.json.gz):
1,148 passed, one cloud-install fixture assertion failed because macOS exposed
`/var/...` while the shell resolved `/private/var/...`; 214 remained unrun.
A canonical `TMPDIR=/private/tmp` rerun is in progress.
[First simulation report](qa-evidence/battlefield-surround-2026-10-14/simulation-first.json.gz):
17 passed, queued-wall team 1 hit a checkpoint timeout, 177 remained unrun. The
same unchanged native scenario reproduced its checkpoint timeout in an isolated
rerun. Its authority-path failure remains unresolved; the scenery is not
imported by the game server. These failed scoped reports do not establish the
full CPU suite. A canonical-temp rerun also spans the later source refresh/fix,
so its results will retain their initial working-source identity rather than
claiming a frozen final head.

The user-authorized independent read-only review found a discontinuous lip
defect: four edge segments could float up to 1.6 world units above the adjoining
ground. The correction preserves each boundary cell's actual corner pair and
adds four exterior closure faces. The focused suite passed 38/38 again after
the correction; the reviewer's second pass reports no actionable findings.
Shader compilation and actual game pixels remain outside that review.

The local checkout's dependencies were absent. Its first locked `npm ci`
attempt failed with ENOSPC. The dependency lock is byte-identical to checkout
`/Users/lb/.codex/worktrees/441c/thousand-unit-skirmish/package-lock.json`, so an
ignored local `node_modules` directory with package symlinks reuses that existing
installation for CPU validation. It is not a shipped path or a changed dependency
version.

The current task runs on macOS. The repo Start skill requires the intended
cloud runtime for browser qualification and disallows a Mac fallback. The
[cloud setup record](cloud-environment.md#optional-browser-readiness-and-known-provisioning-blocker)
retains the existing normal-sandbox startup failure. Read-only inspection of
**Audit cloud game tooling**, chat `01a11bb4-4629-71b9-9a94-88cdc4817013`, found
its setup-source delivery complete and actual environment provisioning/browser
qualification unperformed. There is no qualified cloud executor attached here.
No Mac browser was launched. This bounds the presently unavailable appearance
evidence; implementation, CPU contracts, packaging and staging continue.

## Retained acceptance

Pending: actual ordinary-game images at 0.91/0.48, Fit map, edge pans, both teams,
wide/narrow viewports, fogged/visible edge troops, map switch and rematch. The
owner retains this work at the identified deployed release. A qualified cloud
browser is the resume condition; the original concept image and CPU checks do
not replace those captures.
