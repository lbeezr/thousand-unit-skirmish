# Vaelora portal QA — 11 October 2026

[Brand plan](vaelora-brand.md) · [Entry contract](game-entry.md) · [Art studies](art-direction/vaelora-brand-v1/README.md)

Owner: branding/portal chat `01a12b79`. Baseline source:
`e0ced8ad21081cdbd221561b784f16575035e5da`. Source changes, test results,
clean release identity, served/deployed identity and rendered use are separate
claims. The generated boards and schematic do not prove browser behavior.

## Scope and planned checks

Ordinary root has a world-first Vaelora hero, one prominent fresh-game choice,
validated Resume, existing Practice/rules, friend rooms, tools and native dialogs.
Preserved Bellweather concept art is exactly admitted and included in release
inputs. World/guide links are reading paths and never launch a match.

Use existing entry, navigation, presence, Practice and PvE checks, the real
`game-menu-scenario.mjs`, client static admission/import checks, docs and type
checks, and a clean release package. Record actual results below after execution.

## Executed source and process checks

- Existing entry/navigation/presence/Practice/PvE suite: **63/63 passed**.
- Existing real menu scenario: **15 groups passed**, including isolated creation,
  both-seat lobby launch, stale/auth-interrupted/strict Resume, Practice mode choice,
  all 13 current labs, real Worker deposit and cold checkpoint recovery. Imported
  delivery: 140 entry modules and 4 mode-UI modules. This is DOM/process evidence.
- Type checks passed for both configured JavaScript and Node boundaries.
- Runtime import boundaries passed: 252 modules, 487 local edges, no cycle edges.
- Static admission passed for 146 imported client modules. Added source-byte
  equality for the Bellweather copy and exact admission/private-source checks.
- Documentation links passed: 709 Markdown files, 5,412 local links.

The initial sandboxed native scenario could not bind loopback (`listen EPERM`);
the normal approval path allowed the same existing disposable scenario to pass.
The older menu art assertion initially accepted only Worker/Barracks sources;
it now also verifies the selected Bellweather bytes. No check was disabled.

Before integration, the read-only Railway trigger query showed staging's sole
`main` trigger (`a70f9350-09fd-4c61-9bc4-3567051455e2`) and **zero production
triggers**. GitHub main reported no protection/ruleset checks. This supports the
standing staging integration path without changing deployment configuration.

## Initial browser restriction (before the user exception)

