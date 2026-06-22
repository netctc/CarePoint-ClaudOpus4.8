param(
  [string]$ProjectRoot = "C:\Users\MA\Desktop\care-center-work",
  [string]$ApiBaseUrl = "http://localhost:4000"
)

Write-Host "CarePoint Phase 30 account mutation audit hardening verification" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot"

if (!(Test-Path $ProjectRoot)) {
  Write-Host "Project root not found. Pass -ProjectRoot with your actual workspace path." -ForegroundColor Red
  exit 1
}

Set-Location $ProjectRoot

Write-Host "`n1) Confirming package does not require .env changes..." -ForegroundColor Yellow
Write-Host "No new environment variables are required. Do not copy any .env file from deliverables."

Write-Host "`n2) Generating Prisma client..." -ForegroundColor Yellow
npm run prisma:generate --workspace @care-center/api
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n3) Building API workspace..." -ForegroundColor Yellow
npm run build --workspace @care-center/api
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n4) Building Admin workspace..." -ForegroundColor Yellow
npm run build --workspace @care-center/admin
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n5) Manual API smoke-test examples." -ForegroundColor Yellow
Write-Host "Start API separately if it is not running. Replace <TOKEN> and IDs before running:"
Write-Host "Invoke-RestMethod '$ApiBaseUrl/api/admin/accounts' -Method Post -Headers @{ Authorization = 'Bearer <TOKEN>'; 'Content-Type' = 'application/json' } -Body '{\"email\":\"phase30-test@example.com\",\"firstName\":\"Phase\",\"lastName\":\"Thirty\",\"role\":\"SUPPORT\",\"status\":\"ACTIVE\"}'"
Write-Host "Invoke-RestMethod '$ApiBaseUrl/api/admin/accounts/<ACCOUNT_ID>' -Method Patch -Headers @{ Authorization = 'Bearer <TOKEN>'; 'Content-Type' = 'application/json' } -Body '{\"firstName\":\"Updated\"}'"
Write-Host "Invoke-RestMethod '$ApiBaseUrl/api/admin/accounts/<ACCOUNT_ID>/deactivate' -Method Post -Headers @{ Authorization = 'Bearer <TOKEN>'; 'Content-Type' = 'application/json' } -Body '{\"reason\":\"Phase 30 smoke test\"}'"

Write-Host "`nVerification script finished." -ForegroundColor Green
