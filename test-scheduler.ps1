# Test script for the scheduler endpoint
$apiBase = "http://localhost:5044"

# Step 1: Register a test user
$randomId = Get-Random -Maximum 999999
$testEmail = "scheduler-test-$randomId@test.com"
$testPassword = "TestPassword123!"

Write-Host "Step 1: Registering test user..."
Write-Host "Email: $testEmail"

$registerBody = @{
    email = $testEmail
    password = $testPassword
    firstName = "Scheduler"
    lastName = "Tester"
} | ConvertTo-Json

try {
    $registerResp = Invoke-RestMethod -Uri "$apiBase/api/auth/register" `
        -Method Post `
        -Body $registerBody `
        -ContentType "application/json"
    
    Write-Host "✅ Registration successful"
    $token = $registerResp.token
    $userId = $registerResp.user.id
    Write-Host "User ID: $userId"
    Write-Host "Token received (first 60 chars): $($token.Substring(0, 60))..."
}
catch {
    Write-Host "❌ Registration failed: $_"
    exit 1
}

# Step 2: Create a test post
Write-Host ""
Write-Host "Step 2: Creating a test post..."

$postBody = @{
    title = "Test Post for Scheduler"
    caption = "This is a test post to verify scheduler is working"
} | ConvertTo-Json

try {
    $postResp = Invoke-RestMethod -Uri "$apiBase/api/posts" `
        -Method Post `
        -Body $postBody `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $token" }
    
    Write-Host "✅ Post created"
    $postId = $postResp.id
    Write-Host "Post ID: $postId"
}
catch {
    Write-Host "❌ Post creation failed: $_"
    exit 1
}

# Step 3: Create a schedule (with time in the past so it's due immediately)
Write-Host ""
Write-Host "Step 3: Creating a schedule for the post..."

$scheduledTime = (Get-Date).ToUniversalTime().AddMinutes(-1).ToString("o")
$scheduleBody = @{
    postId = $postId
    platform = "linkedin"
    scheduledTime = $scheduledTime
} | ConvertTo-Json

Write-Host "Scheduled time (past): $scheduledTime"

try {
    $scheduleResp = Invoke-RestMethod -Uri "$apiBase/api/schedules" `
        -Method Post `
        -Body $scheduleBody `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $token" }
    
    Write-Host "✅ Schedule created"
    Write-Host ($scheduleResp | ConvertTo-Json -Depth 3)
}
catch {
    Write-Host "❌ Schedule creation failed: $_"
    exit 1
}

# Step 4: Call the scheduler endpoint
Write-Host ""
Write-Host "Step 4: Triggering scheduler with run-now endpoint..."

try {
    $runResp = Invoke-RestMethod -Uri "$apiBase/api/scheduler/run-now" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $token" } `
        -ContentType "application/json"
    
    Write-Host "✅ Scheduler run completed"
    Write-Host ($runResp | ConvertTo-Json -Depth 5)
}
catch {
    Write-Host "❌ Scheduler run failed: $_"
    exit 1
}

Write-Host ""
Write-Host "✅ All tests completed successfully!"
