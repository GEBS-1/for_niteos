#!/usr/bin/env bash
# Первичная установка NITEOS на Ubuntu VPS (REG.облако, 1 GB RAM)
# Запуск на сервере: bash reg-ru-bootstrap.sh
set -euo pipefail

APP_DIR="/opt/niteos"
REPO="https://github.com/GEBS-1/for_niteos.git"
BRANCH="main"

echo "==> Swap 2G (нужно для npm run build на 1 GB RAM)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Node.js 22"
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1)" != "v22" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs git ca-certificates
fi

echo "==> PM2"
npm install -g pm2

echo "==> Клонирование"
mkdir -p "$(dirname "$APP_DIR")"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR" && git stash push -u -m "deploy-stash" 2>/dev/null || true
  git fetch origin && git checkout "$BRANCH" && git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

if [[ -f /tmp/.env.production ]]; then
  cp /tmp/.env.production .env.production
fi
if [[ ! -f .env.production ]]; then
  echo "ERROR: нет .env.production — загрузите на сервер в /tmp/.env.production"
  exit 1
fi

mkdir -p data
chown -R "$(whoami):$(whoami)" data 2>/dev/null || true

echo "==> Сборка (может занять 5–15 мин на 1 GB RAM)"
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=1536"
npm ci
npm run build

echo "==> PM2"
pm2 delete niteos 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u root --hp /root 2>/dev/null || \
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$(whoami)" --hp "$HOME" || true

echo "==> UFW"
if command -v ufw &>/dev/null; then
  ufw allow OpenSSH || true
  ufw allow 3000/tcp || true
  ufw --force enable || true
fi

echo ""
echo "Готово: http://$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3000"
echo "Админка: /admin/leads"
echo "Проверка: curl -s http://127.0.0.1:3000/api/ai-status"
