$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-Not (Test-Path $pythonExe)) {
  $pythonExe = "python"
}
$env:PYTHONPATH = "$repoRoot\services\api;$repoRoot\packages\config;$repoRoot\packages\diagnostics"
Push-Location $repoRoot
try {
  & $pythonExe -m uvicorn open_fireside_api.main:app --host 127.0.0.1 --port 8765 --reload
} finally {
  Pop-Location
}
