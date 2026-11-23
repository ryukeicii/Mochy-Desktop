# Mochy for desktop

A lightweight, native cross-platform port of **Mochy** built with **Rust** (`Tauri v2` + `tokio` + `reqwest` + `axum` local streaming proxy) and a zero-framework native WebView UI with WebGL shaders.

# PROJECT STILL IN ALPHA

---

## Building & Running

### Prerequisites
- **Rust** (`1.77+` via [rustup.rs](https://rustup.rs))
- Platform WebView dependencies:
  - **macOS** (`x86_64` & `ARM64` / Apple Silicon): Xcode Command Line Tools (`xcode-select --install`)
  - **Windows** (`x64`): Microsoft Visual Studio C++ Build Tools + WebView2 (pre-installed on Windows 10/11)
  - **Linux** (`x86_64` & `ARM64` / `aarch64`): See [Linux (Build from Source)](#linux-build-from-source) below

### Run in Development
```bash
cd src-tauri
cargo run
```

### Build Optimized Release Binary
```bash
cd src-tauri
cargo build --release
```

### Build Native OS Bundles (`.app` / `.dmg` / `.msi` / `.exe` / `.deb` / `.rpm` / `.AppImage`)
If you have `tauri-cli` installed (`cargo install tauri-cli`):
```bash
cd src-tauri
cargo tauri build
```

---

## Linux (Build from Source)

Mochy compiles natively on Linux across both **`x86_64`** and **`ARM64` (`aarch64`)** (including Raspberry Pi, ARM laptops, and Asahi Linux).

### Quick Build & Install Script
Installs system dependencies for your distro, compiles the release binary for your CPU architecture, and adds Mochy to `~/.local/bin` and your app launcher:
```bash
chmod +x scripts/build-linux.sh
./scripts/build-linux.sh --deps --install
```
To build native Linux packages (`.deb`, `.rpm`, `.AppImage`) instead, install `cargo install tauri-cli` and run:
```bash
./scripts/build-linux.sh --deps --bundle
```

### Manual Dependencies by Distro

> **Audio Codecs Note:** WebKitGTK uses GStreamer for `<audio>` playback. Make sure the GStreamer plugins (`good`, `bad`, and `libav`) are installed so AAC/MP4, FLAC, and MP3 streams play properly.

- **Arch Linux / EndeavourOS / Manjaro / CachyOS** (`x86_64` & `aarch64` / Arch Linux ARM):
  ```bash
  sudo pacman -S --needed base-devel curl wget file openssl pkgconf \
    webkit2gtk-4.1 librsvg appmenu-gtk-module libappindicator-gtk3 xdotool \
    gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-libav
  ```
- **Debian / Ubuntu / Linux Mint / Pop!_OS** (`amd64` & `arm64`):
  ```bash
  sudo apt update && sudo apt install -y build-essential curl wget file pkg-config \
    libxdo-dev libssl-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav
  ```
- **Fedora / Nobara / RHEL-based** (`x86_64` & `aarch64`):
  ```bash
  sudo dnf install -y @development-tools curl wget file pkgconf-pkg-config openssl-devel \
    webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel libxdo-devel \
    gstreamer1-plugins-base gstreamer1-plugins-good gstreamer1-plugins-bad-free
  # For full AAC/MP4 codec support, enable RPM Fusion and install:
  # sudo dnf install -y gstreamer1-libav gstreamer1-plugins-ugly
  ```
- **openSUSE Tumbleweed / Leap** (`x86_64` & `aarch64`):
  ```bash
  sudo zypper install -y gcc gcc-c++ make pkg-config curl wget file libopenssl-devel \
    webkit2gtk3-devel libappindicator3-devel librsvg-devel xdotool-devel \
    gstreamer-plugins-base gstreamer-plugins-good gstreamer-plugins-bad gstreamer-plugins-libav
  ```
- **Void Linux** (`x86_64` & `aarch64`):
  ```bash
  sudo xbps-install -Sy base-devel pkg-config curl wget file openssl-devel \
    webkit2gtk41-devel gtk+3-devel libappindicator-devel librsvg-devel xdotool-devel \
    gst-plugins-base1 gst-plugins-good1 gst-plugins-bad1 gst-libav
  ```
- **NixOS**:
  ```bash
  nix-shell -p pkg-config openssl webkitgtk_4_1 gtk3 libayatana-appindicator librsvg xdotool \
    gst_all_1.gstreamer gst_all_1.gst-plugins-base gst_all_1.gst-plugins-good \
    gst_all_1.gst-plugins-bad gst_all_1.gst-libav
  ```

### Compile Manually on Linux (x86_64 & ARM64)
```bash
git clone https://github.com/ryukeicii/Mochy-Desktop.git
cd Mochy-Desktop/src-tauri
cargo build --release
./target/release/mochy
```

> **Wayland / NVIDIA Tip:** If you see a blank or flickering window on Wayland with NVIDIA GPUs, launch with:
> ```bash
> WEBKIT_DISABLE_DMABUF_RENDERER=1 ./target/release/mochy
> ```

---

## Source Projects & Credits

Mochy Desktop builds on and integrates with the following open-source projects and services:

### Upstream & Audio / UI
- **[Mochy Music](https://github.com/realidkroo/Mochy-Music)** — Original mobile app (transport animations, remote/link protocol, and design language)
- **[AutoEq](https://github.com/jaakkopasanen/AutoEq)** — Headphone parametric EQ profiles and live correction search
- **[Inter](https://github.com/rsms/inter)** — UI typeface (`ui/fonts/`)

### Lyrics Providers & APIs
- **[Better Lyrics](https://github.com/better-lyrics/better-lyrics)** / **[better-lyrics/api](https://github.com/better-lyrics/api)** — Word-by-word synced lyrics (`lyrics-api.boidu.dev`)
- **[YouLyPlus](https://github.com/ibratabian17/YouLyPlus)** / **[LyricsPlus](https://github.com/ibratabian17/LyricsPlus)** — Syllable-synced lyrics (`lyricsplus.binimum.org`)
- **[PaxSenix](https://github.com/Paxsenix0/Spotify-Lyrics-API)** — Apple Music lyrics proxy (`lyrics.paxsenix.org`)
- **[SimpMusic](https://github.com/maxrave-dev/SimpMusic)** — YouTube-matched lyrics (`api-lyrics.simpmusic.org`)
- **[LRCLIB](https://github.com/tranxuanthang/lrclib)** — Open community synced lyrics database (`lrclib.net`)

### Core Rust Libraries
- **[Tauri v2](https://github.com/tauri-apps/tauri)** & **[tauri-plugin-dialog](https://github.com/tauri-apps/plugins-workspace)** — Cross-platform desktop shell and native WebView runtime
- **[Tokio](https://github.com/tokio-rs/tokio)** — Async runtime and local streaming proxy server
- **[reqwest](https://github.com/seanmonstar/reqwest)** — HTTP client for InnerTube, lyrics, and stream proxying
- **[lofty](https://github.com/Serial-ATA/lofty-rs)** — Local audio metadata and embedded artwork reader
- **[rusqlite](https://github.com/rusqlite/rusqlite)** — SQLite reader for synced mobile library snapshots
- **[mdns-sd](https://github.com/keepsimple1/mdns-sd)** & **[if-addrs](https://github.com/messense/if-addrs)** — Local network device discovery for Mochy Link
- **[ring](https://github.com/briansmith/ring)** — ECDH, HMAC, and SHA-256 cryptography for device pairing and signed links
- **[image](https://github.com/image-rs/image)** — Cover artwork palette extraction
- **[roxmltree](https://github.com/RazrFalcon/roxmltree)** — TTML synced lyrics XML parser
- **[serde](https://github.com/serde-rs/serde)** & **[regex](https://github.com/rust-lang/regex)** — Serialization and lyrics/metadata parsing
