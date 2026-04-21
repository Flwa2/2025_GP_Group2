param(
    [switch]$StatusOnly
)

$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$global:WeCastProjectRoot = $script:ProjectRoot

function Get-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key
    )

    $envItem = Get-Item -Path ("Env:{0}" -f $Key) -ErrorAction SilentlyContinue
    if ($envItem -and $envItem.Value) {
        return [string]$envItem.Value
    }

    $envPath = Join-Path $script:ProjectRoot ".env"
    if (-not (Test-Path $envPath)) {
        return ""
    }

    $pattern = "^{0}=(.*)$" -f [regex]::Escape($Key)
    $match = Select-String -Path $envPath -Pattern $pattern | Select-Object -First 1
    if (-not $match) {
        return ""
    }

    $value = $match.Matches[0].Groups[1].Value.Trim()
    return $value.Trim("'`"")
}

function Mask-Secret {
    param(
        [string]$Value
    )

    $trimmed = [string]$Value
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return "missing"
    }

    if ($trimmed.Contains("@")) {
        $parts = $trimmed.Split("@", 2)
        $local = $parts[0]
        $domain = $parts[1]
        if ($local.Length -le 2) {
            return ("{0}*@{1}" -f $local.Substring(0, 1), $domain)
        }
        return ("{0}{1}{2}@{3}" -f $local.Substring(0, 1), ("*" * ($local.Length - 2)), $local.Substring($local.Length - 1, 1), $domain)
    }

    if ($trimmed.Length -le 8) {
        return ("{0}{1}" -f $trimmed.Substring(0, 1), ("*" * [Math]::Max(1, $trimmed.Length - 1)))
    }

    return ("{0}{1}{2}" -f $trimmed.Substring(0, 4), ("*" * ($trimmed.Length - 8)), $trimmed.Substring($trimmed.Length - 4, 4))
}

function Get-StatusFlag {
    param(
        [bool]$Ready
    )

    if ($Ready) {
        return "OK"
    }

    return "MISS"
}

function Write-Section {
    param(
        [string]$Title
    )

    Write-Host ""
    Write-Host ("[{0}]" -f $Title) -ForegroundColor Yellow
}

function Write-StatusLine {
    param(
        [string]$Label,
        [bool]$Ready,
        [string]$Details = ""
    )

    $flag = Get-StatusFlag -Ready $Ready
    $flagColor = if ($Ready) { "Green" } else { "Red" }
    Write-Host ("  {0,-20}" -f $Label) -NoNewline -ForegroundColor Gray
    Write-Host ("[{0}]" -f $flag) -NoNewline -ForegroundColor $flagColor
    if ($Details) {
        Write-Host ("  {0}" -f $Details) -ForegroundColor DarkGray
    } else {
        Write-Host ""
    }
}

