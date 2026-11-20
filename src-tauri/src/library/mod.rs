use crate::lyrics::models::LyricsProvider;
use crate::youtube::models::SongItem;
use chrono::{Datelike, Local, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySong {
    pub id: String,
    pub item: SongItem,
    pub liked_at: Option<i64>,
    pub last_played_at: Option<i64>,
    pub play_count: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPlaylist {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub song_ids: Vec<String>,
    pub is_pinned: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayEvent {
    pub song_id: String,
    pub played_at: i64,
}

// one change made here that the paired devices haven't heard about yet: a like, an unlike or a play
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub seq: u64,
    pub kind: String,
    pub song_id: String,
    pub at: i64,
    #[serde(default)]
    pub play_time: i64,
}

// a playlist that lives on a paired device, mirrored here read-only and replaced on every sync
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MirroredPlaylist {
    pub id: String,
    pub device_id: String,
    pub device_name: String,
    pub name: String,
    pub song_ids: Vec<String>,
}

// what a paired device's library said at the last sync, in this app's own terms
#[derive(Clone, Debug, Default)]
pub struct RemoteLibrary {
    pub songs: HashMap<String, SongItem>,
    pub liked: Vec<(String, i64)>,
    pub known: HashSet<String>,
    pub playlists: Vec<(String, String, Vec<String>)>,
    pub events: Vec<(String, i64)>,
}

// what another device pushed here: the songs it talks about, its plays, and what it liked or unliked
#[derive(Clone, Debug, Default)]
pub struct IncomingChanges {
    pub songs: Vec<SongItem>,
    pub plays: Vec<(String, i64)>,
    pub liked: Vec<String>,
    pub unliked: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopSongEntry {
    pub song: SongItem,
    pub plays: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopArtistEntry {
    pub name: String,
    pub id: Option<String>,
    pub plays: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthRecap {
    pub month_label: String,
    pub plays: usize,
    pub minutes: usize,
    pub top_songs: Vec<TopSongEntry>,
    pub top_artists: Vec<TopArtistEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSession {
    pub queue: Vec<SongItem>,
    pub index: usize,
    pub position: f64,
    pub title: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMeta {
    pub id: String,
    pub display_name: String,
    pub detail: String,
    pub enabled: bool,
}

fn default_player_bar_style() -> String {
    "auto".to_string()
}

fn default_true() -> bool {
    true
}

fn default_audio_quality() -> String {
    "auto".to_string()
}

fn default_extra_prefs() -> serde_json::Value {
    serde_json::json!({})
}

fn default_shared_folders() -> Vec<String> {
    dirs::audio_dir()
        .filter(|d| d.is_dir())
        .map(|d| vec![d.to_string_lossy().into_owned()])
        .unwrap_or_default()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_player_bar_style")]
    pub player_bar_style: String,
    pub high_quality_audio: bool,
    pub normalize_volume: bool,
    pub hide_explicit: bool,
    pub lyrics_blur: bool,
    pub lyrics_glow: bool,
    pub animated_backgrounds: bool,
    pub lyrics_size: f64,
    pub lyrics_position: String,
    pub lyrics_open: bool,
    pub player_volume: f64,
    pub profile_name: String,
    pub recent_searches: Vec<String>,
    pub lyrics_provider_order: Vec<String>,
    pub lyrics_providers_disabled: Vec<String>,
    // folders whose songs play here and stream to paired devices (flac included)
    #[serde(default = "default_shared_folders")]
    pub shared_folders: Vec<String>,
    #[serde(default = "default_true")]
    pub share_local_files: bool,
    // the name paired devices see; empty means the computer's own name
    #[serde(default)]
    pub device_name: String,
    #[serde(default = "default_true")]
    pub hero_auto_turn: bool,
    #[serde(default = "default_audio_quality")]
    pub audio_quality: String,
    #[serde(default = "default_extra_prefs")]
    pub prefs: serde_json::Value,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            player_bar_style: default_player_bar_style(),
            high_quality_audio: true,
            normalize_volume: true,
            hide_explicit: false,
            lyrics_blur: true,
            lyrics_glow: true,
            animated_backgrounds: true,
            lyrics_size: 1.0,
            lyrics_position: "left".to_string(),
            lyrics_open: false,
            player_volume: 1.0,
            profile_name: String::new(),
            recent_searches: Vec::new(),
            lyrics_provider_order: LyricsProvider::DEFAULT_ORDER
                .iter()
                .map(|p| p.as_str().to_string())
                .collect(),
            lyrics_providers_disabled: Vec::new(),
            shared_folders: default_shared_folders(),
            share_local_files: true,
            device_name: String::new(),
            hero_auto_turn: true,
            audio_quality: default_audio_quality(),
            prefs: default_extra_prefs(),
        }
    }
}

impl AppSettings {
    pub fn ordered_providers(&self) -> Vec<LyricsProvider> {
        let mut seen = HashSet::new();
        let mut order = Vec::new();
        for s in &self.lyrics_provider_order {
            if let Some(p) = LyricsProvider::from_str(s) {
                if seen.insert(p) {
                    order.push(p);
                }
            }
        }
        for p in LyricsProvider::DEFAULT_ORDER {
            if seen.insert(p) {
                order.push(p);
            }
        }
        order
    }

    pub fn ordered_enabled_providers(&self) -> Vec<LyricsProvider> {
        let disabled: HashSet<LyricsProvider> = self
            .lyrics_providers_disabled
            .iter()
            .filter_map(|s| LyricsProvider::from_str(s))
            .collect();
        self.ordered_providers()
            .into_iter()
            .filter(|p| !disabled.contains(p))
            .collect()
    }

    pub fn provider_metas(&self) -> Vec<ProviderMeta> {
        let disabled: HashSet<LyricsProvider> = self
            .lyrics_providers_disabled
            .iter()
            .filter_map(|s| LyricsProvider::from_str(s))
            .collect();
        self.ordered_providers()
            .into_iter()
            .map(|p| ProviderMeta {
                id: p.as_str().to_string(),
                display_name: p.display_name().to_string(),
                detail: p.detail().to_string(),
                enabled: !disabled.contains(&p),
            })
            .collect()
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoreData {
    #[serde(default)]
    songs: HashMap<String, LibrarySong>,
    #[serde(default)]
    playlists: Vec<LocalPlaylist>,
    #[serde(default)]
    events: Vec<PlayEvent>,
    #[serde(default)]
    session: Option<PlayerSession>,
    #[serde(default)]
    settings: AppSettings,
    #[serde(default)]
    journal: Vec<JournalEntry>,
    #[serde(default)]
    journal_seq: u64,
    #[serde(default)]
    mirrored: Vec<MirroredPlaylist>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSummary {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub song_ids: Vec<String>,
    pub is_pinned: bool,
    pub covers: Vec<String>,
    // set for a playlist mirrored from a paired device
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub liked_ids: Vec<String>,
    pub liked_songs: Vec<SongItem>,
    pub recent_songs: Vec<SongItem>,
    pub playlists: Vec<PlaylistSummary>,
    pub on_repeat: Option<SongItem>,
    pub forgotten_favorites: Vec<SongItem>,
    pub gacha_pool: Vec<SongItem>,
    pub recap: MonthRecap,
    pub device_playlists: Vec<PlaylistSummary>,
}

pub struct Library {
    path: PathBuf,
    data: RwLock<StoreData>,
}

impl Library {
    pub fn new() -> Arc<Self> {
        let folder_name = if std::env::var("MOCHY_TOUR_DIR").is_ok() {
            "Mochy-tour"
        } else {
            "Mochy"
        };
        let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        let dir = base.join(folder_name);
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("Library.json");

        let data: StoreData = fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        Arc::new(Self {
            path,
            data: RwLock::new(data),
        })
    }

    fn now_ms() -> i64 {
        Utc::now().timestamp_millis()
    }

    // the folder the library lives in, where the link and the local file index keep their own files
    pub fn data_dir(&self) -> PathBuf {
        self.path.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from("."))
    }

    async fn save(&self, store: &StoreData) {
        if let Ok(json) = serde_json::to_string_pretty(store) {
            let _ = fs::write(&self.path, json);
        }
    }

    fn upsert_song<'a>(store: &'a mut StoreData, song: &SongItem) -> &'a mut LibrarySong {
        let entry = store
            .songs
            .entry(song.id.clone())
            .or_insert_with(|| LibrarySong {
                id: song.id.clone(),
                item: song.clone(),
                liked_at: None,
                last_played_at: None,
                play_count: 0,
            });
        entry.item.title = song.title.clone();
        if !song.artists.is_empty() {
            entry.item.artists = song.artists.clone();
        }
        if song.album.is_some() {
            entry.item.album = song.album.clone();
        }
        if !song.thumbnail.is_empty() {
            entry.item.thumbnail = song.thumbnail.clone();
        }
        if song.duration.is_some() {
            entry.item.duration = song.duration;
        }
        entry
    }

    // a file on this computer only means something here, the other devices never hear of it
    fn journaled(song: &SongItem) -> bool {
        song.source.as_deref() != Some("local")
    }

    fn journal(store: &mut StoreData, kind: &str, song_id: &str, at: i64, play_time: i64) {
        store.journal_seq += 1;
        let seq = store.journal_seq;
        store.journal.push(JournalEntry {
            seq,
            kind: kind.to_string(),
            song_id: song_id.to_string(),
            at,
            play_time,
        });
        // a device that never comes back mustn't grow this forever
        if store.journal.len() > 20_000 {
            let drop = store.journal.len() - 20_000;
            store.journal.drain(..drop);
        }
    }

    pub async fn toggle_like(&self, song: SongItem) -> bool {
        let mut store = self.data.write().await;
        let now = Self::now_ms();
        let entry = Self::upsert_song(&mut store, &song);
        let is_liked = if entry.liked_at.is_some() {
            entry.liked_at = None;
            false
        } else {
            entry.liked_at = Some(now);
            true
        };
        if Self::journaled(&song) {
            Self::journal(&mut store, if is_liked { "like" } else { "unlike" }, &song.id, now, 0);
        }
        self.save(&store).await;
        is_liked
    }

    pub async fn record_play(&self, song: SongItem) {
        let mut store = self.data.write().await;
        let now = Self::now_ms();
        let entry = Self::upsert_song(&mut store, &song);
        entry.last_played_at = Some(now);
        entry.play_count += 1;
        if Self::journaled(&song) {
            let play_time = song.duration.unwrap_or(0).max(0) * 1000;
            Self::journal(&mut store, "play", &song.id, now, play_time);
        }
        store.events.push(PlayEvent {
            song_id: song.id,
            played_at: now,
        });
        self.save(&store).await;
    }

    pub async fn is_liked(&self, id: &str) -> bool {
        self.data
            .read()
            .await
            .songs
            .get(id)
            .map(|s| s.liked_at.is_some())
            .unwrap_or(false)
    }

    pub async fn song(&self, id: &str) -> Option<SongItem> {
        self.data.read().await.songs.get(id).map(|s| s.item.clone())
    }

    // the changes a device hasn't heard yet, and the songs they talk about, oldest first
    pub async fn journal_since(&self, seq: u64) -> (Vec<JournalEntry>, Vec<(SongItem, Option<i64>)>, u64) {
        let store = self.data.read().await;
        let entries: Vec<JournalEntry> = store.journal.iter().filter(|e| e.seq > seq).cloned().collect();
        let mut seen = HashSet::new();
        let songs = entries
            .iter()
            .filter(|e| seen.insert(e.song_id.clone()))
            .filter_map(|e| store.songs.get(&e.song_id).map(|s| (s.item.clone(), s.liked_at)))
            .collect();
        (entries, songs, store.journal_seq)
    }

    // every like here, for a device synced for the first time so nothing liked before pairing is lost
    pub async fn all_liked(&self) -> Vec<(SongItem, i64)> {
        let store = self.data.read().await;
        store
            .songs
            .values()
            .filter(|s| Self::journaled(&s.item))
            .filter_map(|s| s.liked_at.map(|at| (s.item.clone(), at)))
            .collect()
    }

    pub async fn journal_head(&self) -> u64 {
        self.data.read().await.journal_seq
    }

    // entries every device already has can go
    pub async fn prune_journal(&self, delivered_to_all: u64) {
        let mut store = self.data.write().await;
        let before = store.journal.len();
        store.journal.retain(|e| e.seq > delivered_to_all);
        if store.journal.len() != before {
            self.save(&store).await;
        }
    }

    // a paired device's library folded in: its likes and plays count here, its playlists show here read-only,
    // and a like it took back since the last sync is taken back here too
    pub async fn apply_remote(&self, device_id: &str, device_name: &str, remote: RemoteLibrary, last_sync_at: i64) -> usize {
        let mut store = self.data.write().await;
        let now = Self::now_ms();
        let mut referenced: HashSet<String> = HashSet::new();
        referenced.extend(remote.liked.iter().map(|(id, _)| id.clone()));
        for (_, _, ids) in &remote.playlists {
            referenced.extend(ids.iter().cloned());
        }
        referenced.extend(remote.events.iter().map(|(id, _)| id.clone()));
        for id in &referenced {
            if let Some(song) = remote.songs.get(id) {
                Self::upsert_song(&mut store, song);
            }
        }

        let liked_there: HashSet<&str> = remote.liked.iter().map(|(id, _)| id.as_str()).collect();
        let mut changed = 0usize;
        for (id, at) in &remote.liked {
            if let Some(entry) = store.songs.get_mut(id) {
                if entry.liked_at.is_none() {
                    entry.liked_at = Some(if *at > 0 { *at } else { now });
                    changed += 1;
                }
            }
        }
        // only a like the device has already had a chance to hear about can have been taken back there
        if last_sync_at > 0 {
            for entry in store.songs.values_mut() {
                if let Some(at) = entry.liked_at {
                    if at < last_sync_at && remote.known.contains(&entry.id) && !liked_there.contains(entry.id.as_str()) {
                        entry.liked_at = None;
                        changed += 1;
                    }
                }
            }
        }

        store.mirrored.retain(|p| p.device_id != device_id);
        for (pid, name, ids) in remote.playlists {
            let ids: Vec<String> = ids.into_iter().filter(|id| store.songs.contains_key(id)).collect();
            if ids.is_empty() {
                continue;
            }
            store.mirrored.push(MirroredPlaylist {
                id: format!("link:{}:{}", device_id, pid),
                device_id: device_id.to_string(),
                device_name: device_name.to_string(),
                name,
                song_ids: ids,
            });
        }

        let mut have: HashSet<(String, i64)> = store.events.iter().map(|e| (e.song_id.clone(), e.played_at)).collect();
        let mut added = Vec::new();
        for (id, at) in remote.events {
            if store.songs.contains_key(&id) && have.insert((id.clone(), at)) {
                added.push(PlayEvent { song_id: id, played_at: at });
            }
        }
        for ev in &added {
            if let Some(entry) = store.songs.get_mut(&ev.song_id) {
                entry.play_count += 1;
                if entry.last_played_at.map(|t| t < ev.played_at).unwrap_or(true) {
                    entry.last_played_at = Some(ev.played_at);
                }
            }
        }
        changed += added.len();
        store.events.extend(added);
        store.events.sort_by_key(|e| e.played_at);
        self.save(&store).await;
        changed
    }

    // a device pushed what happened on it: the songs it mentions, its plays, its likes and unlikes
    pub async fn apply_changes(&self, changes: IncomingChanges) {
        let mut store = self.data.write().await;
        let now = Self::now_ms();
        for song in &changes.songs {
            Self::upsert_song(&mut store, song);
        }
        for id in &changes.liked {
            if let Some(entry) = store.songs.get_mut(id) {
                if entry.liked_at.is_none() {
                    entry.liked_at = Some(now);
                }
            }
        }
        for id in &changes.unliked {
            if let Some(entry) = store.songs.get_mut(id) {
                entry.liked_at = None;
            }
        }
        let mut have: HashSet<(String, i64)> = store.events.iter().map(|e| (e.song_id.clone(), e.played_at)).collect();
        for (id, at) in changes.plays {
            if !store.songs.contains_key(&id) || !have.insert((id.clone(), at)) {
                continue;
            }
            if let Some(entry) = store.songs.get_mut(&id) {
                entry.play_count += 1;
                if entry.last_played_at.map(|t| t < at).unwrap_or(true) {
                    entry.last_played_at = Some(at);
                }
            }
            store.events.push(PlayEvent { song_id: id, played_at: at });
        }
        self.save(&store).await;
    }

    // this library for another computer running mochy: likes, playlists and the last months of plays
    pub async fn export(&self) -> serde_json::Value {
        let store = self.data.read().await;
        let since = Self::now_ms() - 120 * 86_400_000;
        let mut ids: HashSet<&str> = HashSet::new();
        let liked: Vec<serde_json::Value> = store
            .songs
            .values()
            .filter(|s| Self::journaled(&s.item))
            .filter_map(|s| s.liked_at.map(|at| (s, at)))
            .map(|(s, at)| {
                ids.insert(s.id.as_str());
                serde_json::json!({ "id": s.id, "at": at })
            })
            .collect();
        let playlists: Vec<serde_json::Value> = store
            .playlists
            .iter()
            .map(|p| {
                ids.extend(p.song_ids.iter().map(|s| s.as_str()));
                serde_json::json!({ "id": p.id, "name": p.name, "songIds": p.song_ids })
            })
            .collect();
        let events: Vec<serde_json::Value> = store
            .events
            .iter()
            .filter(|e| e.played_at >= since)
            .map(|e| {
                ids.insert(e.song_id.as_str());
                serde_json::json!({ "songId": e.song_id, "at": e.played_at })
            })
            .collect();
        let songs: Vec<&SongItem> = ids
            .iter()
            .filter_map(|id| store.songs.get(*id))
            .map(|s| &s.item)
            .filter(|s| Self::journaled(s))
            .collect();
        serde_json::json!({ "songs": songs, "liked": liked, "playlists": playlists, "events": events })
    }

    pub async fn forget_device(&self, device_id: &str) {
        let mut store = self.data.write().await;
        store.mirrored.retain(|p| p.device_id != device_id);
        self.save(&store).await;
    }

    pub async fn create_playlist(&self, name: String) -> LocalPlaylist {
        let mut store = self.data.write().await;
        let playlist = LocalPlaylist {
            id: Uuid::new_v4().to_string(),
            name,
            created_at: Self::now_ms(),
            song_ids: Vec::new(),
            is_pinned: true,
        };
        store.playlists.push(playlist.clone());
        self.save(&store).await;
        playlist
    }

    pub async fn rename_playlist(&self, id: &str, name: String) {
        let mut store = self.data.write().await;
        if let Some(p) = store.playlists.iter_mut().find(|p| p.id == id) {
            p.name = name;
            self.save(&store).await;
        }
    }

    pub async fn toggle_pin(&self, id: &str) {
        let mut store = self.data.write().await;
        if let Some(p) = store.playlists.iter_mut().find(|p| p.id == id) {
            p.is_pinned = !p.is_pinned;
            self.save(&store).await;
        }
    }

    pub async fn delete_playlist(&self, id: &str) {
        let mut store = self.data.write().await;
        store.playlists.retain(|p| p.id != id);
        self.save(&store).await;
    }

    pub async fn add_to_playlist(&self, song: SongItem, playlist_id: &str) {
        let mut store = self.data.write().await;
        Self::upsert_song(&mut store, &song);
        if let Some(p) = store.playlists.iter_mut().find(|p| p.id == playlist_id) {
            if !p.song_ids.contains(&song.id) {
                p.song_ids.push(song.id);
            }
        }
        self.save(&store).await;
    }

    pub async fn remove_from_playlist(&self, song_id: &str, playlist_id: &str) {
        let mut store = self.data.write().await;
        if let Some(p) = store.playlists.iter_mut().find(|p| p.id == playlist_id) {
            p.song_ids.retain(|id| id != song_id);
        }
        self.save(&store).await;
    }

    pub async fn clear_history(&self) {
        let mut store = self.data.write().await;
        store.events.clear();
        for song in store.songs.values_mut() {
            song.last_played_at = None;
            song.play_count = 0;
        }
        self.save(&store).await;
    }

    pub async fn save_session(&self, session: PlayerSession) {
        let mut store = self.data.write().await;
        store.session = Some(session);
        self.save(&store).await;
    }

    pub async fn get_session(&self) -> Option<PlayerSession> {
        self.data.read().await.session.clone()
    }

    pub async fn get_settings(&self) -> AppSettings {
        self.data.read().await.settings.clone()
    }

    pub async fn update_settings(&self, settings: AppSettings) -> AppSettings {
        let mut store = self.data.write().await;
        store.settings = settings.clone();
        self.save(&store).await;
        settings
    }

    pub fn store_size_bytes(&self) -> u64 {
        fs::metadata(&self.path).map(|m| m.len()).unwrap_or(0)
    }

    pub async fn export_json(&self) -> Result<String, String> {
        let store = self.data.read().await;
        serde_json::to_string_pretty(&*store).map_err(|e| e.to_string())
    }

    pub async fn import_json(&self, raw: &str) -> Result<LibrarySnapshot, String> {
        let parsed: StoreData = serde_json::from_str(raw).map_err(|e| format!("Invalid backup file: {}", e))?;
        {
            let mut store = self.data.write().await;
            *store = parsed;
            self.save(&store).await;
        }
        Ok(self.snapshot().await)
    }

    pub async fn snapshot(&self) -> LibrarySnapshot {
        let store = self.data.read().await;
        let now = Self::now_ms();

        // Liked songs (newest first)
        let mut liked_entries: Vec<&LibrarySong> = store
            .songs
            .values()
            .filter(|s| s.liked_at.is_some())
            .collect();
        liked_entries.sort_by(|a, b| b.liked_at.cmp(&a.liked_at));
        let liked_songs: Vec<SongItem> = liked_entries
            .into_iter()
            .take(2000)
            .map(|s| s.item.clone())
            .collect();
        let liked_ids: Vec<String> = liked_songs.iter().map(|s| s.id.clone()).collect();

        // Recent songs (newest first)
        let mut recent_entries: Vec<&LibrarySong> = store
            .songs
            .values()
            .filter(|s| s.last_played_at.is_some())
            .collect();
        recent_entries.sort_by(|a, b| b.last_played_at.cmp(&a.last_played_at));
        let recent_songs: Vec<SongItem> = recent_entries
            .into_iter()
            .take(300)
            .map(|s| s.item.clone())
            .collect();

        // Playlists
        let playlists: Vec<PlaylistSummary> = store
            .playlists
            .iter()
            .map(|p| {
                let covers: Vec<String> = p
                    .song_ids
                    .iter()
                    .take(4)
                    .filter_map(|id| store.songs.get(id).map(|s| s.item.thumbnail.clone()))
                    .filter(|t| !t.is_empty())
                    .collect();
                PlaylistSummary {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    created_at: p.created_at,
                    song_ids: p.song_ids.clone(),
                    is_pinned: p.is_pinned,
                    covers,
                    device_name: None,
                    device_id: None,
                }
            })
            .collect();

        let device_playlists: Vec<PlaylistSummary> = store
            .mirrored
            .iter()
            .map(|p| PlaylistSummary {
                id: p.id.clone(),
                name: p.name.clone(),
                created_at: 0,
                song_ids: p.song_ids.clone(),
                is_pinned: false,
                covers: p
                    .song_ids
                    .iter()
                    .filter_map(|id| store.songs.get(id).map(|s| s.item.thumbnail.clone()))
                    .filter(|t| !t.is_empty())
                    .take(4)
                    .collect(),
                device_name: Some(p.device_name.clone()),
                device_id: Some(p.device_id.clone()),
            })
            .collect();

        // On repeat: >= 3 plays in last 14 days
        let since_14d = now - 14 * 86_400_000;
        let mut counts_14d: HashMap<&str, usize> = HashMap::new();
        for ev in &store.events {
            if ev.played_at >= since_14d {
                *counts_14d.entry(&ev.song_id).or_insert(0) += 1;
            }
        }
        let on_repeat = counts_14d
            .into_iter()
            .filter(|(_, c)| *c >= 3)
            .max_by_key(|(_, c)| *c)
            .and_then(|(id, _)| store.songs.get(id).map(|s| s.item.clone()));

        // Forgotten favorites: playCount >= 3 && lastPlayedAt < 21 days ago
        let cutoff_21d = now - 21 * 86_400_000;
        let mut forgotten: Vec<&LibrarySong> = store
            .songs
            .values()
            .filter(|s| {
                s.play_count >= 3
                    && s.last_played_at
                        .map(|t| t < cutoff_21d)
                        .unwrap_or(false)
            })
            .collect();
        forgotten.sort_by(|a, b| b.play_count.cmp(&a.play_count));
        let forgotten_favorites: Vec<SongItem> = forgotten
            .into_iter()
            .take(5)
            .map(|s| s.item.clone())
            .collect();

        // Gacha pool: recent 80 + liked 80 unique
        let mut seen = HashSet::new();
        let mut gacha_pool = Vec::new();
        for s in recent_songs.iter().take(80).chain(liked_songs.iter().take(80)) {
            if seen.insert(s.id.clone()) {
                gacha_pool.push(s.clone());
            }
        }

        // Month recap
        let local_now = Local::now();
        let start_of_month = Local
            .with_ymd_and_hms(local_now.year(), local_now.month(), 1, 0, 0, 0)
            .single()
            .map(|dt| dt.timestamp_millis())
            .unwrap_or(0);
        let month_names = [
            "JANUARY",
            "FEBRUARY",
            "MARCH",
            "APRIL",
            "MAY",
            "JUNE",
            "JULY",
            "AUGUST",
            "SEPTEMBER",
            "OCTOBER",
            "NOVEMBER",
            "DECEMBER",
        ];
        let month_idx = (local_now.month0() as usize).min(11);
        let month_label = format!("{} {}", month_names[month_idx], local_now.year());

        let mut month_counts: HashMap<String, usize> = HashMap::new();
        let mut total_plays = 0usize;
        for ev in &store.events {
            if ev.played_at >= start_of_month {
                *month_counts.entry(ev.song_id.clone()).or_insert(0) += 1;
                total_plays += 1;
            }
        }

        let mut top_songs: Vec<TopSongEntry> = month_counts
            .iter()
            .filter_map(|(id, &plays)| {
                store.songs.get(id).map(|s| TopSongEntry {
                    song: s.item.clone(),
                    plays,
                })
            })
            .collect();
        top_songs.sort_by(|a, b| b.plays.cmp(&a.plays));

        let mut artist_plays: HashMap<String, (Option<String>, usize)> = HashMap::new();
        let mut total_seconds = 0usize;
        for (id, &plays) in &month_counts {
            if let Some(s) = store.songs.get(id) {
                let dur = s.item.duration.unwrap_or(200).max(0) as usize;
                total_seconds += dur * plays;
                for artist in s.item.artists.iter().take(2) {
                    let entry = artist_plays
                        .entry(artist.name.clone())
                        .or_insert((artist.id.clone(), 0));
                    if entry.0.is_none() && artist.id.is_some() {
                        entry.0 = artist.id.clone();
                    }
                    entry.1 += plays;
                }
            }
        }

        let mut top_artists: Vec<TopArtistEntry> = artist_plays
            .into_iter()
            .map(|(name, (id, plays))| TopArtistEntry { name, id, plays })
            .collect();
        top_artists.sort_by(|a, b| b.plays.cmp(&a.plays));
        top_songs.truncate(20);
        top_artists.truncate(10);

        let recap = MonthRecap {
            month_label,
            plays: total_plays,
            minutes: total_seconds / 60,
            top_songs,
            top_artists,
        };

        LibrarySnapshot {
            liked_ids,
            liked_songs,
            recent_songs,
            playlists,
            on_repeat,
            forgotten_favorites,
            gacha_pool,
            recap,
            device_playlists,
        }
    }

    pub async fn songs_by_ids(&self, ids: &[String]) -> Vec<SongItem> {
        let store = self.data.read().await;
        ids.iter()
            .filter_map(|id| store.songs.get(id).map(|s| s.item.clone()))
            .collect()
    }
}
