$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$source = Join-Path $repoRoot ".diagnostics\latest"
$target = Join-Path $repoRoot "feedback-input.zip"
if (Test-Path $target) { Remove-Item $target -Force }
Compress-Archive -Path "$source\*" -DestinationPath $target
Write-Host "Created $target"
