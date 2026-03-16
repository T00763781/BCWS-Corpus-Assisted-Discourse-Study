param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8765/api"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$diagRoot = Join-Path $repoRoot ".diagnostics\latest"
New-Item -ItemType Directory -Force -Path $diagRoot | Out-Null
$logPath = Join-Path $diagRoot "seed-demo.log"
$healthUrl = "$($ApiBaseUrl.TrimEnd('/'))/health"
$runUrl = "$($ApiBaseUrl.TrimEnd('/'))/connectors/run"

function Write-SeedLog {
  param([string]$Message)
  $timestamp = Get-Date -Format o
  "$timestamp $Message" | Tee-Object -FilePath $logPath -Append
}

Write-SeedLog "Starting seed-demo workflow against $ApiBaseUrl"
for ($attempt = 1; $attempt -le 15; $attempt++) {
  try {
    $health = Invoke-RestMethod -Method Get -Uri $healthUrl
    Write-SeedLog "API health check succeeded: $($health.status)"
    break
  } catch {
    if ($attempt -eq 15) {
      throw "Open Fireside API not ready at $healthUrl"
    }
    Start-Sleep -Seconds 1
  }
}

$connectors = @("bcws.catalog", "cwfis.summary", "geomet.weather", "social.seed")
foreach ($connector in $connectors) {
  Write-SeedLog "Running connector $connector"
  $result = Invoke-RestMethod -Method Post -Uri $runUrl -ContentType "application/json" -Body (@{connector_key=$connector} | ConvertTo-Json)
  Write-SeedLog "Connector $connector completed with status $($result.status)"
}

Write-SeedLog "Seed-demo workflow completed"
