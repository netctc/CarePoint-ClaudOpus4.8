param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

Write-Host "CarePoint Phase 31 verification" -ForegroundColor Cyan
Write-Host "Root: $Root"

$expected = @(
  "backend/src/modules/accounts/accountBulk.schema.ts",
  "backend/src/modules/accounts/accountCsv.ts",
  "backend/src/modules/accounts/accountBulkAudit.ts",
  "backend/src/modules/accounts/accountBulk.service.ts",
  "backend/src/modules/accounts/accountBulk.routes.example.ts",
  "frontend/admin/lib/accounts/bulkApi.ts",
  "frontend/admin/components/accounts/AccountBulkActionBar.tsx",
  "frontend/admin/components/accounts/AccountCsvImportDrawer.tsx",
  "docs/PHASE31_IMPLEMENTATION_NOTES.md",
  "validation/PHASE31_QA_CHECKLIST.md"
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

Write-Host "Static file verification passed. No .env files found." -ForegroundColor Green
Write-Host "Next: merge, run TypeScript checks, then execute API smoke tests." -ForegroundColor Yellow
