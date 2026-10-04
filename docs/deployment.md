# Deployment and recovery

[Documentation index](README.md) · [Configuration](configuration.md)

The supported hosted shape is one supervisor with isolated match workers and
persistent storage. Shared HTTP Basic Auth protects an invite-only playtest.
Accounts, public matchmaking, and multi-replica match routing are future work.

## Package a release

From a reviewed, committed checkout:

```sh
npm ci
npm test
npm run release:pack
```

The packer copies the Dockerfile's local `COPY` inputs into a temporary release
directory and reports the source revision and content digest. It rejects dirty
checkouts. `--allow-dirty` is for disposable package tests and does not identify a
reproducible committed release.

If copying, verification or manifest creation fails, the packer removes only its
new incomplete directory. A successful package stays available to its caller;
keep it through staging and any approved promotion, then remove it when finished.
The local release scenario stops its child before removing its own package and
test volume, including when setup fails before server startup.

On macOS the packer requests native copy-on-write cloning (`cp -c`) for regular
files and falls back to ordinary copying when that command fails. Other platforms
retain ordinary copying. The resulting files remain isolated snapshots; source
updates do not mutate the release. This avoids duplicating large art/audio bytes
when the filesystem supports cloning, while retaining the same content digest
and Docker input checks. See the [bounded snapshot check](qa-evidence/vaelora-sunbloom-worked-2026-10-01/README.md)
for byte/mutation-isolation and full-pack evidence under limited local disk space.

