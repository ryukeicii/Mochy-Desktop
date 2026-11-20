// mochy link on the desktop: the same wi-fi protocol the android app speaks, so a phone and this computer can pair,
// steer each other, keep their libraries in step and stream each other's song files (flac included)

pub mod http;
pub mod mdns;
pub mod snapshot;

use crate::library::{AppSettings, IncomingChanges, Library};
use crate::local::LocalMusic;
use crate::youtube::models::{AlbumRef, ArtistRef, SongItem};
use http::{Request, Response};
use mdns::{Mdns, Peer, PAIR_SERVICE, PHONE_SERVICE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicI64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex, RwLock};

pub const LINK_PORT: u16 = 47801;
pub const PAIR_PORT: u16 = 47802;
pub const PROTOCOL: i64 = 1;
pub const KIND: &str = "desktop";
const MAX_DEVICES: usize = 10;
const MAX_WRONG_TRIES: u32 = 5;
// a device that hasn't said hello for this long is closed or gone
const LIVE_FOR_MS: i64 = 70_000;
const HEARTBEAT: Duration = Duration::from_secs(20);
// a library is pulled again when the phone says it changed, but not more often than this
const MIN_SYNC_GAP_MS: i64 = 90_000;
// and at least this often while both are around
const AUTO_SYNC_GAP_MS: i64 = 15 * 60_000;
const CONTROLLER_QUIET_MS: i64 = 12_000;

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn yes() -> bool {
    true
}

// a device this computer is paired with; the key is what both sides show on every call
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedDevice {
    pub id: String,
    pub name: String,
    pub key: String,
    pub kind: String,
    pub paired_at: i64,
    pub last_seen_at: i64,
    #[serde(default)]
    pub last_sync_at: i64,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub port: u16,
    // it may play, skip and change settings here, and this computer may do the same there
    #[serde(default = "yes")]
    pub remote_control: bool,
    // steering starts by itself as soon as the device turns up
    #[serde(default)]
    pub auto_control: bool,
    // it may stream this computer's song files
    #[serde(default = "yes")]
    pub stream_local: bool,
    // the two libraries are kept in step
    #[serde(default = "yes")]
    pub mirror_library: bool,
    // the last of this computer's changes it has heard
    #[serde(default)]
    pub pushed_seq: u64,
    // the newest of its plays already counted here
    #[serde(default)]
    pub events_mark: i64,
}

