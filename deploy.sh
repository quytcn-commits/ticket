#!/bin/bash
# =============================================
#  Deploy QR Check-in trên VPS Ubuntu
#  Chạy: bash deploy.sh your-domain.com
# =============================================

set -e

DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@$DOMAIN"}

echo "========================================="
echo "  Deploy QR Check-in System"
echo "  Domain: $DOMAIN"
echo "========================================="

# 1. Install Docker (if not exists)
if ! command -v docker &> /dev/null; then
    echo "→ Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "  Docker installed. Please logout and login again, then re-run this script."
    exit 0
fi

# 2. Install Docker Compose (if not exists)
if ! command -v docker compose &> /dev/null; then
    echo "→ Installing Docker Compose..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

# 3. Create .env for production
if [ ! -f .env.production ]; then
    echo "→ Creating .env.production..."
    cat > .env.production << EOF
JWT_SECRET=$(openssl rand -hex 32)
HMAC_SECRET=$(openssl rand -hex 32)
ADMIN_USER=admin
ADMIN_PASS=$(openssl rand -base64 12)
EOF
    echo "  Created .env.production"
    echo "  ⚠️  ADMIN PASSWORD: $(grep ADMIN_PASS .env.production | cut -d= -f2)"
    echo "  ⚠️  Save this password! You'll need it to login."
fi

# 4. Update nginx config with actual domain
echo "→ Configuring nginx for $DOMAIN..."
sed -i "s/your-domain.com/$DOMAIN/g" nginx/nginx.conf

# 5. First run: get SSL cert (need nginx on port 80 first)
echo "→ Getting SSL certificate..."

# Temporarily start with HTTP-only nginx
cat > /tmp/nginx-temp.conf << 'TMPEOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }
    location / {
        return 200 'Setting up...';
        add_header Content-Type text/plain;
    }
}
TMPEOF
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /tmp/nginx-temp.conf

# Start temp nginx for certbot
docker run -d --name temp-nginx \
    -p 80:80 \
    -v /tmp/nginx-temp.conf:/etc/nginx/conf.d/default.conf:ro \
    -v certbot-var:/var/lib/letsencrypt \
    nginx:alpine 2>/dev/null || true

sleep 2

# Get certificate
docker run --rm \
    -v certbot-etc:/etc/letsencrypt \
    -v certbot-var:/var/lib/letsencrypt \
    certbot/certbot certonly \
    --webroot --webroot-path=/var/lib/letsencrypt \
    --email $EMAIL \
    --agree-tos --no-eff-email \
    -d $DOMAIN 2>/dev/null || echo "  SSL cert may already exist or domain not pointed to this server"

# Stop temp nginx
docker rm -f temp-nginx 2>/dev/null || true

# 6. Build and start
echo "→ Building and starting..."
docker compose --env-file .env.production up -d --build

echo ""
echo "========================================="
echo "  DEPLOYED SUCCESSFULLY!"
echo "========================================="
echo ""
echo "  URL:      https://$DOMAIN"
echo "  Admin:    $(grep ADMIN_USER .env.production | cut -d= -f2)"
echo "  Password: $(grep ADMIN_PASS .env.production | cut -d= -f2)"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f        # View logs"
echo "    docker compose restart app    # Restart app"
echo "    docker compose down           # Stop all"
echo "    docker compose up -d --build  # Rebuild & restart"
echo ""
echo "  SSL auto-renew is configured via certbot container."
echo "========================================="
