$ErrorActionPreference = "Continue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$diagRoot = Join-Path $repoRoot ".diagnostics\latest"
New-Item -ItemType Directory -Force -Path $diagRoot | Out-Null
Get-ChildItem Env: | Sort-Object Name | Out-File (Join-Path $diagRoot "environment.txt")
Get-ChildItem $repoRoot -Force | Out-File (Join-Path $diagRoot "repo-root-listing.txt")
