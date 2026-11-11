#!/usr/bin/env bash
# =============================================================================
#  MARK LV ("JARVIS") - one-shot installer for macOS and Linux
#
#  1. Installs system prerequisites (git, PortAudio, Qt runtime libs, OS tools)
#  2. Finds Python 3.11-3.13 (prefers 3.12); if absent, provisions 3.12 with uv
#     (no sudo, no PPA, works on any distro / macOS version)
#  3. Clones https://github.com/FatihMakes/Mark-LV, or fast-forwards an existing
#     clone - re-running this script is how you update
#  4. Creates an isolated .venv, installs requirements + Playwright browsers
#  5. Verifies every critical import, byte-compiles, checks for a microphone
#  6. Writes start-jarvis.sh and an app-menu / desktop launcher
#
#  Usage:
#    bash install-jarvis.sh [--dir PATH] [--skip-browsers] [--no-shortcut] [--launch]
#
#  Safe to re-run. Your API key (config/api_keys.json) and memories
#  (memory/long_term.json) are git-ignored upstream and never overwritten.
# =============================================================================
set -Eeuo pipefail

INSTALL_DIR="${HOME}/Mark-LV"
REPO_URL="https://github.com/FatihMakes/Mark-LV.git"
SKIP_BROWSERS=0
NO_SHORTCUT=0
LAUNCH=0
SUPPORTED_PY=("3.12" "3.13" "3.11")   # order = preference

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)           INSTALL_DIR="$2"; shift 2 ;;
    --dir=*)         INSTALL_DIR="${1#*=}"; shift ;;
    --skip-browsers) SKIP_BROWSERS=1; shift ;;
    --no-shortcut)   NO_SHORTCUT=1; shift ;;
    --launch)        LAUNCH=1; shift ;;
    -h|--help)       usage ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
done

LOG_FILE="${TMPDIR:-/tmp}/jarvis-install-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

c_step=$'\033[36m'; c_ok=$'\033[32m'; c_warn=$'\033[33m'; c_err=$'\033[31m'; c_off=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$c_step" "$1" "$c_off"; }
ok()   { printf '    %s[OK]%s %s\n' "$c_ok" "$c_off" "$1"; }
note() { printf '    %s[!]%s  %s\n' "$c_warn" "$c_off" "$1"; }
die()  { printf '\n%s[X] %s%s\n    Full log: %s\n' "$c_err" "$1" "$c_off" "$LOG_FILE"; exit 1; }
trap 'die "Unexpected failure on line $LINENO: $BASH_COMMAND"' ERR

have() { command -v "$1" >/dev/null 2>&1; }

SUDO=""
if [[ $EUID -ne 0 ]] && have sudo; then SUDO="sudo"; fi

OS="$(uname -s)"
printf '\n  MARK LV / JARVIS - %s installer\n  Install directory : %s\n  Log file          : %s\n' "$OS" "$INSTALL_DIR" "$LOG_FILE"

