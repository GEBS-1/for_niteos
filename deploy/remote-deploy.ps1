# Deploy from Windows to VPS (add deploy/niteos_deploy_key.pub to server first)
# Usage: .\deploy\remote-deploy.ps1 -Server 194.226.187.101 -User root

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
  Write-Error "Missing $Key - generate SSH key first (see DEPLOY.md)"
}

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
Write-Host "LEADS_VIEW_TOKEN (save this): $token"

$ssh = "ssh -i `"$Key`" -o StrictHostKeyChecking=accept-new ${User}@${Server}"
$scp = "scp -i `"$Key`" -o StrictHostKeyChecking=accept-new"

& scp -i $Key -o StrictHostKeyChecking=accept-new $EnvProd "${User}@${Server}:/tmp/.env.production"
& scp -i $Key -o StrictHostKeyChecking=accept-new (Join-Path $PSScriptRoot "reg-ru-bootstrap.sh") "${User}@${Server}:/tmp/reg-ru-bootstrap.sh"
& ssh -i $Key -o StrictHostKeyChecking=accept-new "${User}@${Server}" "bash /tmp/reg-ru-bootstrap.sh"

Write-Host "Open: http://${Server}:3000"
