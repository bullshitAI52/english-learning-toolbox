#!/bin/bash
set -e

echo "========================================"
echo "  English Learning Toolbox - Deploy"
echo "========================================"
echo ""

PROJECT_DIR="/root/english-learning-toolbox"
NGINX_ROOT="/var/www/html/my-website"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

# ---- 1. Node.js ----
echo "[1/5] Checking Node.js..."
if ! command -v node &>/dev/null; then
    echo "  Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

# ---- 2. PM2 ----
echo "[2/5] Checking PM2..."
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi
echo "  PM2: $(pm2 -v)"

# ---- 3. Dependencies ----
echo "[3/5] Installing dependencies..."
cd "$PROJECT_DIR/server"
npm install --production

# ---- 4. Environment ----
echo "[4/5] Configuring environment..."
if [ ! -f "$PROJECT_DIR/server/.env" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    cat > "$PROJECT_DIR/server/.env" << ENVEOF
JWT_SECRET=$JWT_SECRET
PORT=3000
ENVEOF
    echo "  Generated .env with random JWT_SECRET"
else
    echo "  .env already exists, skipped"
fi

# ---- 5. Nginx ----
echo "[5/5] Configuring Nginx..."
if command -v nginx &>/dev/null; then
    mkdir -p "$NGINX_ROOT" /etc/nginx/ssl

    # Copy frontend files
    cp "$PROJECT_DIR/index.html" "$PROJECT_DIR/style.css" "$PROJECT_DIR/script.js" "$NGINX_ROOT/"

    # Create Nginx config
    cat > /etc/nginx/sites-available/english << 'NGXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/html/my-website;
    index index.html;
    client_max_body_size 100M;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGXEOF

    ln -sf /etc/nginx/sites-available/english /etc/nginx/sites-enabled/english
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo "  Nginx configured"
else
    echo "  Nginx not found, install it: apt install nginx"
fi

# ---- 6. Start ----
echo ""
echo "Starting backend..."
pm2 delete english-backend 2>/dev/null || true
pm2 start "$PROJECT_DIR/server/index.js" --name english-backend
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "========================================"
echo "  Deploy Complete!"
echo "========================================"
echo "  HTTP:  http://$SERVER_IP"
echo "  API:   http://$SERVER_IP:3000/health"
echo ""
echo "  First admin? Run:"
echo "    cd $PROJECT_DIR/server"
echo "    node -e \"const db=require('./db');db.run('UPDATE users SET is_admin=1,approved=1 WHERE id=1')\""
echo "========================================"
