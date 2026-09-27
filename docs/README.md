# Documentation

Start with the task you want to do. The root [README](../README.md) is the quick
start; this index covers maintained guides, contracts, experiments, and evidence.

## Play and operate

| Task | Guide |
| --- | --- |
| Install, run locally, host on LAN, troubleshoot | [Local setup](getting-started.md) |
| Learn controls, economy, objectives, and rematches | [Player guide](playing.md) |
| Reproduce a solo match | [Play vs AI](play-vs-ai.md) |
| Find server defaults and limits | [Configuration](configuration.md) |
| Package, deploy, recover, and back up | [Deployment](deployment.md) |

## Develop and test

| Task | Guide |
| --- | --- |
| Understand runtime boundaries and files | [Architecture](architecture.md) |
| Run focused checks, browser scenarios, or measurements | [Testing](testing.md) |
| Change commands, snapshots, or bot observations | [Gameplay contract](gameplay-command-observation-contract.md) |
| Understand overload behavior | [Simulation timing](simulation-timing.md) |
| Author and validate scenario JSON | [Map authoring](map-authoring.md) |
| Choose a map | [Catalog](maps.md), [Forked Vale](forked-vale-scenario.md), [Three Crowns](three-crowns-layout.md) |
| Change the compact objective HUD | [Objective behavior and validation](battlefield-objectives-validation.md) |
| Change cues or captions | [Audio design](audio-design.md) |

## Product and experiments

- [Game bible](game-bible.md): product promise, design principles, quality floor, scope.
- [Roadmap](roadmap.md): next outcomes and milestone evidence.
- [Balance](first-skirmish-balance.md): current no-tune baseline and next observations.
- [QA and external playtests](qa-vertical-slice.md): acceptance and repeatable protocol.
- [Map scale](map-scale-density.md), [living land](living-land-experiment.md), and
  [harvestable woodland](harvestable-woodland-pilot.md): implemented slices and proposed follow-ups.
- [Model-opponent research](model-controlled-opponent-research.md): default-off fake-provider boundary.

## Art and assets

Start with the [asset guide](assets.md), which distinguishes active runtime paths
from source/candidate packs. Then use the relevant contract:

- [Art direction](art-direction-contract-v1.md) and [production lanes](art-production-lanes.md).
- [Renderer state/GLB/environment contract](renderer-state-contract.md).
- [Sprite-atlas format](sprite-atlas-contract-v1.md).
- [Building model/capture pipeline](building-asset-production-pipeline.md) and
  [direct 2D workflow](building-sprite-production-workflow.md).
- [Unit/building kit](unit-building-art.md) and [GLB finish proposal](unit-building-art-output-proposal.md).
- [Environment library](environment-pack-v1.md) and [interactive states](environment-state-pack-v1.md).
- [Cursor/icon contract](ui-cursor-icon-contract.md).
- [Asset directory index](../assets/README.md) for individual pack READMEs and provenance.

## Research and evidence

- [RTS coverage](references/feature-coverage-inventory.md),
  [Openage study](references/openage-study.md), [Warcraft study](references/warcraft-rts-inventory.md).
- QA checkpoints: [25 September](qa-checkpoint-2026-09-25.md),
  [26 September](qa-checkpoint-2026-09-26.md).
- [Performance baseline, 25 September](performance-reliability-baseline-2026-09-25.md).
- [Environment runtime pilot](qa-evidence/environment-state-pack-v1/pilot/README.md).
- [Technical-art checkpoint](technical-art-surfacing-checkpoint-2026-09-26.md).
- [Historical archive](archive/README.md): original measurements, ledgers, and prototype history.

## Keep these docs useful

- Put instructions in the guide for that task; link to them instead of copying them.
- Keep runtime claims tied to code. A generated asset is not necessarily integrated.
- Keep proposals explicit. A milestone needs its stated evidence, not a feature count.
- Record measurements once with build, conditions, result, and limitations.
- Preserve exact prompts, source IDs, hashes, and provenance; they are factual records.
- Update manifest/checksum entries if their covered documentation changes.
- Use relative repository links and commands from the repository root unless stated otherwise.
- Run `npm run docs:check` after edits; CI checks local paths and heading anchors.
- Keep the README short. Put detailed schema in contracts and old chronology in the archive.

This rewrite describes source baseline `e4a3731`. Future changes should update
the owning guide rather than append repeated status to several files. Repository
coordination rules remain in [AGENTS.md](../AGENTS.md).
