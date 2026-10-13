# Permanent Meshy source archive

[Working rules](../AGENTS.md) · [Art preservation](lore/art-evolution.md) ·
[Recovery ledger](qa-evidence/meshy-source-archive-2026-10-13/recovery.json)

## Location and ownership

The shared private Mac archive is:

```text
/Users/lb/Documents/thousand-unit-skirmish-source-archive/meshy
```

It is independent of the primary checkout, Codex worktrees, Git history and
provider retention. Every worktree uses the same default. On another host,
`RTS_MESHY_ARCHIVE` or `--archive` must identify explicitly persistent private
storage; a temporary container or another disposable worktree is not a substitute.
The generation owner retains responsibility for transfer and hash verification
at this archive before calling the source preserved. No cloud mount or automated
off-device backup is claimed by this workflow.

The source-recovery owner is chat `01a13546-557e-7331-ab06-096841398918`.
This is a source-only production outcome. Art/storyboard backing, runtime changes,
release admission, deployment and in-game appearance acceptance are N/A.
Private source archival does not publish art or change the approved game assets.

## Archive layout and integrity

- `objects/<sha256>.glb`: exact, self-contained model bytes, copied independently
  of the source file, read-only and deduplicated by SHA-256.
- `by-asset/<asset>/<variant>/<stage>/`: readable model names, ending with their
  content hash. These are hard links to the verified objects within the archive,
  so organizing one model under multiple combinations does not duplicate bytes.
- `records/`: name, collection, original path, byte count, hash and object path
  for every recovered source location.
- `catalog.json` and `README.md`: verified inventory and readable source index.
- `provenance/`: task IDs, stage lineage, prompts and other JSON records, with
  URLs and credential fields removed. Each includes the original receipt hash.
- `jobs/`: permanent CLI working directories for future downloads/generation,
  retaining task records and delivered files even when a command fails or times out.
- `recovery.json`: dated expected-source comparison and outstanding recovery work.

GLB is the current archive's verified model format. It bundles geometry, textures,
rigs and clips; the importer rejects truncated files and external dependencies.
For other formats, preserve the complete dependency bundle in permanent `jobs/`
and add appropriate verification before labeling it archived. No format conversion,
paid regeneration or public source upload is implicit in recovery.

## Save future models by default

Run authorized Meshy production operations through the repository wrapper.
It uses the skill's pinned CLI 0.4.0, reuses its normal secure authentication,
places the CLI working directory and all output in the permanent archive, then
copies every delivered GLB into verified objects and refreshes the catalog.
Use absolute local input paths because the CLI runs inside its permanent job folder.
Existing account configuration is reused; never put keys in command arguments.

Every future run requires three lowercase names (letters, digits and hyphens,
up to 64 characters each):

| Name | Meaning | Example |
| --- | --- | --- |
| `--asset` | Stable subject across generations | `worker`, `town-hall`, `oak` |
| `--variant` | Version plus meaningful style/state/color combination | `frontier-v2-blue`, `frontier-v2-foundation` |
| `--stage` | Production step or action clip | `base`, `textured`, `optimized`, `rigged`, `walk`, `attack` |

Use a new variant version when changing the intended design. Multiple attempts
of the same combination remain separate by hash and permanent job/task identity;
none silently replaces the previous attempt. Example saved path:
`by-asset/worker/frontier-v2-blue/walk/worker--frontier-v2-blue--walk--<hash>.glb`.
The catalog retains each original filename, exact full hash and task lineage.
Unclassified historical sources remain explicitly in the legacy collection.

```sh
# Free planner: no model submission or credits.
node scripts/assets/meshy-source-archive.mjs run --asset worker --variant frontier-v2-blue --stage base -- make /absolute/reference.png --dry-run --max-credits 30

# Only after the generation itself and its budget are authorized.
node scripts/assets/meshy-source-archive.mjs run --asset worker --variant frontier-v2-blue --stage base -- make /absolute/reference.png --max-credits 30

# Free recovery/download of an existing task, with the exact owning resource.
node scripts/assets/meshy-source-archive.mjs run --asset worker --variant frontier-v2-blue --stage base -- download --resource image-to-3d --task-id EXISTING_TASK_ID --model-format glb
```

