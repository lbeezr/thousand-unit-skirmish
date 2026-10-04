# Main-menu existing-art study — 3 October 2026

[Entry contract](game-entry.md) · [Native entry QA](qa-game-entry-2026-10-03.md#browser-steps) · [HUD art mapping](hud-art-integration.md)

## Bounded presentation

The ordinary root menu retains **Thousand Unit Skirmish**, its current tagline,
and New Game, Create Room, Join Room, conditional Resume, Map Studio and Settings.
The composition uses the existing dark green palette, a compact serif title,
and one decorative Worker/Barracks vignette below the title. Action labels have
their own solid backing; artwork never sits behind them. No new lore, logo,
faction selection, title change or game-state meaning is introduced.

Runtime changes belong to `src/game-menu.css`. The existing brand/action
selectors remain the interface with the room/menu owner's entry module;
HTML, routing, Resume, authentication, invitations and dialog hooks are unchanged.
CSS pseudo-elements have empty content and ignore pointer events. They neither
add focus stops nor request the game renderer or a room connection.

## Reused sources

| Source | Composition | Provenance |
| --- | --- | --- |
| [Human Worker source](../assets/ui/portraits/human-worker-source.png), 1774×887 | Existing selection viewport: x970/y0/270px, displayed at 112px on desktop and 80px below 520px width | [Portrait source record](../assets/ui/portraits/PROVENANCE.md) |
| [Azure Complete Barracks](../assets/buildings/barracks-sprite-test-v1/runtime/barracks-complete-azure.webp), 640² | 200px supporting silhouette on desktop; omitted below 520px width | [Barracks source record](../assets/buildings/barracks-sprite-test-v1/PROVENANCE.md) |

Both source files are unchanged, already server-allowlisted and in the release
Docker context. CSS references add about 1.22 MB of existing image bytes to the
desktop menu's first uncached visit; the narrow menu uses only the Worker source.
Art has reserved dimensions and does not block room-service lookup or controls.
Source quality, downloading and style acceptance remain separate observations.

## Readability and evidence boundary

Choice descriptions and footer use the existing muted text color. Disabled
choices retain readable text instead of reducing the whole button's opacity.
The current bright focus outline covers buttons and Join/Settings inputs.
Tools wrap, long status messages wrap, and the menu remains vertically scrollable.
Below 760px width the menu stacks; below 520px the Worker moves beside the title.
At 560px height or less the vignette is omitted and content starts at the top.
There is no new animation.

The private first visual study uses the shipped images, actual menu labels and
declared CSS geometry with substituted fonts and approximate text flow. It is
explicitly a **static study, not a native browser or engine capture**. Its files
stay outside the repository; no new public concept pixels are published.
Cloud browser preflight reports `sandbox-unavailable` and `storage-unavailable`.
No sandbox bypass is used. Focus, rendered wrapping, Retina sharpness and human
style acceptance still require the native recipe below.

## Mac capture recipe

Use this PR's final merge locally with the ordinary room supervisor and existing
authentication. Follow the [entry behavior recipe](qa-game-entry-2026-10-03.md#browser-steps), then capture:

1. Fresh profile at `/`, 1280×800: all three entry choices and tools are visible;
   title and vignette stay separate from action text. Record build, browser,
   device, viewport/DPR, room-service state and image hash.
2. 390×844 and 320×568, also with a valid saved Resume: no horizontal clipping;
   every action/status is reachable by scrolling. Worker never covers the title.
3. 844×390 and 1280×540: vignette is absent, choices begin near the top, and
   vertical scrolling reaches the footer. Repeat at 200% browser zoom.
4. Tab through choices, tools, Join code, Cancel/Join, and Settings inputs/Done.
   Focus remains visible; Escape returns to the opener. Screen-reader output
   contains the existing names and statuses, with no decorative art names.
5. Temporarily fail the room-service request and block both images. The original
   labels, status guidance and Settings remain usable; art failure causes no
   layout shift. Root still opens no `/ws` or renderer. Enter a game and verify
   the existing Worker/Barracks selection portrait has not changed.

These are owner-run QA steps, not a publication or merge hold.
