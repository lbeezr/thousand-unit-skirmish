# Underbough paint transition review — 1 October 2026

Eight full-game captures compare `paintEdges=legacy` with `paintEdges=organic`
on identical copied Underbough Rootways and Bellweather Millrace exposed-soil
studies. Ground sources and variant settings are identical. Only Underbough
uses the new authored-paint profile. Its ordinary pair was visually inspected:
soil edges fade more gradually and the patch outline is less rigid, but the
improvement is modest at this scale. Browser errors were empty. Bellweather
retains the existing transition profile.

The Underbough authored-paint mask uses three separable five-tap blur passes
instead of two, and shared displacement amplitude of 1.2 mask pixels (0.6 cell)
instead of 0.6 pixels (0.3 cell). Shared weights remain normalized before layer
compositing. Mist and forest cover keep their existing profile. This is visual
paint only; it does not change terrain labels, collision, elevation or resources.
It does not remove broad grid-derived shapes or supply ecological scenery.

`terrain-blend-scenario.mjs` passed existing and organic-profile checks for
normalization, catalog-order independence, deterministic reopening, retained
interiors and unchanged source map. Renderer proof checks expected kit texture
loading and cache isolation. No hosted or performance result is claimed.
