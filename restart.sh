#!/bin/bash
pkill -f unified-server || true
cd /home/brewpost/brewpost/server
aws secretsmanager get-secret-value --secret-id env --query SecretString --output text | jq -r 'to_entries[] | "\(.key)=\(.value)"' > .env
echo "Environment variables loaded:"
cat .env
echo "Installing dependencies..."
npm install --production
PORT=8080 nohup node unified-server.js > server.log 2>&1 &
sleep 2
echo "Server started with PID: $(pgrep -f unified-server)"
echo "Server listening on: http://localhost:8080"