# --- 1. System prerequisites -------------------------------------------------
step "Installing system prerequisites"
case "$OS" in
  Darwin)
    if ! xcode-select -p >/dev/null 2>&1; then
      note "Xcode Command Line Tools are required (provides git and compilers)."
      xcode-select --install || true
      die "Finish the Command Line Tools installer window, then re-run this script."
    fi
    ok "Xcode Command Line Tools present (PortAudio and Qt are bundled in the macOS wheels)"
    ;;
  Linux)
    if have apt-get; then
      $SUDO apt-get update -qq
      # libportaudio2: sounddevice on Linux needs the system PortAudio.
      # python3-tk: pyautogui -> mouseinfo calls sys.exit() on import without tkinter.
      # libxcb-cursor0 + xkbcommon/EGL/GL: required by the PyQt6 xcb platform plugin.
      $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        git curl ca-certificates python3-venv python3-tk libportaudio2 libxcb-cursor0 libxkbcommon-x11-0 \
        libxcb-icccm4 libxcb-keysyms1 libxcb-image0 libxcb-render-util0 libxcb-randr0 \
        libxcb-shape0 libxcb-xinerama0 libxcb-xkb1 libfontconfig1 \
        libegl1 libgl1 libglib2.0-0 libpipewire-0.3-0 libdbus-1-3 libnss3 \
        pulseaudio-utils brightnessctl xdg-utils >/dev/null
    elif have dnf; then
      $SUDO dnf install -y -q git curl python3-tkinter portaudio xcb-util-cursor libxkbcommon-x11 \
        xcb-util-wm xcb-util-keysyms xcb-util-image xcb-util-renderutil fontconfig \
        mesa-libEGL mesa-libGL glib2 dbus-libs nss pulseaudio-utils brightnessctl xdg-utils
    elif have pacman; then
      $SUDO pacman -Sy --needed --noconfirm git curl tk portaudio xcb-util-cursor libxkbcommon-x11 \
        xcb-util-wm xcb-util-keysyms xcb-util-image xcb-util-renderutil fontconfig \
        libglvnd glib2 dbus nss libpulse brightnessctl xdg-utils
    elif have zypper; then
      $SUDO zypper --non-interactive install git curl python3-tk portaudio libxcb-cursor0 libxkbcommon-x11-0 \
        libxcb-icccm4 libxcb-keysyms1 libxcb-image0 libxcb-render-util0 fontconfig \
        Mesa-libEGL1 Mesa-libGL1 glib2-tools dbus-1 mozilla-nss pulseaudio-utils brightnessctl xdg-utils
    else
      note "Unknown package manager - install git, PortAudio and the Qt6 xcb libraries yourself."
    fi
    ok "System packages ready"
    ;;
  *) die "Unsupported OS '$OS'. On Windows use install-jarvis.ps1 instead." ;;
esac
have git || die "git is not available - install it and re-run."

# --- 2. Python ---------------------------------------------------------------
step "Locating Python 3.11 - 3.13"
BASE_PY=""
for v in "${SUPPORTED_PY[@]}"; do
  for cand in "python${v}" "/opt/homebrew/bin/python${v}" "/usr/local/bin/python${v}"; do
    if have "$cand" && [[ "$("$cand" -c 'import sys;print("%d.%d"%sys.version_info[:2])' 2>/dev/null)" == "$v" ]] \
       && "$cand" -c 'import venv, ensurepip, tkinter' >/dev/null 2>&1; then
      BASE_PY="$(command -v "$cand")"; break 2
    fi
  done
done
if [[ -z "$BASE_PY" ]]; then
  note "No usable Python 3.11-3.13 found - provisioning Python 3.12 with uv (user-local, no sudo)."
  if ! have uv; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="${HOME}/.local/bin:${HOME}/.cargo/bin:${PATH}"
  fi
  uv python install 3.12
  BASE_PY="$(uv python find 3.12)"
fi
[[ -x "$BASE_PY" ]] || die "Could not obtain Python 3.12."
ok "Python $("$BASE_PY" -c 'import sys;print("%d.%d.%d"%sys.version_info[:3])') at $BASE_PY"

# --- 3. Clone or update -----------------------------------------------------
step "Fetching Mark-LV source"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "    Existing clone found - updating (your config and memory are untouched)..."
  git -C "$INSTALL_DIR" pull --ff-only
elif [[ -d "$INSTALL_DIR" && -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]]; then
  die "$INSTALL_DIR exists, is not empty and is not a git clone. Use --dir to pick another folder."
else
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
FACE="$INSTALL_DIR/core/face_model.obj"
if [[ ! -f "$FACE" || $(wc -c < "$FACE") -lt 4096 ]]; then
  note "core/face_model.obj is missing or truncated - the avatar will fall back to the glowing core."
fi
ok "Source ready at $INSTALL_DIR"

