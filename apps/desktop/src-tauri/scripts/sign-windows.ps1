#Requires -Version 5.1
# Invoked by Tauri's bundler as the Windows signCommand (see release.yml).
# Tauri swallows this script's stdout/stderr and only reports "failed to run
# powershell" on a non-zero exit, so everything is also appended to a log file
# that the release workflow prints when the build fails.
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$FilePath
)

$ErrorActionPreference = 'Stop'

$logDir = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$logPath = Join-Path $logDir 'sign-windows.log'

function Write-SignLog([string]$Message) {
    "[{0:u}] {1}" -f (Get-Date), $Message | Add-Content -LiteralPath $logPath
}

try {
    Write-SignLog "Signing $FilePath"

    foreach ($name in @(
            'AZURE_ARTIFACT_SIGNING_ENDPOINT',
            'AZURE_ARTIFACT_SIGNING_ACCOUNT',
            'AZURE_ARTIFACT_SIGNING_PROFILE'
        )) {
        if (-not (Test-Path "Env:$name") -or -not (Get-Item "Env:$name").Value) {
            throw "Missing required environment variable: $name"
        }
    }

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "File to sign not found: $FilePath"
    }

    $signTool = Get-Command sign -ErrorAction Stop
    Write-SignLog "sign tool: $($signTool.Source)"

    & sign code artifact-signing `
        --timestamp-url 'http://timestamp.acs.microsoft.com' `
        --artifact-signing-endpoint $env:AZURE_ARTIFACT_SIGNING_ENDPOINT `
        --artifact-signing-account $env:AZURE_ARTIFACT_SIGNING_ACCOUNT `
        --artifact-signing-certificate-profile $env:AZURE_ARTIFACT_SIGNING_PROFILE `
        $FilePath *>&1 | ForEach-Object { Write-SignLog "$_" }

    $code = $LASTEXITCODE
    Write-SignLog "sign exited with code $code"
    if ($code -ne 0) {
        exit $code
    }
}
catch {
    Write-SignLog ("ERROR: " + ($_ | Out-String))
    exit 1
}
