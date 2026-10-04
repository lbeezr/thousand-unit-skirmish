# First-play tasks and evidence

[QA acceptance](qa-vertical-slice.md#lightweight-external-playtest-protocol) ·
[Player guide](playing.md) · [Testing strategy](testing-strategy.md)

Owner: HUD integration lane, with the cloud testing owner supplying qualified
render execution. Keep the compact, dismissible HUD and current approved art.
This protocol measures the ordinary entry and complete-match loop; it does not
prescribe a redesign or replace the existing two-pair acceptance target.

## Why and what was audited

The [Letters for Letters postmortem](https://itch.io/devlog/1572857/letters-for-letters-postmortem.amp)
(3 July 2026) reports players confusing gestures across screens, missing progress
and asking what the goal was. Apply that lesson here by observing attempts and
explanations, rather than treating working controls as proof of understanding.

Source audit at `1e7b9d0fde23bd3675f286d98a127fad374102be`, 4 October 2026:

| Ordinary step | Existing cue / automated coverage | Question for first play |
| --- | --- | --- |
| Menu → room | New Game, Create Room and Join Room distinguish purposes; entry, Practice and lobby contracts cover admission/readiness. | Can players start the intended solo or friend match without choosing a diagnostic route? |
| Room → match | Ready, Launch match and waiting text explain host/guest roles; lobby tests cover both seats. | Do both players notice readiness, launch and settings invalidation? |
| Match → select → move | Team/selection text, LMB/RMB hint and contextual actions; selection/order fixtures check eligibility and input routing. | Can a newcomer identify their units and connect selection with a destination? |
| Gather → build → train | Production / Build & train, resource/cargo and placement feedback; economy/construction/roster contracts cover paid actions. | Does the initial MOVE / ATTACK hint hide the context-sensitive Gather idea? |
| Combat → victory | Attack move, stances, Objectives, HOW TO WIN and result text; rule/result contracts exist. | Does the player distinguish fighting from this match's actual winning rule? |
| Result → restart | Play again or WAITING FOR HOST TO RESET; rematch contracts cover reset. | Does the PvP host expect immediate play instead of another ready/launch cycle? |

A fresh agent reviewed shipped markup, lobby copy and player-facing guides
without reading tests or implementation first. It proposed the gather/build and
restart questions above, and found conflicting guidance: the player guide calls
Millrace the default PvP capture scenario, while the entry guide distinguishes
Skirmish and Objective Control. These are text-based hypotheses/documentation
ambiguity, not reproduced player failures or rendered observations. Record the
actual map/mode and displayed rule; do not teach Millrace's rule for every match.

## Repeatable novice session

Use the existing two pairs of newcomers when actual participants are available;
record prior RTS/game experience and use anonymous session IDs. Begin in separate
fresh browser profiles at the ordinary root menu, with default hints/settings and
approved runtime art. Provide only the authorized URL/access and the goal prompts
below. Do not require guide reading, name buttons/inputs in advance, expose debug
tools, enable preview flags, alter stocks/timers or force a victory. Spontaneous
help use is part of the observation; record it.

Primary run: ordinary Create Room / Join Room with two human seats and the
displayed default setup. A separate fresh run covers ordinary New Game versus AI;
record its admitted map/mode and keep solo results separate. Repeat with seats
swapped, but label the second match as learned use, not another first-play sample.

| Task prompt, given one at a time | Observer records; do not show this column to the player |
| --- | --- |
| Start a match with the other person. | First menu choice, invite/join attempts, seat, Ready/Launch discovery and launch time. |
| Tell me which side you are, where your units are and what ends this match. | First two minutes: explanation, evidence they point to, help openings and actual rule; mark misunderstanding even if corrected later. |
| Choose one Worker and send it somewhere of your choice. | Selected role/team, first attempted input, selection cue, command feedback and observed displacement. |
| Increase your stored wood. | Target/input attempts, cargo versus bank understanding, first deposit, pauses and unintended orders. |
| Make a building that can train infantry, then train one. | Menu discovery, selected builders, site attempts, rejection/cancellation feedback, payment, completed building and spawned unit. |
| Check the winning rule in detail, close it, then continue with your selected units. | How details were found, close/Escape, focus and retained selection; compact objective/deadline feedback if this mode has it. |
| Fight the opponent while keeping some Workers gathering. | Army selection, first attack/attack-move attempt, target/order feedback, route decisions, losses and intended versus observed result. |
| After the match ends, explain the result and play another match with the same opponent. | Winner/reason on both screens, player explanation, host/guest actions, lobby readiness and time until the new match runs. |

Allow up to 30 minutes for the complete match; record a timeout/unfinished match
instead of manufacturing an ending. Record task start/end and attempts even if
the player abandons or later succeeds. If blocked for two minutes, record the
block before offering help; any coached completion is assisted. Technical
recovery and game/control hints are interventions with exact time and wording.
Ask the existing exit questions about intention, deciding factor, alternatives
and confusion. A qualifying result requires an uncoached completed match,
understood result and usable rematch; otherwise retain the specific incomplete
step. A small sample guides the next reproduction, not population statistics.

## Three separate evidence records

| Record | What can be claimed | Current status |
| --- | --- | --- |
| Automated correctness | Real shipped-HTML objective bindings, focus/selection retention and closed urgency updates in jsdom; existing rules/entry/economy/rematch contracts. | Nonvisual execution recorded in the owning PR. Renderer/network/layout are stubbed; this is not a first-play session. |
| Fresh-agent heuristic | Text/cue review and testable confusion candidates at the pinned source above. | Completed without browser/captures; no interaction or human comprehension claim. |
| Human first play | Real uncoached attempts, interventions, outcome and the player's own explanation at an identified build. | Not run; zero participants/sessions are claimed by this slice. |

For each actual run retain source SHA, clean pack digest, served `/health`
source/release identity, map/mode/opening/seed, seat, browser/OS, viewport/DPR,
settings and exact command/environment. Use `passed`, `failed`, `blocked` or
`not-run` per task. Keep access credentials, seat tokens, private assets and
participant identity out of the evidence. Attach permitted capture paths/hashes,
console/asset failures and actual observations; do not fill unknown results with
the expected behavior.

## Next cloud acceptance

[Renderer qualification PR306](https://github.com/lbeezr/thousand-unit-skirmish/pull/306)
is integrated, but successful hosted execution/artifact inspection was not
available to this lane at the audit. The cloud testing owner retains that gate.
Do not retry the unchanged blocked local sandbox, use Mac testing or weaken
security. No rendered evidence is claimed here.

Once that environment is qualified, the HUD owner runs the table through the
ordinary root menu on a clean normal build. Verify served identity first; capture
menu, lobby/readiness, selection/order feedback, gathering/payment/construction,
combat, open/closed Objectives, result and rematch. Preserve multiple advancing
game frames, readable UI PNGs and capture hashes with console/shader/asset logs;
repeat objective dismissal for both seats with keyboard focus and live countdowns
where the selected mode supports them. The qualification's prepared movement
fixture alone does not establish this normal-entry sequence. A scripted browser
pass remains separate from the subsequent human first-play sessions. Route each
observed failure to one bounded reproduction and the smallest appropriate fix.
