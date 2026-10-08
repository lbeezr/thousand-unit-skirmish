#!/usr/bin/env bash
# Install this checkout's locked dependencies; browser readiness is separate.
set -euo pipefail

if (( $# )); then
  printf 'Usage: bash scripts/cloud-install.sh\n' >&2
  exit 2
fi

RTS_REPOSITORY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$RTS_REPOSITORY_ROOT"
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) throw Error("Node 24+ required")'

export npm_config_cache="${npm_config_cache:-/tmp/thousand-unit-skirmish-cloud/npm-cache}"
export TMPDIR="${TMPDIR:-/tmp/thousand-unit-skirmish-cloud/tmp}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/thousand-unit-skirmish-cloud/xdg-config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/thousand-unit-skirmish-cloud/xdg-cache}"
mkdir -p -- "$npm_config_cache" "$TMPDIR" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

npm ci --include=dev --no-audit --no-fund
printf 'Locked dependencies installed. Configure task environment fields separately; these exports apply only to this process.\n'
