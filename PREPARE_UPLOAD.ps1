$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Get-Location

if (-not (Test-Path (Join-Path $frontendRoot "settings.html"))) {
    throw "Run this script from your ProTrade frontend root folder where settings.html exists."
}

Copy-Item `
    (Join-Path $scriptDir "security-activity.js") `
    (Join-Path $frontendRoot "security-activity.js") `
    -Force

$settingsPath = Join-Path $frontendRoot "settings.html"
$html = Get-Content $settingsPath -Raw

if ($html -notmatch 'src=["'']security-activity\.js["'']') {
    $scriptTag = '  <script src="security-activity.js"></script>'

    if ($html -match '</body>') {
        $html = $html -replace '</body>', "$scriptTag`r`n</body>"
    }
    else {
        $html = "$html`r`n$scriptTag`r`n"
    }

    Set-Content `
        -Path $settingsPath `
        -Value $html `
        -Encoding UTF8

    Write-Host "settings.html patched." -ForegroundColor Green
}
else {
    Write-Host "settings.html already linked." -ForegroundColor Yellow
}

$uploadFolder = Join-Path $frontendRoot "UPLOAD_TO_GITHUB"

Remove-Item $uploadFolder -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $uploadFolder | Out-Null

Copy-Item $settingsPath (Join-Path $uploadFolder "settings.html") -Force
Copy-Item `
    (Join-Path $frontendRoot "security-activity.js") `
    (Join-Path $uploadFolder "security-activity.js") `
    -Force

if (Get-Command node -ErrorAction SilentlyContinue) {
    node --check (Join-Path $frontendRoot "security-activity.js")
    if ($LASTEXITCODE -ne 0) {
        throw "security-activity.js syntax check failed."
    }
    Write-Host "JavaScript syntax test passed." -ForegroundColor Green
}

Write-Host ""
Write-Host "READY TO UPLOAD:" -ForegroundColor Cyan
Write-Host $uploadFolder
Write-Host ""
Write-Host "Upload settings.html and security-activity.js to GitHub main."
