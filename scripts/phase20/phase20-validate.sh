#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
cd "$ROOT_DIR"

echo "== Phase 20 static merge readiness =="
node scripts/phase20/validate-phase20-merge.mjs "$ROOT_DIR"

echo ""
echo "== Dependency/build validation commands =="
echo "Run the following after npm install has completed in the workspace:"
echo "npm run prisma:generate --workspace @care-center/api"
echo "npm exec --workspace @care-center/api -- prisma validate --schema services/api/prisma/schema.prisma"
echo "npm exec --workspace @care-center/api -- prisma migrate status --schema services/api/prisma/schema.prisma"
echo "npm run build:api"
echo "npm run build:admin"
echo "npm run build:provider"
echo ""
echo "For production-like deployment, use migrate deploy instead of migrate dev after backing up the database."