// the same device as the window sees it, without its key
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceView {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub paired_at: i64,
    pub last_seen_at: i64,
    pub last_sync_at: i64,
    pub host: Option<String>,
    pub live: bool,
    pub remote_control: bool,
    pub auto_control: bool,
    pub stream_local: bool,
    pub mirror_library: bool,
    pub file_count: usize,
    pub sync: Option<SyncStatus>,
    // what the device said about itself on its last hello: whether it lets this computer pull or stream
    pub they_mirror: Option<bool>,
    pub they_stream: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFile {
    pub song: SongItem,
    pub bytes: u64,
    pub mime: String,
    pub local: bool,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkStore {
    #[serde(default)]
    device_id: String,
    #[serde(default)]
    devices: Vec<PairedDevice>,
    // what each paired device can stream here, from its last sync
    #[serde(default)]
    files: HashMap<String, Vec<RemoteFile>>,
}

#[derive(Clone, Debug)]
pub struct LiveDevice {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub key: String,
    pub seen_at: i64,
    pub mirror: Option<bool>,
    pub stream: Option<bool>,
    pub rev: Option<i64>,
    pub lib: Option<String>,
}

impl LiveDevice {
    fn base(&self) -> String {
        base_url(&self.host, self.port)
    }
}

pub fn base_url(host: &str, port: u16) -> String {
    if host.contains(':') {
        format!("http://[{}]:{}", host, port)
    } else {
        format!("http://{}:{}", host, port)
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub phase: String,
    pub at: i64,
    pub message: Option<String>,
}

// what the window's player is doing, as it last said; the position runs on from read_at while it plays
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerMirror {
    pub song: Option<SongItem>,
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    pub index: usize,
    #[serde(default)]
    pub up_next: Vec<SongItem>,
    #[serde(default)]
    pub liked: bool,
}

// the device this computer steers, and what it last said it plays
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteView {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub reachable: bool,
    pub song: Option<SongItem>,
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    pub liked: bool,
    pub up_next: Vec<(i64, SongItem)>,
    pub read_at: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingView {
    pub code: String,
    pub name: String,
    pub address: Option<String>,
    pub port: u16,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStateView {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub port: u16,
    pub address: Option<String>,
    pub devices: Vec<DeviceView>,
    pub nearby: Vec<Peer>,
    pub pairing: Option<PairingView>,
    pub remote: Option<RemoteView>,
    pub controller: Option<String>,
    pub shared_files: usize,
}

struct Pairing {
    code: String,
    wrong: u32,
    port: u16,
    _server: http::Server,
}

pub struct LinkHub {
    me: String,
    library: Arc<Library>,
    local: Arc<LocalMusic>,
    path: PathBuf,
    store: RwLock<LinkStore>,
    live: RwLock<HashMap<String, LiveDevice>>,
    server: Mutex<Option<http::Server>>,
    pairing: Mutex<Option<Pairing>>,
    mdns: Mdns,
    mirror: RwLock<(PlayerMirror, i64)>,
    window_open: AtomicBool,
    remote: RwLock<Option<RemoteView>>,
    watchers: AtomicI32,
    sync_status: RwLock<HashMap<String, SyncStatus>>,
    syncing: Mutex<HashSet<String>>,
    revision: AtomicI64,
    controller: RwLock<Option<(String, i64)>>,
    // the device's library sum at its last good sync, to tell whether there's anything new to pull
    synced_lib: RwLock<HashMap<String, String>>,
    client: reqwest::Client,
    slow: reqwest::Client,
    // for a song file: no limit on the whole transfer, a long flac plays for as long as it plays
    stream: reqwest::Client,
    app: OnceLock<AppHandle>,
    name_cache: std::sync::RwLock<String>,
}

fn random_hex(bytes: usize) -> String {
    let mut out = String::new();
    while out.len() < bytes * 2 {
        out.push_str(&uuid::Uuid::new_v4().simple().to_string());
    }
    out.truncate(bytes * 2);
    out
}

fn new_code() -> String {
    let raw = u32::from_str_radix(&random_hex(4), 16).unwrap_or(0);
    (raw % 900_000 + 100_000).to_string()
}

// this computer's address on the wi-fi, for a network that hides devices from each other
pub fn local_address() -> Option<String> {
    const VIRTUAL: &[&str] = &["utun", "tun", "tap", "ppp", "wg", "docker", "veth", "br-", "vmnet", "vboxnet", "bridge", "awdl", "llw", "anpi", "zt"];
    let mut found: Vec<(u8, std::net::Ipv4Addr)> = if_addrs::get_if_addrs()
        .ok()?
        .into_iter()
        .filter(|i| !i.is_loopback() && !VIRTUAL.iter().any(|v| i.name.starts_with(v)))
        .filter_map(|i| match i.ip() {
            std::net::IpAddr::V4(v4) if !v4.is_link_local() => {
                let rank = if v4.octets()[0] == 192 && v4.octets()[1] == 168 { 0 } else if v4.is_private() { 1 } else { 2 };
                Some((rank, v4))
            }
            _ => None,
        })
        .collect();
    found.sort();
    found.first().map(|(_, ip)| ip.to_string())
}

fn computer_name() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("scutil").args(["--get", "ComputerName"]).output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if out.status.success() && !name.is_empty() {
                return name;
            }
        }
    }
    whoami::devicename()
        .ok()
        .filter(|n| !n.trim().is_empty())
        .or_else(|| whoami::hostname().ok())
        .unwrap_or_else(|| "Computer".into())
}

fn host_label(id: &str) -> String {
    format!("mochy-{}", id.chars().filter(|c| c.is_ascii_alphanumeric()).take(8).collect::<String>())
}

// a song as the phone hands it over: enough to show it and to find it on youtube
pub fn song_to_wire(song: &SongItem, art_base: Option<&str>) -> Value {
    let thumbnail = if let Some(id) = song.thumbnail.strip_prefix("local-art:") {
        // art_base already ends in "?k=<key>" for the device asking, the same way its streams carry the key
        art_base
            .and_then(|base| base.split_once('?').map(|(b, q)| format!("{}/art/{}?{}", b, id, q)))
            .map(Value::String)
            .unwrap_or(Value::Null)
    } else if song.thumbnail.is_empty() {
        Value::Null
    } else {
        Value::String(song.thumbnail.clone())
    };
    json!({
        "id": song.id,
        "title": song.title,
        "duration": song.duration.unwrap_or(-1),
        "thumbnailUrl": thumbnail,
        "explicit": song.explicit,
        "artists": song.artists.iter().map(|a| json!({ "id": a.id, "name": a.name })).collect::<Vec<_>>(),
        "album": song.album.as_ref().map(|a| json!({ "id": a.id, "title": a.name })),
    })
}

pub fn song_from_wire(value: &Value) -> Option<SongItem> {
    let id = value.get("id")?.as_str()?.to_string();
    if id.is_empty() {
        return None;
    }
    let text = |v: Option<&Value>| v.and_then(|v| v.as_str()).filter(|s| !s.is_empty() && *s != "null").map(str::to_string);
    Some(SongItem {
        title: text(value.get("title")).unwrap_or_default(),
        artists: value
            .get("artists")
            .and_then(|a| a.as_array())
            .map(|list| {
                list.iter()
                    .map(|a| ArtistRef { name: text(a.get("name")).unwrap_or_default(), id: text(a.get("id")) })
                    .collect()
            })
            .unwrap_or_default(),
        album: value.get("album").and_then(|a| {
            Some(AlbumRef { name: text(a.get("title"))?, id: text(a.get("id")).unwrap_or_default() })
        }),
        duration: value.get("duration").and_then(|d| d.as_i64()).filter(|d| *d > 0),
        thumbnail: text(value.get("thumbnailUrl")).filter(|u| u.starts_with("http")).unwrap_or_default(),
        explicit: value.get("explicit").and_then(|e| e.as_bool()).unwrap_or(false),
        music_video_type: None,
        source: None,
        id,
    })
}

impl LinkHub {
    pub fn new(library: Arc<Library>, local: Arc<LocalMusic>) -> Arc<Self> {
        let path = library.data_dir().join("Link.json");
        let mut store: LinkStore = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        if store.device_id.is_empty() {
            store.device_id = uuid::Uuid::new_v4().to_string();
            if let Ok(json) = serde_json::to_string_pretty(&store) {
                let _ = std::fs::write(&path, json);
            }
        }
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(4))
            .timeout(Duration::from_secs(30))
            .no_proxy()
            .build()
            .unwrap_or_default();
        let slow = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(4))
            .timeout(Duration::from_secs(180))
            .no_proxy()
            .build()
            .unwrap_or_default();
        let stream = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(4))
            .read_timeout(Duration::from_secs(30))
            .no_proxy()
            .build()
            .unwrap_or_default();
        Arc::new(Self {
            me: store.device_id.clone(),
            library,
            local,
            path,
            store: RwLock::new(store),
            live: RwLock::new(HashMap::new()),
            server: Mutex::new(None),
            pairing: Mutex::new(None),
            mdns: Mdns::new(),
            mirror: RwLock::new((PlayerMirror::default(), 0)),
            window_open: AtomicBool::new(false),
            remote: RwLock::new(None),
            watchers: AtomicI32::new(0),
            sync_status: RwLock::new(HashMap::new()),
            syncing: Mutex::new(HashSet::new()),
            revision: AtomicI64::new(now_ms()),
            controller: RwLock::new(None),
            synced_lib: RwLock::new(HashMap::new()),
            client,
            slow,
            stream,
            app: OnceLock::new(),
            name_cache: std::sync::RwLock::new(computer_name()),
        })
    }

    pub fn id(&self) -> &str {
        &self.me
    }

    pub async fn name(&self) -> String {
        let custom = self.library.get_settings().await.device_name;
        if !custom.trim().is_empty() {
            return custom.trim().to_string();
        }
        self.name_cache.read().unwrap().clone()
    }

    fn emit(&self, event: &str, payload: Value) {
        if let Some(app) = self.app.get() {
            let _ = app.emit(event, payload);
        }
    }

    fn changed(&self) {
        self.emit("link://changed", Value::Null);
    }

    // brings the link up: the server, the wi-fi watch, the hello loop and the remote's poll
    pub async fn start(self: &Arc<Self>, app: AppHandle) {
        let _ = self.app.set(app);
        let hub = self.clone();
        self.mdns.watch(PAIR_SERVICE, move || hub.changed());
        let hub = self.clone();
        self.mdns.watch(PHONE_SERVICE, move || hub.changed());
        self.ensure_server().await;
        self.refresh_advert().await;

        let hub = self.clone();
        tokio::spawn(async move {
            // a first look soon after launch, then on a steady beat
            tokio::time::sleep(Duration::from_secs(2)).await;
            loop {
                hub.heartbeat().await;
                tokio::time::sleep(HEARTBEAT).await;
            }
        });
        let hub = self.clone();
        tokio::spawn(async move {
            loop {
                let fast = hub.watchers.load(Ordering::Relaxed) > 0;
                if hub.remote.read().await.is_some() {
                    hub.poll_remote().await;
                }
                tokio::time::sleep(Duration::from_millis(if fast { 1000 } else { 5000 })).await;
            }
        });
    }

    pub fn window_shown(&self) {
        self.window_open.store(true, Ordering::Relaxed);
    }

    async fn save(&self) {
        let store = self.store.read().await;
        if let Ok(json) = serde_json::to_string_pretty(&*store) {
            let _ = tokio::fs::write(&self.path, json).await;
        }
    }

    async fn port(&self) -> u16 {
        self.server.lock().await.as_ref().map(|s| s.port).unwrap_or(0)
    }

    async fn ensure_server(self: &Arc<Self>) -> u16 {
        let mut slot = self.server.lock().await;
        if let Some(server) = slot.as_ref() {
            return server.port;
        }
        let hub = self.clone();
        let handler: http::Handler = Arc::new(move |req| {
            let hub = hub.clone();
            Box::pin(async move { hub.route(req).await })
        });
        match http::Server::start(LINK_PORT, handler).await {
            Ok(server) => {
                let port = server.port;
                *slot = Some(server);
                port
            }
            Err(e) => {
                eprintln!("[link] couldn't start the link server: {e}");
                0
            }
        }
    }

    // the wi-fi advert is up while any device is paired, the same as the phone keeps its own
    async fn refresh_advert(&self) {
        let any = !self.store.read().await.devices.is_empty();
        let port = self.port().await;
        if any && port > 0 {
            let name = self.name().await;
            self.mdns.advertise(
                PHONE_SERVICE,
                &format!("Mochy {}", name),
                &host_label(&self.me),
                port,
                &[(mdns::ATTR_ID, &self.me), (mdns::ATTR_NAME, &name), (mdns::ATTR_KIND, KIND)],
            );
        } else {
            self.mdns.withdraw(PHONE_SERVICE);
        }
    }

    // ---------------------------------------------------------------- state for the window

    pub async fn state(&self) -> LinkStateView {
        let now = now_ms();
        let store = self.store.read().await;
        let live = self.live.read().await;
        let sync = self.sync_status.read().await;
        let devices = store
            .devices
            .iter()
            .map(|d| {
                let l = live.get(&d.id).filter(|l| now - l.seen_at < LIVE_FOR_MS);
                DeviceView {
                    id: d.id.clone(),
                    name: d.name.clone(),
                    kind: d.kind.clone(),
                    paired_at: d.paired_at,
                    last_seen_at: d.last_seen_at,
                    last_sync_at: d.last_sync_at,
                    host: l.map(|l| l.host.clone()).or_else(|| d.host.clone()),
                    live: l.is_some(),
                    remote_control: d.remote_control,
                    auto_control: d.auto_control,
                    stream_local: d.stream_local,
                    mirror_library: d.mirror_library,
                    file_count: store.files.get(&d.id).map(|f| f.len()).unwrap_or(0),
                    sync: sync.get(&d.id).cloned(),
                    they_mirror: l.and_then(|l| l.mirror),
                    they_stream: l.and_then(|l| l.stream),
                }
            })
            .collect();
        let paired: HashSet<&str> = store.devices.iter().map(|d| d.id.as_str()).collect();
        let nearby = self
            .mdns
            .peers(PAIR_SERVICE)
            .into_iter()
            .filter(|p| p.id != self.me && !paired.contains(p.id.as_str()))
            .collect();
        let pairing = self.pairing.lock().await.as_ref().map(|p| (p.code.clone(), p.port));
        let name = self.name().await;
        let controller = self
            .controller
            .read()
            .await
            .as_ref()
            .filter(|(_, at)| now - at < CONTROLLER_QUIET_MS)
            .map(|(n, _)| n.clone());
        LinkStateView {
            id: self.me.clone(),
            name: name.clone(),
            kind: KIND.into(),
            port: self.port().await,
            address: local_address(),
            devices,
            nearby,
            pairing: pairing.map(|(code, port)| PairingView { code, name, address: local_address(), port }),
            remote: self.remote.read().await.clone(),
            controller,
            shared_files: self.local.len().await,
        }
    }

    pub async fn files(&self, device_id: &str) -> Vec<RemoteFile> {
        self.store.read().await.files.get(device_id).cloned().unwrap_or_default()
    }

    pub async fn all_files(&self) -> Vec<(String, String, Vec<RemoteFile>)> {
        let store = self.store.read().await;
        store
            .devices
            .iter()
            .filter_map(|d| store.files.get(&d.id).map(|f| (d.id.clone(), d.name.clone(), f.clone())))
            .filter(|(_, _, f)| !f.is_empty())
            .collect()
    }

    // ---------------------------------------------------------------- the player mirror

    pub async fn update_player(&self, mirror: PlayerMirror) {
        self.window_shown();
        *self.mirror.write().await = (mirror, now_ms());
    }

    async fn now_json(&self, art_base: Option<&str>) -> Value {
        let (mirror, read_at) = self.mirror.read().await.clone();
        let moved = if mirror.playing { (now_ms() - read_at) as f64 / 1000.0 } else { 0.0 };
        let position = if mirror.duration > 0.0 { (mirror.position + moved).min(mirror.duration) } else { mirror.position + moved };
        let up_next: Vec<Value> = mirror
            .up_next
            .iter()
            .take(25)
            .enumerate()
            .map(|(i, s)| json!({ "index": mirror.index + 1 + i, "song": song_to_wire(s, art_base) }))
            .collect();
        let mut out = json!({
            "playing": mirror.playing,
            "position": (position.max(0.0) * 1000.0) as i64,
            "duration": (mirror.duration.max(0.0) * 1000.0) as i64,
            "index": mirror.index,
            "upNext": up_next,
            "liked": mirror.liked,
            "style": "FLAGSHIP",
            "styles": [],
        });
        if let Some(song) = &mirror.song {
            out["song"] = song_to_wire(song, art_base);
        }
        out
    }

    // ---------------------------------------------------------------- the server

    async fn device_by_key(&self, key: Option<&str>) -> Option<PairedDevice> {
        let key = key?;
        self.store.read().await.devices.iter().find(|d| http::equal_secret(&d.key, key)).cloned()
    }

    async fn route(self: Arc<Self>, req: Request) -> Response {
        let Some(device) = self.device_by_key(req.key()).await else {
            return Response::status(401, "not paired");
        };
        self.seen(&device.id).await;
        let path = req.path.clone();
        match path.as_str() {
            "/hello" => self.on_hello(&req, &device).await,
            "/avatar" | "/library" => Response::status(404, "not here"),
            "/library.json" => {
                if !device.mirror_library {
                    return Response::status(403, "library sharing is off");
                }
                Response::json(&self.library.export().await)
            }
            "/files" => {
                if !device.stream_local || !self.library.get_settings().await.share_local_files {
                    return Response::json(&json!([]));
                }
                let list: Vec<Value> = self.local.all().await.iter().map(|t| t.wire()).collect();
                Response::json(&Value::Array(list))
            }
            p if p.starts_with("/file/") => {
                if !device.stream_local || !self.library.get_settings().await.share_local_files {
                    return Response::status(403, "streaming is off");
                }
                let id = &p["/file/".len()..];
                match self.local.get(id).await {
                    Some(track) => Response::ranged_file(req.header("range"), PathBuf::from(&track.path), track.bytes, &track.mime),
                    None => Response::status(404, "no such file"),
                }
            }
            p if p.starts_with("/art/") => match self.local.art(&p["/art/".len()..]).await {
                Some((bytes, mime)) => Response::bytes(bytes, &mime).with_header("Cache-Control", "max-age=86400"),
                None => Response::status(404, ""),
            },
            "/changes" if req.method == "POST" => {
                if device.mirror_library {
                    self.apply_incoming(&req.json()).await;
                }
                Response::ok()
            }
            "/unlink" if req.method == "POST" => {
                self.forget(&device.id).await;
                Response::ok()
            }
            _ => self.clone().controlled(&req, &device).await,
        }
    }

    // a phone says where its own link server is; this computer answers with what it is and what it allows
    async fn on_hello(&self, req: &Request, device: &PairedDevice) -> Response {
        let port = req.query.get("port").or_else(|| req.query.get("tvPort")).and_then(|p| p.parse::<u16>().ok()).filter(|p| *p > 0);
        if let Some(port) = port {
            self.mark_live(&device.id, &req.remote_host(), port, None).await;
        }
        let settings = self.library.get_settings().await;
        Response::json(&json!({
            "id": self.me,
            "name": self.name().await,
            "kind": KIND,
            "user": settings.profile_name,
            "protocol": PROTOCOL,
            "dbVersion": 0,
            "appVersion": env!("CARGO_PKG_VERSION"),
            "rev": self.revision.load(Ordering::Relaxed),
            "mirror": device.mirror_library,
            "stream": device.stream_local && settings.share_local_files,
            "port": self.port().await,
        }))
    }

    // what a paired device may ask of the player here: what's on, play this, line that up, skip, and the settings it may change
    async fn controlled(self: Arc<Self>, req: &Request, device: &PairedDevice) -> Response {
        if device.kind == "tv" {
            return Response::status(404, "");
        }
        if !device.remote_control {
            return Response::status(403, "remote control is off on this computer");
        }
        if !self.window_open.load(Ordering::Relaxed) {
            return Response::status(409, "mochy isn't open on this computer");
        }
        self.note_controller(&device.name).await;
        let body = req.json();
        let art_base = self.art_base(device).await;
        match req.path.as_str() {
            "/now" => Response::json(&self.now_json(art_base.as_deref()).await),
            "/play" => {
                let songs = self.songs_for(device, body.get("songs")).await;
                if songs.is_empty() {
                    return Response::status(400, "no songs");
                }
                let index = body.get("index").and_then(|v| v.as_u64()).unwrap_or(0).min(songs.len() as u64 - 1);
                self.emit(
                    "link://command",
                    json!({
                        "type": "play",
                        "songs": songs,
                        "index": index,
                        "position": body.get("position").and_then(|v| v.as_f64()).unwrap_or(0.0) / 1000.0,
                        "title": body.get("title"),
                        "from": device.name,
                    }),
                );
                Response::ok()
            }
            "/next" | "/queue" => {
                let songs = self.songs_for(device, body.get("songs")).await;
                self.emit("link://command", json!({ "type": &req.path[1..], "songs": songs, "from": device.name }));
                Response::ok()
            }
            "/jump" | "/remove" => {
                self.emit("link://command", json!({ "type": &req.path[1..], "index": body.get("index").and_then(|v| v.as_i64()).unwrap_or(-1) }));
                Response::ok()
            }
            "/control" => {
                let action = body.get("action").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                if action == "sync" {
                    let hub = self.clone();
                    let id = device.id.clone();
                    tokio::spawn(async move {
                        let _ = hub.sync(&id).await;
                    });
                } else {
                    let position = body.get("position").and_then(|v| v.as_f64()).map(|ms| ms / 1000.0);
                    self.emit("link://command", json!({ "type": "control", "action": action, "position": position }));
                }
                Response::ok()
            }
            "/style" => Response::ok(),
            "/settings" => {
                if req.method == "POST" {
                    let key = body.get("key").and_then(|v| v.as_str()).unwrap_or_default();
                    if !self.write_setting(key, body.get("value").cloned().unwrap_or(Value::Null)).await {
                        return Response::status(400, "unknown setting");
                    }
                }
                Response::json(&json!({ "settings": self.settings_json().await }))
            }
            _ => Response::status(404, ""),
        }
    }

    // where a device can load this computer's cover art from
    async fn art_base(&self, device: &PairedDevice) -> Option<String> {
        let address = local_address()?;
        let port = self.port().await;
        Some(format!("{}?k={}", base_url(&address, port), device.key))
    }

    // songs sent over the wire, with the ones that only live on that device marked as streaming from it
    async fn songs_for(&self, device: &PairedDevice, list: Option<&Value>) -> Vec<SongItem> {
        let files: HashSet<String> = self.files(&device.id).await.into_iter().map(|f| f.song.id).collect();
        list.and_then(|l| l.as_array())
            .map(|a| a.iter().filter_map(song_from_wire).collect::<Vec<_>>())
            .unwrap_or_default()
            .into_iter()
            .map(|mut s| {
                if s.id.starts_with("LOCAL_") || (files.contains(&s.id) && s.id.len() != 11) {
                    s.source = Some(format!("link:{}", device.id));
                } else if s.id.starts_with("pc") && s.id.len() == 18 {
                    s.source = Some("local".into());
                    s.thumbnail = format!("local-art:{}", s.id);
                }
                s
            })
            .collect()
    }

    async fn note_controller(&self, name: &str) {
        let now = now_ms();
        let mut slot = self.controller.write().await;
        let fresh = slot.as_ref().map(|(n, at)| n != name || now - at > 5_000).unwrap_or(true);
        *slot = Some((name.to_string(), now));
        drop(slot);
        if fresh {
            self.emit("link://controller", json!({ "name": name }));
        }
    }

    async fn settings_json(&self) -> Value {
        let s = self.library.get_settings().await;
        json!([
            { "key": "normalize", "section": "Playback", "title": "Even out loudness", "type": "switch", "value": s.normalize_volume },
            { "key": "audioQuality", "section": "YouTube", "title": "Audio quality", "type": "choice",
              "value": if s.high_quality_audio { "HIGH" } else { "LOW" },
              "options": [{ "value": "HIGH", "label": "High" }, { "value": "LOW", "label": "Data saver" }] },
            { "key": "lyricsBlur", "section": "Lyrics", "title": "Blur the far lines", "type": "switch", "value": s.lyrics_blur },
            { "key": "lyricsGlow", "section": "Lyrics", "title": "Glow on held notes", "type": "switch", "value": s.lyrics_glow },
            { "key": "animatedBackgrounds", "section": "Player", "title": "Moving backgrounds", "type": "switch", "value": s.animated_backgrounds },
            { "key": "playerBarStyle", "section": "Player", "title": "Player bar", "type": "choice", "value": s.player_bar_style,
              "options": [
                { "value": "auto", "label": "Fit the window" },
                { "value": "classic", "label": "Classic" },
                { "value": "compact", "label": "Compact" },
                { "value": "classicWithNav", "label": "Classic with tabs" },
                { "value": "compactWithNav", "label": "Compact with tabs" }
              ] },
        ])
    }

    async fn write_setting(&self, key: &str, value: Value) -> bool {
        let mut s: AppSettings = self.library.get_settings().await;
        let flag = value.as_bool();
        let text = value.as_str().map(str::to_string);
        match (key, flag, text) {
            ("normalize", Some(v), _) => s.normalize_volume = v,
            ("lyricsBlur", Some(v), _) => s.lyrics_blur = v,
            ("lyricsGlow", Some(v), _) => s.lyrics_glow = v,
            ("animatedBackgrounds", Some(v), _) => s.animated_backgrounds = v,
            ("audioQuality", _, Some(v)) if v == "HIGH" || v == "LOW" => s.high_quality_audio = v == "HIGH",
            ("playerBarStyle", _, Some(v)) if ["auto", "classic", "compact", "classicWithNav", "compactWithNav"].contains(&v.as_str()) => {
                s.player_bar_style = v
            }
            _ => return false,
        }
        let saved = self.library.update_settings(s).await;
        self.emit("settings://changed", serde_json::to_value(saved).unwrap_or(Value::Null));
        true
    }

    async fn apply_incoming(&self, body: &Value) {
        let rows = body.get("rows").and_then(|r| r.get("song")).and_then(|s| s.as_array()).cloned().unwrap_or_default();
        let mut artists: HashMap<String, String> = HashMap::new();
        for a in body.get("rows").and_then(|r| r.get("artist")).and_then(|s| s.as_array()).into_iter().flatten() {
            if let (Some(id), Some(name)) = (a.get("id").and_then(|v| v.as_str()), a.get("name").and_then(|v| v.as_str())) {
                artists.insert(id.into(), name.into());
            }
        }
        let mut song_artists: HashMap<String, Vec<ArtistRef>> = HashMap::new();
        for m in body.get("rows").and_then(|r| r.get("song_artist_map")).and_then(|s| s.as_array()).into_iter().flatten() {
            if let (Some(sid), Some(aid)) = (m.get("songId").and_then(|v| v.as_str()), m.get("artistId").and_then(|v| v.as_str())) {
                if let Some(name) = artists.get(aid) {
                    song_artists.entry(sid.into()).or_default().push(ArtistRef {
                        name: name.clone(),
                        id: (aid.starts_with("UC")).then(|| aid.to_string()),
                    });
                }
            }
        }
        let songs = rows
            .iter()
            .filter_map(|r| {
                let mut wire = json!({
                    "id": r.get("id"), "title": r.get("title"), "duration": r.get("duration"),
                    "thumbnailUrl": r.get("thumbnailUrl"), "explicit": r.get("explicit").and_then(|e| e.as_i64()).map(|e| e != 0),
                });
                if let (Some(aid), Some(name)) = (r.get("albumId").and_then(|v| v.as_str()), r.get("albumName").and_then(|v| v.as_str())) {
                    wire["album"] = json!({ "id": aid, "title": name });
                }
                let mut song = song_from_wire(&wire)?;
                song.artists = song_artists.remove(&song.id).unwrap_or_default();
                Some(song)
            })
            .collect();
        let ids = |key: &str| -> Vec<String> {
            body.get(key).and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect()).unwrap_or_default()
        };
        let plays = body
            .get("plays")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|p| Some((p.get("songId")?.as_str()?.to_string(), p.get("timestamp")?.as_i64()?)))
                    .collect()
            })
            .unwrap_or_default();
        self.library.apply_changes(IncomingChanges { songs, plays, liked: ids("liked"), unliked: ids("unliked") }).await;
        self.revision.fetch_add(1, Ordering::Relaxed);
        self.emit("library://changed", Value::Null);
    }

    // ---------------------------------------------------------------- devices

    async fn seen(&self, id: &str) {
        let now = now_ms();
        let mut store = self.store.write().await;
        if let Some(d) = store.devices.iter_mut().find(|d| d.id == id) {
            // written at most once a minute, a phone calls every few seconds while it's steering
            if now - d.last_seen_at < 60_000 {
                return;
            }
            d.last_seen_at = now;
        }
        drop(store);
        self.save().await;
    }

    async fn mark_live(&self, id: &str, host: &str, port: u16, hello: Option<&Value>) {
        let key = match self.store.read().await.devices.iter().find(|d| d.id == id) {
            Some(d) => d.key.clone(),
            None => return,
        };
        let was_around = self.live.read().await.get(id).map(|l| now_ms() - l.seen_at < LIVE_FOR_MS).unwrap_or(false);
        let previous = self.live.read().await.get(id).cloned();
        let live = LiveDevice {
            id: id.to_string(),
            host: host.to_string(),
            port,
            key,
            seen_at: now_ms(),
            mirror: hello.and_then(|h| h.get("mirror")).and_then(|v| v.as_bool()).or(previous.as_ref().and_then(|p| p.mirror)),
            stream: hello.and_then(|h| h.get("stream")).and_then(|v| v.as_bool()).or(previous.as_ref().and_then(|p| p.stream)),
            rev: hello.and_then(|h| h.get("rev")).and_then(|v| v.as_i64()).or(previous.as_ref().and_then(|p| p.rev)),
            lib: hello.and_then(|h| h.get("lib")).and_then(|v| v.as_str()).map(str::to_string).or(previous.and_then(|p| p.lib)),
        };
        self.live.write().await.insert(id.to_string(), live);
        let mut moved = false;
        {
            let mut store = self.store.write().await;
            if let Some(d) = store.devices.iter_mut().find(|d| d.id == id) {
                if d.host.as_deref() != Some(host) || d.port != port {
                    d.host = Some(host.to_string());
                    d.port = port;
                    moved = true;
                }
            }
        }
        if moved {
            self.save().await;
        }
        if !was_around {
            self.changed();
            self.on_arrival(id).await;
        }
    }

    // a device that just turned up is taken over when it asked for that and nothing else is steered
    async fn on_arrival(&self, id: &str) {
        if self.remote.read().await.is_some() {
            return;
        }
        let device = self.store.read().await.devices.iter().find(|d| d.id == id).cloned();
        if let Some(d) = device.filter(|d| d.auto_control && d.remote_control) {
            let _ = self.remote_start(&d.id).await;
            self.emit("link://toast", json!({ "message": format!("Controlling {}", d.name) }));
        }
    }

    pub async fn live_device(&self, id: &str) -> Option<LiveDevice> {
        self.live.read().await.get(id).filter(|l| now_ms() - l.seen_at < LIVE_FOR_MS).cloned()
    }

    pub async fn update_device(&self, id: &str, patch: Value) -> bool {
        let mut store = self.store.write().await;
        let Some(d) = store.devices.iter_mut().find(|d| d.id == id) else { return false };
        if let Some(v) = patch.get("remoteControl").and_then(|v| v.as_bool()) {
            d.remote_control = v;
            if !v {
                d.auto_control = false;
            }
        }
        if let Some(v) = patch.get("autoControl").and_then(|v| v.as_bool()) {
            d.auto_control = v && d.remote_control;
        }
        if let Some(v) = patch.get("streamLocal").and_then(|v| v.as_bool()) {
            d.stream_local = v;
        }
        if let Some(v) = patch.get("mirrorLibrary").and_then(|v| v.as_bool()) {
            d.mirror_library = v;
        }
        if let Some(v) = patch.get("name").and_then(|v| v.as_str()).filter(|v| !v.trim().is_empty()) {
            d.name = v.trim().to_string();
        }
        let steering_lost = !d.remote_control;
        let id = d.id.clone();
        drop(store);
        self.save().await;
        if steering_lost && self.remote.read().await.as_ref().map(|r| r.id == id).unwrap_or(false) {
            self.remote_stop().await;
        }
        self.changed();
        true
    }

    // a phone hears about it straight away; this side forgets the device either way
    pub async fn unlink(&self, id: &str) {
        if let Some(live) = self.live_device(id).await {
            let _ = self
                .client
                .post(format!("{}/unlink", live.base()))
                .header(http::KEY_HEADER, &live.key)
                .json(&json!({}))
                .send()
                .await;
        }
        self.forget(id).await;
    }

    async fn forget(&self, id: &str) {
        self.live.write().await.remove(id);
        {
            let mut store = self.store.write().await;
            store.devices.retain(|d| d.id != id);
            store.files.remove(id);
        }
        self.save().await;
        self.library.forget_device(id).await;
        if self.remote.read().await.as_ref().map(|r| r.id == id).unwrap_or(false) {
            self.remote_stop().await;
        }
        self.refresh_advert().await;
        self.changed();
        self.emit("library://changed", Value::Null);
    }

    // ---------------------------------------------------------------- pairing

    // while the pairing sheet is open, this computer waits on the wi-fi for someone who types the code it shows
    pub async fn open_pairing(self: &Arc<Self>) -> Result<PairingView, String> {
        let link_port = self.ensure_server().await;
        let mut slot = self.pairing.lock().await;
        if slot.is_none() {
            let hub = self.clone();
            let handler: http::Handler = Arc::new(move |req| {
                let hub = hub.clone();
                Box::pin(async move { hub.door(req).await })
            });
            let server = http::Server::start(PAIR_PORT, handler).await.map_err(|e| e.to_string())?;
            let port = server.port;
            let name = self.name().await;
            self.mdns.advertise(
                PAIR_SERVICE,
                &format!("Mochy {}", name),
                &format!("{}-pair", host_label(&self.me)),
                port,
                &[(mdns::ATTR_ID, &self.me), (mdns::ATTR_NAME, &name), (mdns::ATTR_KIND, KIND)],
            );
            *slot = Some(Pairing { code: new_code(), wrong: 0, port, _server: server });
        }
        let pairing = slot.as_ref().unwrap();
        let _ = link_port;
        let view = PairingView { code: pairing.code.clone(), name: self.name().await, address: local_address(), port: pairing.port };
        drop(slot);
        self.changed();
        Ok(view)
    }

    pub async fn close_pairing(&self) {
        let had = self.pairing.lock().await.take().is_some();
        self.mdns.withdraw(PAIR_SERVICE);
        if had {
            self.changed();
        }
    }

    async fn door(self: Arc<Self>, req: Request) -> Response {
        match (req.method.as_str(), req.path.as_str()) {
            (_, "/pair/hello") => Response::json(&json!({
                "id": self.me, "name": self.name().await, "kind": KIND, "protocol": PROTOCOL,
            })),
            ("POST", "/pair") => self.on_pair(&req).await,
            _ => Response::status(404, ""),
        }
    }

    async fn on_pair(self: &Arc<Self>, req: &Request) -> Response {
        let body = req.json();
        let given = body.get("code").and_then(|v| v.as_str()).unwrap_or_default().trim().to_string();
        {
            let mut slot = self.pairing.lock().await;
            let Some(pairing) = slot.as_mut() else { return Response::status(409, "not pairing") };
            if !http::equal_secret(&given, &pairing.code) {
                // guessing is cut short: a few wrong codes and the screen shows a new one
                pairing.wrong += 1;
                if pairing.wrong >= MAX_WRONG_TRIES {
                    pairing.code = new_code();
                    pairing.wrong = 0;
                    drop(slot);
                    self.changed();
                }
                return Response::status(403, "wrong code");
            }
        }
        let Some(id) = body.get("phoneId").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(str::to_string) else {
            return Response::status(400, "");
        };
        let Some(key) = body.get("key").and_then(|v| v.as_str()).filter(|s| s.len() >= 16).map(str::to_string) else {
            return Response::status(400, "");
        };
        {
            let store = self.store.read().await;
            if store.devices.len() >= MAX_DEVICES && !store.devices.iter().any(|d| d.id == id) {
                return Response::status(409, "full");
            }
        }
        let now = now_ms();
        let host = req.remote_host();
        let port = body.get("port").and_then(|v| v.as_u64()).map(|p| p as u16).filter(|p| *p > 0).unwrap_or(LINK_PORT);
        let kind = body.get("kind").and_then(|v| v.as_str()).filter(|k| !k.is_empty()).unwrap_or("phone").to_string();
        let name = body.get("phoneName").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or("Phone").to_string();
        self.save_paired(PairedDevice {
            id: id.clone(),
            name: name.clone(),
            key,
            kind,
            paired_at: now,
            last_seen_at: now,
            last_sync_at: 0,
            host: Some(host.clone()),
            port,
            remote_control: true,
            auto_control: false,
            stream_local: true,
            mirror_library: true,
            pushed_seq: 0,
            events_mark: 0,
        })
        .await;
        self.mark_live(&id, &host, port, None).await;
        // a used code is never good twice
        if let Some(p) = self.pairing.lock().await.as_mut() {
            p.code = new_code();
            p.wrong = 0;
        }
        self.emit("link://paired", json!({ "id": id, "name": name }));
        let hub = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let _ = hub.sync(&id).await;
        });
        Response::json(&json!({
            "tvId": self.me,
            "tvName": self.name().await,
            "kind": KIND,
            "port": self.port().await,
        }))
    }

    // pairing again keeps the switches set for it before
    async fn save_paired(&self, fresh: PairedDevice) {
        {
            let mut store = self.store.write().await;
            let merged = match store.devices.iter().find(|d| d.id == fresh.id) {
                Some(old) => PairedDevice {
                    remote_control: old.remote_control,
                    auto_control: old.auto_control,
                    stream_local: old.stream_local,
                    mirror_library: old.mirror_library,
                    pushed_seq: 0,
                    events_mark: old.events_mark,
                    last_sync_at: 0,
                    ..fresh
                },
                None => fresh,
            };
            store.devices.retain(|d| d.id != merged.id);
            store.devices.push(merged);
        }
        self.save().await;
        self.refresh_advert().await;
        self.changed();
    }

    // asks a device in pairing mode to take this computer, with the code its screen shows
    pub async fn pair(self: &Arc<Self>, peer_id: Option<String>, address: Option<String>, code: String) -> Result<DeviceView, String> {
        let peer = match (peer_id, address) {
            (Some(id), _) => self.mdns.find(PAIR_SERVICE, &id).ok_or("That device stopped pairing. Open its pairing screen again.")?,
            (None, Some(address)) => self.peer_at(&address).await?,
            _ => return Err("Pick a device or type its address".into()),
        };
        if peer.kind == "tv" {
            return Err("A TV pairs with a phone. Pair this computer with your phone instead.".into());
        }
        let link_port = self.ensure_server().await;
        {
            let store = self.store.read().await;
            if store.devices.len() >= MAX_DEVICES && !store.devices.iter().any(|d| d.id == peer.id) {
                return Err("This computer already has 10 devices".into());
            }
        }
        let key = random_hex(24);
        let name = self.name().await;
        let user = self.library.get_settings().await.profile_name;
        let response = self
            .client
            .post(format!("{}/pair", base_url(&peer.host, peer.port)))
            .json(&json!({
                "code": code.trim(),
                "phoneId": self.me,
                "phoneName": name,
                "kind": KIND,
                "userName": user,
                "hasAvatar": false,
                "port": link_port,
                "key": key,
                "protocol": PROTOCOL,
            }))
            .send()
            .await
            .map_err(|_| format!("Couldn't reach {}", peer.name))?;
        let status = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        match status {
            200 => {}
            403 => return Err("That code isn't right".into()),
            409 if text == "full" => return Err(format!("{} already has all the devices it takes", peer.name)),
            _ => return Err(format!("Couldn't pair with {}", peer.name)),
        }
        let reply: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        let now = now_ms();
        let id = reply.get("tvId").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or(&peer.id).to_string();
        let kind = reply.get("kind").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or(&peer.kind).to_string();
        let port = reply.get("port").and_then(|v| v.as_u64()).map(|p| p as u16).filter(|p| *p > 0).unwrap_or(LINK_PORT);
        let device = PairedDevice {
            id: id.clone(),
            name: reply.get("tvName").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or(&peer.name).to_string(),
            key,
            kind,
            paired_at: now,
            last_seen_at: now,
            last_sync_at: 0,
            host: Some(peer.host.clone()),
            port,
            remote_control: true,
            auto_control: false,
            stream_local: true,
            mirror_library: true,
            pushed_seq: 0,
            events_mark: 0,
        };
        self.save_paired(device).await;
        self.mark_live(&id, &peer.host, port, None).await;
        let hub = self.clone();
        let sync_id = id.clone();
        tokio::spawn(async move {
            hub.hello(&sync_id).await;
            let _ = hub.sync(&sync_id).await;
        });
        self.state().await.devices.into_iter().find(|d| d.id == id).ok_or_else(|| "Paired, but lost track of it".to_string())
    }

    // a device on a wi-fi that hides devices from each other: asked directly at the address its pairing screen shows
    async fn peer_at(&self, address: &str) -> Result<Peer, String> {
        let address = address.trim().trim_start_matches("http://").trim_end_matches('/');
        let (host, port) = match address.rsplit_once(':') {
            Some((h, p)) if !h.contains(':') => (h.to_string(), p.parse::<u16>().map_err(|_| "That address doesn't look right")?),
            _ => (address.to_string(), PAIR_PORT),
        };
        let hello: Value = self
            .client
            .get(format!("{}/pair/hello", base_url(&host, port)))
            .send()
            .await
            .map_err(|_| format!("Nothing answered at {}", address))?
            .json()
            .await
            .map_err(|_| "That isn't a Mochy pairing screen".to_string())?;
        Ok(Peer {
            id: hello.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            name: hello.get("name").and_then(|v| v.as_str()).unwrap_or("Device").to_string(),
            host,
            port,
            kind: hello.get("kind").and_then(|v| v.as_str()).unwrap_or("phone").to_string(),
        })
    }

    // ---------------------------------------------------------------- heartbeat

    async fn heartbeat(self: &Arc<Self>) {
        let ids: Vec<(String, String)> = self.store.read().await.devices.iter().map(|d| (d.id.clone(), d.kind.clone())).collect();
        for (id, kind) in ids {
            // a tv says hello to its phone, never the other way round
            if kind == "tv" {
                continue;
            }
            let hub = self.clone();
            tokio::spawn(async move {
                if let Some(hello) = hub.hello(&id).await {
                    hub.maybe_sync(&id, &hello).await;
                }
            });
        }
    }

    // true when the device answered; it moved to another address, or never said where it was, and it's found by its id
    async fn hello(&self, id: &str) -> Option<Value> {
        let device = self.store.read().await.devices.iter().find(|d| d.id == id).cloned()?;
        let my_port = self.port().await;
        let mut targets: Vec<(String, u16)> = Vec::new();
        if let Some(host) = &device.host {
            targets.push((host.clone(), if device.port > 0 { device.port } else { LINK_PORT }));
        }
        if let Some(found) = self.mdns.find(PHONE_SERVICE, id) {
            if !targets.iter().any(|(h, p)| *h == found.host && *p == found.port) {
                targets.push((found.host, found.port));
            }
        }
        for (host, port) in targets {
            let url = format!("{}/hello?port={}&kind={}", base_url(&host, port), my_port, KIND);
            match self.client.get(&url).header(http::KEY_HEADER, &device.key).timeout(Duration::from_secs(6)).send().await {
                Ok(r) if r.status().as_u16() == 200 => {
                    let hello: Value = r.json().await.unwrap_or(Value::Null);
                    self.mark_live(id, &host, port, Some(&hello)).await;
                    return Some(hello);
                }
                // the other side unlinked this computer while they were apart
                Ok(r) if r.status().as_u16() == 401 => {
                    self.forget(id).await;
                    self.emit("link://toast", json!({ "message": format!("{} unlinked this computer", device.name) }));
                    return None;
                }
                _ => continue,
            }
        }
        let was = self.live_device(id).await.is_some();
        if !was {
            // it already counted as away, nothing new to say
            return None;
        }
        self.changed();
        None
    }

    // a like or a playlist edit comes over within a heartbeat; plays alone wait for the longer gap
    async fn maybe_sync(&self, id: &str, hello: &Value) {
        let Some(device) = self.store.read().await.devices.iter().find(|d| d.id == id).cloned() else { return };
        if !device.mirror_library || hello.get("mirror").and_then(|v| v.as_bool()) == Some(false) {
            return;
        }
        let since = now_ms() - device.last_sync_at;
        let head = self.library.journal_head().await;
        let lib_changed = {
            let marks = self.synced_lib.read().await;
            let mark = marks.get(id).cloned();
            hello.get("lib").and_then(|v| v.as_str()).map(|l| Some(l.to_string()) != mark).unwrap_or(false)
        };
        let ours = head > device.pushed_seq;
        if device.last_sync_at == 0 || since > AUTO_SYNC_GAP_MS || ((lib_changed || ours) && since > MIN_SYNC_GAP_MS) {
            let _ = self.sync(id).await;
        }
    }

    // ---------------------------------------------------------------- sync

    async fn set_status(&self, id: &str, phase: &str, message: Option<String>) {
        self.sync_status.write().await.insert(id.to_string(), SyncStatus { phase: phase.into(), at: now_ms(), message });
        self.changed();
    }

    // sends what happened here, then takes the device's library and its list of song files, as far as each side allows
    pub async fn sync(&self, id: &str) -> Result<String, String> {
        {
            let mut busy = self.syncing.lock().await;
            if !busy.insert(id.to_string()) {
                return Err("Already syncing".into());
            }
        }
        let result = self.sync_inner(id).await;
        self.syncing.lock().await.remove(id);
        match &result {
            Ok(summary) => {
                if let Some(lib) = self.live_device(id).await.and_then(|l| l.lib) {
                    self.synced_lib.write().await.insert(id.to_string(), lib);
                }
                self.set_status(id, "synced", (!summary.is_empty()).then(|| summary.clone())).await;
                self.emit("library://changed", Value::Null);
            }
            Err(e) => self.set_status(id, "failed", Some(e.clone())).await,
        }
        result
    }

    async fn sync_inner(&self, id: &str) -> Result<String, String> {
        let device = self.store.read().await.devices.iter().find(|d| d.id == id).cloned().ok_or("Not paired")?;
        let live = match self.live_device(id).await {
            Some(l) => l,
            None => {
                self.hello(id).await;
                self.live_device(id).await.ok_or_else(|| format!("{} isn't around", device.name))?
            }
        };
        self.set_status(id, "syncing", None).await;
        let base = live.base();
        let mut summary = Vec::new();

        if device.mirror_library {
            // push first, so what was liked here is already there when its library comes back
            let (entries, songs, head) = self.library.journal_since(device.pushed_seq).await;
            let first = device.last_sync_at == 0;
            let extra = if first { self.library.all_liked().await } else { Vec::new() };
            if !entries.is_empty() || !extra.is_empty() {
                let body = snapshot::changes_body(&entries, &songs, &extra);
                let sent = self.client.post(format!("{}/changes", base)).header(http::KEY_HEADER, &live.key).json(&body).send().await;
                match sent {
                    Ok(r) if r.status().is_success() => {
                        summary.push(format!("sent {} changes", entries.len() + extra.len()));
                    }
                    Ok(r) if r.status().as_u16() == 403 => {}
                    _ => return Err(format!("Couldn't send changes to {}", device.name)),
                }
            }
            self.with_device(id, |d| d.pushed_seq = head).await;

            let events_since = device.events_mark.max(now_ms() - 120 * 86_400_000);
            let remote = if device.kind == KIND {
                let r = self.slow.get(format!("{}/library.json", base)).header(http::KEY_HEADER, &live.key).send().await.map_err(|e| e.to_string())?;
                if r.status().as_u16() == 403 {
                    None
                } else {
                    let v: Value = r.json().await.map_err(|e| e.to_string())?;
                    Some(snapshot::read_json(&v, id))
                }
            } else {
                let r = self.slow.get(format!("{}/library", base)).header(http::KEY_HEADER, &live.key).send().await.map_err(|e| e.to_string())?;
                if r.status().as_u16() == 403 {
                    None
                } else if !r.status().is_success() {
                    return Err(format!("{} didn't send its library ({})", device.name, r.status().as_u16()));
                } else {
                    let gz = r.bytes().await.map_err(|e| e.to_string())?;
                    let temp = self.library.data_dir().join(format!("link-{}.db", now_ms()));
                    let device_id = id.to_string();
                    let read = tokio::task::spawn_blocking(move || {
                        let raw = snapshot::gunzip(&gz).map_err(|e| e.to_string())?;
                        std::fs::write(&temp, raw).map_err(|e| e.to_string())?;
                        let out = snapshot::read(&temp, &device_id, events_since).map_err(|e| e.to_string());
                        let _ = std::fs::remove_file(&temp);
                        out
                    })
                    .await
                    .map_err(|e| e.to_string())??;
                    Some(read)
                }
            };
            if let Some(remote) = remote {
                let newest = remote.events.iter().map(|(_, at)| *at).max().unwrap_or(device.events_mark);
                let songs = remote.songs.clone();
                let liked = remote.liked.len();
                let lists = remote.playlists.len();
                self.library.apply_remote(id, &device.name, remote, device.last_sync_at).await;
                self.with_device(id, |d| d.events_mark = d.events_mark.max(newest)).await;
                summary.push(format!("{} likes, {} playlists", liked, lists));
                self.pull_files(id, &base, &live.key, Some(&songs)).await;
            } else {
                self.pull_files(id, &base, &live.key, None).await;
            }
        } else {
            self.pull_files(id, &base, &live.key, None).await;
        }

        self.with_device(id, |d| d.last_sync_at = now_ms()).await;
        self.prune_journal().await;
        Ok(summary.join(", "))
    }

    async fn with_device(&self, id: &str, change: impl FnOnce(&mut PairedDevice)) {
        {
            let mut store = self.store.write().await;
            if let Some(d) = store.devices.iter_mut().find(|d| d.id == id) {
                change(d);
            }
        }
        self.save().await;
    }

    async fn prune_journal(&self) {
        let store = self.store.read().await;
        let lowest = store.devices.iter().filter(|d| d.mirror_library && d.kind != "tv").map(|d| d.pushed_seq).min();
        drop(store);
        if let Some(lowest) = lowest {
            self.library.prune_journal(lowest).await;
        }
    }

    // the song files the device can hand over, named from its library when there is one
    async fn pull_files(&self, id: &str, base: &str, key: &str, songs: Option<&HashMap<String, SongItem>>) {
        let Ok(r) = self.client.get(format!("{}/files", base)).header(http::KEY_HEADER, key).send().await else { return };
        let Ok(list) = r.json::<Vec<Value>>().await else { return };
        let known: HashMap<String, SongItem> = match songs {
            Some(s) => s.clone(),
            None => self.files(id).await.into_iter().map(|f| (f.song.id.clone(), f.song)).collect(),
        };
        let mut files = Vec::new();
        for f in list {
            let Some(fid) = f.get("id").and_then(|v| v.as_str()).map(str::to_string) else { continue };
            let mut song = known.get(&fid).cloned().unwrap_or_else(|| SongItem {
                id: fid.clone(),
                title: f.get("title").and_then(|v| v.as_str()).unwrap_or(&fid).to_string(),
                artists: f
                    .get("artist")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|a| vec![ArtistRef { name: a.to_string(), id: None }])
                    .unwrap_or_default(),
                album: f.get("album").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(|a| AlbumRef { name: a.into(), id: String::new() }),
                duration: f.get("duration").and_then(|v| v.as_i64()).filter(|d| *d > 0),
                thumbnail: if f.get("art").and_then(|v| v.as_bool()).unwrap_or(false) { format!("link-art:{}:{}", id, fid) } else { String::new() },
                explicit: false,
                music_video_type: None,
                source: None,
            });
            song.source = Some(format!("link:{}", id));
            files.push(RemoteFile {
                song,
                bytes: f.get("bytes").and_then(|v| v.as_u64()).unwrap_or(0),
                mime: f.get("mime").and_then(|v| v.as_str()).unwrap_or("audio/mp4").to_string(),
                local: f.get("local").and_then(|v| v.as_bool()).unwrap_or(false),
            });
        }
        self.store.write().await.files.insert(id.to_string(), files);
        self.save().await;
        self.changed();
    }

    // where the local proxy fetches a device's file or cover from
    pub async fn file_url(&self, device_id: &str, path: &str) -> Option<(String, String)> {
        let live = self.live_device(device_id).await?;
        Some((format!("{}{}", live.base(), path), live.key))
    }

    pub fn stream_client(&self) -> &reqwest::Client {
        &self.stream
    }

    // ---------------------------------------------------------------- steering another device

    pub async fn remote_start(&self, id: &str) -> Result<RemoteView, String> {
        let device = self.store.read().await.devices.iter().find(|d| d.id == id).cloned().ok_or("Not paired")?;
        if device.kind == "tv" {
            return Err("A TV is steered from its phone".into());
        }
        let view = RemoteView {
            id: device.id.clone(),
            name: device.name.clone(),
            kind: device.kind.clone(),
            reachable: self.live_device(id).await.is_some(),
            song: None,
            playing: false,
            position: 0.0,
            duration: 0.0,
            liked: false,
            up_next: Vec::new(),
            read_at: now_ms(),
        };
        *self.remote.write().await = Some(view);
        self.poll_remote().await;
        self.changed();
        self.remote.read().await.clone().ok_or_else(|| "stopped".into())
    }

    pub async fn remote_stop(&self) {
        *self.remote.write().await = None;
        self.emit("link://remote", Value::Null);
        self.changed();
    }

    pub fn remote_watch(&self, open: bool) {
        let v = self.watchers.fetch_add(if open { 1 } else { -1 }, Ordering::Relaxed) + if open { 1 } else { -1 };
        if v < 0 {
            self.watchers.store(0, Ordering::Relaxed);
        }
    }

    // one call to the steered device: a get without a body, a post with one; the error says why it didn't go
    pub async fn remote_call(&self, path: &str, body: Option<Value>) -> Result<Value, String> {
        let target = self.remote.read().await.as_ref().map(|r| (r.id.clone(), r.name.clone())).ok_or("Not steering anything")?;
        let live = self.live_device(&target.0).await.ok_or_else(|| format!("{} isn't around", target.1))?;
        let url = format!("{}{}", live.base(), path);
        let request = match body {
            Some(b) => self.client.post(url).json(&b),
            None => self.client.get(url),
        };
        let r = request.header(http::KEY_HEADER, &live.key).timeout(Duration::from_secs(8)).send().await.map_err(|_| format!("Couldn't reach {}", target.1))?;
        let status = r.status().as_u16();
        let text = r.text().await.unwrap_or_default();
        match status {
            200 => Ok(serde_json::from_str(&text).unwrap_or(json!({}))),
            403 => Err(if text.is_empty() { format!("{} doesn't let this computer steer it", target.1) } else { text }),
            409 => Err(format!("Open Mochy on {} first", target.1)),
            _ => Err(format!("{} said no ({})", target.1, status)),
        }
    }

    pub async fn poll_remote(&self) {
        let Some(target) = self.remote.read().await.clone() else { return };
        let answer = self.remote_call("/now", None).await;
        let mut slot = self.remote.write().await;
        let Some(view) = slot.as_mut().filter(|v| v.id == target.id) else { return };
        match answer {
            Ok(now) => {
                view.reachable = true;
                view.song = now.get("song").and_then(song_from_wire);
                view.playing = now.get("playing").and_then(|v| v.as_bool()).unwrap_or(false);
                view.position = now.get("position").and_then(|v| v.as_f64()).unwrap_or(0.0) / 1000.0;
                view.duration = now.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0) / 1000.0;
                view.liked = now.get("liked").and_then(|v| v.as_bool()).unwrap_or(false);
                view.up_next = now
                    .get("upNext")
                    .and_then(|v| v.as_array())
                    .map(|a| {
                        a.iter()
                            .filter_map(|i| Some((i.get("index")?.as_i64()?, song_from_wire(i.get("song")?)?)))
                            .collect()
                    })
                    .unwrap_or_default();
                view.read_at = now_ms();
            }
            Err(_) => view.reachable = false,
        }
        let snapshot = serde_json::to_value(&*view).unwrap_or(Value::Null);
        drop(slot);
        self.emit("link://remote", snapshot);
    }

    // a queue picked here plays on the steered device instead; a long one goes over as a window around the song picked
    pub async fn remote_play(&self, songs: Vec<SongItem>, index: usize, position: f64, mode: &str, title: Option<String>) -> Result<(), String> {
        let playable: Vec<&SongItem> = songs.iter().collect();
        let (window, start) = if mode == "play" {
            let from = index.saturating_sub(50);
            let to = (from + 300).min(playable.len());
            (&playable[from..to], index.min(to.saturating_sub(1)).saturating_sub(from))
        } else {
            (&playable[..], 0)
        };
        let wire: Vec<Value> = window.iter().map(|s| song_to_wire(s, None)).collect();
        let path = match mode {
            "next" => "/next",
            "queue" => "/queue",
            _ => "/play",
        };
        let mut body = json!({ "songs": wire, "index": start, "position": (position * 1000.0) as i64 });
        if let Some(t) = title {
            body["title"] = Value::String(t);
        }
        self.remote_call(path, Some(body)).await?;
        self.poll_remote().await;
        Ok(())
    }
}

impl Drop for LinkHub {
    fn drop(&mut self) {
        self.mdns.withdraw(PHONE_SERVICE);
        self.mdns.withdraw(PAIR_SERVICE);
    }
}

