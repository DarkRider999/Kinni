<#
.SYNOPSIS
    One-shot installer for MARK LV ("JARVIS") on Windows 10 / 11.

.DESCRIPTION
    Takes a bare Windows PC to a working JARVIS with a desktop shortcut:

      1. Finds Python 3.11-3.13 (prefers 3.12), installs 3.12 via winget if absent.
      2. Finds Git, installs it via winget if absent.
      3. Clones https://github.com/FatihMakes/Mark-LV (or fast-forwards an
         existing clone - re-running this script is how you update).
      4. Creates an isolated virtual environment (.venv) so nothing touches
         your system Python or other projects.
      5. Installs requirements.txt + Playwright browsers (chromium, firefox).
      6. Repairs pywin32 registration and the VC++ runtime if needed.
      7. Verifies every critical import, byte-compiles the project, and checks
         that a microphone is visible.
      8. Writes Start-Jarvis.bat and a desktop shortcut with the JARVIS icon.

    Safe to re-run at any time: every step is idempotent. Your API key
    (config\api_keys.json) and memories (memory\long_term.json) are git-ignored
    upstream, so an update never overwrites them.

.PARAMETER InstallDir
    Where to put Mark-LV. Default: %USERPROFILE%\Mark-LV

.PARAMETER SkipBrowsers
    Skip the ~300 MB Playwright browser download (browser automation only).

.PARAMETER NoShortcut
    Do not create the desktop shortcut.

.PARAMETER Launch
    Start JARVIS as soon as installation finishes.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\install-jarvis.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\install-jarvis.ps1 -InstallDir D:\Apps\Mark-LV -Launch
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:USERPROFILE 'Mark-LV'),
    [string]$RepoUrl    = 'https://github.com/FatihMakes/Mark-LV.git',
    [switch]$SkipBrowsers,
    [switch]$NoShortcut,
    [switch]$Launch
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$SupportedPython = @('3.12', '3.13', '3.11')   # order = preference
$LogFile = Join-Path $env:TEMP ('jarvis-install-{0:yyyyMMdd-HHmmss}.log' -f (Get-Date))

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
function Write-Step([string]$Message) { Write-Host ''; Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)   { Write-Host "    [OK] $Message" -ForegroundColor Green }
function Write-Note([string]$Message) { Write-Host "    [!]  $Message" -ForegroundColor Yellow }
function Stop-Install([string]$Message) {
    Write-Host ''
    Write-Host "[X] $Message" -ForegroundColor Red
    Write-Host "    Full log: $LogFile" -ForegroundColor Red
    try { Stop-Transcript | Out-Null } catch { }
    exit 1
}

# Native tools write progress to stderr; under 'Stop' Windows PowerShell 5.1
# can turn that into a terminating error. Judge success by exit code instead.
function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$Exe,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory)][string]$What,
        [switch]$AllowFailure
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        # Out-Host streams progress live and keeps it out of the return value.
        & $Exe @Arguments | Out-Host
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($code -ne 0 -and -not $AllowFailure) { Stop-Install "$What failed (exit code $code)." }
    return $code
}

# Run a native command silently and return trimmed stdout, or $null on failure.
function Get-NativeOutput {
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @())
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Exe @Arguments 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        if ($null -eq $out) { return $null }
        return (($out | Out-String).Trim())
    } catch {
        return $null
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = ($machine, $user | Where-Object { $_ }) -join ';'
}

