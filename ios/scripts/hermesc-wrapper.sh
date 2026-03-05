#!/bin/sh
set -e

REAL_HERMESC="${PODS_ROOT}/hermes-engine/destroot/bin/hermesc"

if [ ! -x "$REAL_HERMESC" ]; then
  echo "error: hermesc not found at ${REAL_HERMESC}" 1>&2
  exit 2
fi

exec "$REAL_HERMESC" -w "$@"
