# Reads the stack outputs and writes:
#   infra/.stack-outputs.json   (used by the test scripts)
#   apps/phone/.env.local       (Vite)
#   apps/tv/.env.local          (Expo: EXPO_PUBLIC_*)
param(
  [string]$StackName = 'movewell',
  [string]$Region = 'us-east-1'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$raw = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].Outputs' --output json
if ($LASTEXITCODE -ne 0) { throw "Could not read stack $StackName in $Region" }
$o = @{}
foreach ($x in ($raw | ConvertFrom-Json)) { $o[$x.OutputKey] = $x.OutputValue }

($o | ConvertTo-Json) | Set-Content -Encoding ascii (Join-Path $root 'infra\.stack-outputs.json')

foreach ($app in 'phone', 'tv') { New-Item -ItemType Directory -Force (Join-Path $root "apps\$app") | Out-Null }

@"
VITE_API_URL=$($o.HttpApiUrl)
VITE_WS_URL=$($o.WebSocketUrl)
"@ | Set-Content -Encoding ascii (Join-Path $root 'apps\phone\.env.local')

@"
EXPO_PUBLIC_API_URL=$($o.HttpApiUrl)
EXPO_PUBLIC_WS_URL=$($o.WebSocketUrl)
EXPO_PUBLIC_PHONE_URL=$($o.PhoneAppUrl)
"@ | Set-Content -Encoding ascii (Join-Path $root 'apps\tv\.env.local')

Write-Host "`nPlayMotion backend is live:" -ForegroundColor Green
Write-Host "  HTTP API   $($o.HttpApiUrl)"
Write-Host "  WebSocket  $($o.WebSocketUrl)"
Write-Host "  Phone app  $($o.PhoneAppUrl)"
Write-Host "Wrote apps/phone/.env.local, apps/tv/.env.local and infra/.stack-outputs.json"
