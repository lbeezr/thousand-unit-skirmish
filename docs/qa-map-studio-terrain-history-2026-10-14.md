# Map Studio terrain history — 14 October 2026

[Authoring contract](map-authoring.md#terrain-edit-history--14-october-2026) ·
[Testing strategy](testing-strategy.md)

Owner: maps/map-making chat `01a13a87-26dd-70b1-9410-ffa2f8e6932e`.
Source base: main `dcde6da3150151a3c4b7398fa369345611096b59`.
Branch: `codex/map-terrain-history`. Final reviewed head, clean pack digest and
served revision belong to the attached PR/task receipt; the base is not the
candidate identity. This slice changes editor behavior across maps without
changing a shipped layout, simulation, prices, map admission or save schema.

## Motivation and observable acceptance

The authoring queue explicitly lacked terrain gesture history. Resource patches
and scenario edits already had their own Undo/Redo; terrain mistakes required
repainting or retaining an earlier export. The default Map Studio path now has
Undo Terrain and Redo Terrain above the grid. A completed paint/height/obstacle
gesture or hill generation can be reversed and reapplied; obstacle-displaced
resource nodes return exactly. This is an authoring-tool observation from source
and its production-handler fixture, not a new human playtest finding.

Art backing and the interaction storyboard are in the authoring contract. The
buttons reuse current editor styles and the existing landscape/grid treatment.
New art, runtime composition and generated assets are N/A.

## CPU and tool evidence

The registered `scripts/map-studio-terrain-history.test.mjs` uses the real host
pointer handlers, history buttons, draft storage, map population, packers and
portable validators in the existing JSDOM fixture. Rendering, audio, pointer
capture APIs and other subpanels are stubbed; its clicks do not prove browser
pixels, physical pointer-capture behavior or uncoached usability.

The checks cover:

- Exact typed-layer restoration, floating obstacle height, optional terrain seed
  and displaced resource identity/stock/wildlife fields/selection.
- Ground paint/reset, all height tools, obstacle rectangles/round strokes and
  Erase; one undo step per complete drag and no mutation during preview.
- Cancel, lost capture, foreign pointer refusal, no-op redo preservation and
  branching; map load/resize and independent resource edits invalidate history.
- Count and byte eviction on a 256² grid; exact undo at the retained boundary.
- Undone-state autosave, portable JSON validation/export, and draft recovery
  with unchanged cells and fresh history.

Focused execution passes 145/145 checks: ten new history/gesture checks plus
all 135 resource-brush, draft-recovery and import-error regressions. Independent
review found one adjacent fixture missing idle pointer state; the fixture and
anchor-picking assertion were corrected, and review has no remaining findings.
Runtime import regressions plus history pass 75/75; dependency boundaries,
existing strict type checks, documentation links and whitespace checks pass.
The disposable native saved-map restart scenario passes. Packed serving passes
the new module's actual bytes and headers, HEAD, malformed sibling denial and
normal client import closure.

The first fast-lane attempt stopped at 1,127/1,354 checks because the sandbox
could not open a cleanup fixture's loopback socket. It does not claim a suite
pass. The loopback-authorized rerun passed 1,140/1,354 registered checks, then
stopped at the unchanged cloud-install fixture: macOS resolved its checkout to
`/private/var/...` while the assertion expected `/var/...`. The isolated fixture
reproduces that failure; with the supported canonical `TMPDIR=/private/tmp`,
all five cloud-install checks pass. The 213 unrun fast checks and full simulation
lane remain unclaimed. Final committed clean package identity is retained in the
task/PR receipt. Ordinary rendered acceptance stays separate.

## Remaining verification and next action

Identified clean release and staging HTTP identity are separate receipts.
Ordinary rendered editor acceptance remains incomplete. The intended supported
cloud browser has the previously recorded provisioning/capability blocker in
[cloud setup](cloud-environment.md#optional-browser-readiness-and-known-provisioning-blocker);
this slice does not retry unchanged cloud setup or use stopped Mac browser tests.
The map-making owner retains a bounded capture after supported capability is
available, including the source/release/served identity and image hashes.

Use a disposable ordinary Tiny Terraced Vale room. Open Map Studio as Azure,
paint a curved Forest stroke over a resource marker, undo and redo it, then
raise/smooth ground and generate hills with a different seed. Verify visible
preview/commit/restoration, keyboard focus, canceled pointer behavior and the
controls at a narrow viewport. Download/reimport, Save & Play, and reconnect to
confirm the authored geometry under normal game rules. Preserve the prior map;
publishing intentionally resets only the disposable match. A tool or package
pass does not close these rendered/in-game observations.
