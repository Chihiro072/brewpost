#!/bin/bash

# Load secrets from AWS Secrets Manager
SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id env --region us-east-1 --query SecretString --output text)

# Create .env file from secrets in the ASP.NET Core backend directory
cd backend/BrewPost.API
echo "$SECRET_VALUE" | jq -r 'to_entries[] | "\(.key)=\(.value)"' > .env

# Start the ASP.NET Core backend
nohup dotnet run --urls="http://0.0.0.0:5044" > server.log 2>&1 &