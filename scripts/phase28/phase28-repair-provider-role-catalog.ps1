# Phase 28 provider role catalog schema repair helper.
# Run from the repository root on Windows PowerShell.

$ErrorActionPreference = "Stop"

Write-Host "[phase28] Applying idempotent provider-role schema repair SQL..."
Push-Location services/api
npm exec -- prisma db execute --schema prisma/schema.prisma --file prisma/phase28-provider-role-catalog-repair.sql

Write-Host "[phase28] Regenerating Prisma Client..."
npm exec -- prisma generate --schema prisma/schema.prisma

Write-Host "[phase28] Verifying repaired schema..."
node scripts/phase28/verify-provider-role-catalog-schema.mjs
Pop-Location

Write-Host "[phase28] Done. Restart the API and Admin/Provider web apps."
