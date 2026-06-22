param(
  [string]$ApiBase = "http://localhost:4000",
  [string]$AdminBase = "http://localhost:3001"
)

$ErrorActionPreference = "Continue"

function Test-Url($Name, $Url) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 60
    $sw.Stop()
    [PSCustomObject]@{
      Name = $Name
      Status = [int]$response.StatusCode
      Ms = [int]$sw.ElapsedMilliseconds
      Url = $Url
    }
  } catch {
    $sw.Stop()
    [PSCustomObject]@{
      Name = $Name
      Status = "ERROR"
      Ms = [int]$sw.ElapsedMilliseconds
      Url = $Url
      Error = $_.Exception.Message
    }
  }
}

$checks = @(
  @{ Name = "API auth me"; Url = "$ApiBase/api/auth/me" },
  @{ Name = "API admin providers"; Url = "$ApiBase/api/admin/users/providers?limit=25" },
  @{ Name = "API admin patients"; Url = "$ApiBase/api/admin/users/patients?limit=25" },
  @{ Name = "API admin organizations"; Url = "$ApiBase/api/admin/users/organizations?limit=25" },
  @{ Name = "API refill events"; Url = "$ApiBase/api/records/refill-operational-events?limit=12" },
  @{ Name = "Admin dashboard"; Url = "$AdminBase/portal/dashboard" },
  @{ Name = "Admin accounts"; Url = "$AdminBase/portal/accounts" },
  @{ Name = "Admin coverage"; Url = "$AdminBase/portal/coverage" }
)

$results = foreach ($check in $checks) {
  Test-Url -Name $check.Name -Url $check.Url
}

$results | Format-Table -AutoSize

Write-Host "\nTargets:" -ForegroundColor Cyan
Write-Host "- API list endpoints should normally stay below 2000ms in local development."
Write-Host "- Admin initial pages should return shell HTML quickly and defer heavy tables."
Write-Host "- /portal/coverage should return 200 after Phase 32 route recovery."
