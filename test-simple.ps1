# Simple test: Register user and call scheduler endpoint
$apiBase = "http://localhost:5044"

# Register user
$registerBody = @{
    email = "test-$(Get-Random)@test.com"
    password = "TestPassword123!"
    firstName = "Test"
    lastName = "User"
} | ConvertTo-Json

Write-Host "Registering user..."
$regResp = Invoke-RestMethod -Uri "$apiBase/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
$token = $regResp.token
Write-Host "✅ User registered"
Write-Host ""

# Call scheduler
Write-Host "Calling scheduler endpoint..."
$schedResp = Invoke-RestMethod -Uri "$apiBase/api/scheduler/run-now" -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json"

Write-Host "Response:"
$schedResp | ConvertTo-Json -Depth 5
