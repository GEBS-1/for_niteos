#!/bin/bash
# Вставьте в VNC-консоль REG.облако целиком (после входа root)
set -e
mkdir -p /root/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHqmIJblNjLIGgu0p3aNVo2GzbX4zGTiQaCrtcjEz6L4 user@User-PC' >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
echo "=== SSH key added ==="
curl -fsSL https://raw.githubusercontent.com/GEBS-1/for_niteos/main/deploy/reg-ru-bootstrap.sh -o /tmp/reg-ru-bootstrap.sh
echo "=== Теперь с вашего ПК запустите deploy/remote-deploy.ps1 ==="
echo "=== Или напишите в чат: ключ добавил ==="
