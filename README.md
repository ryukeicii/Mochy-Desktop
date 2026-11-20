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
