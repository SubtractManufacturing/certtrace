#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

# Must match winprint 0.2.1's DEFAULT_PDFIUM_BUILD_ID.
$PdfiumBuildId = if ($env:WINPRINT_PDFIUM_BUILD_ID) { $env:WINPRINT_PDFIUM_BUILD_ID } else { '7802' }

$srcTauri = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $srcTauri 'target'
$staged = Join-Path $srcTauri 'pdfium.dll'

function Find-WinprintPdfiumDll {
    param([string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) {
        return $null
    }
    Get-ChildItem -Path $Root -Recurse -Filter 'pdfium.dll' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '[\\/]build[\\/]winprint-' } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
}

function Get-PdfiumPlatformName {
    switch ($env:CARGO_CFG_TARGET_ARCH) {
        'x86' { return 'win-x86' }
        'aarch64' { return 'win-arm64' }
        default { return 'win-x64' }
    }
}

function Download-PdfiumDll {
    $platform = Get-PdfiumPlatformName
    $url = "https://github.com/bblanchon/pdfium-binaries/releases/download/chromium/$PdfiumBuildId/pdfium-$platform.tgz"
    $work = Join-Path ([System.IO.Path]::GetTempPath()) ("certtrace-pdfium-" + [guid]::NewGuid().ToString('N'))
    $archive = Join-Path $work 'pdfium.tgz'
    New-Item -ItemType Directory -Path $work | Out-Null
    try {
        Write-Host "Downloading $url"
        Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing
        tar -xzf $archive -C $work
        $dll = Get-ChildItem -Path $work -Recurse -Filter 'pdfium.dll' -File | Select-Object -First 1
        if (-not $dll) {
            throw "Downloaded PDFium archive did not contain pdfium.dll ($url)."
        }
        Copy-Item -LiteralPath $dll.FullName -Destination $staged -Force
    }
    finally {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$src = $null
if (Test-Path -LiteralPath $targetDir) {
    $src = Find-WinprintPdfiumDll -Root $targetDir
}
if (-not $src -and $env:CARGO_TARGET_DIR -and (Test-Path -LiteralPath $env:CARGO_TARGET_DIR)) {
    $src = Find-WinprintPdfiumDll -Root $env:CARGO_TARGET_DIR
}

if ($src) {
    Copy-Item -LiteralPath $src.FullName -Destination $staged -Force
    Write-Host "Staged pdfium.dll from $($src.FullName)"
}
else {
    Download-PdfiumDll
    Write-Host "Staged pdfium.dll from pdfium-binaries $PdfiumBuildId"
}

$info = Get-Item -LiteralPath $staged
if ($info.Length -le 0) {
    throw "Staged pdfium.dll is empty. The Windows installer would still fail to start."
}

if (Test-Path -LiteralPath $targetDir) {
    Get-ChildItem -Path $targetDir -Recurse -Filter 'certtrace-desktop.exe' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/]bundle[\\/]' } |
        ForEach-Object {
            Copy-Item -LiteralPath $staged -Destination (Join-Path $_.DirectoryName 'pdfium.dll') -Force
        }
}
