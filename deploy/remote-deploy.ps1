# Деплой с Windows на VPS (нужен SSH-ключ deploy/niteos_deploy_key на сервере)
# Использование: .\deploy\remote-deploy.ps1 -Server 194.226.187.101 -User root

param(
  [string]$Server = "194.226.187.101",
  [string]$User = "root"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$Key = Join-Path $PSScriptRoot "niteos_deploy_key"
$EnvLocal = Join-Path $Root ".env.local"
$EnvProd = Join-Path $Root ".env.production.deploy"

if (-not (Test-Path $Key)) {
  Write-Error "Нет $Key — сначала сгенерируйте ключ (см. DEPLOY.md)"
}

# .env.production для сервера
$token = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$lines = @(
  "NODE_ENV=production",
  "PORT=3000",
  "HOSTNAME=0.0.0.0",
  "LEADS_VIEW_TOKEN=$token"
)
if (Test-Path $EnvLocal) {
  Get-Content $EnvLocal | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    if ($_ -notmatch '^LEADS_VIEW_TOKEN=') { $lines += $_ }
  }
}
$lines | Set-Content $EnvProd -Encoding utf8
Write-Host "LEADS_VIEW_TOKEN (сохраните): $token"

$ssh = "ssh -i `"$Key`" -o StrictHostKeyChecking=accept-new ${User}@${Server}"
$scp = "scp -i `"$Key`" -o StrictHostKeyChecking=accept-new"

Invoke-Expression "$scp `"$EnvProd`" ${User}@${Server}:/tmp/.env.production"
Invoke-Expression "$scp `"$PSScriptRoot\reg-ru-bootstrap.sh`" ${User}@${Server}:/tmp/reg-ru-bootstrap.sh"
Invoke-Expression "$ssh `"bash /tmp/reg-ru-bootstrap.sh`""

Write-Host "Откройте: http://${Server}:3000"
