#!/usr/bin/env bash
set -euo pipefail

# Build (and optionally install) Mochy Desktop natively on Linux (x86_64, aarch64/ARM64, etc.)
# Supports Arch, Debian/Ubuntu, Fedora, openSUSE, and Void Linux.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DEPS=false
DO_INSTALL=false
DO_BUNDLE=false

usage() {
  cat <<'EOF'
Usage: ./scripts/build-linux.sh [OPTIONS]

Build Mochy Desktop natively on Linux (works on x86_64, ARM64/aarch64, etc.).

Options:
  --deps      Install required system dependencies for your distro (uses sudo)
  --install   Install binary, icon, and .desktop launcher to ~/.local
  --bundle    Build native packages (.deb / .rpm / .AppImage) via cargo-tauri
  -h, --help  Show this help message

Examples:
  ./scripts/build-linux.sh --deps --install
  ./scripts/build-linux.sh --bundle
EOF
}

for arg in "$@"; do
  case "$arg" in
    --deps) INSTALL_DEPS=true ;;
    --install) DO_INSTALL=true ;;
    --bundle) DO_BUNDLE=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 1 ;;
  esac
done

detect_distro() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "${ID:-unknown} ${ID_LIKE:-}"
  else
    echo "unknown"
  fi
}

install_deps() {
  local distro
  distro="$(detect_distro)"
  echo "==> Installing Linux dependencies (detected: $distro)"

  if command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --needed --noconfirm \
      base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 \
      librsvg webkit2gtk-4.1 xdotool pkgconf \
      gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-libav
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y \
      build-essential curl wget file pkg-config libxdo-dev libssl-dev \
      libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
      gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
      gstreamer1.0-plugins-bad gstreamer1.0-libav
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y \
      @development-tools curl wget file pkgconf-pkg-config openssl-devel \
      webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel \
      libxdo-devel gstreamer1-plugins-base gstreamer1-plugins-good \
      gstreamer1-plugins-bad-free
    echo "Note: For AAC/MP4 playback on Fedora, enable RPM Fusion and install gstreamer1-libav / gstreamer1-plugins-ugly if needed."
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper install -y \
      gcc gcc-c++ make pkg-config curl wget file libopenssl-devel \
      webkit2gtk3-soup2-devel webkit2gtk3-devel libappindicator3-devel \
      librsvg-devel xdotool-devel gstreamer-plugins-base gstreamer-plugins-good \
      gstreamer-plugins-bad gstreamer-plugins-libav
  elif command -v xbps-install >/dev/null 2>&1; then
    sudo xbps-install -Sy \
      base-devel pkg-config curl wget file openssl-devel \
      webkit2gtk41-devel gtk+3-devel libappindicator-devel librsvg-devel \
      xdotool-devel gst-plugins-base1 gst-plugins-good1 gst-plugins-bad1 gst-libav
  else
    echo "Unsupported package manager. Please install WebKitGTK 4.1, GTK 3, librsvg, libappindicator, OpenSSL, pkg-config, and GStreamer plugins manually." >&2
    exit 1
  fi
}

if $INSTALL_DEPS; then
  install_deps
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Error: Rust/Cargo not found. Install it from https://rustup.rs first." >&2
  exit 1
fi

ARCH="$(uname -m)"
echo "==> Building Mochy for Linux ($ARCH)..."

cd "$ROOT_DIR/src-tauri"
if $DO_BUNDLE; then
  if ! cargo tauri --version >/dev/null 2>&1; then
    echo "Error: cargo-tauri not installed. Run: cargo install tauri-cli" >&2
    exit 1
  fi
  cargo tauri build
  echo "==> Bundles written to: $ROOT_DIR/src-tauri/target/release/bundle/"
else
  cargo build --release
  echo "==> Binary built at: $ROOT_DIR/src-tauri/target/release/mochy"
fi

if $DO_INSTALL; then
  BIN_SRC="$ROOT_DIR/src-tauri/target/release/mochy"
  if [ ! -x "$BIN_SRC" ]; then
    echo "Error: Release binary not found at $BIN_SRC" >&2
    exit 1
  fi
  mkdir -p "$HOME/.local/bin" \
           "$HOME/.local/share/icons/hicolor/128x128/apps" \
           "$HOME/.local/share/applications"
  install -m 755 "$BIN_SRC" "$HOME/.local/bin/mochy"
  install -m 644 "$ROOT_DIR/src-tauri/icons/128x128.png" \
    "$HOME/.local/share/icons/hicolor/128x128/apps/mochy.png"
  cat > "$HOME/.local/share/applications/mochy.desktop" <<EOF
[Desktop Entry]
Name=Mochy
Comment=Lightweight YouTube Music & synced lyrics desktop app
Exec=$HOME/.local/bin/mochy
Icon=mochy
Terminal=false
Type=Application
Categories=AudioVideo;Audio;Player;Music;
StartupWMClass=mochy
EOF
  command -v update-desktop-database >/dev/null 2>&1 && \
    update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
  echo "==> Installed Mochy to $HOME/.local/bin/mochy and added desktop launcher."
fi
