# Finds which Bedrock models this AWS account can actually invoke from us-east-1 and prints the
# deploy command to use. Run it once before the first deploy (and any time a model call fails).
#   .\scripts\check-bedrock.ps1
param([string]$Region = 'us-east-1')
$ErrorActionPreference = 'Continue'

Write-Host "`nInference profiles in $Region (Claude Haiku + Amazon Nova Lite):" -ForegroundColor Cyan
$profiles = aws bedrock list-inference-profiles --region $Region --query "inferenceProfileSummaries[?contains(inferenceProfileId, 'haiku') || contains(inferenceProfileId, 'nova-lite')].inferenceProfileId" --output json | ConvertFrom-Json
if (-not $profiles) { Write-Host 'Could not list inference profiles. Check "aws configure" and your IAM permissions.' -ForegroundColor Red; exit 1 }
$profiles | ForEach-Object { Write-Host "  $_" }

# Newest Claude Haiku first (US cross-region profiles), then Nova Lite.
$haiku = $profiles | Where-Object { $_ -like 'us.anthropic.claude-haiku*' } | Sort-Object -Descending
$candidates = @($haiku) + @('us.amazon.nova-lite-v1:0')

$tmp = Join-Path $env:TEMP 'movewell-bedrock-check'
New-Item -ItemType Directory -Force $tmp | Out-Null
Set-Content -Path "$tmp\messages.json" -Encoding ascii -Value '[{"role":"user","content":[{"text":"Reply with the single word: ready"}]}]'
# Same request shape the Lambda sends to Claude (thinking off for fast coaching lines).
Set-Content -Path "$tmp\anthropic-fields.json" -Encoding ascii -Value '{"thinking":{"type":"disabled"}}'

$working = @()
Write-Host "`nTest calls (Converse API):" -ForegroundColor Cyan
foreach ($id in $candidates) {
  $cmd = @('bedrock-runtime', 'converse', '--region', $Region, '--model-id', $id, '--messages', "file://$tmp\messages.json", '--inference-config', 'maxTokens=20', '--query', 'output.message.content[0].text', '--output', 'text')
  if ($id -like '*anthropic*') { $cmd += @('--additional-model-request-fields', "file://$tmp\anthropic-fields.json") }
  $out = aws @cmd 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host ("  OK    {0}  ->  {1}" -f $id, ($out | Out-String).Trim()) -ForegroundColor Green
    $working += $id
  } else {
    # Show the whole AWS error (it often spans several lines), not just the last line.
    $message = (($out | Out-String) -replace '\s+', ' ').Trim()
    Write-Host ("  FAIL  {0}`n        {1}" -f $id, $message) -ForegroundColor Yellow
  }
}
Remove-Item -Recurse -Force $tmp

if (-not $working) {
  Write-Host "`nNo model worked. Open the Bedrock console > Model catalog, open Claude Haiku, and complete the" -ForegroundColor Red
  Write-Host 'one-time Anthropic use-case form (or request Nova Lite). The app still runs on templates without it.' -ForegroundColor Red
  exit 1
}
# Keep at most one Claude + Nova as the fallback chain.
$chain = (@($working | Where-Object { $_ -like '*anthropic*' } | Select-Object -First 1) + @($working | Where-Object { $_ -like '*nova*' })) -join ','
Write-Host "`nUse this model chain:" -ForegroundColor Cyan
Write-Host "  $chain"
Write-Host "`nDeploy with:" -ForegroundColor Cyan
Write-Host "  .\scripts\deploy.ps1 -ModelIds `"$chain`""
