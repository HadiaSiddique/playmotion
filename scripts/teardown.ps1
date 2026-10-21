# Deletes the whole PlayMotion stack (after the hackathon). Empties the web bucket first,
# because CloudFormation cannot delete a bucket that still has files.
param([string]$StackName = 'movewell', [string]$Region = 'us-east-1')
$ErrorActionPreference = 'Stop'
$bucket = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" --output text
$answer = Read-Host "Delete stack '$StackName' and everything in s3://$bucket ? Type yes"
if ($answer -ne 'yes') { Write-Host 'Cancelled.'; exit 0 }
aws s3 rm "s3://$bucket" --recursive --region $Region
sam delete --stack-name $StackName --region $Region --no-prompts
