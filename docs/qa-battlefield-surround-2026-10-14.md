# Terraced Vale surround: delivery and appearance evidence

[Runtime treatment](battlefield-surround.md) · [Source board](art-direction/battlefield-setting-2026-10-14/README.md) · [Acceptance rules](testing-strategy.md)

Owner: **Explore map edge atmosphere**, chat `01a13aba-1a70-7322-9b8e-f71bb213dccd`.
Map: `veyrholds-terraced-vale`, 160×160, seed 93025. Scope: the user-selected
connected rocky landscape and static valley-cloud experiment, with default
binding on this map alone.

## Checkpoint

[PR678](https://github.com/lbeezr/thousand-unit-skirmish/pull/678) merged as
`5f2c653477016e3a0949fc01ba63bacd03757b46`. The clean
[release receipt](qa-evidence/battlefield-surround-2026-10-14/release.json)
records 1,853 files and digest
`sha256:86d4394e9dedaa5578443be82b80a34cf2852b462d523d1ee8b16b33ceaa1e0b`.
Staging deployment `1dfb6b16-cb42-4b56-902e-ce1f19f928c3` reached SUCCESS at
2026-10-14 15:11:41 UTC on that exact source. The
[public source receipt](qa-evidence/battlefield-surround-2026-10-14/served-source.json)
matches the served main, scenery and camera modules at 15:13:34 UTC. The isolated
packed-release scenario passed HTTP/auth/WebSocket/assets/transitive import
checks. Production remains on `67b166748f6cc82c0a76319478f4475da1ab9083`.
These are delivery receipts; no in-game appearance pass is claimed yet.

[Focused source receipt](qa-evidence/battlefield-surround-2026-10-14/focused-source.json)
retains tested-file hashes and 38/38 focused scenery, cliff, Terraced Vale,
camera recovery and client-import checks. Both type configurations, runtime
boundaries (263 modules/512 local edges, no cycles), docs and whitespace pass.
The first sandboxed focused attempt had two loopback `listen EPERM` failures;
the authorized loopback rerun passed all 38.

[First fast report](qa-evidence/battlefield-surround-2026-10-14/fast-first.json.gz):
1,148 passed, one cloud-install fixture assertion failed because macOS exposed
`/var/...` while the shell resolved `/private/var/...`; 214 remained unrun.
The [canonical-temp fast rerun](qa-evidence/battlefield-surround-2026-10-14/fast-canonical-tmp.json.gz)
passed 1,198/1,363 checks before unrelated pathing-replay assertions failed;
164 remained unrun.
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

The current task runs on macOS; no Mac game browser was launched. The initial
local cloud executor was unavailable, but subsequent inspection found the
[qualified hosted Ubuntu path](renderer-qualification.md). Its normal sandboxed
WebGL2 backend is reusable. An attempted `tree-targeting` dispatch was rejected
by automatic approval review before starting a run because that case's scenery
coverage was not established. It was not retried through another route.

A dedicated [Terraced Vale appearance workflow](../.github/workflows/battlefield-surround-capture.yml)
and [feature-owned driver](../scripts/renderer-battlefield-surround-staging.mjs)
prepare the matching capture. It uses normal New Game, two human seats,
`skirmish@1`, the unchanged shipped Terraced Vale, actual pointer Move, native
camera/minimap controls, rematch and normal lobby map changes. It neither imports
a lab map nor edits world state. Twenty-six frames cover both seats, 0.91/0.48,
Fit map, corners, 1920×1080/1024×768, visible edge Workers, unexplored fog,
rematch, another shipped map and return. Five focused CPU tests establish fixed
public-source hash comparison, bounded streamed files, reachable native edge
destinations and live WebGL2/frame validation. These tests do not establish pixels.

The workflow accepts only an exact 40-character active staging source revision,
has read-only repository permission, a ten-minute job bound, one six-minute
capture deadline and one-day artifacts. It compares eight public setting files
against immutable GitHub bytes before and after capture. Runner SHA, captured
source SHA, clean release digest and provider deployment identity stay separate.
The driver leaves appearance status pending until the owner inspects actual PNGs.

## Retained acceptance

Pending: actual ordinary-game images at 0.91/0.48, Fit map, edge pans, both teams,
wide/narrow viewports, fogged/visible edge troops, map switch and rematch. The
owner retains this work at the identified deployed release. Next: independently
review and publish the dedicated case, dispatch once for a confirmed stable
staging revision, download evidence before expiry and inspect actual images.
The original concept image and CPU checks do not replace those captures.
