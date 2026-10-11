# Vaelora interface research and color decisions

11 October 2026 · [Brand bible](../../vaelora-brand.md) · [Component reference](interface-reference.html)

Vaelora should feel inhabited, crafted and clear to use. The user selected a
world-first entry, a textured primary action, decorative borders and foliage,
then requested a reusable system for color, materials and button states. The
recommendation is to keep that selected brass action and define the surrounding
system carefully. Familiar colors can still form a distinct identity when
their material, placement and meaning are consistent.

## Reference observations

| Primary source | What it supports | Decision for Vaelora |
| --- | --- | --- |
| [World of Warcraft homepage](https://worldofwarcraft.blizzard.com/en-us/) — visually inspected 11 October 2026 | The observed top navigation and hero use prominent filled gold actions, with a quieter outlined alternative over world art. This is a current website observation, not a universal rule for WoW's client. | Keep a strong action hierarchy and a world-led setting. Do not equate a reference brand with a single permanent button color. |
| [Blizzard's Dragonflight HUD/UI revamp](https://worldofwarcraft.blizzard.com/en-us/news/23841481) — historical, 2022 | Blizzard describes preserving the UI's personality while reducing clutter and improving customization/accessibility; the article discusses refreshed creature ornament around the action bar. | Give decoration a clear relationship to the world. Reduce its weight on play surfaces and protect functional visibility. |
| [Riot's Hextech UI architecture](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui) — historical, 2017 | Riot describes shared components, type/palette styles, coordinated motion and layered button internals. | Define reusable families and states with separate visual layers, instead of painting a different button for every screen. |
| [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | Color alone must not carry information or distinguish a meaningful state. | Add labels, symbols and clear selection/focus treatments. |
| [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | Contrast requirements apply to text and necessary component/state cues. | Measure actual pairs and textured states; keep decorative rules separate from functional boundaries. |

No internal Blizzard or Riot brand manual was used. Their proprietary artwork,
fonts, sounds and component files were not imported. The older League Nexus
“Visual Language of Hextech” URL redirected to the League homepage during this
research, so it is not used as evidence for that article's contents.

## Gold, green and red

These are our design interpretations, not claims about universal color psychology.
The interactive reference holds the panel and hierarchy constant so the action
colors can be compared in context.

| Direction | Strength | Tradeoff and decision |
| --- | --- | --- |
| Worked brass on pine | Continues the chosen textured button and has strong light/dark separation. Fits everyday craft, maps and inherited objects. | Familiar fantasy territory. Make it recognizably Vaelora through warm matte grain, botanical edges and restrained use. **Recommended foundation.** |
| Celadon on pine | Connects the action more directly to the living landscape; softer emphasis than gold or red. | Already proposed for selection. Making it the primary action would require a separate persistent-selection treatment. **Retain as an exploration.** |
| Crimson lacquer with brass edges | More martial emphasis and a classic fantasy feel. | Competes with the proposed destructive role and warms the whole client substantially. **Retain as an exploration; use crimson for deliberate loss in the proposed system.** |

Our distinctive combination is dark pine, parchment, warm brass, pale celadon,
hand-painted oak and thin geometric rules. It does not require an exotic hue.
Red can appear in world art, banners and regional palettes while functional
crimson remains stable in controls. Match/team colors remain a separate system.

## Acceptance and remaining decisions

The user has selected the foundation and material direction. The semantic
extension is proposed for review. The component reference uses actual retained
brass/oak assets and live text, not a generated screenshot of a UI. Alternate
action colors change only the documentation specimen; they do not recolor the
production portal.

Remaining art decisions are a custom wordmark/crest, a cohesive small icon
family, dedicated parchment/lacquer textures if they prove useful, and regional
frame variants. Produce and compare these only against a concrete surface.
Ambient animation and UI sound require separate state/audio review.
