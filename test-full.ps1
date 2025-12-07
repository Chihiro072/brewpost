# Full test: Create user, post, schedule, and trigger scheduler
$apiBase = "http://localhost:5044"

# 1. Register user
Write-Host "[1] Registering user..."
$registerBody = @{
    email = "test-$(Get-Random -Maximum 999999)@test.com"
    password = "TestPassword123!"
    firstName = "Test"
    lastName = "User"
} | ConvertTo-Json

$regResp = Invoke-RestMethod -Uri "$apiBase/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
$token = $regResp.token
$userId = $regResp.user.id
Write-Host "✅ User created: $userId"

# 2. Create a post
Write-Host ""
Write-Host "[2] Creating a post..."
$postBody = @{
    title = "Auto-Post Test $(Get-Random)"
    caption = "Testing the auto-post scheduler feature"
} | ConvertTo-Json

$postResp = Invoke-RestMethod -Uri "$apiBase/api/posts" -Method Post `
  -Body $postBody `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json"

$postId = $postResp.id
Write-Host "✅ Post created: $postId"

# 3. Create a schedule (time just slightly in future, then wait for it to become due)
Write-Host ""
Write-Host "[3] Creating a schedule with time 2 seconds in future..."
$futureTime = (Get-Date).ToUniversalTime().AddSeconds(2).ToString("o")
$scheduleBody = @{
    postId = $postId
    platform = "linkedin"
    scheduledTime = $futureTime
} | ConvertTo-Json

Write-Host "   Scheduled time: $futureTime"

$schedResp = Invoke-RestMethod -Uri "$apiBase/api/schedules" -Method Post `
  -Body $scheduleBody `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json"

$scheduleId = $schedResp.scheduleId
Write-Host "OK - Schedule created: $scheduleId"

# 4. Wait for schedule to become due, then trigger scheduler
Write-Host ""
Write-Host "[4] Waiting 3 seconds for schedule to become due..."
Start-Sleep -Seconds 3

Write-Host "[5] Triggering scheduler with run-now endpoint..."

try {
  $runResp = Invoke-RestMethod -Uri "$apiBase/api/scheduler/run-now" -Method Post `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json"

  Write-Host ""
  Write-Host "SCHEDULER RESULTS:"
  $runResp | ConvertTo-Json -Depth 10
} catch {
  Write-Host "Error calling scheduler: $_"
}
