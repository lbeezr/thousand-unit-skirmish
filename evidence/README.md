# Immutable full CPU qualification at 67295aef

Game source: **67295aef1a744bde9000ce2c3d12e00b78a922e0**, clean, including
PR423 schema composition, PR426 completion-event cleanup, PR427 pending-goal
fixture correction and PR428 paid last-Infantry recovery. The normal unchanged
unsharded full command was:

```sh
npm test -- --report=/workspace/cpu-qualification-67295aef/report.json
```

This attempt exited 1: **1,105 registered checks passed, one failed, and 217
were unrun**. The failed Tiny batch passed two tests and failed two. Both
`[20260925,0]` cases remain ongoing at tick 108000 / 3600 seconds in authored@1 and
skirmish@1; reversed `[0,20260925]` cases complete and strictly replay/reset at
2711 seconds, winner 1 by elimination. Both actual failure packets are retained:
783867 decoded bytes and 968 trace entries each. This is a normal unchanged
assertion failure, without an operator interruption or a separate diagnostic.

Audio response, WebSocket frame and deflate-offer 100% floors passed; the shared
production/research floor was unrun. Dedicated off-phase recovery and the later
elimination scenario were also unrun. Cleanup 7/7, pathing replay 11/11, Worker
recovery 33/33 and migrated Skirmish targets/replay 78/78 passed in this attempt.
The narrower paid-Infantry controls passed within Worker recovery, while complete
Tiny completion remains failed.

There are 1,323 registered checks. All 1,314 preceding registrations retain their
exact arguments and order, with nine additions. All four coverage floors retain
100% line, branch and function requirements. The 44 installed package versions
match the unchanged lockfile. The source, assertions, simulation ceilings and
other original budgets were not changed during this attempt.

`qualification.json` summarizes the actual closed result and each coverage floor.
`report.json` is the normal CI report, `terminal.json` retains the exit/source,
and `suite.log` preserves the complete stdout and stderr, including the emitted
CI JSON. A failed fail-fast attempt leaves its later checks explicitly unrun.
`fullCpuSuitePassed` is true only when every registration completed successfully
in this one full attempt.

`tiny-evidence-index.json` records any actual Tiny noncompletion packets from this
run. When emitted, every original gzip/base64 envelope and byte-identical decoded
record is retained under `tiny-failure-evidence/`, together with separate opening
and final checkpoints, accepted-command/restart trace, metrics, and last filtered
decision views. A zero packet count is interpreted with the actual Tiny check
status; it does not imply that an unrun check passed.

PR428's previously reported paid Infantry spawn in 22.03 seconds, cold restore
and exact replay establish only their narrower checkpoint scope. No previous
subset or checkpoint success contributes to this report. The preceding bd7,
f293 and 172c attempts and the complete 172c failure archive retain their hashes,
recorded in `freeze.json` and checked before sealing.

`MANIFEST.json` lists every other archive member with byte count and SHA256.
`verify-evidence.py` uses Python's standard library to verify all member hashes,
source/registry/result consistency, actual coverage-floor statuses, the console
CI report, and every emitted Tiny packet against its decoded components:

```sh
python3 verify-evidence.py cpu-qualification-67295aef.zip --extract=/tmp/cpu-67295aef
```

The linked delivery receipt pins the separate unmerged evidence commit, direct
archive download and SHA256. That data commit is separate from the game source
above. It has no runtime or deployment effect. Full CPU evidence does not close
ordinary-game, browser, render, release or staging acceptance. AI 01a10297 retains
the policy's downstream runtime acceptance; any concrete failed contract retains
its identified implementation/fixture owner and next action in the receipt.
