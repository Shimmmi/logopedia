#!/bin/sh
set -e
echo "Starting LogoPed worker..."
exec npx tsx worker/index.ts
