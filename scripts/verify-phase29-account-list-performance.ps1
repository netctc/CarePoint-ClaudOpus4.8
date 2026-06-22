param(
  [string]$ProjectRoot = "C:\Users\MA\Desktop\care-center-work",
  [string]$ApiBaseUrl = "http://localhost:4000"
)

Write-Host "CarePoint Phase 29 account-list performance verification" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot"

if (!(Test-Path $ProjectRoot)) {
  Write-Host "Project root not found. Pass -ProjectRoot with your actual workspace path." -ForegroundColor Red
  exit 1
}

Set-Location $ProjectRoot

Write-Host "\n1) Checking Prisma client generation..." -ForegroundColor Yellow
npm run prisma:generate --workspace @care-center/api
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "\n2) Building API workspace..." -ForegroundColor Yellow
npm run build --workspace @care-center/api
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "\n3) Building Admin workspace..." -ForegroundColor Yellow
npm run build --workspace @care-center/admin
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "\n4) Optional API smoke test." -ForegroundColor Yellow
Write-Host "Start API separately if it is not running, then test:"
Write-Host "Invoke-RestMethod '$ApiBaseUrl/api/admin/accounts?page=1&pageSize=25&sortBy=createdAt&sortDir=desc' -Headers @{ Authorization = 'Bearer <TOKEN>' }"

Write-Host "\nVerification script finished." -ForegroundColor Green
