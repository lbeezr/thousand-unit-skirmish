# Cloud environment setup

[Local setup](getting-started.md) · [Configuration](configuration.md) · [Testing](testing.md)

This is a versioned setup recipe, not a record that environment settings were
applied. It installs this checkout's locked dependencies and makes its Start
skill available to compatible agents. It does not publish the environment, start
the game, install system tools, configure providers or qualify browser rendering.

## Install command and defaults

Select the branch or commit containing these files in the environment's checkout.
From that checkout root, put this exact command in the **setup/install command**
field:

```sh
bash scripts/cloud-install.sh
```

The [script](../scripts/cloud-install.sh) derives the checkout root from its own
location, requires Node 24+, creates writable cache/temp directories and runs
`npm ci --include=dev --no-audit --no-fund`. It uses `package-lock.json` without
changing dependency versions. It can also be called by path from another working
directory. Repeating it recreates the locked `node_modules`; run it during setup,
not on each agent turn. There is no browser launch in dependency installation.

The checkout currently pins Three.js 0.180.0, TypeScript 5.9.3, `@types/node`
24.19.1, Acorn 8.15.0 and jsdom 26.1.0. These versions belong to the package files;
update them through normal dependency work rather than editing setup settings.

In the environment's **environment variables** fields, add the following
non-secret values for both setup and task runtime:

| Field name | Exact recommended value |
| --- | --- |
| `npm_config_cache` | `/tmp/thousand-unit-skirmish-cloud/npm-cache` |
| `TMPDIR` | `/tmp/thousand-unit-skirmish-cloud/tmp` |
| `XDG_CONFIG_HOME` | `/tmp/thousand-unit-skirmish-cloud/xdg-config` |
| `XDG_CACHE_HOME` | `/tmp/thousand-unit-skirmish-cloud/xdg-cache` |
| `CHROME_PATH` | `/usr/bin/chromium` |

The first four values are the script's fallback defaults: it uses each existing
nonempty caller value instead when supplied. The script creates all four
directories. `CHROME_PATH` is a separate recommendation for this image's existing
browser; the installer neither sets nor validates it. Use the actual installed
browser path if another image is selected. `TMPDIR` must exist before any browser
or fixture creates a temporary directory; setup creates it for subsequent tasks.
`/tmp` storage is temporary and must be recreated when the environment is rebuilt.

Exports inside the setup subprocess only affect that subprocess and its children.
They do not become task defaults by writing this script, committing this guide or
running setup. Configure the fields above for tasks as well. If a later task uses
the old published environment or a different checkout, it can still have old
settings/files. Caller overrides let another writable layout work without edits
to this repository. Avoid home-directory caches on an image where home is read-only.

The game already defaults to `RTS_HOST=127.0.0.1` and `PORT=4173`; leave those
unset for a local preview. Set `RTS_PUBLIC_ORIGINS` only for the actual forwarded
or custom browser origin, as described in [configuration](configuration.md).
Preserve existing room/map data on resume; disposable QA uses existing fixtures
with temporary data directories. No access password is needed for loopback tests.

## Start skill and task behavior

The repo skill is
[`.agents/skills/thousand-unit-skirmish-start/SKILL.md`](../.agents/skills/thousand-unit-skirmish-start/SKILL.md).
On an agent supporting repository skill discovery, select/invoke
`thousand-unit-skirmish-start` when beginning or resuming work here. Confirm the
skill is discovered in a new task; merely adding the file does not establish that
a host loaded it. If discovery is unavailable, explicitly read the file.

The skill preserves branches, edits, game data and needed preview processes. It
uses task-relevant checks, reuses a verified existing server, and starts
`npm start` only when needed and absent. It does not rerun setup, the entire suite
or a known blocked browser on every turn. Existing `AGENTS.md`, test lanes and CDP
fixtures remain authoritative. No new browser automation framework is required.

## Optional browser readiness and known provisioning blocker

Only when browser work is requested on a newly provisioned runtime, run:

```sh
node scripts/renderer-capability.mjs --launch
```

A successful WebGL2 readback establishes capability only. Actual game boot,
console/runtime errors and screenshots still need a bounded repo browser test.
Browser readiness is separate from successful dependency setup: nonvisual coding
can proceed when the browser is blocked. On a known blocked runtime, preserve its
original log and use the existing `--diagnose=STARTUP_LOG` mode without launching.

The 8 October audit at revision `ac4a09dd4e27a8c355726f5fd4b53a25fc364590`
found Chromium 151.0.7922.173 installed. Its one normal-sandbox attempt stopped
before CDP/WebGL, reporting `chrome_crashpad_handler: --database is required`,
`mkdir : No such file or directory (2)`, and:

```text
The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /usr/lib/chromium/chrome-sandbox is owned by root and has mode 4755.
```

Observed helper: `/usr/lib/chromium/chrome-sandbox`, owner `nobody:nogroup`, mode
`4755`. Both `/usr/bin/chromium` and `/usr/lib/chromium/chromium` were mode `755`,
owner `nobody:nogroup`. Home cache/config directories were unwritable. Writable
XDG paths address storage preparation, not the sandbox error. The environment
provider owns provisioning a working normal-sandbox browser and its prerequisites.
Do not change helper permissions/ownership, disable sandboxing or guess GPU
packages in this setup. GPU availability was not established. No browser retry
was performed while preparing these files.

## Publish and verify a new task

This change prepares files for a draft PR. It does not merge, deploy or republish
the environment. When separately authorized to configure/publish the environment:

1. Select the intended published source branch/commit containing these files.
   Set the setup command and the non-secret task variables above. Keep the
   environment's existing network/security policy; this recipe changes neither.
2. Save/publish through the environment host's normal controls, then open a new
   task using that environment. Existing tasks do not prove new defaults loaded.
3. Verify `git rev-parse HEAD`, `node --version` and `npm ls --depth=0` against
   the intended source and lock. Read only the five non-secret variables above;
   never dump the full environment or credential files. Check that the four
   directories exist and are writable and that `CHROME_PATH` is executable.
4. Confirm discovery/readability of the Start skill. For CPU setup verification,
   run `node --test scripts/cloud-install.test.mjs` and
   `node scripts/check-docs.mjs`. These tests use temporary fixtures and stubs,
   not real package installation or browser launch. Then choose checks relevant
   to the next task; this is not a claim that the full suite passed.
5. If requested browser work has provider-fixed prerequisites, run the optional
   capability check once, then a bounded game capture. Record exact revision,
   capability report and rendered evidence. Otherwise keep the browser blocker
   explicit while continuing independent work.

## Asset tools and secure provider configuration

The audited image already had Blender 4.3.2, ffmpeg/ffprobe 7.1.5, Python 3.12.14,
Pillow and NumPy. Meshy, game-dev and ElevenLabs CLIs and the local ElevenLabs SDK
were absent. Hosted Meshy, asset and ElevenLabs skills were available; their
availability does not prove local tooling or provider authentication.

This baseline installs only the game lockfile. Meshy's supported skill runner
uses CLI 0.4.0 and requires a user-controlled existing session or secure provider
configuration. Hosted ElevenLabs MCP access is independent of local SDK access.
Direct local provider use needs an approved official SDK/CLI and securely managed
credentials; do not commit keys, copy sessions or request credentials in chat.
Provider authentication and paid generation remain separate authorized work.
