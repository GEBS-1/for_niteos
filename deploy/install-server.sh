#!/usr/bin/env bash
# Первичная установка на Ubuntu VPS (без Docker)
# Запуск: bash deploy/install-server.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/for_niteos}"
REPO="${REPO:-https://github.com/GEBS-1/for_niteos.git}"

echo "==> Node.js 22"
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> PM2"
sudo npm install -g pm2

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> Clone $REPO"
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  cp deploy/env.production.example .env.production
  echo "!!! Отредактируйте $APP_DIR/.env.production (ключи AI, LEADS_VIEW_TOKEN)"
fi

echo "==> npm ci && build"
npm ci
npm run build

echo "==> PM2 start"
pm2 start deploy/ecosystem.config.cjs || pm2 restart niteos
pm2 save

echo "==> Готово. Проверка: curl -s http://127.0.0.1:3000/api/ai-status"
echo "    Nginx: см. deploy/nginx.conf.example"
