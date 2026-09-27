# Performance baseline — 25 September 2026

[Documentation index](README.md) · [Current measurement guide](testing.md#performance-measurements)

**Historical local measurements:** source `f1d6482`, Apple M2/24 GB,
macOS 26.6.2, Node 24.9.0, headless Chrome 153.0.8010.53.

| Profile | Recorded outcome |
| --- | --- |
| Checkpointed movement, 3 × 12 s, 2,000 units | Tick p95 6.311–8.871 ms; maxima 10.005–24.611 ms. |
| Checkpointed attack move | Failed the 100 ms ceiling with a 187.704 ms tick under substantial host load. |
| Two-seat snapshot bandwidth | 120,744-byte p95 JSON payload; 308.43 KiB/s combined compressed WebSocket egress. |
| Browser, three 10 s movement waves | Frame p95 16.7 ms; callback p95 3.5 ms; zero tasks over 50 ms. |
| Reconnect and slow reader | Scenario passes recorded; the slow reader reclaimed its seat after disconnect. |

These synthetic localhost results do not establish Railway capacity, packet-loss
behavior, windowed presentation, GPU completion, or the cause of the failed tick.
Other work was active on the measurement host.

The [full baseline record](archive/2026-09/performance-reliability-baseline-2026-09-25.md)
retains run IDs, hashes, raw summary values, commands, and limitations. Use
[testing](testing.md) and the [QA protocol](qa-vertical-slice.md) for a new run.
Control host conditions, keep the source/workload comparable, and preserve failed
results alongside passes. Hosted capacity requires a separate identified server
and network profile.
