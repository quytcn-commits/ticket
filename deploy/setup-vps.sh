#!/bin/bash
# =============================================
#  SETUP VPS MỚI - Chạy 1 lần duy nhất
#  bash setup-vps.sh
# =============================================

set -e
echo "========================================="
echo "  Setup VPS for multi-domain Docker"
echo "========================================="

# 1. Update system
echo "→ [1/5] Updating system..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo "→ [2/5] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo ""
    echo "⚠️  Docker installed. Please run:"
    echo "   logout"
    echo "   (login again)"
    echo "   bash setup-vps.sh    # run this script again"
    exit 0
else
    echo "→ [2/5] Docker already installed ✓"
fi

# 3. Install Docker Compose
if ! docker compose version &> /dev/null; then
    echo "→ [3/5] Installing Docker Compose..."
    sudo apt-get install -y docker-compose-plugin
else
    echo "→ [3/5] Docker Compose already installed ✓"
fi

# 4. Create standard directory structure
echo "→ [4/5] Creating directory structure..."
sudo mkdir -p /opt/proxy
sudo mkdir -p /opt/apps
sudo chown -R $USER:$USER /opt/proxy /opt/apps

# 5. Setup shared proxy
echo "→ [5/5] Starting shared reverse proxy..."
cd /opt/proxy

# Download proxy config
cat > docker-compose.yml << 'EOF'
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy:1.6
    container_name: nginx-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - proxy-certs:/etc/nginx/certs:ro
      - proxy-vhost:/etc/nginx/vhost.d
      - proxy-html:/usr/share/nginx/html
      - ./custom.conf:/etc/nginx/conf.d/custom.conf:ro
    networks:
      - proxy-network

  acme-companion:
    image: nginxproxy/acme-companion:2.4
    container_name: nginx-proxy-acme
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - proxy-certs:/etc/nginx/certs:rw
      - proxy-vhost:/etc/nginx/vhost.d
      - proxy-html:/usr/share/nginx/html
      - proxy-acme:/etc/acme.sh
    environment:
      - NGINX_PROXY_CONTAINER=nginx-proxy
      - DEFAULT_EMAIL=admin@luckydraw.work
    depends_on:
      - nginx-proxy
    networks:
      - proxy-network

volumes:
  proxy-certs:
  proxy-vhost:
  proxy-html:
  proxy-acme:

networks:
  proxy-network:
    name: proxy-network
    driver: bridge
EOF

cat > custom.conf << 'EOF'
client_max_body_size 20M;
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
EOF

docker compose up -d

echo ""
echo "========================================="
echo "  VPS SETUP COMPLETE!"
echo "========================================="
echo ""
echo "  Directory structure:"
echo "    /opt/proxy/    ← shared reverse proxy (running)"
echo "    /opt/apps/     ← your projects go here"
echo ""
echo "  Next: deploy your first app"
echo "    cd /opt/apps"
echo "    git clone <repo> ticket"
echo "    cd ticket"
echo "    bash deploy/deploy-ticket.sh"
echo ""
echo "========================================="
