# Play Console → Kurulum → Uygulama bütünlüğü → App signing key certificate SHA-256
# Kullanım:
#   .\scripts\write-assetlinks.ps1 -Sha256 "AA:BB:CC:..."
# Play SHA eklerken (upload key kalır):
#   .\scripts\write-assetlinks.ps1 -Sha256 "PLAY:SHA:..." -Append
param(
    [Parameter(Mandatory = $true)]
    [string]$Sha256,
    [switch]$Append
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$outPath = Join-Path $repoRoot "apps\web\public\.well-known\assetlinks.json"
$normalized = ($Sha256 -replace "\s", "").ToUpperInvariant()

$existing = @()
if ($Append -and (Test-Path $outPath)) {
    try {
        $parsed = Get-Content $outPath -Raw | ConvertFrom-Json
        $fps = $parsed[0].target.sha256_cert_fingerprints
        if ($fps) { $existing = @($fps) }
    } catch {
        Write-Warning "Mevcut assetlinks okunamadi; yeni dosya olusturulacak."
    }
}

$all = @($existing + $normalized | Select-Object -Unique)

$json = @(
    @{
        relation = @("delegate_permission/common.handle_all_urls")
        target   = @{
            namespace                   = "android_app"
            package_name                = "benimogretmenim.com.tr"
            sha256_cert_fingerprints    = $all
        }
    }
) | ConvertTo-Json -Depth 6

$dir = Split-Path $outPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
Set-Content -Path $outPath -Value $json -Encoding UTF8
Write-Host "Yazildi: $outPath"
Write-Host "Parmak izleri: $($all -join ', ')"
Write-Host "Sonraki: web deploy, sonra curl https://benimogretmenim.com.tr/.well-known/assetlinks.json"
