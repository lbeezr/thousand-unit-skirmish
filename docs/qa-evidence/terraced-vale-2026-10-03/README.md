# Terraced Vale evidence

[Findings and limitations](../../qa-terraced-vale-2026-10-03.md)

`static-audit.json` extracts this candidate from the repeatable checkout audit,
retaining exact source/input hashes, routes, placements and resource markers.
`native-accepted.jsonl` is the accepted paid/native case at its identified source; its last
record is the complete report with its exact source and map hash. Browser and
hosted acceptance remain false. `diagnostic.json`, collector output and server
logs describe one fog-enabled 2,000-unit movement diagnostic. Reproduce with
`node reproduction.mjs /absolute/checkout /absolute/output-directory`.

`package-receipt.json` identifies the clean local release source/digest and equal
map hashes. `packed-entry.json` is the actual server/Practice/Worker check from
that package; reproduce with `node packed-entry-reproduction.mjs /absolute/packed-directory`.
This directory is not the published Railway artifact. Browser preflight and
staging-ready stderr retain actual environment failures.

Historical harness runs remain separate from accepted evidence:

- `native-first-attempt.*`: assumed a final MOVE notice but received early PLANNING.
- `native-second-attempt.*`: assumed generic BUILD ORDER; paid builds acknowledge their own label.
- `native-third-attempt.*`: public building records omit the authoritative footprint.
- `native-history-waiter.jsonl`: completed under cb73bc9a, but a historical-state waiter could falsely satisfy the food check. Its internal `passed:true` is not accepted evidence.
- `native-before-main-rebase.jsonl`: corrected waiter at da646901; full paid/recovery/Practice case passed on the earlier core. It is not final integrated-core acceptance.
- `native-home-record-failure.jsonl`: both paid expansions completed; the combat probe incorrectly looked for home TCs among added buildings. The separate public `homeTownCenters` collection is used in the corrected case.
- `native-integrated-combat-failure.jsonl`: new aggressive idle actors attacked returning miners; cross-base arrivals passed, economy funding timed out. The final scenario uses normal No Attack orders for peaceful measurements, then explicit building combat.

`post-mode-core/` repeats the diagnostic and packed entry after the mode/crowd
integrations, with separate source/package identity. It does not repeat the full
paid sequence.

`manifest.json` records evidence byte hashes and dispositions. Source revisions
are those measured, not the later documentation/review commit. The diagnostic
host was shared and not isolated; no controlled hardware comparison, browser
frame/memory/appearance, hosted capacity or full mass-army arrival is claimed.
