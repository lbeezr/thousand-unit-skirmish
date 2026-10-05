# Exact-source CPU evidence at 172c53f3

Source: **172c53f3669b3564503cdbdfae2c83637517d235**, clean, including PR419
and PR420. This archive retains every byte of both executions' console output,
the normal CI JSON report, explicit operator interruption, and both actual Tiny
failure envelopes and decoded opening/final checkpoints, trace, metrics and last
filtered decision views. No source edits or new simulations were used to extract
the records.

The normal unsharded full attempt is **incomplete**: 930 checks passed, one native
cleanup was operator interrupted, and 383 were unrun out of 1,314. The completion
event scenario printed a pass summary, then did not exit for six minutes; its
client-close finalizer has no deadline. The retained operator record identifies
the exact two owned processes/signals. This was not a natural assertion failure.
All four 100% coverage floors, Medium, Tiny and dedicated off-phase recovery were
unrun in this full attempt. No prior subset pass completes this report.

The separate unchanged `node --test scripts/pve-tiny-search.test.mjs` diagnostic
at this same SHA passed two cases and failed two. Seeds `[20260925,0]` remain
ongoing at tick 108000 / 3600 seconds in both authored@1 and skirmish@1. Each failed
record has 876 trace entries and both last decision ticks 107970. Reversed seeds
`[0,20260925]` complete and strictly replay/reset at 2711 seconds, winner 1 by
elimination, in both modes. This diagnostic does not extend the full report. No
gameplay cause has been established.

Each failure directory contains:

- `envelope.json`: the exact emitted gzip/base64 envelope, with raw byte count
  and SHA256.
- `record.json` and `record.json.gz`: the complete decoded bytes and original
  compressed bytes. The two records are 748978 bytes each.
- `initial.json`, `final.json`, `trace.json`, `metrics.json` and
  `lastDecisionViews.json`: convenient decoded components.
- `summary.json`: exact source/identity/tick/checksum metadata.

`MANIFEST.json` lists every other archive member with length and SHA256.
`verify-evidence.py` uses only Python's standard library to verify all member
hashes, both complete packets against the actual retained console, their decoded
components, and the full/diagnostic distinction. To verify and extract:

```sh
python3 verify-evidence.py cpu-qualification-172c53f3.zip --extract=/tmp/cpu-172c53f3
```

The delivery receipt on [PR420](https://github.com/lbeezr/thousand-unit-skirmish/pull/420)
pins the separate unmerged evidence commit and archive SHA256. Fetch that exact
commit from the same authorized repository, then obtain the archive and verifier:

```sh
git fetch origin EVIDENCE_COMMIT_FROM_PR420_RECEIPT
git show FETCH_HEAD:evidence/cpu-qualification-172c53f3.zip > /tmp/cpu-qualification-172c53f3.zip
git show FETCH_HEAD:evidence/verify-evidence.py > /tmp/verify-cpu-172c53f3.py
python3 /tmp/verify-cpu-172c53f3.py /tmp/cpu-qualification-172c53f3.zip --extract=/tmp/cpu-172c53f3
```

AI 01a10297 owns Tiny diagnosis from these actual checkpoints and filtered views.
Fixture 01a1085f owns the cleanup follow-up recorded at
[PR419#5987167121](https://github.com/lbeezr/thousand-unit-skirmish/pull/419#issuecomment-5987167121)
and the separate parent-confirmed Medium schema30 fixture migration gap. Full CPU
qualification remains open after owned fixes. This evidence branch is not merged
into main or deployed; it makes no rendered, browser or deployment acceptance claim.
