param(
  [switch]$CreateVenv = $true,
  [switch]$InstallNodePackages = $false
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$diagRoot = Join-Path $repoRoot ".diagnostics\latest"
New-Item -ItemType Directory -Force -Path $diagRoot | Out-Null
$logPath = Join-Path $diagRoot "bootstrap.log"

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format o
  "$timestamp $Message" | Tee-Object -FilePath $logPath -Append
}

Write-Log "Starting Open Fireside bootstrap"
Write-Log "Repo root: $repoRoot"

if ($CreateVenv) {
  Write-Log "Creating Python virtual environment"
  python -m venv "$repoRoot\.venv" 2>&1 | Tee-Object -FilePath $logPath -Append
}

$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-Not (Test-Path $pythonExe)) {
  $pythonExe = "python"
}

Write-Log "Installing Python packages"
& $pythonExe -m pip install --upgrade pip setuptools wheel 2>&1 | Tee-Object -FilePath $logPath -Append
& $pythonExe -m pip install -e "$repoRoot" 2>&1 | Tee-Object -FilePath $logPath -Append

if ($InstallNodePackages) {
  Write-Log "Installing Node workspace packages"
  Push-Location $repoRoot
  npm install 2>&1 | Tee-Object -FilePath $logPath -Append
  Pop-Location
}

Write-Log "Building diagnostics bundle"
& $pythonExe -c "from open_fireside_diagnostics.bundle import build_diagnostics_bundle; build_diagnostics_bundle(r'$diagRoot')" 2>&1 | Tee-Object -FilePath $logPath -Append

Write-Log "Bootstrap complete"
