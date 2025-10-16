#!/bin/bash

# Load secrets from AWS Secrets Manager
SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id env --region us-east-1 --query SecretString --output text)

# Create .env file from secrets
echo "$SECRET_VALUE" | jq -r 'to_entries[] | "\(.key)=\(.value)"' > .env

# Start the server (it will read .env file)
pm2 start unified-server.js --name unified-server