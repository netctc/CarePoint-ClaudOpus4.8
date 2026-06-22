#!/usr/bin/env bash
set -euo pipefail

# Phase 28 provider role catalog schema repair helper.
# Run from the repository root on macOS/Linux/Git Bash.

echo "[phase28] Applying idempotent provider-role schema repair SQL..."
(
  cd services/api
  npm exec -- prisma db execute --schema prisma/schema.prisma --file prisma/phase28-provider-role-catalog-repair.sql
  echo "[phase28] Regenerating Prisma Client..."
  npm exec -- prisma generate --schema prisma/schema.prisma
  echo "[phase28] Verifying repaired schema..."
  node scripts/phase28/verify-provider-role-catalog-schema.mjs
)

echo "[phase28] Done. Restart the API and Admin/Provider web apps."
