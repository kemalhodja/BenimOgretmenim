# Render www domain kalici duzeltme (tek seferlik).
# Render Dashboard → Account Settings → API Keys → Create
#
# Kullanim:
#   .\scripts\setup-render-domain.ps1 -ApiKey "rnd_...."
# veya:
#   $env:RENDER_API_KEY="rnd_...."; .\scripts\setup-render-domain.ps1

param(
  [string]$ApiKey = $env:RENDER_API_KEY
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $ApiKey?.Trim()) {
  Write-Host "RENDER_API_KEY gerekli." -ForegroundColor Red
  Write-Host "Render Dashboard → Account → API Keys → Create"
  Write-Host 'Ornek: .\scripts\setup-render-domain.ps1 -ApiKey "rnd_..."'
  exit 1
}

$env:RENDER_API_KEY = $ApiKey.Trim()

Write-Host "[1/3] Render prod sync (domain + env + deploy)..." -ForegroundColor Cyan
node (Join-Path $repoRoot "scripts\render-sync-production.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (Get-Command gh -ErrorAction SilentlyContinue) {
  Write-Host "[2/3] GitHub secret RENDER_API_KEY kaydediliyor..." -ForegroundColor Cyan
  gh secret set RENDER_API_KEY --repo kemalhodja/BenimOgretmenim --body $env:RENDER_API_KEY
  Write-Host "[3/3] GitHub workflow tetikleniyor..." -ForegroundColor Cyan
  gh workflow run render-sync-domains.yml -R kemalhodja/BenimOgretmenim
} else {
  Write-Host "[2/3] gh yok — GitHub secret atlandi." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Tamam. 2-5 dk sonra test:" -ForegroundColor Green
Write-Host '  curl.exe -s "https://www.benimogretmenim.com.tr/" | Select-Object -First 1'
Write-Host "Beklenen: <!DOCTYPE html>"
Write-Host ""
Write-Host "Kalici: API proxy koprusu kaldirilabilir (www web servisinde olunca)."
