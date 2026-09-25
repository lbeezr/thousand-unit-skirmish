# Audio direction · first 1v1 pass

The audio palette is original procedural Web Audio synthesis in `src/audio.mjs`. There are no recorded samples, external assets, dependencies, or third party licenses. Cues use soft woodlike triangle tones for commands, clear sine intervals for completion and objectives, and a short rough downward tone for rejection. The synthesized wind and sparse three note phrases sit well below the effects mix.

| Event | Player meaning | Trigger |
| --- | --- | --- |
| Selection | The new unit or building selection registered | Explicit selection action only |
| Move, attack, gather, build | The command was sent | Local command, once per order regardless of unit count |
| Reject | The order or production request failed | Server notice or offline send |
| Queue | Production or research began | Server confirmation |
| Complete | A friendly building, unit queue, or research completed | Friendly state transition or team notice, with a shared cooldown |
| Battle, selected unit, base alert | A new fight, selected force taking damage, or building under attack | Aggregated friendly snapshot damage |
| Resource empty, base lost | Gathering must redirect or a friendly production building was destroyed | Server notice, with independent limits |
| Objective gained or lost, victory, defeat, draw | Match state changed | Server event or winner transition |

Combat uses one event decision per snapshot. Ordinary damage only signals a new engagement after nine quiet seconds. Selected force and base alerts have independent twelve second limits. There are no per-unit attack, hit, death, gathering, or footstep sounds: those would mask orders and scale with 2,000 units. Routine cues cap at twelve oscillator voices; critical alerts may use up to twenty.

The first user gesture unlocks Web Audio. Match Controls has enable, volume, and ambience/music controls, a playback status, and saved local settings. Muting, setting volume to zero, or hiding the tab suspends the audio context. Music phrases occur about every 34 seconds and yield for ten seconds after tactical alerts. The atmosphere ducks for 2.4 seconds under tactical alerts. The audio mix can be judged during a full 1v1 playtest; the current levels are a first pass, not a measured loudness master.
