#!/bin/bash
# Quick script to check and restart the ASP.NET Core backend on EC2

echo "Checking if BrewPost.API is running..."
ps aux | grep BrewPost.API | grep -v grep

echo ""
echo "Checking port 5044..."
netstat -tlnp | grep 5044 || ss -tlnp | grep 5044

echo ""
echo "Last 20 lines of server logs..."
tail -20 /home/brewpost/brewpost/backend/BrewPost.API/server.log || echo "No server logs found"

echo ""
echo "To restart manually:"
echo "1. cd /home/brewpost/brewpost/backend/BrewPost.API"
echo "2. Kill existing: pkill -f BrewPost.API"
echo "3. Load env: aws secretsmanager get-secret-value --secret-id env --query SecretString --output text | jq -r 'to_entries[] | \"\\(.key)=\\(.value)\"' > .env"
echo "4. Start: nohup dotnet run --urls=\"http://0.0.0.0:5044\" > server.log 2>&1 &"
