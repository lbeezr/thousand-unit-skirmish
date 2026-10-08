---
name: thousand-unit-skirmish-start
description: Start or resume work in Thousand Unit Skirmish; check cloud setup, reuse running local servers, and diagnose requested browser work without resetting game state.
---

# Start or resume Thousand Unit Skirmish

Use this skill when starting or resuming work in this repository, checking its
cloud setup, or starting its local preview. Read repository `AGENTS.md` and
[cloud configuration](../../../docs/cloud-environment.md). Resolve commands from
the checkout root; never assume its absolute path.

1. Preserve the current branch, edits, running processes, rooms and checkpoints.
   Check `git status --short`, `node --version` and, when installation is uncertain,
   `npm ls --depth=0`. Require Node 24+. Do not run installation on every turn.
   If dependencies are missing, use `bash scripts/cloud-install.sh` only within
   authorized setup work; otherwise report the prerequisite.
2. Choose checks for the actual task. Use `node scripts/ci.mjs --list` to inspect
   the registry when needed, then focused checks. Startup does not require a full
   suite, asset generation, deployment or browser capture.
3. For a requested preview, check `/health` at the known local server origin and
   confirm that it belongs to this checkout/task before reusing it. If the port
   is occupied by an unknown process, inspect it or choose another explicit port;
   do not stop it or spawn a duplicate supervisor. Start `npm start` only when a
   server is needed and absent. Defaults are `127.0.0.1:4173`. Preserve existing
   room/checkpoint directories. Use fresh temporary fixture data only for an
   explicitly disposable test; prefer existing repository fixtures.
4. For requested browser work, reuse a capability result for the same runtime.
   On a newly provisioned runtime, run
   `node scripts/renderer-capability.mjs --launch` once. If already blocked,
   preserve its exact startup error and diagnose that log with
   `node scripts/renderer-capability.mjs --diagnose=STARTUP_LOG` instead of
   relaunching every turn. Retry only after the relevant runtime provisioning
   changes or a separate authorized diagnostic requires it. Never weaken sandbox
   flags, modify the helper or use the user's Mac as a fallback.
5. After capability succeeds, use existing repo CDP/browser fixtures and available
   game-playtest guidance for the requested bounded check. Verify page boot,
   console/runtime errors and actual rendered screenshots. A capability readback,
   HTTP response or source check does not establish an in-game visual pass.
6. Report the revision, relevant checks, evidence and blockers. Preserve servers
   needed for ongoing preview; stop only owned disposable processes and remove
   only their owned temporary resources. Do not read credential values, log in,
   spend provider credits, change environment settings or publish merely to start.