# --- 4. Virtual environment --------------------------------------------------
step "Preparing isolated virtual environment (.venv)"
VENV_PY="$INSTALL_DIR/.venv/bin/python"
if [[ -x "$VENV_PY" ]]; then
  cur="$("$VENV_PY" -c 'import sys;print("%d.%d"%sys.version_info[:2])' 2>/dev/null || echo broken)"
  if [[ ! " ${SUPPORTED_PY[*]} " == *" $cur "* ]]; then
    note "Existing .venv uses Python $cur (unsupported/broken) - rebuilding it."
    rm -rf "$INSTALL_DIR/.venv"
  fi
fi
[[ -x "$VENV_PY" ]] || "$BASE_PY" -m venv "$INSTALL_DIR/.venv"
"$VENV_PY" -m pip install -q --upgrade --disable-pip-version-check pip setuptools wheel
ok "venv: Python $("$VENV_PY" -c 'import sys;print("%d.%d"%sys.version_info[:2])')"

# --- 5. Dependencies ---------------------------------------------------------
step "Installing Python dependencies (first run: 5-10 minutes)"
( cd "$INSTALL_DIR" && "$VENV_PY" -m pip install --disable-pip-version-check --upgrade -r requirements.txt )
# yt-dlp is deliberately unpinned upstream; keep it current for YouTube on the HUD.
"$VENV_PY" -m pip install -q --disable-pip-version-check --upgrade yt-dlp || note "yt-dlp update failed - YouTube playback may lag behind."
if [[ "$OS" == "Linux" ]]; then
  # The Linux opencv-python wheel bundles its own Qt plugins and repoints
  # QT_QPA_PLATFORM_PLUGIN_PATH at them on `import cv2`, which stops PyQt6 from
  # loading its xcb plugin ("no Qt platform plugin could be initialized").
  # Mark-LV never calls cv2.imshow & co., so the GUI-free build is a drop-in.
  if "$VENV_PY" -m pip show -q opencv-python >/dev/null 2>&1; then
    cv_ver="$("$VENV_PY" -c 'import importlib.metadata as m;print(m.version("opencv-python"))')"
    # Both distributions write the same cv2/ package, so remove both and reinstall
    # headless cleanly - otherwise an update run leaves no cv2 at all.
    "$VENV_PY" -m pip uninstall -y -q opencv-python opencv-python-headless
    "$VENV_PY" -m pip install -q --disable-pip-version-check --no-cache-dir "opencv-python-headless==${cv_ver}" \
      || "$VENV_PY" -m pip install -q --disable-pip-version-check "opencv-python-headless>=4.8,<5"
    ok "Swapped opencv-python for opencv-python-headless (prevents a Qt plugin clash on Linux)"
  fi
fi
ok "Python packages installed"

if [[ $SKIP_BROWSERS -eq 1 ]]; then
  note "Skipping Playwright browsers. Enable later with: \"$VENV_PY\" -m playwright install chromium firefox"
else
  step "Installing Playwright browsers (chromium + firefox, ~300 MB)"
  if "$VENV_PY" -m playwright install chromium firefox; then
    ok "Browsers installed"
    if [[ "$OS" == "Linux" ]]; then
      $SUDO "$VENV_PY" -m playwright install-deps chromium firefox >/dev/null 2>&1 \
        && ok "Browser system libraries installed" \
        || note "playwright install-deps could not run - headless browsers may miss system libraries."
    fi
  else
    note "Browser download failed (network/proxy?). Everything except browser automation works; re-run later."
  fi
fi

# --- 6. Verification ---------------------------------------------------------
step "Verifying installation"
"$VENV_PY" -W ignore - <<'PY' || die "Core modules failed to import - see CRITICAL-FAIL lines above."
import importlib, os, sys
critical = ["PyQt6.QtWidgets", "PyQt6.QtMultimedia", "PyQt6.QtMultimediaWidgets",
            "sounddevice", "numpy", "google.genai", "requests", "bs4", "PIL", "cv2",
            "mss", "psutil", "pyautogui", "pyperclip", "fastapi", "uvicorn",
            "cryptography", "qrcode"]
