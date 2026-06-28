#!/bin/sh
# Boot sequence for the production container.
#
# A suspended Neon (serverless) Postgres compute can take longer than Prisma's
# 10s advisory-lock timeout to wake on the first connection, which surfaces as
# `P1002 ... Timed out trying to acquire a postgres advisory lock`. Retry the
# migration a few times so the compute has time to spin up; by the 2nd/3rd
# attempt it's awake and the migration applies cleanly.
set -e

attempts=5
i=1
while [ "$i" -le "$attempts" ]; do
  echo "prisma migrate deploy (attempt $i/$attempts)..."
  if npx prisma migrate deploy; then
    echo "Migrations applied."
    break
  fi
  if [ "$i" -eq "$attempts" ]; then
    echo "Migrations failed after $attempts attempts." >&2
    exit 1
  fi
  echo "Migration attempt failed (Neon may be waking up). Retrying in 8s..."
  sleep 8
  i=$((i + 1))
done

exec node src/server.js
