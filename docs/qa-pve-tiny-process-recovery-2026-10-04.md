# Tiny normal process recovery: human control and PvE receiving case

[Cold foundation proof](qa-pve-fog-restart-phase-2026-10-04.md) · [AI backlog](pve-policy-backlog.md) · [Testing](testing.md)

Owner: Opponent AI. The parent authorized ordinary development PvE availability
for verified Terraced Vale only; the mode owner retains admission/capability,
launch selection and normal New Game changes. Browser/served acceptance remains
required to call that outcome complete, but it must not prevent exposing the
normal option needed to test it. Other maps and ordinary human defaults are not
part of this receiving case.

The agreed public request uses `mode: pve`, explicit `skirmish@1`, map seed 0 and
policy seed 20260925. [The receiving boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/242#issuecomment-5975583689)
records ownership and the expected returned launch/map/mode metadata. This PR
changes only the scenario, CI registration and owned evidence guides. It does
not change or secretly override availability.

## Observed control

The initial default PvE run on main `be656c47` stops at the normal status's
`ordinarySetup.pve.available: false`. That is a retained admission dependency,
not a passed PvE run. The script's explicit `pvp` profile then runs the same
ordinary Skirmish HTTP/WebSocket recovery path with two human seats. CI registers
that control while the receiving availability change is pending.

The strict human control passes on unchanged canonical Terraced Vale, 160×160
cells, 24 opening units and 150 food/250 wood per seat. It uses actual player
commands and three real supervisor shutdowns/new OS processes, with the saved
checkpoint read for assertions and never edited or injected:

- A paid 175-wood Barracks foundation remains after same-process session resume
  and after supervisor/worker process restart. The human reclaims its original
  seat/player and match, and the building completes normally.
- Two recruits debit the current Infantry definitions' exact 100-food cost.
  A second process restart retains their queue and remaining training, then
  both complete. Ordinary Stop orders stabilize deposits for exact food/wood
  comparisons across restore, so grants and duplicate charges cannot satisfy
  the acceptance. Normal gathering resumes and cargo subsequently deposits.
- The normal host reset removes prior production and trained generations,
  returns the 12-unit human opening and 150/250 banks, clears enemy sight and
  retains map/mode metadata. A third process restart retains that new epoch;
  the second normal human seat then gathers.

Every welcome checks fog is enabled with the 6,400-byte 160×160 mask, hides the
opponent's banks, and requires disclosed enemy units/buildings to survive the
already tested visibility projection. Generation identity, actual mode/map,
same seat/match and paid production remain authoritative. No provider, resource
grant, custom map or test enablement flag is involved. Session tokens stay only
in memory; the printed receipt contains checkpoint hashes, not credentials.

The strict control restores at ticks 4, 381 and 1,462 in its recorded run;
recruits 24/25 finish and deposit continuation is observed at tick 1,461. These
ticks describe that real-time run and are not deterministic duration assertions.
Existing client/mode/foundation controls separately pass 65 checks. The reviewer
identified permissive balance comparisons in the initial scenario design; the
strict control above uses stopped deposits and measured costs instead.

```sh
node scripts/pve-tiny-process-recovery-scenario.mjs pvp
node scripts/pve-tiny-process-recovery-scenario.mjs pve
node --test scripts/client-rematch-recovery.test.mjs scripts/pve-mode-adapter.test.mjs scripts/pve-fog-restart.test.mjs
```

The default script profile is `pve`; it requires actual normal admission and
must not be reported as passed from the `pvp` control. The post-enablement PvE
run additionally verifies the reserved AI seat, persisted seeds, and restarted
opponent gathering after reset through the same public flow. It remains pending
until the mode-owner implementation is integrated and executed.

## Limits and retained ownership

This is local ordinary protocol and graceful OS process-restart proof, not a
deployed browser capture or an abrupt crash test. The reset case runs during a
live match; it does not establish rendered defeat/result rematch. Client CPU
controls cover terminal-result retention and stale-socket/rematch handling, but
they are not rendered acceptance. Existing exact native AI games and the
separate cold-foundation evidence retain their original source qualifications.

Raw controls are retained at `/workspace/pve-tiny-process-evidence-2026-10-04`.
Mode/runtime and staging owners retain normal development availability and
identified served/browser verification. The AI owner retains executing and
interpreting the receiving PvE recovery case and addressing failures. Source
availability is authorized for development testing; completion remains open.
