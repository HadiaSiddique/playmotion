# Builds apps/phone and publishes it to S3 + CloudFront (HTTPS, so the phone camera works).
#   .\scripts\deploy-phone.ps1
param([string]$StackName = 'movewell', [string]$Region = 'us-east-1')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$ErrorActionPreference = 'Continue'
aws sts get-caller-identity --query Account --output text *> $null
$signedIn = $LASTEXITCODE -eq 0
$ErrorActionPreference = 'Stop'
if (-not $signedIn) { throw "AWS sign-in expired or missing. Run 'aws login', finish signing in in your browser, then run this script again." }

# Always refresh the URLs so the build points at the deployed backend.
& (Join-Path $PSScriptRoot 'write-env.ps1') -StackName $StackName -Region $Region
$o = Get-Content (Join-Path $root 'infra\.stack-outputs.json') -Raw | ConvertFrom-Json
$bucket = "s3://$($o.WebBucketName)"

Push-Location (Join-Path $root 'apps\phone')
try {
  # npm/vite/aws write progress to stderr; check exit codes instead of stopping on it (see deploy.ps1).
  $ErrorActionPreference = 'Continue'
  # npm.cmd, not npm: the npm.ps1 shim is blocked by the default execution policy.
  if (-not (Test-Path node_modules)) {
    npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  }
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'vite build failed' }

  # Hashed assets are cached for a year; index.html is always re-checked. The Polly cache (tts/) is left alone.
  aws s3 sync dist $bucket --delete --exclude 'tts/*' --exclude 'index.html' --cache-control 'public,max-age=31536000,immutable' --region $Region
  if ($LASTEXITCODE -ne 0) { throw 's3 sync failed' }
  aws s3 cp dist\index.html "$bucket/index.html" --cache-control 'no-cache' --content-type 'text/html; charset=utf-8' --region $Region
  if ($LASTEXITCODE -ne 0) { throw 's3 cp index.html failed' }
  aws cloudfront create-invalidation --distribution-id $o.DistributionId --paths '/' '/index.html' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'CloudFront invalidation failed' }
} finally {
  Pop-Location
}
Write-Host "`nPhone app is live at $($o.PhoneAppUrl)" -ForegroundColor Green
Write-Host 'Test it: node scripts\fake-tv.mjs, then open the link it prints on your phone.'
