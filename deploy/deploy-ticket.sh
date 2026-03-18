#!/bin/bash
# =============================================
#  Deploy QR Check-in → ticket.luckydraw.work
#  Chạy từ thư mục project:
#    cd /opt/apps/ticket
#    bash deploy/deploy-ticket.sh
# =============================================

set -e

echo "========================================="
echo "  Deploy: ticket.luckydraw.work"
echo "========================================="

# 1. Check proxy is running
if ! docker ps | grep -q nginx-proxy; then
    echo "❌ Shared proxy chưa chạy! Chạy trước:"
    echo "   cd /opt/proxy && docker compose up -d"
    exit 1
fi
echo "→ Proxy: running ✓"

# 2. Generate .env if not exists
if [ ! -f .env ]; then
    echo "→ Generating .env with random secrets..."
    cat > .env << EOF
JWT_SECRET=$(openssl rand -hex 32)
HMAC_SECRET=$(openssl rand -hex 32)
ADMIN_USER=admin
ADMIN_PASS=$(openssl rand -base64 12 | tr -d '=/+' | head -c 12)
EOF
    echo ""
    echo "  ┌──────────────────────────────────┐"
    echo "  │  SAVE THESE CREDENTIALS!         │"
    echo "  │  Admin: $(grep ADMIN_USER .env | cut -d= -f2)"
    echo "  │  Pass:  $(grep ADMIN_PASS .env | cut -d= -f2)"
    echo "  └──────────────────────────────────┘"
    echo ""
fi

# 3. Build and deploy
echo "→ Building and starting..."
docker compose up -d --build

# 4. Wait and check
echo "→ Waiting for container..."
sleep 5

if docker ps | grep -q qr-checkin; then
    echo ""
    echo "========================================="
    echo "  DEPLOYED SUCCESSFULLY!"
    echo "========================================="
    echo ""
    echo "  URL:  https://ticket.luckydraw.work"
    echo "  Admin: $(grep ADMIN_USER .env | cut -d= -f2)"
    echo "  Pass:  $(grep ADMIN_PASS .env | cut -d= -f2)"
    echo ""
    echo "  SSL certificate will be auto-issued"
    echo "  (may take 1-2 minutes on first deploy)"
    echo ""
    echo "  Commands:"
    echo "    docker compose logs -f     # View logs"
    echo "    docker compose restart     # Restart"
    echo "    docker compose down        # Stop"
    echo "    docker compose up -d --build  # Rebuild"
    echo ""
    echo "  Backup DB:"
    echo "    docker cp qr-checkin:/app/data/checkin.db ./backup.db"
    echo "========================================="
else
    echo "❌ Container failed to start. Check logs:"
    echo "   docker compose logs"
fi
