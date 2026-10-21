# Builds and deploys the PlayMotion backend (us-east-1), then writes the app .env files.
#   .\scripts\deploy.ps1                                   # default model chain
#   .\scripts\deploy.ps1 -ModelIds "id1,id2"               # chain printed by check-bedrock.ps1
param(
  [string]$ModelIds = '',
  [string]$StackName = 'movewell'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Fail fast with a clear message when the AWS sign-in has expired (otherwise SAM fails half-way through).
$ErrorActionPreference = 'Continue'
aws sts get-caller-identity --query Account --output text *> $null
$signedIn = $LASTEXITCODE -eq 0
$ErrorActionPreference = 'Stop'
if (-not $signedIn) { throw "AWS sign-in expired or missing. Run 'aws login', finish signing in in your browser, then run this script again." }

& (Join-Path $PSScriptRoot 'sync-shared.ps1')

Push-Location (Join-Path $root 'infra')
try {
  # SAM writes progress to stderr. With 'Stop', Windows PowerShell turns that into an error whenever
  # output is captured or redirected, so rely on the exit codes below instead.
  $ErrorActionPreference = 'Continue'
  sam build
  if ($LASTEXITCODE -ne 0) { throw 'sam build failed' }

  $deployArgs = @('deploy', '--stack-name', $StackName)
  if ($ModelIds) { $deployArgs += @('--parameter-overrides', "BedrockModelIds=$ModelIds", "BedrockVisionModelIds=$ModelIds") }
  sam @deployArgs
  if ($LASTEXITCODE -ne 0) { throw 'sam deploy failed' }
} finally {
  Pop-Location
}

& (Join-Path $PSScriptRoot 'write-env.ps1') -StackName $StackName
