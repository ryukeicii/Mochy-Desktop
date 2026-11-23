# Mochy for desktop

A lightweight, native cross-platform port of **Mochy** built with **Rust** (`Tauri v2` + `tokio` + `reqwest` + `axum` local streaming proxy) and a zero-framework native WebView UI with WebGL shaders.

# PROJECT STILL IN ALPHA

---

## Building & Running

### Prerequisites
- **Rust** (`1.77+` via [rustup.rs](https://rustup.rs))
- Platform WebView dependencies:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Microsoft Visual Studio C++ Build Tools + WebView2 (pre-installed on Windows 10/11)
  - **Linux (Debian/Ubuntu)**:
    ```bash
    sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
    ```

### Run in Development
```bash
cd mochy-rs/src-tauri
cargo run
```

### Build Optimized Release Binary
```bash
cd mochy-rs/src-tauri
cargo build --release
```

### Build Native OS Bundles (`.app` / `.dmg` / `.msi` / `.exe` / `.deb` / `.AppImage`)
If you have `tauri-cli` installed (`cargo install tauri-cli`):
```bash
cd mochy-rs/src-tauri
cargo tauri build
```

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
