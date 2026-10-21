# Builds the TV app for browsers (Expo web export) and publishes it to S3 + CloudFront, so anyone can try
# PlayMotion from a link: the browser is the TV; a phone (QR code) or the laptop webcam is the camera.
#   .\scripts\deploy-tv.ps1
param([string]$StackName = 'movewell', [string]$Region = 'us-east-1')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$ErrorActionPreference = 'Continue'
aws sts get-caller-identity --query Account --output text *> $null
$signedIn = $LASTEXITCODE -eq 0
$ErrorActionPreference = 'Stop'
if (-not $signedIn) { throw "AWS sign-in expired or missing. Run 'aws login', finish signing in in your browser, then run this script again." }

# Refresh the backend URLs the build bakes in (EXPO_PUBLIC_*), then read where to upload.
& (Join-Path $PSScriptRoot 'write-env.ps1') -StackName $StackName -Region $Region
$o = Get-Content (Join-Path $root 'infra\.stack-outputs.json') -Raw | ConvertFrom-Json
if (-not $o.TvBucketName) { throw 'The stack has no TV hosting yet. Run .\scripts\deploy.ps1 first.' }
$bucket = "s3://$($o.TvBucketName)"

Push-Location (Join-Path $root 'apps\tv')
try {
  # Expo, npm and aws write progress to stderr; check exit codes instead of stopping on it (see deploy.ps1).
  $ErrorActionPreference = 'Continue'
  node node_modules\expo\bin\cli export --platform web --output-dir dist --clear
  if ($LASTEXITCODE -ne 0) { throw 'expo web export failed' }

  # Hashed bundles and assets are cached for a year; index.html is always re-checked.
  aws s3 sync dist $bucket --delete --exclude 'index.html' --cache-control 'public,max-age=31536000,immutable' --region $Region
  if ($LASTEXITCODE -ne 0) { throw 's3 sync failed' }
  aws s3 cp dist\index.html "$bucket/index.html" --cache-control 'no-cache' --content-type 'text/html; charset=utf-8' --region $Region
  if ($LASTEXITCODE -ne 0) { throw 's3 cp index.html failed' }
  aws cloudfront create-invalidation --distribution-id $o.TvDistributionId --paths '/' '/index.html' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'CloudFront invalidation failed' }
} finally {
  Pop-Location
}
Write-Host "`nPlayMotion TV app is live at $($o.TvAppUrl)" -ForegroundColor Green
Write-Host 'Open it in Chrome, then use "Use this laptop''s camera" or scan the QR code with a phone.'
