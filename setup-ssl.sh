#!/bin/bash

# Install Certbot for Let's Encrypt SSL
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace your-domain.com with your actual domain)
# sudo certbot --nginx -d your-domain.com

# Or use self-signed certificate for testing
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/brewpost.key \
  -out /etc/ssl/certs/brewpost.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=54.242.36.109"

# Update Nginx configuration
sudo tee /etc/nginx/sites-available/brewpost-ssl > /dev/null <<EOF
server {
    listen 80;
    server_name 54.242.36.109;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    server_name 54.242.36.109;

    ssl_certificate /etc/ssl/certs/brewpost.crt;
    ssl_certificate_key /etc/ssl/private/brewpost.key;

    location / {
        root /home/brewpost/brewpost/dist;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:8081;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/brewpost-ssl /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "SSL setup complete. Update Cognito URLs to use https://54.242.36.109"