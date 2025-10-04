param(
  [int]$Port = 1313
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$docsPath = Join-Path $repoRoot 'docs'

if (-not (Test-Path (Join-Path $docsPath 'themes' 'hugo-scroll'))) {
  Write-Host 'Theme submodule missing. Initialising submodules...' -ForegroundColor Yellow
  Push-Location $repoRoot
  git submodule update --init --recursive
  Pop-Location
}

Write-Host "Starting Hugo server on http://localhost:$Port" -ForegroundColor Cyan
Push-Location $docsPath
hugo server --bind 127.0.0.1 --baseURL http://localhost:$Port/ --port $Port --buildDrafts --buildFuture
Pop-Location