This task is attached to macOS; no managed cloud execution surface is available
to run the required `node scripts/renderer-capability.mjs --launch` there. The
[cloud setup record](cloud-environment.md#optional-browser-readiness-and-known-provisioning-blocker)
retains the latest known normal-sandbox provisioning failure. Do not retry that
unfixed cloud or substitute the stopped Mac testing path. No rendered pass is
claimed. This owner retains acceptance; the environment provider owns the cloud
prerequisite. Source/HTTP checks can proceed independently.

When the supported browser is available:

1. Record source SHA, clean pack digest and the exact served identity separately.
2. At 1440×900 and 1024×768, load ordinary `/`. Observe art/heading/button
   readability, pending and unavailable server states; verify no clipping.
3. At 390×844, 320px width and 200% zoom, observe stacked actions and natural
   scroll. Initial focus must not skip the world banner. Check keyboard focus,
   anchor destinations, native Join/Settings dismissal and return focus.
4. New Game opens the actual admitted solo match. Return to root and observe
   validated Resume. Create/Join a friend room; inspect both-seat lobby entry.
5. Open Practice rules, change to an admitted mode and launch; open Settings,
   edit a preference, close and reopen. Record actual response/errors.
6. Inspect image loading failure, reduced motion and the concept-art caption;
   all controls remain legible and available according to server authority.

No ordinary match image, deployment or release success is inferred from a mockup.

## Clean release and publication receipt

Tested implementation source: `dfc8c4da6437fb933293db6adb3cfd5ba562a62b`.
The clean pack reports `sourceDirty: false`, 1,489 files and digest
`sha256:91492ac1938f515eb46a21fd7572cbaf40b67e6eb7d4cb2fa4352c36866d7c1b`.
It contains `assets/ui/vaelora-brand-v1/bellweather-map.png`; neither generated
study is a release input. The existing packed-release scenario passed guarded
startup, Basic Auth HTTP/WebSocket, all declared public paths, imported modules,
image/atlas hashes and volume-path contracts. These are local process/HTTP checks.

Markup/CSS sanity found unique IDs, resolvable local anchors, three native
regional disclosures and 100 parsed CSS rules. Declared solid text/background
contrast: paper/pine 12.74:1, sage/pine 8.66:1, primary label/brass 6.01:1,
reading copy/parchment 6.61:1, copper/parchment 4.54:1. Image compositing,
actual wrapping and native keyboard behavior still require rendered inspection.

Publication attempt: `git push origin codex/vaelora-brand-portal` was rejected
by GitHub with `permission denied`. A subsequent metadata read returned
`viewerPermission: READ` for `lbeezr/thousand-unit-skirmish`. No PR was created,
no merge occurred and no redesigned revision was deployed. This is repository
write access for the terminal connection, not an unavailable CI run or a visual
milestone hold. The later account audit below resolves the connection mismatch.
This chat retains publication, integration and exact staging verification.

This later documentation receipt does not alter the tested implementation.

## Material iteration and authorized local browser proof

The user explicitly answered “Allow a portal-only local browser check”. This
exception supersedes the local restriction for this task's portal check only.
The normal-sandbox capability helper passed on Chrome 154.0.8037.99 / Apple M2
([receipt](art-direction/vaelora-brand-v1/browser/renderer-capability.json)).
The [browser report](art-direction/vaelora-brand-v1/browser/report.json) records
the material working patch over `b9e86bcd3b5b4464b4d88690be332ee232a2c762`,
with `sourceDirty: true`, exact tested-file hashes, and an isolated authenticated
server whose build identity was `unknown / unavailable`. These are actual
portal captures, not generated studies or deployed-release images.

At 1440×900, 1024×768, 390×844 and 320×844, there was no horizontal overflow
or clipped button text. Targets remain at least 44px tall; initial focus does
not skip the world banner. Foliage stays clear of labels and never receives
pointer input. Settings persisted the changed audio preference; Settings/Join
Escape returned focus. Join displayed invalid-invite feedback. Practice rules
and regional field notes opened. An intercepted New Game request exercised
pending and 503 recovery without allocating a room. Reduced motion removed
transitions; forced colors removed decorations and preserved controls. No
console errors or browser exceptions; zero connected players at completion.
Desktop, narrow, error and forced-color captures were visually reviewed.

Two PNG capture passes hit ENOSPC; smaller JPEG captures with browser caching
disabled completed successfully. All owned browser profiles, servers and data
were cleaned up. The disk also intermittently rejected final evidence writes;
only task-owned duplicate storage was reclaimed. Original generated assets
remain preserved, with exact source/runtime hashes in the
[material manifest](../assets/ui/vaelora-brand-v1/materials-manifest.json).

After the material edits: 63/63 entry/navigation/presence/Practice/PvE tests,
both type-check configurations, exact admission/hash checks (146 modules),
and docs (709 files, 5,422 links at that checkpoint) passed. Entry logic and
simulation were unchanged. Explicit 200% browser zoom, blocked-image loading,
rendered saved Resume/game launch and deployed
acceptance remain open. Publication uses the authorized connection identified below.

### Clean material release receipt

Committed material source: `dcf78dc09319c498ac184417ade6f5dc2c43bf01`.
The clean package reports `sourceDirty: false`, 1,492 files and digest
`sha256:c6acd28cd12544ba0359f87396a05ded1ccb9c860c8355478c106f01ca449e30`.
Both WebP materials are included; generated source PNGs and browser captures
stay outside the release. Every browser-tested runtime hash matches this
committed source. The development captures' unknown served identity remains
distinct from this package identity.

The packaged HTTP scenario initially classified every non-PNG/CSS/HTML/JSON
admitted path as JavaScript and rejected the correct `image/webp` response.
Its expected MIME mapping now explicitly includes WebP. The complete scenario
then passed authenticated HTTP/WebSocket, exact public paths, build identity,
asset hashes and volume contracts. This later test/documentation correction
does not change any packaged runtime file. No PR, merge or deployment occurred.

## Brand bible v0.2 documentation checkpoint

The user requested design guidelines, colors/materials and button families/states,
with research into Warcraft and League references. The existing brand guide is
now the [brand and interface bible](vaelora-brand.md), with a source-linked
[research note](art-direction/vaelora-brand-v1/brand-research.md) and an
[interactive documentation reference](art-direction/vaelora-brand-v1/interface-reference.html).
It separates the selected foundation from proposed semantic additions and
records current production differences. No runtime interface or launch behavior
changed in this documentation slice.

The [source validation receipt](art-direction/vaelora-brand-v1/interface-validation.json)
records three palette switches, selected-state toggling, inert demonstration
feedback, unique IDs, local anchor/asset resolution and 13 solid-color contrast
pairs. Those are DOM/source checks, not rendered-layout or texture-composite
acceptance. Documentation links passed (710 Markdown files, 5,437 local links
before this receipt was added); whitespace checks passed.

The in-app browser tool rejected the `file:` reference preview under its URL
security policy. No alternate browser surface or protocol workaround was used.
The bible/reference files were opened as local Codex file artifacts. Visual
layout, actual focus rendering and textured contrast for this new documentation
specimen remain unverified. Earlier portal browser evidence remains unchanged.

## Publication connection correction — 11 October 2026

The terminal is authenticated as `lbliii`, with read-only access to the target
fork and admin access to the older parent repository. The existing connected
GitHub app is authenticated as `lbeezr`; repository metadata and the collaborator
permission endpoint confirm admin/write access to `lbeezr/thousand-unit-skirmish`.
Railway's live staging configuration and the deployment guide both identify this
fork's `main` as the intended source. No new login, permission grant, repository
switch or deployment-configuration change is needed. The earlier claim that the
user had to restore repository access was too broad.

The branding owner is publishing through that existing authorized GitHub app.
Current remote `main` remains `e0ced8ad21081cdbd221561b784f16575035e5da`, so the
prepared branch has no upstream conflict. Local tested source, API publication
commit, clean release and actual deployment identities remain separate receipts.

## Published PR and independent review

[PR #637](https://github.com/lbeezr/thousand-unit-skirmish/pull/637) publishes the
prepared tree as `f0b83484fbf998a00b056822f6de9ece92f3ef98`. All 63 focused entry
tests, the 15-group menu scenario, types, import/asset checks, documentation links
and the packed HTTP/WebSocket scenario passed again at that exact head. Its clean
1,492-file package has the same `c6acd28c…449e30` digest recorded above.

An in-app browser loaded that identified package at 1440×900. An isolated local
proxy then returned HTTP 404 for the hero, brass and oak images. Desktop and
320×844 fallback controls remained readable; the narrow page measured 320px with
244px controls and no overflow. Settings opened and Escape returned focus. No
console errors were captured and no match was entered (zero connected players).
Owned test servers, disposable data and tabs were cleaned up. The available zoom
keyboard action did not change the browser viewport; explicit 200% zoom remains
unverified. The documentation specimen's earlier `file:` restriction is unchanged.

The user authorized an independent read-only review agent and a bounded staging
New Game → portal → Resume check after deployment. Review found one P2:
unconditional `preventScroll` could initially focus a control below the viewport.
The correction focuses an initial action only when its complete bounds are
visible; otherwise document focus remains at the page start, with the existing
Skip to play link available. It never takes focus from a control the user has
already selected. Focused regression cases cover a partly visible action and an
off-screen Settings fallback during an unavailable room service. The corrected
65-test entry suite and type checks pass. Final review, release identity and
staging acceptance follow in the PR's live checkpoint.