Download rig/action GLBs through the same runner, using asset keys returned by
the task's `download --list`; archive every stage, not just the final pose.
An async task can have a permanent receipt without any model bytes yet.
`archivedModels: false` / `modelVerification: pending` is explicitly incomplete model delivery; finish the
matching wait/download. A terminal provider error leaves already-delivered GLBs
preserved. The runner forwards the provider exit code and retains sanitized output.
`modelVerification: passed` means the delivered GLBs and named paths passed
archive verification; a task ID or successful submission alone cannot produce it.

For an existing local generation folder or a single original:

```sh
node scripts/assets/meshy-source-archive.mjs import --source /absolute/meshy_output --label frontier-building-sources
node scripts/assets/meshy-source-archive.mjs import --source /absolute/original.glb --asset worker --variant frontier-v2-blue --stage base --expected-sha256 EXACT_RECORDED_SHA256
node scripts/assets/meshy-source-archive.mjs verify
```

Do not remove original folders until verification succeeds. Imports are repeatable;
existing preserved objects are checked and never replaced on a hash mismatch.
Keep the catalog/provenance with the objects when backing up or restoring.
For reuse, resolve the model's `objectPath` in the catalog and use that exact GLB;
copy it under the required original filename into a new working folder if a baker
requires specific names. Preserve the archive copy unchanged.
The standalone `archive.mjs` tool copy is retained in the permanent archive.
After restoring objects, records and provenance, its `index` command verifies
model bytes and rebuilds missing readable hard links and the catalog. `verify`
does not modify files and fails if any expected named path is missing or corrupt.
Back up `jobs/` too when retaining pending-task receipts and original CLI output;
`index` can recreate an empty jobs folder but cannot restore its lost contents.

## Initial collection — 13 October 2026

The initial recovery found 55 GLB source paths and preserved **50 unique models,
2,267,600,196 bytes (2.27 GB)**, plus 223 sanitized JSON provenance records.
The older `/Users/lb/Developer/thousand-unit-skirmish` checkout supplied most files;
the surviving `88e5` worktree supplied earlier Worker/Infantry models.
Copies passed SHA-256, byte count, GLB structure and dependency checks.

The user also confirmed four available account models: Human Field Worker,
medieval_town_hall_complete, medieval_town_hall_c1_foundation and
medieval_town_hall_c2_framing. Their refreshed CLI links still returned HTTP 403;
authenticated website GLB downloads succeeded. All four were imported as separate
versions, bringing the verified total to **54 unique models, 59 source paths and
2,901,571,740 bytes (2.90 GB)**. Their safe account receipts and exact hashes are
retained privately in the archive. No new models were generated and no credits
were spent on recovery.

Across this collection, individual GLBs range from 7.4 MB to 323.7 MB; the median
is 28.4 MB. Detailed geometry and embedded textures account for much of the size.
The total above counts unique model objects; future job output can retain another
copy alongside its verified object. The catalog links each readable source name
to the exact preserved GLB.

Recovered families include earlier Town Center complete/state sources, oak/pine/
berry originals and optimized versions, cursor sources, cliff, character style
experiments, rig/action variants, and the exact original Bellweather Sheep.
The tree, Town Center lifecycle and Sheep sources match their retained public
capture hashes. Older Town Center/character files are distinct from the missing
newer building and Infantry-pilot originals; similar filenames are not recovery.

The [recovery ledger](qa-evidence/meshy-source-archive-2026-10-13/recovery.json)
retains each known current source/hash and its provenance. Missing originals are
the nine newer building GLBs (Town Center, House, Storehouse, Stable, Workshop,
Watchtower, Mill, Farm, Dock), the Infantry pilot base/walk/attack/defeat and its
separate rigged model. Local filename searches, reachable Git model blobs and
connected Drive discovery did not locate those bytes. The four civilization-model
task IDs were not retained in their public provenance. With verified account
authorization, all nine retained old task IDs returned HTTP 404 / not found.
The available account models above do not replace any missing exact source hash.
The 14 missing originals remain explicit; recovery would need another surviving
copy or restored provider access. No paid regeneration was attempted.

The archive is permanent local storage. A Google Drive backup needs explicit
destination/payload authorization: automatic approval review rejected the first
catalog upload. No upload or off-device backup is claimed. Provider recovery and
backup state belong in the dated ledger; generation is never used to conceal a
missing original.
