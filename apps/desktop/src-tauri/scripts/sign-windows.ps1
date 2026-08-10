#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$FilePath
)

$ErrorActionPreference = 'Stop'

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

sign code artifact-signing `
    --timestamp-url 'http://timestamp.acs.microsoft.com' `
    --artifact-signing-endpoint $env:AZURE_ARTIFACT_SIGNING_ENDPOINT `
    --artifact-signing-account $env:AZURE_ARTIFACT_SIGNING_ACCOUNT `
    --artifact-signing-certificate-profile $env:AZURE_ARTIFACT_SIGNING_PROFILE `
    $FilePath

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
