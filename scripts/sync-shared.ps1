# Copies packages/shared (source of truth for exercise/game IDs and the WebSocket protocol)
# into the Lambda code folder. deploy.ps1 runs this automatically.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'infra\src\lib\shared'
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item (Join-Path $root 'packages\shared\*.mjs') $dest -Force
Write-Host "Synced packages/shared -> infra/src/lib/shared" -ForegroundColor Green
