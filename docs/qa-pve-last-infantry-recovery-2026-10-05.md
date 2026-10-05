# Last-price Infantry recovery — 5 October 2026

[AI queue](pve-policy-backlog.md) · [Previous retention boundary](qa-pve-tiny-failure-evidence-2026-10-05.md)

Owner: Opponent AI `01a10297`. This receipt establishes a bounded production
defect and paid replacement. It does not establish the cause or resolution of
the full Tiny completion failure, balance, a deployment or rendered acceptance.
Art backing: N/A; no presentation changes.

## Exact retained input and current capabilities

The CI owner's [PR420 handoff](https://github.com/lbeezr/thousand-unit-skirmish/pull/420#issuecomment-5987283081)
provides an [immutable qualification archive](https://raw.githubusercontent.com/lbeezr/thousand-unit-skirmish/206e6edd2cc50686adc82d41747cab6e75691def/evidence/cpu-qualification-172c53f3.zip).
It was independently downloaded and all44members verified, including both
gzip/base64 failure packets and their decoded component digests. Archive:
537183bytes, SHA256 `99838b932bec32f05cf464bd8d92f711bc77199384147e9356ff82c6343f18f0`.
Source: clean `172c53f3669b3564503cdbdfae2c83637517d235`.

The original full CPU attempt is incomplete:930passed,1operator interruption,
383unrun. Its separate unchanged Tiny diagnostic reports seeds `[20260925,0]`
ongoing at3600seconds in authored@1 and Skirmish@1; reversed seeds complete
at2711seconds and exactly repeat. These are distinct execution receipts.

The policy already gathers, recruits and researches, replaces Workers, replants
finite Farms, rebuilds producers, scouts, pursues disclosed targets, answers
observed raids and regroups. Its reserve rule has one demonstrated gap here:
both terminal packets leave seat0 with no living units, no Worker producer or
paid queue,59.99999999994134food,0wood,15available population and one complete
idle Barracks. Its authoritative Infantry option is available at50food, yet
the policy requires100food including the normal50food reserve. There is no
Worker or pending Worker recovery to earn that reserve back.

The enemy previously issued nine Barracks-id2 assaults, last at tick78630;
its terminal filtered view discloses no enemy building. The footprint has mixed
remembered/unknown cells, and11surviving assault units are moving at tick108000.
There are no retained intermediate decision views establishing exactly when
sight was lost. No specific search, route or hidden-building-memory cause is
inferred from the surviving Barracks or from issued coordinates.

## Bounded mechanism controls and change

At the unchanged source above, strict restore of each complete terminal
checkpoint followed by30seconds of seat0's normal policy buys nothing and
spawns nothing. A matched diagnostic fork sends one ordinary `train` command
after10seconds: it pays50food, spawns an Infantry at tick108661, and retains
9.999999999941338food. Both complete controls exactly repeat in each native
mode. Hidden enemy bank changes leave the filtered observation equal.
The forced command belongs only to this diagnosis.

The runtime change in [production policy](../src/pve-production.mjs) releases
the Infantry food reserve only when there are no living owned units, no paid
queues, no living Worker-producing building (including foundations), and an
explicitly available Infantry option. It buys through the existing authoritative
command. Worker recovery remains first; a living or queued unit restores the
normal reserve. Opening delay, retry backoff, population, prices, military/roster
caps, blocked exits and all other purchases retain their existing rules.
No targeting, map, admission, native authority, movement or victory code changes.

## Regression and acceptance boundary

[Fixture provenance](../scripts/fixtures/pve-last-infantry/provenance.json)
retains both exact original checkpoint objects as compact JSON/gzip, about20KB
each, with compressed and decoded SHA256 checks. No authority field is edited.
[Native recovery helper](../scripts/pve-last-infantry-case.mjs) strictly restores
each whole checkpoint, uses the normal policy, checks hidden-bank/unit projection,
and cold-restores the real paid queue in a new fixture with both-seat snapshot
equality under the existing Worker transient row17 clearing contract. All
authority fields remain equal. It compares every repeated command, notice and
final checkpoint.

The nine [focused regressions](../scripts/pve-last-infantry.test.mjs) cover both
seats and three policy seeds at budget boundaries, preserved Worker/queue/
availability guards, bounded retry, and the two real seat0 native failures.
Candidate native forks pay at tick108300, restore the paid queue at that tick,
spawn at108661, and finish with one living paid Infantry and10food after30seconds.
Baseline forks have zero living units. All candidate commands are accepted;
both whole replays repeat exactly. Both short forks remain ongoing.

These tests are imported by the existing registered Worker recovery check;
they do not replace, weaken or change the full Tiny3600second completion tests.
Initial focused execution passed9/9 on the candidate over main `dbc83db3`.
The independently reviewed final head `fb73e908` passed122focused checks and
925syntax checks, plus import/type/docs checks; [PR428](https://github.com/lbeezr/thousand-unit-skirmish/pull/428#issuecomment-5987657009)
merged `67295aef` with an identical tree and nine postmerge recovery passes.
The [sealed124member evidence](https://raw.githubusercontent.com/lbeezr/thousand-unit-skirmish/642714d2ea40e931de90b1511154cee28027d6ef/evidence/pve-last-infantry-recovery-67295aef.zip)
retains exact source, original packets, matched controls, independent review and
validation; a scoped pass is not a full CPU-suite pass.

Next: AI `01a10297` owns unchanged full-match completion diagnosis. The parent
reports CI `01a10378` is running fresh immutable full qualification containing
this fix and separate fixture corrections, with complete failure evidence;
the exact frozen revision/result receipt is pending here. Do not duplicate its
full Tiny match run. Resume diagnosis from any resulting failure packet, using
checkpoint, accepted ledger and filtered views before bounded controls. Paid
Infantry recovery succeeds; full-match completion remains unestablished.
Movement `01a107ba` retains route/clearance work;
no movement dependency or cause was established by this fix. Ordinary served
Tiny recovery acceptance remains with AI and shared staging/capture owners;
deployed revision and rendered observation are unverified here. Medium stays
human-only and current two-seat Frontier rules remain intact.
