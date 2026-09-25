#!/bin/sh
set -eu

if [ -n "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
  mkdir -p "$RAILWAY_VOLUME_MOUNT_PATH/room-data" "$RAILWAY_VOLUME_MOUNT_PATH/custom-maps"
  chown node:node "$RAILWAY_VOLUME_MOUNT_PATH" "$RAILWAY_VOLUME_MOUNT_PATH/room-data" "$RAILWAY_VOLUME_MOUNT_PATH/custom-maps"
fi

exec su-exec node node /app/room-supervisor.mjs
