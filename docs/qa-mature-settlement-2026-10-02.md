# Paid settlement inspection fixture — 2 October 2026

[Testing](testing.md) · [Maps/resourcing plan, Epic 6](maps-resourcing-saga-plan.md#epic-6--mature-settlement-and-composition-fixtures)

The small mirrored fixture uses the existing map format and ordinary paid
build/research/train commands. It creates no authored roster, new currency or
gameplay type. Each seat starts with twelve units and a home Town Center, then
builds three Houses, an expansion Town Center, Storehouse, Barracks, Archery Range,
Stable, Watchtower and Workshop. All six current technologies and every current
unit role finish through real queues. The resulting population is 23/44 per seat,
with twenty units and eleven buildings including the home.

| Per-seat payment | Food | Wood |
| --- | ---: | ---: |
| Ten buildings | 150 | 1,650 |
| Six technologies | 795 | 700 |
| Eight products, including two Workers | 440 | 280 |
| Total | 1,385 | 2,630 |

The declared bank is 2,000 food / 3,000 wood; the paid remainder is 615 / 370
before subsequent gathering. Every accepted command records its actual bank
debit. Node stock, bank credit and carried cargo reconcile through restart.
The harness checks both seat dispatch orders, connected ground and server
placement admission, paid prerequisites, production exits, mixed-unit movement,
identity/queue/research recovery, and a host reset to the opening bank and roster.
It runs at normal simulation speed and takes about four minutes per order.

Generate a reusable checkpoint into a **new** directory:

```sh
node scripts/mature-settlement-scenario.mjs --output=/tmp/vaelora-mature
```

`match.json` is the untouched server-written developed checkpoint, captured before
the reset proof. `map.json` is the input map; `manifest.json` records fixture
version, ruleset, Git revision/dirty state, checkpoint SHA-256, payments and proof
results. Generated checkpoints are local artifacts, not committed assets.

To inspect it from this checkout, copy the checkpoint so inspection cannot modify
the retained evidence, then start the ordinary standalone server:

```sh
run_dir=$(mktemp -d /tmp/vaelora-mature-inspect.XXXXXX)
cp /tmp/vaelora-mature/match.json "$run_dir/match.json"
RTS_HOST=127.0.0.1 PORT=3001 RTS_GAME_MODE=pvp RTS_MAP=maps/open-field.json \
  RTS_MATCH_STATE_PATH="$run_dir/match.json" \
  RTS_CUSTOM_MAP_DIRECTORY="$run_dir/maps" node server.mjs
```

Open `http://127.0.0.1:3001`. The checkpoint restores its embedded fixture map;
the configured Open Field is the startup fallback. Existing seat recovery windows
may delay taking a free seat. Restarting this copy preserves the developed state;
the host's reset returns to the opening fixture, and rerunning the harness rebuilds
the paid settlement.

This is a forty-unit flat-map inspection fixture. Rendered appearance, crowded
regional economy, combat, elimination and objective victory are separate checks;
no browser screenshot or visual acceptance is claimed here.