function Show-WeCastStatus {
    $venvPath = Join-Path $script:ProjectRoot ".venv\Scripts\Activate.ps1"
    $frontendPackage = Join-Path $script:ProjectRoot "static\frontend\package.json"
    $frontendNodeModules = Join-Path $script:ProjectRoot "static\frontend\node_modules"
    $serviceAccount = Join-Path $script:ProjectRoot "config\service_account.json"

    $ffmpegPath = Get-DotEnvValue -Key "FFMPEG_PATH"
    $ffprobePath = Get-DotEnvValue -Key "FFPROBE_PATH"
    $resendApiKey = Get-DotEnvValue -Key "RESEND_API_KEY"
    $resendFromEmail = Get-DotEnvValue -Key "RESEND_FROM_EMAIL"
    $wecastAppUrl = Get-DotEnvValue -Key "WECAST_APP_URL"

    Write-Host ""
    Write-Host "===============================" -ForegroundColor DarkYellow
    Write-Host "        WeCast Dev Shell       " -ForegroundColor Yellow
    Write-Host "===============================" -ForegroundColor DarkYellow
    Write-Host ("Project  : {0}" -f $script:ProjectRoot) -ForegroundColor Cyan
    Write-Host ("Time     : {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -ForegroundColor DarkGray

    Write-Section "Core"
    Write-StatusLine -Label "Virtual env" -Ready (Test-Path $venvPath) -Details ".venv\Scripts\Activate.ps1"
    Write-StatusLine -Label "Root .env" -Ready (Test-Path (Join-Path $script:ProjectRoot ".env")) -Details ".env"
    Write-StatusLine -Label "Frontend package" -Ready (Test-Path $frontendPackage) -Details "static\frontend\package.json"
    Write-StatusLine -Label "Frontend deps" -Ready (Test-Path $frontendNodeModules) -Details "static\frontend\node_modules"

    Write-Section "Services"
    Write-StatusLine -Label "Firebase admin" -Ready (Test-Path $serviceAccount) -Details "config\service_account.json"
    $ffmpegDetails = if ($ffmpegPath) { Split-Path $ffmpegPath -Leaf } else { "" }
    $ffprobeDetails = if ($ffprobePath) { Split-Path $ffprobePath -Leaf } else { "" }
    Write-StatusLine -Label "FFmpeg path" -Ready (-not [string]::IsNullOrWhiteSpace($ffmpegPath)) -Details $ffmpegDetails
    Write-StatusLine -Label "FFprobe path" -Ready (-not [string]::IsNullOrWhiteSpace($ffprobePath)) -Details $ffprobeDetails

    Write-Section "Custom Email"
    Write-StatusLine -Label "Resend API key" -Ready (-not [string]::IsNullOrWhiteSpace($resendApiKey)) -Details (Mask-Secret $resendApiKey)
    Write-StatusLine -Label "From email" -Ready (-not [string]::IsNullOrWhiteSpace($resendFromEmail)) -Details (Mask-Secret $resendFromEmail)
    Write-StatusLine -Label "App URL" -Ready (-not [string]::IsNullOrWhiteSpace($wecastAppUrl)) -Details $wecastAppUrl

    Write-Section "Commands"
    Write-Host "  wecast-status       Show safe config status" -ForegroundColor Gray
    Write-Host "  wecast-backend      Run Flask backend" -ForegroundColor Gray
    Write-Host "  wecast-frontend     Run Vite frontend" -ForegroundColor Gray
    Write-Host "  wecast-root         Jump to project root" -ForegroundColor Gray
    Write-Host ""
}

function global:wecast-status {
    Set-Location $script:ProjectRoot
    Show-WeCastStatus
}

function global:wecast-root {
    Set-Location $script:ProjectRoot
}

function global:wecast-backend {
    Set-Location $script:ProjectRoot
    python app.py
}

function global:wecast-frontend {
    Set-Location (Join-Path $script:ProjectRoot "static\frontend")
    npm run dev
}

if (-not $StatusOnly) {
    $activateScript = Join-Path $script:ProjectRoot ".venv\Scripts\Activate.ps1"
    if (Test-Path $activateScript) {
        . $activateScript
    }

    try {
        $host.UI.RawUI.WindowTitle = "WeCast Dev Shell"
    } catch {
    }

    function global:prompt {
        $currentPath = (Get-Location).Path.Replace($global:WeCastProjectRoot, "~")
        Write-Host "WeCast" -ForegroundColor Yellow -NoNewline
        Write-Host " [" -ForegroundColor DarkGray -NoNewline
        if ($env:VIRTUAL_ENV) {
            Write-Host "venv" -ForegroundColor Green -NoNewline
        } else {
            Write-Host "plain" -ForegroundColor DarkYellow -NoNewline
        }
        Write-Host "] " -ForegroundColor DarkGray -NoNewline
        Write-Host $currentPath -ForegroundColor Cyan -NoNewline
        return "`n> "
    }
}

Set-Location $script:ProjectRoot
Show-WeCastStatus
