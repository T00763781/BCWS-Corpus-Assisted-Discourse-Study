$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$diagRoot = Join-Path $repoRoot ".diagnostics\latest"
$stageRoot = Join-Path $repoRoot ".diagnostics\feedback-stage"
$target = Join-Path $repoRoot "feedback.zip"

if (Test-Path $stageRoot) { Remove-Item $stageRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null

$itemsToCopy = @(
  @{ Source = Join-Path $repoRoot "docs\audits\runtime-repair-audit.md"; Name = "runtime-repair-audit.md" },
  @{ Source = Join-Path $repoRoot "docs\audits\next-steps.md"; Name = "next-steps.md" },
  @{ Source = Join-Path $repoRoot "docs\audits\configure-control-plane-pass.md"; Name = "configure-control-plane-pass.md" },
  @{ Source = Join-Path $repoRoot "docs\audits\push-log.md"; Name = "push-log.md" },
  @{ Source = Join-Path $repoRoot "docs\audits\verification-log.txt"; Name = "verification-log.txt" },
  @{ Source = Join-Path $diagRoot "api-prepatch.err.log"; Name = "api-prepatch.err.log" },
  @{ Source = Join-Path $diagRoot "frontend-dev.out.log"; Name = "frontend-dev.out.log" },
  @{ Source = Join-Path $diagRoot "frontend-dev.err.log"; Name = "frontend-dev.err.log" },
  @{ Source = Join-Path $diagRoot "seed-demo.log"; Name = "seed-demo.log" },
  @{ Source = Join-Path $repoRoot "output\configure-control-plane-pass\verification-notes.txt"; Name = "configure-control-plane-verification-notes.txt" }
)

foreach ($item in $itemsToCopy) {
  if (Test-Path $item.Source) {
    Copy-Item $item.Source (Join-Path $stageRoot $item.Name) -Force
  }
}

$artifactRoot = Join-Path $repoRoot "output\configure-control-plane-pass"
if (Test-Path $artifactRoot) {
  Copy-Item (Join-Path $artifactRoot "*.png") $stageRoot -Force -ErrorAction SilentlyContinue
}

if (Test-Path $target) { Remove-Item $target -Force }
Compress-Archive -Path "$stageRoot\*" -DestinationPath $target
Write-Host "Created $target"
