# Packed-game Worker work-cycle capture

The [capture helper](../scripts/worker-work-cycle-capture.mjs) records one bounded
Food work cycle through the normal packed client, real seat socket and default
presentation. It exercises manual Move as a reference, Gather approach, productive
Food harvest, full-load automatic return, one deposit, automatic resumption and
fresh productive harvest. A final explicit Stop ends the workload. It does not
publish a map, inject resources, change a checkpoint or recruit other Workers.

The same file exports the disjoint hosted-runner adapter `id = 'worker-work-cycle'`
and `run({ browser, origin, evidenceDirectory, pack })`. The CI owner supplies a
qualified sandboxed browser, a healthy loopback packed supervisor with Open Field
and an unused idle seat, a clean pack object and an evidence directory. The adapter
owns only its new page/context; it does not launch or dispose the supplied browser
or server. The standalone CLI below owns those resources and performs preflight.
No shared workflow, renderer-qualification or client-hook changes are required to
invoke this interface.

The implementation owner owns this recipe and its contract checks. The cloud
testing owner executes it at an identified clean release and inspects the images;
the release delivery owner separately identifies any containing staging build.
[Hosted qualification #323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323)
and [run 37215311854](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854)
establish an available hosted capture route for the earlier build. They do not
establish a pass for a later Worker route change.

## Run at an identified clean revision

Use the existing non-root hosted Chrome executor with its normal browser sandbox.
The helper performs its own WebGL2 capability probe before starting a game. Use
locked dependencies and a clean checkout; dirty packages are rejected. No browser
sandbox bypass or user profile is supported.

```bash
node --test scripts/worker-work-cycle-capture.test.mjs
node scripts/pack-railway-release.mjs > /tmp/worker-work-cycle-pack.json
node --input-type=module - /tmp/worker-work-cycle-pack.json <<'NODE'
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const pack = JSON.parse(readFileSync(process.argv[2], 'utf8'));
execFileSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
  cwd: pack.directory, stdio: 'inherit',
});
NODE
node scripts/worker-work-cycle-capture.mjs /tmp/worker-work-cycle-pack.json /tmp/worker-work-cycle-evidence
```

The helper launches the packed `room-supervisor.mjs` on an owned loopback port
with the shipped Open Field map and fresh temporary room data. Its entry is
`/?rendererCapture=environment-state`: the existing read-only rendering capture
switch exposes the real client command hook and keeps default art. Home base is
centered through the ordinary camera button. Commands name exactly one idle owned
Worker; browser commands attach the current generation through the existing
client. This is a command-hook workload, not a cursor hit-testing or discoverability
test. The manual reference returns to the original starting area before Gather;
its actual fractional Gather start is recorded.

## Evidence and acceptance boundaries

`work-cycle.json` separates source SHA/dirty state, clean release digest, served
loopback build identity, served entry/vendor byte hashes and decoded packed asset
hashes. It records six advancing real-game phases, each with a full-page PNG,
canvas PNG, 48 RGBA readback samples and digests. The files retain received Worker
coordinates, generation, task, typed cargo and productive-work receipts. Received
Food stock, own bank and owned cargo prove one ten-Food deposit and conservation
within the wire's cent rounding tolerance. Every sampled unselected Worker keeps
its task and cargo. Harvest screenshots wait for at least half a Food of productive
work, allowing the normal interpolation to settle. The existing source remains
finite and productive throughout;
depletion, obstacle safety, drop-off scoring, cold recovery and comparative route
cost require the implementation owner's separate authoritative checks.

Only an allowlisted numeric projection of received own-seat state is retained.
Food nodes must already be disclosed in that seat snapshot and belong to the
shipped plain-Food allowlist. Opponent banks/Workers, raw messages, sessions,
notices, socket URLs and arbitrary error text are excluded. Samples are capped at
2,400; overflow fails the run. Browser exceptions, unexpected resource failures,
missing phases, blank/stale readbacks, cargo loss, unintended recruitment and
cleanup failures also fail. A blocked capability result exits 3 with no game-frame
claim; a contract or execution failure exits 1.

The cloud testing owner must inspect the six screenshots and canvas images for
the actual Worker approach/return/resumption trajectory and attach the identified
run artifacts. A passing local hosted pack establishes that selected build's
rendered work cycle. It does not establish staging deployment, staging served
identity, an unassisted player observation or broader navigation performance.
The release delivery owner and cloud testing owner retain those separate next
steps. Local cloud preflight on 4 October 2026 reported `sandbox-unavailable` and
`storage-unavailable`; no local rendered work-cycle pass is claimed.
