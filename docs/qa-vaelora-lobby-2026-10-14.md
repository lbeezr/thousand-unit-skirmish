# Vaelora pregame lobby — 14 October 2026

[Room contract](room-lobby.md) · [Brand bible](vaelora-brand.md) · [Creative direction](creative-direction.md)

Owner: **Unify game art direction and lore**, chat
`01a13a8a-37a9-7812-800a-12e48c842b52`. Initial source baseline:
`c2a0f4168b36bbc36e7d9c9c62474fab55905261`. This is a runtime presentation
increment with ordinary rendered acceptance still incomplete.

## Outcome and backing

Create Room / Join Room now use a lobby treatment that carries the selected
Vaelora client language into match preparation: pine/parchment, a restrained
brass frame, serif identity, square-cut working controls and the existing
brass material on an enabled Launch match. The dialog uses its own scoped
tokens; shared match-mode controls outside it retain their existing styling.

Backing: [selected immersive client study](art-direction/vaelora-brand-v1/immersive-client-study.png),
[brand component reference](art-direction/vaelora-brand-v1/interface-reference.html),
[journey stages 2–3](art-direction/creative-atlas-v1/journey-storyboard.svg) and
the new [six-state lobby storyboard](art-direction/creative-atlas-v1/lobby-state-storyboard.svg).
The latter was natively rasterized and visually inspected as a schematic source
study. It is not a browser capture. Existing material provenance remains in the
[brand manifest](../assets/ui/vaelora-brand-v1/materials-manifest.json); no new
image generation or redistribution is introduced.

Azure's square and Ember's diamond accompany the already written seat identities.
The full selected map label is repeated below the native picker so it can wrap
on narrow layouts. Header copy says Frontier **rules**, keeping gameplay identity
separate from a fictional allegiance. The confirmed Ready state receives a
distinct boundary; pending requests never invent readiness or a changed map.
Rejected commands use the actual message on an error surface. Reconnecting
retains literal recovery text. Disabled labels remain opaque/readable; controls
have 44px minimum height, a separated focus ring and reduced-motion behavior.
Forced colors preserve labels, team shapes and an inset ready outline.

This changes no room command, seat authority, mode eligibility, readiness reset,
launch predicate, saved session, simulation rule or chat delivery behavior.

## Checks and evidence scope

- 37 existing lobby/chat/mode DOM tests passed before and after the change.
  Added assertions to existing transition tests cover a plain full map label,
  unchanged map/readiness during pending work, confirmed Ready, spectator
  withdrawal, pending/error styling meaning and reconnect precedence.
- Both strict type projects and runtime architecture checks passed.
- Native `room-pregame-scenario.mjs` passed all sixteen named groups, including
  two real DOM lobbies, mode/map configuration, stale revisions, readiness,
  launch races, spectator/rejoin authority, recovery, publication and rematch.
  Its first sandboxed loopback listen returned `EPERM`; the same disposable
  fixture passed with the authorized loopback permission. No browser was used.
- All 73 pregame/launch/chat protocol tests passed with their authorized
  disposable loopback fixtures; the sandbox-only attempt had refused listeners.
- The lobby stylesheet parsed as 47 top-level rules. The client asset allowlist
  scenario passed with all 153 imported modules served. Documentation links and
  diff whitespace checks passed. Clean packaging and packed HTTP checks are
  recorded with the integration checkpoint when completed.

These are contract/process/source checks. They do not establish browser layout,
actual colors over texture, keyboard appearance, forced-color rendering or game
acceptance. A clean package and HTTP hashes cannot replace those observations.

## Integration and continuing acceptance

### Verified source and staging delivery

[PR #671](https://github.com/lbeezr/thousand-unit-skirmish/pull/671) merged the
runtime increment as `115cbebd8b30dd4f7968b3db6fc5c5167f4cab47`. Its checked
implementation head is `a997bea73f910eef96f357525f33cf7e4044d173`. The connected
GitHub publication tree matched the reconciled local tree exactly.

The [clean local package receipt](qa-evidence/vaelora-lobby-2026-10-14/clean-package.json)
records `sourceDirty:false` at that implementation head and digest
`sha256:0082e33843dfc9c34a2195fbeb44aa53875a92de4f50598f4b533251ff3f94d9`.
The packed HTTP scenario passed guarded startup, authentication, WebSocket,
import/asset delivery and private-path behavior. CSS, UI-module and brass-material
bytes matched the source. Both type gates, architecture and documentation passed
again at the containing main; 37 DOM tests also passed at the published head.
No full CPU-suite or independent-review pass is claimed.

Railway staging deployment `f13f0ef5-c3c5-4bf4-b165-6656e77076cd` reached
`SUCCESS` on 14 October at 14:09:49 UTC. The
[live HTTP receipt](qa-evidence/vaelora-lobby-2026-10-14/staging-http.json) verifies
the protected `/health` identity at merge source `115cbebd`, matching exact
served lobby CSS, UI and brass hashes/MIME, plus 142 served import checks.
Its identity origin is **railway-git**: deployment cleanliness and pack digest
are **unknown/null**. The local clean-package digest is not attributed to the
deployed image. These are source/byte observations, with zero browser game frames.

The existing staging configuration admits public gameplay. The older generic
smoke stopped at `/` because it expected 401 and observed 200; that run is not
reported as a pass. A scoped read-only probe verified the actual configured
policy: unauthenticated `/` and `/ready` return 200, while `/health` and GET
`/api/rooms` retain 401. Existing credentials stayed in memory, and no settings,
rooms or security policy were changed by this delivery check.

### Retained ordinary-room verification

Default consumers: `index.html` loads `src/room-lobby.css`; `src/main.js` constructs
the ordinary `createRoomLobby` dialog. Both source files already have exact public
admission and release inclusion. The brass WebP is already admitted and shipped
for the portal. No preview flag, new loader, HTTP path or packaging rule is added.

The existing staging service is the relevant user environment; production
promotion is outside this increment. Source SHA, clean release digest and exact
served/deployed revision must be recorded separately. Implementation/source
integration is a milestone; rendered acceptance is not claimed from it.

**Retained by this owner:** ordinary host and guest entry, waiting/both-ready,
pending/rejection/reconnect, spectator reservation, chat draft and launch states
at the identified containing release. Check 1280×720 and narrow/short windows,
keyboard focus, long map labels, reduced motion, forced colors and image failure.
The dialog must remain scrollable, text must not be obscured, the texture must
leave Launch readable, and the match must enter the existing Obsidian HUD.

No cloud browser executor is exposed to this local task. The repository's
general Mac-browser restriction remains in force; earlier portal/HUD exceptions
are scoped to their owning tasks. No Mac game browser launch or unchanged cloud
startup retry was performed. Resume normal-room capture when a supported cloud
executor with the repository's successful WebGL2 capability receipt is available.
This blocks only rendered acceptance; integration, packaging and platform reads
continue independently.
