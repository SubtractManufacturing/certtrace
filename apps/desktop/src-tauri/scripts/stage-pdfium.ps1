#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$srcTauri = Split-Path -Parent $PSScriptRoot
$staged = Join-Path $srcTauri 'pdfium.dll'
$searchRoot = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $srcTauri 'target' }

function Find-WinprintPdfiumDll {
    param([string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) {
        return $null
    }
    Get-ChildItem -Path $Root -Recurse -Filter 'pdfium.dll' -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Length -gt 0 -and $_.FullName -match '[\\/]build[\\/]winprint-'
        } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
}

$src = Find-WinprintPdfiumDll -Root $searchRoot
if (-not $src) {
    throw "pdfium.dll not found under winprint build output in $searchRoot. Build the Rust app on Windows first so winprint can unpack its Sigstore-verified PDFium."
}

Copy-Item -LiteralPath $src.FullName -Destination $staged -Force
Write-Host "Staged pdfium.dll from $($src.FullName)"

Get-ChildItem -Path $searchRoot -Recurse -Filter 'certtrace-desktop.exe' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '[\\/]bundle[\\/]' } |
    ForEach-Object {
        Copy-Item -LiteralPath $staged -Destination (Join-Path $_.DirectoryName 'pdfium.dll') -Force
    }