optional = ["playwright.sync_api", "yt_dlp", "ddgs", "send2trash", "pptx", "pdfplumber",
            "docx", "openpyxl"]
# pyautogui/pyperclip need a running X/Wayland session; over SSH or in a headless
# shell they cannot import, which says nothing about the desktop install.
if sys.platform.startswith("linux") and not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
    print("No graphical session detected - skipping display-bound modules (pyautogui, pyperclip).")
    critical = [m for m in critical if m not in ("pyautogui", "pyperclip")]
failed = []
for m in critical:
    try:
        importlib.import_module(m)
    except BaseException as e:  # mouseinfo raises SystemExit, not ImportError
        failed.append(m); print("CRITICAL-FAIL %s: %r" % (m, e))
for m in optional:
    try:
        importlib.import_module(m)
    except BaseException as e:
        print("OPTIONAL-FAIL %s: %r" % (m, e))
sys.exit(1 if failed else 0)
PY
ok "All core modules import"
"$VENV_PY" -m compileall -q -x '[\\/]\.venv[\\/]' "$INSTALL_DIR" >/dev/null || die "Project failed to byte-compile."
ok "Project source compiles"
if mic="$("$VENV_PY" -c "import sounddevice as sd; print(sd.query_devices(kind='input')['name'])" 2>/dev/null)"; then
  ok "Default microphone: $mic"
else
  note "No microphone detected - plug one in (macOS: System Settings > Privacy & Security > Microphone > allow Terminal)."
fi

# --- 7. Launcher -------------------------------------------------------------
step "Creating launcher"
LAUNCHER="$INSTALL_DIR/start-jarvis.sh"
cat > "$LAUNCHER" <<'SH'
#!/usr/bin/env bash
cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")" || exit 1
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
exec ./.venv/bin/python main.py "$@"
SH
chmod +x "$LAUNCHER"
ok "Launcher: $LAUNCHER"

if [[ $NO_SHORTCUT -eq 0 ]]; then
  if [[ "$OS" == "Linux" ]]; then
    APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
    mkdir -p "$APPS"
    cat > "$APPS/jarvis.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=JARVIS
Comment=MARK LV personal AI assistant
Exec="$LAUNCHER"
Path=$INSTALL_DIR
Icon=$INSTALL_DIR/config/jarvis.ico
Terminal=false
Categories=Utility;
EOF
    chmod +x "$APPS/jarvis.desktop"
    DESK="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
    if [[ -d "$DESK" ]]; then
      cp "$APPS/jarvis.desktop" "$DESK/jarvis.desktop" && chmod +x "$DESK/jarvis.desktop"
      have gio && gio set "$DESK/jarvis.desktop" metadata::trusted true 2>/dev/null || true
    fi
    ok "App-menu entry: $APPS/jarvis.desktop"
  else
    CMD="$HOME/Desktop/JARVIS.command"
    printf '#!/usr/bin/env bash\nexec "%s"\n' "$LAUNCHER" > "$CMD"
    chmod +x "$CMD"
    ok "Desktop launcher: $CMD"
  fi
fi

trap - ERR
printf '\n  %sJARVIS is installed.%s\n\n' "$c_ok" "$c_off"
cat <<EOF
  Next steps:
    1. Get a free Gemini API key: https://aistudio.google.com/app/apikey
    2. Launch: $LAUNCHER   (or the JARVIS shortcut)
    3. Paste the key into the setup screen on first launch.
    4. Optional: enable "Hey Jarvis" from the gear menu > WAKE WORD.

  To update later, just run this script again.

EOF

if [[ $LAUNCH -eq 1 ]]; then exec "$LAUNCHER"; fi
