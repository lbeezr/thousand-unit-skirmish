# Local setup

[Documentation index](README.md) · [Player guide](playing.md)

## Requirements

- Node.js 24 or newer and npm.
- A desktop browser with WebGL support; mouse and keyboard are the baseline.
- Chrome or Chromium for the optional automated browser scenarios.

Run commands from the repository root. Install the locked dependency with
`npm ci`, then start the room supervisor with `npm start`. Open
[localhost:4173](http://127.0.0.1:4173). The supervisor launches a separate Node
worker for each active room. `node server.mjs` instead launches one match directly
and is useful for disposable scenarios.

## Local and LAN examples

Use a different port when another server is already running:

```sh
PORT=4174 npm start
```

For LAN play, replace the address below with this computer's LAN address. Set
both the listening interface and the browser-facing origin:

```sh
RTS_HOST=0.0.0.0 RTS_PUBLIC_ORIGINS=http://192.168.1.25:4173 npm start
```

Other players open `http://192.168.1.25:4173`. Binding to all interfaces alone
does not allow that browser origin. Comma-separate multiple full origins in
`RTS_PUBLIC_ORIGINS` when needed.

To start a disposable single match on another shipped map:

```sh
RTS_MAP=maps/three-crowns.json PORT=4174 node server.mjs
```

`RTS_MAP` must point inside `maps/`. A supervisor restart can restore an existing
checkpoint, including its map; use a fresh data directory for a new test fixture.

## Data and reconnects

The local supervisor uses `room-data/` for room records and checkpoints and
`custom-maps/` for default-room authored maps. Invite-room maps are stored with
their room. Keep these directories if you want to resume play.

Tabs automatically retry a lost connection. A disconnected seat is reserved for
120 seconds by default. The default room and four invite rooms are allowed by
default; extra connections become spectators when both seats are occupied.
See [configuration](configuration.md) for limits and [recovery](deployment.md#recovery-and-backups)
for checkpoint behavior.

## Common problems

In a restricted cloud workspace, npm's default cache under the home directory
may be unwritable. If `npm ci` reports a cache-path `ENOENT` or `EACCES`, choose
a writable cache directory while keeping the locked install:

```sh
npm ci --cache /tmp/thousand-unit-skirmish-npm-cache
```

This changes only where npm caches downloads. Continue with `npm start` or the
[repository checks](testing.md#repository-checks) after the install succeeds.

| Symptom | Check |
| --- | --- |
| Port already in use | Stop your previous server or choose a different `PORT`. |
| Page loads but WebSocket fails on a LAN/custom domain | Set the exact browser origin in `RTS_PUBLIC_ORIGINS`; include scheme and port. |
| Three.js or another client asset fails to load | Run `npm ci`; use the game server rather than opening `index.html` as a file. |
| Joined as spectator | Both seats are occupied or reserved for reconnect; use a fresh invite room or reclaim the original tab's seat. |
| Room creation fails | The configured invite-room cap may be full. Use an existing room or deliberately change `RTS_MAX_ROOMS`. |
| Browser scenario cannot find Chrome | Set `CHROME_PATH` to the Chrome/Chromium executable. |
| A new map setting appears ignored | A saved checkpoint may have restored the previous match; use disposable data paths for tests. |

For hosted HTTPS and shared-password access, use the [deployment guide](deployment.md).
