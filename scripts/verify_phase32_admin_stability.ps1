param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

Write-Host "CarePoint Phase 32 static verification" -ForegroundColor Cyan
Write-Host "Root: $Root"

$expected = @(
  "backend/src/modules/records/refillOperationalEvents.ts",
  "backend/src/modules/records/records.routes.integration.example.ts",
  "backend/src/modules/admin-users/adminUsersResilience.notes.ts",
  "backend/src/utils/withTimeout.ts",
  "frontend/admin/app/portal/coverage/page.tsx",
  "frontend/admin/lib/fetchJsonWithTimeout.ts",
  "frontend/admin/components/accounts/AccountsDeferredLoader.tsx",
  "docs/PHASE32_IMPLEMENTATION_NOTES.md",
  "validation/PHASE32_QA_CHECKLIST.md"
)

$missing = @()
foreach ($file in $expected) {
  $path = Join-Path $Root $file
  if (!(Test-Path $path)) {
    $missing += $file
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing files:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

$envFiles = Get-ChildItem -Path $Root -Recurse -Force -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^\.env($|\.)' }

if ($envFiles.Count -gt 0) {
  Write-Host "Unexpected .env files found in package:" -ForegroundColor Red
  $envFiles.FullName | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

Write-Host "Static verification passed. No .env files found." -ForegroundColor Green
