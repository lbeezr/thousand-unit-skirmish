# Ordinary Worker route capture

The registered [`worker-routes` scenario](../scripts/renderer-worker-route-scenario.mjs)
uses the version 1 [shared capture context](../scripts/renderer-capture-context.mjs)
and the [ordinary capture runner](renderer-qualification.md#ordinary-build-feature-adapter-and-dispatch).
It exports `id = 'worker-routes'`, `contextVersion = 1` and `async run(context)`.
Importing it starts no workload. The runner owns qualification, packed server,
instrumented pages, the three-minute deadline, browser errors and cleanup; the
scenario neither launches nor disposes those resources.

The scenario navigates both isolated pages to ordinary `/`. The host uses Create
Room, selects **Threefold Basin** (`veyrholds-threefold-basin`) in the normal map
dropdown and preserves human Skirmish version 1. The second human uses Join Room;
both use Ready and the host uses Launch. This canonical 192×192 map has disclosed
plain neutral Food near the starting Workers and admits this normal human match.
Home base is centered once with the ordinary camera button. Camera framing,
ordinary zoom and default assets remain unchanged across the phase captures.
There are no preview flags, diagnostic query URLs or world-state injections.

One fresh owned Worker performs ordinary Move toward the disclosed Food as the
manual reference, returns by Move to the same settled cell center, and then
receives Gather. The recorded manual and Gather starts must match within 0.02
world units. Commands go through the existing live client command hook, which
attaches the current generation; they name exactly that Worker. This exercises
the real orders, rather than pointer hit testing. Automatic return, deposit and
resumption receive no additional command. A final explicit Stop ends the cycle.

## Execute at the identified clean source

The CI/capture owner selects the reviewed source containing the scenario and
Worker fix in **Ordinary game capture**, with case `worker-routes`, or includes it
in one common `all` batch. Record the exact checkout SHA, clean release digest and
run URL in the feature PR before assessing the output. Reuse the workflow's
single sandboxed WebGL2 preflight, locked production dependency install and
clean pack. Its callable commands are:

```sh
node --test scripts/worker-work-cycle-capture.test.mjs scripts/renderer-worker-route-scenario.test.mjs scripts/renderer-worker-route-joint.test.mjs
node scripts/renderer-feature-capture.mjs --check worker-routes
node scripts/renderer-feature-capture.mjs PACK_JSON EVIDENCE_DIRECTORY worker-routes
```

The joint CPU test imports the actual shared loader and invoker and loads this
actual adapter. Only qualification, pages and screenshot bytes are synthetic in
that test; it establishes no rendered-game pass. The shared context module is a
required dependency. There is no standalone fallback for this registered case.

## Retained evidence and review

The case produces 11 source-bound checkpoints, in this order:

| Checkpoint | Required observation |
| --- | --- |
| `manual-departure` | Manual Move has displaced the Worker at least 0.5 units. |
| `manual-midpoint` | Manual Move has displaced it at least 2 units and advanced at least 1 unit from its departure capture. |
| `gather-departure` | Gather travels from the matched start with zero cargo. |
| `gather-midpoint` | Gather has displaced it at least 2 units and advanced at least 1 unit from its departure capture. |
| `food-harvest` | A productive `gather-food` receipt carries at least 0.5 Food. |
| `return-departure` | Automatic return leaves the source with the full 10 Food. |
| `return-midpoint` | The full-load return has advanced at least 1 further unit. |
| `deposit-resume` | Own bank gained exactly 10 Food; Gather resumes with zero cargo. |
| `resume-midpoint` | Resumed travel has advanced at least 1 further unit. |
| `food-resumed` | Fresh productive harvesting draws more finite Food. |
| `manual-stop` | Explicit Stop leaves the Worker idle after the single deposit. |

Each checkpoint retains the shared `color.png` and manifest, plus the actual
postrender `worker-canvas.png` and `worker-route-state.json`. The latter binds the
source SHA/release digest, canonical map-definition hash, own seat, command target,
Worker generation/coordinates/task/typed cargo/action, frame number/time, 48 RGBA
samples and image hashes. The existing shared readback's `frame.worker` is retained
alongside received economy state. Economy/frame readback precedes the shared
screenshot; an `afterScreenshot` snapshot explicitly brackets that receipt.
These are separate observations, not a claim of an atomic screenshot/state pair.

`manual-stop/worker-route-summary.json` includes all safe received samples,
issued command payloads, matched starts and conservation. Payloads are recorded
after the live client hook returns true; they are not command acknowledgements.
Actual received state transitions establish the behavior. Own bank plus the selected
source's finite stock plus owned Food cargo must conserve within 0.011 Food, the
wire's cent-rounding tolerance. All unselected Workers keep their original tasks
and cargo. Samples are capped at 2,400 and overflow fails. The projector retains
only own Workers/bank, allowed disclosed plain-Food nodes and owned drop-offs;
it excludes raw messages, sessions, room codes, socket URLs and opponent rows.
The exact 11-checkpoint order is required. Every phase validates owned identity,
economy conservation, advancing frame/time/canvas and its expected task/cargo;
midpoints require displacement from their preceding departure or deposit image.

The resource owner inspects the full screenshots and canvas sequence for manual,
Gather, return and resumed trajectories at ordinary zoom, retaining the run's
artifacts before expiry. Numeric receipts and advancing canvas images support
that review. No existing safe animation identity hook establishes a gait/clip
acceptance here; the Foot animation owner retains that separate check. Before
and after builds each need their own source, release and screenshot receipts.
This bounded plain-Food case does not establish obstacle-route coverage, broader
path-cost comparisons or staging served identity.

## Current evidence boundary

The local sandbox preflight was blocked once on 4 October 2026 with
`sandbox-unavailable` and `storage-unavailable`; its retained report is
`/tmp/worker-work-cycle-evidence/browser-preflight.json`, with zero rendered game
frames. It was not retried or bypassed. The earlier
[hosted qualification run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854)
establishes an available hosted backend at its recorded source, not acceptance
of this ordinary case. Actual identified-build hosted artifacts and resource-owner
image inspection remain open. Release delivery separately records any staging
build's served identity and ordinary-game observation. The older
[standalone Open Field helper](qa-worker-work-cycle-capture.md) keeps its existing
entry and default behavior; its captures do not substitute for this normal-room
scenario.
