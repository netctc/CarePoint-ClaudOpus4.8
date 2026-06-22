$ErrorActionPreference = 'Stop'

$required = @(
  'apps/admin/src/app/portal/coverage/page.tsx',
  'scripts/check-admin-src-route-tree.ps1',
  'scripts/measure-admin-routes.ps1',
  'docs/phase34/README.md'
)

foreach ($file in $required) {
  if (!(Test-Path $file)) {
    throw "Missing expected file: $file"
  }
}

if (Test-Path '.env') {
  throw 'Package validation failed: .env must not be included.'
}

Write-Host 'Phase 34 static verification passed.' -ForegroundColor Green