Docker includes the active building sprite and Town Center lifecycle packs.
The Building Variant Atlas remains a separate local preview; its HTML/CSS/JS
are outside the game server allowlist and Docker inputs. See
[local asset review](assets.md#review-locally).

For a manual release, keep the same packed directory for staging and any
subsequent production promotion. GitHub source deployments instead build the
connected commit; the local package check validates Docker inputs but does not
publish an artifact to Railway. Inspect the source integration and auto-deploy
settings below before merging. This guide does not assert which build is
deployed now.

## Railway

### GitHub source and deployment triggers

The approved source for the existing `game` service is
[`lbeezr/thousand-unit-skirmish`, branch `main`](https://github.com/lbeezr/thousand-unit-skirmish/tree/main),
replacing `lbliii/thousand-unit-skirmish` in both environments. Apply and verify
the platform source change separately in these existing resources:

| Resource | ID |
| --- | --- |
| Project | `32da8e2c-3377-49ed-8df0-45f72ecdc562` |
| Service (`game`) | `408356ca-c8cd-4932-abca-d5ebef430dd5` |
| Staging environment | `93f80e39-efd0-420a-9282-86886d3e88bd` |
| Production environment | `b6e4036d-5592-4b7f-8f21-ca5d6d1f4529` |

Repository files cannot change Railway's connected repository, trigger branch,
auto-deploy switch, or **Wait for CI** setting. Verify each environment's actual
settings and deployment SHA in Railway. Preserve volumes, variables, domains,
replica counts, and readiness checks during the source switch.

When auto-deploy is enabled, a push or merge to the connected `main` branch
triggers Railway. If both environments auto-deploy from `main`, the same merge
can deploy to both; a separate production promotion requires production
auto-deploy to be disabled. Make that release decision explicitly in Railway.
The [existing GitHub workflow](../.github/workflows/ci.yml) checks code and release
inputs only. Keep Railway's integration as the single automatic deploy trigger;
do not also add a Railway CLI deploy job to Actions.

Enable and verify [fork CI](testing.md#enable-and-verify-fork-ci) independently.
Railway's [Wait for CI](https://docs.railway.com/deployments/github-autodeploys#wait-for-ci)
requires a workflow triggered by pushes to the deployment branch; this workflow
retains `push: branches: [main]`. Running CI does not itself enable that gate.
With the gate enabled, verify all workflow conclusions for the deployment
commit and Railway's terminal deployment result. Preserve an existing gate
during the switch; absent CI is not a reason to disable it. Any required new
GitHub app permissions or credentials need a separate approval.

Before the first release from the fork, identify each environment's running
commit and audit its saved checkpoints against the target build, including room
and pregame state. Preserve the prior release and volume backup before replacing
an older build. CI's disposable recovery fixtures do not establish compatibility
with the actual hosted data; see [recovery and backups](#recovery-and-backups).

### Manual release

Configure each environment independently:

1. Run the `game` service with one replica and a persistent volume at `/app/data`.
2. Set a unique `RTS_ACCESS_PASSWORD` of at least 16 characters. Set
   `RTS_ACCESS_USER` if the default `players` is unsuitable.
3. Generate a public domain. `RAILWAY_PUBLIC_DOMAIN` supplies its allowed origin;
   add full custom origins to `RTS_PUBLIC_ORIGINS` when needed.
4. Deploy the packed directory and wait for `/ready` to pass.
5. Run the release smoke against the intended project/environment.

```sh
railway up /path/to/release-directory --path-as-root --environment staging --service game
npm run release:smoke -- --environment staging --project PROJECT_ID --expected-source FULL_SHA --expected-digest sha256:DIGEST
```

Use the source revision and digest from the reviewed pack's `release-manifest.json`
and the intended project ID. The smoke script reads service credentials without
printing the password and checks readiness, authentication, expected served identity,
required assets and WebSocket access. Use the same artifact for a separately approved production
promotion, then repeat with `--environment production`.

Authenticated `/health` includes sanitized `buildIdentity`. Packed releases copy a
private `src/server/release-identity.json` into Docker through the existing `src`
COPY. This declaration and the root manifest are excluded from their own digest;
the declared digest identifies the packer's listed files, not a fresh hash of the
running image. Neither file nor the server identity module is a public asset.
Public `/ready` remains only `{ "ok": true|false }`.

For GitHub-triggered Railway deployments, the documented
[`RAILWAY_GIT_COMMIT_SHA`](https://docs.railway.com/variables/reference#git-variables)
provides source metadata when no packed sidecar exists. Supply `--expected-source
FULL_SHA`; omit `--expected-digest` only when deliberately verifying source alone.
Provider metadata leaves pack cleanliness and digest unknown. Missing, malformed,
conflicting or wrong identity and dirty packed sources fail with exit 1; identity
failures produce a sanitized JSON receipt before asset/WebSocket acceptance.
Identity comparison does not establish rendered gameplay or deployment byte attestation.

The supervisor refuses Railway startup without its required volume, password,
and public origin configuration. `/ready` exposes readiness; `/health`, room
APIs, assets, and WebSockets require authentication. Never put service secrets in
a guide or run log. Review `railway.json`, the Dockerfile, and platform config
compatibility when changing deployment tooling.

## Docker Compose with Caddy

Use a host with Docker Compose, a DNS name pointing at it, and reachable ports
80 and 443. Copy `.env.example` to `.env` and set `DOMAIN` and `RTS_ACCESS_USER`.
Generate an Argon2id password hash:

```sh
docker run --rm -it caddy:2-alpine caddy hash-password --algorithm argon2id
```

Store the complete hash in single quotes as `RTS_ACCESS_PASSWORD_HASH` in `.env`.
Caddy handles HTTPS, Basic Auth, and WebSocket forwarding, and hides detailed
`/health` from its public route.

The committed Compose file does not pass a public origin into the game service.
Add `compose.override.yaml` with the actual browser-facing origin before launch:

```yaml
services:
  game:
    environment:
      RTS_PUBLIC_ORIGINS: https://play.example.com
```

Then run:

```sh
docker compose up --build -d
```

Only Caddy publishes ports. The game runs as a non-root user with a read-only
container filesystem and writable named volumes. `docker compose down` stops
the deployment and preserves volumes; adding `-v` deletes them.

## Recovery and backups

Workers capture state every 30 simulation ticks (about one second without
server overload) and write checkpoints atomically. Slow ticks, storage stalls,
or failed writes can increase the amount of play lost on restart. `/health`
reports checkpoint and scheduler diagnostics.

A valid checkpoint restores match identity, units, production, objectives,
events, and resumable seats. Connected seats at a crash receive a fresh reclaim
window at restart; already-disconnected seats retain their original expiry.
Invalid or incompatible checkpoints are rejected and replaced by a fresh match.
A failed periodic write leaves the previous checkpoint intact. Health reports
checkpoint failures and save age; later periodic writes resume after storage
becomes writable. The [storage-failure regression](qa-checkpoint-storage-2026-09-27.md)
checks both-seat play and restart after a temporary permission failure.
A worker is restarted on the next relevant request/health check; invite workers
can start lazily.

Shutdown gives workers seven seconds to stop gracefully before forcing an exit.
A worker already terminated by a signal is complete; the supervisor does not
wait for another exit event. See the [signal shutdown regression](qa-worker-shutdown-2026-09-27.md).

Invite IDs and custom maps persist with room data. The supervisor can rebuild a
missing/invalid room index from valid directories; lowering the cap does not
delete saved rooms. By default an invite room idle for six hours is removed
with its checkpoint and maps. HTTP lookup and direct WebSocket joins enforce
the same idle deadline. A join admitted before that deadline reserves its room
through worker startup, so expiry cannot delete its checkpoint or maps while
recovery is in progress. See the [idle-expiry regression](qa-room-expiry-2026-09-27.md).

- Railway: back up the volume containing both `room-data` and `custom-maps`.
- Compose: back up both `room_data` and `custom_maps`; Caddy's volumes retain
  certificates and configuration.
- Rehearse restoration in an isolated environment and verify the map catalog,
  both seats, production, objectives, and commands.
- Preserve the previous release artifact and check checkpoint compatibility
  before rolling back code.

Existing dated QA notes record past backup/deployment problems. Inspect the
actual service before claiming backups, restore, or rollback are working now.

## Public smoke and capacity

Use `scripts/qa-staging-smoke.mjs` and `scripts/qa-staging-browser.mjs` with injected
service variables for two-seat checks; see the [QA plan](qa-vertical-slice.md).
`npm run release:smoke -- --environment staging --project PROJECT_ID --expected-source FULL_SHA` also
checks every static module reachable from the served client entry point, using
the same audit as the packed-release scenario. It rejects missing modules,
HTML responses, empty modules, and imports outside the game origin. Dynamic
assets and actual browser evaluation still need the browser check.
Authoring/reset tests must use a disposable QA room.

Each active room adds a Node process and simulation workload. A configured room
cap is not a measured capacity result. Establish hosted CPU, memory, egress,
order-latency, and reconnect budgets using [the testing guide](testing.md).
