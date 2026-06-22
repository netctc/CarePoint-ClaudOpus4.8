param(
  [string]$RootDir = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $RootDir

Write-Host "== Phase 20 static merge readiness =="
node scripts/phase20/validate-phase20-merge.mjs $RootDir

Write-Host ""
Write-Host "== Dependency/build validation commands =="
Write-Host "Run the following after npm install has completed in the workspace:"
Write-Host "npm run prisma:generate --workspace @care-center/api"
Write-Host "npm exec --workspace @care-center/api -- prisma validate --schema services/api/prisma/schema.prisma"
Write-Host "npm exec --workspace @care-center/api -- prisma migrate status --schema services/api/prisma/schema.prisma"
Write-Host "npm run build:api"
Write-Host "npm run build:admin"
Write-Host "npm run build:provider"
Write-Host ""
Write-Host "For production-like deployment, use migrate deploy instead of migrate dev after backing up the database."
