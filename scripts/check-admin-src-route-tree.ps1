$ErrorActionPreference = 'Stop'

$routes = @(
  'apps/admin/src/app/layout.tsx',
  'apps/admin/src/app/auth/sign-in/page.tsx',
  'apps/admin/src/app/portal/dashboard/page.tsx',
  'apps/admin/src/app/portal/accounts/page.tsx',
  'apps/admin/src/app/portal/organizations/page.tsx',
  'apps/admin/src/app/portal/support/console/page.tsx',
  'apps/admin/src/app/portal/coverage/page.tsx'
)

Write-Host "Admin route tree check: apps/admin/src/app" -ForegroundColor Cyan
foreach ($route in $routes) {
  if (Test-Path $route) {
    Write-Host "OK      $route" -ForegroundColor Green
  } else {
    Write-Host "MISSING $route" -ForegroundColor Red
  }
}

if (Test-Path 'apps/admin/app') {
  Write-Host "WARNING apps/admin/app exists. This project uses apps/admin/src/app. Review and remove apps/admin/app if it was created accidentally." -ForegroundColor Yellow
}