function Test-Command([string]$Name) { [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

function Install-WingetPackage {
    param([Parameter(Mandatory)][string]$Id, [Parameter(Mandatory)][string]$Name, [switch]$UserScope)
    if (-not (Test-Command 'winget')) {
        Stop-Install ("$Name is not installed and winget is unavailable on this PC. " +
                      "Install 'App Installer' from the Microsoft Store (it provides winget), or install $Name manually, then re-run this script.")
    }
    Write-Host "    Installing $Name via winget (this can take a few minutes)..."
    $wingetArgs = @('install', '--id', $Id, '--exact', '--source', 'winget',
                    '--accept-package-agreements', '--accept-source-agreements', '--silent')
    if ($UserScope) { $wingetArgs += @('--scope', 'user') }
    # winget returns non-zero for "already installed"; presence is re-checked by the caller.
    [void](Invoke-Native -Exe 'winget' -Arguments $wingetArgs -What "winget install $Id" -AllowFailure)
    Update-SessionPath
}

# ---------------------------------------------------------------------------
# Python discovery
# ---------------------------------------------------------------------------
function Find-SupportedPython {
    # 1) The py launcher - the reliable way on Windows, immune to the
    #    Microsoft Store 'python' alias stub.
    if (Test-Command 'py') {
        foreach ($v in $SupportedPython) {
            $exe = Get-NativeOutput -Exe 'py' -Arguments @("-$v", '-c', 'import sys; print(sys.executable)')
            if ($exe -and (Test-Path $exe)) { return $exe }
        }
    }
    # 2) Standard install locations (per-user and all-users).
    foreach ($v in $SupportedPython) {
        $tag = $v -replace '\.', ''
        $candidates = @(
            (Join-Path $env:LOCALAPPDATA "Programs\Python\Python$tag\python.exe"),
            (Join-Path $env:ProgramFiles "Python$tag\python.exe")
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) {
                $ver = Get-NativeOutput -Exe $c -Arguments @('-c', 'import sys; print("%d.%d" % sys.version_info[:2])')
                if ($ver -eq $v) { return $c }
            }
        }
    }
    return $null
}

function Get-PythonVersion([string]$Exe) {
    Get-NativeOutput -Exe $Exe -Arguments @('-c', 'import sys; print("%d.%d" % sys.version_info[:2])')
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
Start-Transcript -Path $LogFile -Force | Out-Null

Write-Host ''
Write-Host '  MARK LV / JARVIS - Windows installer' -ForegroundColor Magenta
Write-Host "  Install directory : $InstallDir"
Write-Host "  Log file          : $LogFile"

# --- 0. Platform sanity -----------------------------------------------------
Write-Step 'Checking this PC'
if (-not [Environment]::Is64BitOperatingSystem) {
    Stop-Install 'A 64-bit Windows is required (PyQt6 and OpenCV ship 64-bit wheels only).'
}
$osBuild = [Environment]::OSVersion.Version.Build
if ($osBuild -lt 17763) { Write-Note "Windows build $osBuild is older than Windows 10 1809; winget may be unavailable." }
$freeGb = [math]::Round((Get-PSDrive -Name ($InstallDir.Substring(0, 1))).Free / 1GB, 1)
if ($freeGb -lt 3) { Stop-Install "Only $freeGb GB free on drive $($InstallDir.Substring(0,1)): - at least 3 GB is needed." }
Write-Ok "64-bit Windows (build $osBuild), $freeGb GB free"

# --- 1. Python --------------------------------------------------------------
Write-Step 'Locating Python 3.11 - 3.13'
$basePython = Find-SupportedPython
if (-not $basePython) {
    Install-WingetPackage -Id 'Python.Python.3.12' -Name 'Python 3.12' -UserScope
    $basePython = Find-SupportedPython
    if (-not $basePython) {
        Stop-Install ('Python 3.12 could not be installed automatically. Install it from https://www.python.org/downloads/ ' +
                      '(tick "Add python.exe to PATH"), then re-run this script.')
    }
}
Write-Ok "Python $(Get-PythonVersion $basePython) at $basePython"

# --- 2. Git -----------------------------------------------------------------
Write-Step 'Locating Git'
if (-not (Test-Command 'git')) {
    $gitCmd = Join-Path $env:ProgramFiles 'Git\cmd'
    if (Test-Path (Join-Path $gitCmd 'git.exe')) { $env:Path = "$env:Path;$gitCmd" }
}
if (-not (Test-Command 'git')) {
    Install-WingetPackage -Id 'Git.Git' -Name 'Git'
    $gitCmd = Join-Path $env:ProgramFiles 'Git\cmd'
    if (-not (Test-Command 'git') -and (Test-Path (Join-Path $gitCmd 'git.exe'))) { $env:Path = "$env:Path;$gitCmd" }
    if (-not (Test-Command 'git')) { Stop-Install 'Git could not be installed automatically. Install it from https://git-scm.com/download/win and re-run.' }
}
Write-Ok (Get-NativeOutput -Exe 'git' -Arguments @('--version'))

# --- 3. Clone or update -----------------------------------------------------
Write-Step 'Fetching Mark-LV source'
if (Test-Path (Join-Path $InstallDir '.git')) {
    Write-Host '    Existing clone found - updating (your config and memory are untouched)...'
    [void](Invoke-Native -Exe 'git' -Arguments @('-C', $InstallDir, 'pull', '--ff-only') -What 'git pull')
} elseif ((Test-Path $InstallDir) -and (Get-ChildItem -Force $InstallDir | Select-Object -First 1)) {
    Stop-Install "$InstallDir exists, is not empty, and is not a git clone. Choose another folder with -InstallDir or empty it."
} else {
    [void](Invoke-Native -Exe 'git' -Arguments @('clone', '--depth', '1', $RepoUrl, $InstallDir) -What 'git clone')
}
$face = Join-Path $InstallDir 'core\face_model.obj'
if (-not (Test-Path $face) -or (Get-Item $face).Length -lt 4096) {
    Write-Note 'core\face_model.obj is missing or truncated - the avatar will fall back to the glowing core.'
}
Write-Ok "Source ready at $InstallDir"

# --- 4. Virtual environment -------------------------------------------------
Write-Step 'Preparing isolated virtual environment (.venv)'
$venvDir = Join-Path $InstallDir '.venv'
$venvPy  = Join-Path $venvDir 'Scripts\python.exe'
if (Test-Path $venvPy) {
    $venvVer = Get-PythonVersion $venvPy
    if ($SupportedPython -notcontains $venvVer) {
        Write-Note "Existing .venv uses Python $venvVer (unsupported) - rebuilding it."
        Remove-Item -Recurse -Force $venvDir
    }
}
if (-not (Test-Path $venvPy)) {
    [void](Invoke-Native -Exe $basePython -Arguments @('-m', 'venv', $venvDir) -What 'Creating the virtual environment')
}
[void](Invoke-Native -Exe $venvPy -Arguments @('-m', 'pip', 'install', '--upgrade', '--disable-pip-version-check', 'pip', 'setuptools', 'wheel') -What 'Upgrading pip')
Write-Ok "venv: Python $(Get-PythonVersion $venvPy)"

# --- 5. Dependencies --------------------------------------------------------
Write-Step 'Installing Python dependencies (first run: 5-10 minutes)'
Push-Location $InstallDir
try {
    [void](Invoke-Native -Exe $venvPy -Arguments @('-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade', '-r', 'requirements.txt') -What 'pip install -r requirements.txt')
    # yt-dlp is deliberately unpinned upstream; keep it current so YouTube on the HUD keeps working.
    [void](Invoke-Native -Exe $venvPy -Arguments @('-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade', 'yt-dlp') -What 'Updating yt-dlp' -AllowFailure)
} finally {
    Pop-Location
}
Write-Ok 'Python packages installed'

if ($SkipBrowsers) {
    Write-Note 'Skipping Playwright browsers (-SkipBrowsers). Browser automation stays off until you run:'
    Write-Note "  `"$venvPy`" -m playwright install chromium firefox"
} else {
    Write-Step 'Installing Playwright browsers (chromium + firefox, ~300 MB)'
    $code = Invoke-Native -Exe $venvPy -Arguments @('-m', 'playwright', 'install', 'chromium', 'firefox') -What 'playwright install' -AllowFailure
    if ($code -eq 0) { Write-Ok 'Browsers installed' }
    else { Write-Note 'Browser download failed (network/proxy?). Everything except browser automation works; re-run this script later.' }
}

# --- 6. Windows-specific repairs -------------------------------------------
Write-Step 'Verifying Windows integrations'
$pywinOk = Get-NativeOutput -Exe $venvPy -Arguments @('-c', 'import win32com.client; print("ok")')
if ($pywinOk -ne 'ok') {
    Write-Note 'pywin32 not registered - repairing...'
    $postInstall = Join-Path $venvDir 'Scripts\pywin32_postinstall.py'
    if (Test-Path $postInstall) {
        [void](Invoke-Native -Exe $venvPy -Arguments @($postInstall, '-install') -What 'pywin32 post-install' -AllowFailure)
    } else {
        [void](Invoke-Native -Exe $venvPy -Arguments @('-m', 'pywin32_postinstall', '-install') -What 'pywin32 post-install' -AllowFailure)
    }
    $pywinOk = Get-NativeOutput -Exe $venvPy -Arguments @('-c', 'import win32com.client; print("ok")')
}
if ($pywinOk -eq 'ok') { Write-Ok 'pywin32 / COM ready' }
else { Write-Note 'pywin32 still not importable - desktop-shortcut creation inside the app will use a slower fallback. Not fatal.' }

# --- 7. Verification --------------------------------------------------------
Write-Step 'Verifying installation'
$verifyScript = @'
import importlib, sys
critical = ["PyQt6.QtWidgets", "PyQt6.QtMultimedia", "PyQt6.QtMultimediaWidgets",
            "sounddevice", "numpy", "google.genai", "requests", "bs4", "PIL", "cv2",
            "mss", "psutil", "pyautogui", "pyperclip", "fastapi", "uvicorn",
            "cryptography", "qrcode"]
optional = ["playwright.sync_api", "yt_dlp", "ddgs", "send2trash", "pptx", "pdfplumber",
            "docx", "openpyxl", "comtypes", "pycaw", "wmi", "pywinauto", "pygetwindow"]
failed = []
for m in critical:
    try:
        importlib.import_module(m)
    except BaseException as e:  # some packages raise SystemExit, not ImportError
        failed.append(m)
        print("CRITICAL-FAIL %s: %r" % (m, e))
for m in optional:
    try:
        importlib.import_module(m)
    except BaseException as e:
        print("OPTIONAL-FAIL %s: %r" % (m, e))
sys.exit(1 if failed else 0)
'@
$verifyFile = Join-Path $env:TEMP 'jarvis-verify.py'
Set-Content -Path $verifyFile -Value $verifyScript -Encoding ASCII

$code = Invoke-Native -Exe $venvPy -Arguments @('-W', 'ignore', $verifyFile) -What 'Import verification' -AllowFailure
if ($code -ne 0) {
    # The classic cause on a clean PC is a missing Visual C++ runtime ("DLL load failed").
    Write-Note 'A core module failed to load - installing the Microsoft Visual C++ runtime and retrying...'
    Install-WingetPackage -Id 'Microsoft.VCRedist.2015+.x64' -Name 'Visual C++ 2015-2022 Redistributable (x64)'
    $code = Invoke-Native -Exe $venvPy -Arguments @('-W', 'ignore', $verifyFile) -What 'Import verification' -AllowFailure
    if ($code -ne 0) { Stop-Install 'Core modules still fail to import - see CRITICAL-FAIL lines above.' }
}
Remove-Item $verifyFile -ErrorAction SilentlyContinue
Write-Ok 'All core modules import'

[void](Invoke-Native -Exe $venvPy -Arguments @('-m', 'compileall', '-q', '-x', '[\\/]\.venv[\\/]', $InstallDir) -What 'Byte-compiling the project')
Write-Ok 'Project source compiles'

$mic = Get-NativeOutput -Exe $venvPy -Arguments @('-c', "import sounddevice as sd; print(sd.query_devices(kind='input')['name'])")
if ($mic) { Write-Ok "Default microphone: $mic" }
else { Write-Note 'No microphone detected. Plug one in and check Settings > Privacy & security > Microphone > "Let desktop apps access your microphone".' }

# --- 8. Launcher + shortcut -------------------------------------------------
Write-Step 'Creating launcher'
$launcher = Join-Path $InstallDir 'Start-Jarvis.bat'
$launcherBody = @(
    '@echo off',
    'title MARK LV - JARVIS',
    'cd /d "%~dp0"',
    'set PYTHONUTF8=1',
    'set PYTHONIOENCODING=utf-8',
    '".venv\Scripts\python.exe" main.py %*',
    'if errorlevel 1 (',
    '  echo.',
    '  echo JARVIS exited with an error - read the messages above.',
    '  pause',
    ')'
)
Set-Content -Path $launcher -Value $launcherBody -Encoding ASCII
Write-Ok "Launcher: $launcher"

if (-not $NoShortcut) {
    try {
        $desktop  = [Environment]::GetFolderPath('Desktop')   # follows OneDrive redirection
        $lnkPath  = Join-Path $desktop 'JARVIS.lnk'
        $shell    = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($lnkPath)
        $shortcut.TargetPath       = $launcher
        $shortcut.WorkingDirectory = $InstallDir
        $shortcut.Description      = 'MARK LV - JARVIS personal AI assistant'
        $icon = Join-Path $InstallDir 'config\jarvis.ico'
        if (Test-Path $icon) { $shortcut.IconLocation = $icon }
        $shortcut.Save()
        Write-Ok "Desktop shortcut: $lnkPath"
    } catch {
        Write-Note "Could not create the desktop shortcut ($($_.Exception.Message)). Use Start-Jarvis.bat directly."
    }
}

# --- Done -------------------------------------------------------------------
Write-Host ''
Write-Host '  JARVIS is installed.' -ForegroundColor Green
Write-Host ''
Write-Host '  Next steps:'
Write-Host '    1. Get a free Gemini API key: https://aistudio.google.com/app/apikey'
Write-Host '    2. Double-click JARVIS on your desktop (or run Start-Jarvis.bat).'
Write-Host '    3. Paste the key into the setup screen on first launch.'
Write-Host '    4. Optional: enable "Hey Jarvis" from the gear menu > WAKE WORD.'
Write-Host ''
Write-Host '  To update later, just run this script again.'
Write-Host ''

try { Stop-Transcript | Out-Null } catch { }

if ($Launch) { Start-Process -FilePath $launcher -WorkingDirectory $InstallDir }
