# Optional model-opponent research

[Documentation index](README.md) · [Normal PvE](play-vs-ai.md) · [Observation contract](gameplay-command-observation-contract.md)

**Status:** default-off fake-provider prototype. The repository has no real
provider client, credential, endpoint, or room-runtime caller for this helper.
Normal solo play uses the deterministic opponent. Real-provider integration,
activation, and paid evaluation remain separate decisions.

## Boundary

`attachModelProposalOpponent` in `src/pve-model-proposal.mjs` is inert unless
explicitly enabled with an injected provider, synchronous conservative
`estimateRequest`, and `reportsUsage: true`. Tests inject local fakes only.

Inference stays outside the 30 Hz simulation callback. The helper sends an
immutable PvE observation v1 plus proposal version, opaque request ID, source
tick, and output-token cap. The provider never receives raw maps, checkpoints,
welcome messages, credentials, hidden state, or free-form scenario instructions.

The trusted adapter binds the request to match epoch, seat, schema, and tick.
Accepted actions enter the ordinary WebSocket command path; the authoritative
server still validates them.

## Proposal shape

```json
{
  "proposalSchemaVersion": 1,
  "requestId": "trusted-runtime-reference",
  "action": { "type": "gather", "ids": [23], "nodeId": "visible-wood" }
}
```

Actions are limited to `wait`, `gather`, and `attackMove`. Each schema is strict
with no extra fields. At most 64 unit IDs must come from the bound observation;
resource references must be visible and coordinates finite/in bounds. The model
cannot set team, seat, order token, tools, endpoints, scripts, or arbitrary payloads.
A trusted adapter adds the order token. `wait` consumes a slot without a command.

## Enforced prototype limits

| Limit | Value |
| --- | --- |
| Minimum request interval | 5 seconds |
| In flight | One; coalesce to newest observation |
| Requests per match | 120 sent, including timeouts |
| Observation | 256 KiB; reject rather than truncate |
| Estimated input | 65,536 tokens including fixed prompt/schema overhead |
| Output | 256 tokens and 4 KiB JSON |
| Deadline | At most 2 seconds |
| Decision age | At most 60 ticks |
| Conservative match reservation | $1.00 |

Reserve worst-case estimated input plus full output allowance before sending.
Require normalized usage/cost on completion; reservations are retained rather
than refunded. Unsupported estimates, exhausted budgets, or invalid usage stop
new model requests while deterministic play continues. These limits do not
authorize provider spending.

## Fallback and isolation

Errors, timeout, stale binding, invalid schema/reference, oversized output,
budget exhaustion, and correlated command rejection hand the next due action to
the deterministic policy. Each slot issues at most one command. Late responses
cannot dispatch after fallback, reset, or close; no immediate retry loop.

A future provider adapter belongs server-side or in a trusted worker. Bound DTO
preparation/parsing and measure tick/start-lag impact. Never await inference inside
`simulateTick()` or bundle credentials into the browser.

## Evaluation

```sh
node scripts/pve-opponent-scenario.mjs
```

The fake tests cover default-off behavior, fog/authority, strict envelopes,
binding, stale results, budgets, one-in-flight scheduling, and fallback.
Before any provider trial, define a seeded comparison against deterministic PvE:
map/seat outcomes, economy/production progress, objective decisions, latency and
decision age, rejections/timeouts, token usage/cost, and simulation impact at the
supported roster sizes. Keep bounded aggregate metrics rather than raw prompts
or private player data. Local snapshot bandwidth is not a measured DTO token budget.
