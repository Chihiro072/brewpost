#!/bin/bash
# Quick script to check and restart the server on EC2

echo "Checking if unified-server is running..."
ps aux | grep unified-server | grep -v grep

echo ""
echo "Checking port 8080..."
netstat -tlnp | grep 8080 || ss -tlnp | grep 8080

echo ""
echo "Last 20 lines of server logs (if using PM2)..."
pm2 logs unified-server --lines 20 --nostream || echo "PM2 not found or server not managed by PM2"

echo ""
echo "To restart manually:"
echo "1. cd /home/brewpost/brewpost"
echo "2. Kill existing: pkill -f unified-server"
echo "3. Load env: source <(aws secretsmanager get-secret-value --secret-id brewpost-env --query SecretString --output text | jq -r 'to_entries|map(\"export \\(.key)=\\(.value|tostring)\")|.[]')"
echo "4. Start: nohup node unified-server.js > server.log 2>&1 &"
