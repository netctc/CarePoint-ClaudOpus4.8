param(
  [string]$BaseUrl = 'http://localhost:3001'
)

$ErrorActionPreference = 'Continue'
$routes = @(
  '/auth/sign-in?next=/portal/dashboard',
  '/portal/dashboard',
  '/portal/accounts',
  '/portal/organizations',
  '/portal/catalog/services',
  '/portal/coverage'
)

Write-Host "Measuring Admin routes against $BaseUrl" -ForegroundColor Cyan
foreach ($route in $routes) {
  $url = "$BaseUrl$route"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 60
    $sw.Stop()
    [PSCustomObject]@{
      Route = $route
      Status = [int]$response.StatusCode
      Ms = $sw.ElapsedMilliseconds
    }
  } catch {
    $sw.Stop()
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
    [PSCustomObject]@{
      Route = $route
      Status = $status
      Ms = $sw.ElapsedMilliseconds
    }
  }
}
