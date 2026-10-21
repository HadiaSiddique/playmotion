# End-to-end check of the deployed HTTP API: onboarding -> plan -> check-in -> session -> report -> voice.
# Every step prints whether Bedrock ("ai") or the template fallback answered.
#   .\scripts\smoke-test.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outputs = Get-Content (Join-Path $root 'infra\.stack-outputs.json') -Raw | ConvertFrom-Json
$api = $outputs.HttpApiUrl

function Post($path, $body) {
  Invoke-RestMethod -Method Post -Uri "$api$path" -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 10)
}
function Step($name) { Write-Host "`n== $name" -ForegroundColor Cyan }

Step 'GET /health'
Invoke-RestMethod "$api/health" | Format-List

Step 'POST /onboard (older adult, balance goal, needs a chair)'
$onboard = Post '/onboard' @{
  timezone = 'Asia/Karachi'; country = 'PK'
  answers  = @{
    who = 'older_adult'; goal = 'balance'; mobility = 'chair'; painAreas = @('knees'); activityLevel = 'low'
    food = @{ mealsPerDay = 3; sugaryDrinks = 'daily'; eatingOut = 'mostly_home' }
    sleep = 3; mood = 3; sessionMinutes = 10; language = 'en-US'; shareWith = 'family'; displayName = 'Ammi'; reminderTime = '18:00'
  }
}
$userId = $onboard.userId
Write-Host "userId: $userId   mode: $($onboard.plan.mode)   explanation: $($onboard.plan.explanation.source)"
Write-Host "summary: $($onboard.plan.explanation.summary)"
Write-Host "reminders: session=$($onboard.reminders.session) water=$($onboard.reminders.water)"

Step 'GET /plan'
$plan = Invoke-RestMethod "$api/plan?userId=$userId"
Write-Host "today: $($plan.today.game), $($plan.today.minutes) min, moves: $(($plan.today.exercises | ForEach-Object { $_.id }) -join ', ')"

Step 'POST /checkin (low mood -> Calm River)'
$check = Post '/checkin' @{ userId = $userId; mood = 2; energy = 2; sleep = 3 }
Write-Host "today: $($check.today.game) ($($check.today.adapted))   coach [$($check.coach.source)]: $($check.coach.line)"
Write-Host "voice: $($check.coach.audioUrl)"

Step 'POST /checkin (worrying words -> support screen)'
$support = Post '/checkin' @{ userId = $userId; mood = 3; energy = 3; sleep = 3; note = 'I feel hopeless'; withVoice = $false }
Write-Host "safety: $($support.safety.level)   helplines: $(($support.safety.helplines | ForEach-Object { $_.name }) -join '; ')"

Step 'POST /session/complete (with chair-stand test)'
$done = Post '/session/complete' @{
  userId = $userId; game = 'calm_river'; durationSec = 300; moodBefore = 2; moodAfter = 4; energyBefore = 2; energyAfter = 3
  exercises = @(@{ id = 'breathing'; reps = 8; formScore = 90 }); fallTest = @{ type = 'chair_stand_30s'; stands = 9 }
}
Write-Host "xp +$($done.gained.xp)  level $($done.gained.level)  streak $($done.gained.streak)  badges: $($done.gained.newBadges -join ', ')"
Write-Host "celebration: $($done.celebration.line)"

Step 'GET /report'
$report = Invoke-RestMethod "$api/report?userId=$userId"
Write-Host "[$($report.source)] $($report.summary)"
Write-Host "active minutes: $($report.stats.activeMinutes) / 150, mood lift: $($report.stats.moodLift)"

Step 'GET /voice/pack?style=coach'
$pack = Invoke-RestMethod "$api/voice/pack?style=coach"
$ok = @($pack.cues.PSObject.Properties | Where-Object { $_.Value.url }).Count
Write-Host "$ok cue lines synthesised by Polly"

Step 'POST /onboard (kid) + POST /story'
$kid = Post '/onboard' @{ answers = @{ who = 'kid' }; kid = @{ nickname = 'Zee'; avatar = 'fox'; parentPin = '2468' }; timezone = 'Asia/Karachi' }
$story = Post '/story' @{ userId = $kid.userId; game = 'jungle_quest'; chapter = 0 }
Write-Host "[$($story.source)] $($story.text)"
Write-Host "voice: $($story.audioUrl)"

Write-Host "`nSmoke test finished. Adult userId: $userId" -ForegroundColor Green
