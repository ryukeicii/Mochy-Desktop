#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod library;
mod link;
mod local;
mod lyrics;
#[cfg(target_os = "macos")]
mod menu;
mod palette;
mod youtube;

use crate::library::{AppSettings, Library, LibrarySnapshot, LocalPlaylist, PlayerSession, ProviderMeta};
use crate::link::{DeviceView, LinkHub, LinkStateView, PairingView, PlayerMirror, RemoteFile, RemoteView};
use crate::local::LocalMusic;
use crate::lyrics::models::{Lyrics, LyricsCandidate, LyricsOutcome, LyricsProvider, LyricsQuery};
use crate::lyrics::parser::LyricsParser;
use crate::lyrics::service::LyricsService;
use crate::palette::{Palette, PaletteCache};
use crate::youtube::innertube::InnerTube;
use crate::youtube::models::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

pub struct AppState {
    pub innertube: Arc<InnerTube>,
    pub lyrics: Arc<LyricsService>,
    pub library: Arc<Library>,
    pub local: Arc<LocalMusic>,
    pub link: Arc<LinkHub>,
    pub palettes: PaletteCache,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverPick {
    pub seed: SongItem,
    pub seed_liked: bool,
    pub recommendation: SongItem,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitData {
    pub proxy_port: u16,
    pub platform: String,
    pub settings: AppSettings,
    pub providers: Vec<ProviderMeta>,
    pub library: LibrarySnapshot,
    pub session: Option<PlayerSession>,
    pub device_id: String,
    pub device_name: String,
    // the first name on this computer's account, for the home page's hello
    pub user_name: String,
}

#[tauri::command]
async fn app_init(state: State<'_, AppState>) -> Result<InitData, String> {
    let proxy_port = state.innertube.get_proxy_port().await;
    let settings = state.library.get_settings().await;
    let providers = settings.provider_metas();
    let library = state.library.snapshot().await;
    let session = state.library.get_session().await;
    let it = state.innertube.clone();
    tokio::spawn(async move {
        it.ensure_visitor_data().await;
    });
    state.link.window_shown();
    Ok(InitData {
        proxy_port,
        platform: std::env::consts::OS.to_string(),
        settings,
        providers,
        library,
        session,
        device_id: state.link.id().to_string(),
        device_name: state.link.name().await,
        user_name: first_name(),
    })
}

fn first_name() -> String {
    whoami::realname()
        .ok()
        .and_then(|name| name.split_whitespace().next().map(str::to_string))
        .unwrap_or_default()
}

#[tauri::command]
async fn yt_home(
    state: State<'_, AppState>,
    params: Option<String>,
) -> Result<HomePage, String> {
    state.innertube.home(params.as_deref()).await
}

#[tauri::command]
async fn yt_home_continuation(
    state: State<'_, AppState>,
    token: String,
) -> Result<HomePage, String> {
    state.innertube.home_continuation(&token).await
}

#[tauri::command]
async fn yt_discover(
    state: State<'_, AppState>,
    seeds: Vec<SongItem>,
    liked_ids: Vec<String>,
    known_ids: Vec<String>,
) -> Result<Vec<DiscoverPick>, String> {
    let liked_set: HashSet<String> = liked_ids.into_iter().collect();
    let mut taken: HashSet<String> = known_ids.into_iter().collect();
    let mut handles = Vec::new();
    for seed in seeds.into_iter().filter(|s| s.source.is_none()).take(4) {
        let it = state.innertube.clone();
        handles.push(tokio::spawn(async move {
            let items = it
                .next(
                    WatchEndpoint {
                        video_id: Some(seed.id.clone()),
                        playlist_id: None,
                        params: None,
                        index: None,
                    },
                    None,
                )
                .await
                .map(|r| r.items)
                .unwrap_or_default();
            (seed, items)
        }));
    }

    let mut picks = Vec::new();
    for h in handles {
        if let Ok((seed, items)) = h.await {
            if let Some(pick) = items
                .into_iter()
                .find(|i| i.id != seed.id && !taken.contains(&i.id) && !i.thumbnail.is_empty())
            {
                taken.insert(pick.id.clone());
                let seed_liked = liked_set.contains(&seed.id);
                picks.push(DiscoverPick {
                    seed,
                    seed_liked,
                    recommendation: pick,
                });
            }
        }
    }
    Ok(picks)
}

#[tauri::command]
async fn yt_search_suggestions(
    state: State<'_, AppState>,
    input: String,
) -> Result<SearchSuggestions, String> {
    state.innertube.search_suggestions(&input).await
}

#[tauri::command]
async fn yt_search_summary(
    state: State<'_, AppState>,
    query: String,
) -> Result<SearchSummary, String> {
    state.innertube.search_summary(&query).await
}

#[tauri::command]
async fn yt_search(
    state: State<'_, AppState>,
    query: String,
    filter: String,
) -> Result<SearchResult, String> {
    state.innertube.search(&query, &filter).await
}

#[tauri::command]
async fn yt_search_continuation(
    state: State<'_, AppState>,
    token: String,
) -> Result<SearchResult, String> {
    state.innertube.search_continuation(&token).await
}

#[tauri::command]
async fn yt_album(state: State<'_, AppState>, browse_id: String) -> Result<AlbumPage, String> {
    state.innertube.album(&browse_id).await
}

#[tauri::command]
async fn yt_artist(state: State<'_, AppState>, browse_id: String) -> Result<ArtistPage, String> {
    state.innertube.artist(&browse_id).await
}

#[tauri::command]
async fn yt_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
) -> Result<PlaylistPage, String> {
    state.innertube.playlist(&playlist_id).await
}

#[tauri::command]
async fn yt_playlist_continuation(
    state: State<'_, AppState>,
    token: String,
) -> Result<(Vec<SongItem>, Option<String>), String> {
    state.innertube.playlist_continuation(&token).await
}

#[tauri::command]
async fn yt_browse_section(
    state: State<'_, AppState>,
    browse_id: String,
    params: Option<String>,
) -> Result<Vec<YTItem>, String> {
    state
        .innertube
        .browse_section(&browse_id, params.as_deref())
        .await
}

#[tauri::command]
async fn yt_moods(state: State<'_, AppState>) -> Result<Vec<MoodSection>, String> {
    state.innertube.moods_and_genres().await
}

#[tauri::command]
async fn yt_next(
    state: State<'_, AppState>,
    endpoint: WatchEndpoint,
    continuation: Option<String>,
) -> Result<NextResult, String> {
    state.innertube.next(endpoint, continuation).await
}

#[tauri::command]
async fn yt_stream(
    state: State<'_, AppState>,
    video_id: String,
    prefer_high_quality: bool,
    quality: Option<String>,
    force_refresh: Option<bool>,
) -> Result<StreamInfo, String> {
    if force_refresh == Some(true) {
        state.innertube.invalidate_stream(&video_id).await;
    }
    state
        .innertube
        .stream_with_quality(&video_id, prefer_high_quality, quality.as_deref())
        .await
}

#[tauri::command]
async fn lyrics_get(
    state: State<'_, AppState>,
    song: SongItem,
    duration: Option<i64>,
    lyrics_browse_id: Option<String>,
) -> Result<LyricsOutcome, String> {
    if song.source.as_deref() == Some("local") {
        if let Some(raw) = state.local.sidecar_lyrics(&song.id).await {
            if let Some(mut lyrics) = LyricsParser::parse(&raw, LyricsProvider::LrcLib) {
                lyrics.provider_name = "Lyrics file".into();
                return Ok(LyricsOutcome { best: Some(lyrics), candidates: Vec::new() });
            }
        }
    }
    let settings = state.library.get_settings().await;
    let enabled = providers_for(&song, settings.ordered_enabled_providers());
    let query = LyricsQuery::from_song(&song, duration, lyrics_browse_id);
    Ok(state.lyrics.lyrics(query, &enabled).await)
}

// youtube's own sources only know youtube's songs
fn providers_for(song: &SongItem, enabled: Vec<LyricsProvider>) -> Vec<LyricsProvider> {
    if song.source.is_none() {
        return enabled;
    }
    enabled
        .into_iter()
        .filter(|p| !matches!(p, LyricsProvider::YouTubeSubtitle | LyricsProvider::YouTubeMusic | LyricsProvider::YouTubeCaptions))
        .collect()
}

#[tauri::command]
async fn lyrics_all_candidates(
    state: State<'_, AppState>,
    song: SongItem,
    duration: Option<i64>,
    lyrics_browse_id: Option<String>,
) -> Result<Vec<LyricsCandidate>, String> {
    let settings = state.library.get_settings().await;
    let enabled = providers_for(&song, settings.ordered_enabled_providers());
    let query = LyricsQuery::from_song(&song, duration, lyrics_browse_id);
    Ok(state.lyrics.all_candidates(query, &enabled).await)
}

#[tauri::command]
async fn lyrics_choose(
    state: State<'_, AppState>,
    video_id: String,
    lyrics: Lyrics,
) -> Result<(), String> {
    state.lyrics.choose(lyrics, &video_id).await;
    Ok(())
}

#[tauri::command]
async fn lyrics_forget(state: State<'_, AppState>, video_id: String) -> Result<(), String> {
    state.lyrics.forget(&video_id).await;
    Ok(())
}

#[tauri::command]
async fn lib_snapshot(state: State<'_, AppState>) -> Result<LibrarySnapshot, String> {
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_toggle_like(
    state: State<'_, AppState>,
    song: SongItem,
) -> Result<LibrarySnapshot, String> {
    state.library.toggle_like(song).await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_record_play(
    state: State<'_, AppState>,
    song: SongItem,
) -> Result<LibrarySnapshot, String> {
    state.library.record_play(song).await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_create_playlist(
    state: State<'_, AppState>,
    name: String,
) -> Result<(LocalPlaylist, LibrarySnapshot), String> {
    let playlist = state.library.create_playlist(name).await;
    let snap = state.library.snapshot().await;
    Ok((playlist, snap))
}

#[tauri::command]
async fn lib_rename_playlist(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<LibrarySnapshot, String> {
    state.library.rename_playlist(&id, name).await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_toggle_pin(
    state: State<'_, AppState>,
    id: String,
) -> Result<LibrarySnapshot, String> {
    state.library.toggle_pin(&id).await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_delete_playlist(
    state: State<'_, AppState>,
    id: String,
) -> Result<LibrarySnapshot, String> {
    state.library.delete_playlist(&id).await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_add_to_playlist(
    state: State<'_, AppState>,
    song: SongItem,
    playlist_id: String,
) -> Result<LibrarySnapshot, String> {
    state.library.add_to_playlist(song, &playlist_id).await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_remove_from_playlist(
    state: State<'_, AppState>,
    song_id: String,
    playlist_id: String,
) -> Result<LibrarySnapshot, String> {
    state
        .library
        .remove_from_playlist(&song_id, &playlist_id)
        .await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_clear_history(state: State<'_, AppState>) -> Result<LibrarySnapshot, String> {
    state.library.clear_history().await;
    Ok(state.library.snapshot().await)
}

#[tauri::command]
async fn lib_songs_by_ids(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<Vec<SongItem>, String> {
    Ok(state.library.songs_by_ids(&ids).await)
}

#[tauri::command]
async fn lib_save_session(
    state: State<'_, AppState>,
    session: PlayerSession,
) -> Result<(), String> {
    state.library.save_session(session).await;
    Ok(())
}

#[tauri::command]
async fn settings_update(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(AppSettings, Vec<ProviderMeta>), String> {
    let before = state.library.get_settings().await;
    let updated = state.library.update_settings(settings).await;
    if before.shared_folders != updated.shared_folders {
        let local = state.local.clone();
        let folders = updated.shared_folders.clone();
        tokio::spawn(async move {
            local.rescan(folders).await;
        });
    }
    let metas = updated.provider_metas();
    Ok((updated, metas))
}

// ------------------------------------------------------------------ the link

#[tauri::command]
async fn link_state(state: State<'_, AppState>) -> Result<LinkStateView, String> {
    Ok(state.link.state().await)
}

#[tauri::command]
async fn link_pairing_open(state: State<'_, AppState>) -> Result<PairingView, String> {
    state.link.open_pairing().await
}

#[tauri::command]
async fn link_pairing_close(state: State<'_, AppState>) -> Result<(), String> {
    state.link.close_pairing().await;
    Ok(())
}

#[tauri::command]
async fn link_pair(
    state: State<'_, AppState>,
    peer_id: Option<String>,
    address: Option<String>,
    code: String,
) -> Result<DeviceView, String> {
    state.link.pair(peer_id, address, code).await
}

#[tauri::command]
async fn link_unlink(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.link.unlink(&id).await;
    Ok(())
}

#[tauri::command]
async fn link_update_device(state: State<'_, AppState>, id: String, patch: Value) -> Result<bool, String> {
    Ok(state.link.update_device(&id, patch).await)
}

// one device, or every one that's around when no id is given
#[tauri::command]
async fn link_sync(state: State<'_, AppState>, id: Option<String>) -> Result<String, String> {
    match id {
        Some(id) => state.link.sync(&id).await,
        None => {
            let view = state.link.state().await;
            let mut done = Vec::new();
            for d in view.devices.into_iter().filter(|d| d.live && d.kind != "tv") {
                if state.link.sync(&d.id).await.is_ok() {
                    done.push(d.name);
                }
            }
            if done.is_empty() {
                Err("No device is around to sync with".into())
            } else {
                Ok(format!("Synced with {}", done.join(", ")))
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceFiles {
    id: String,
    name: String,
    files: Vec<RemoteFile>,
}

#[tauri::command]
async fn link_files(state: State<'_, AppState>, id: Option<String>) -> Result<Vec<DeviceFiles>, String> {
    let all = state.link.all_files().await;
    Ok(all
        .into_iter()
        .filter(|(d, _, _)| id.as_ref().map(|i| i == d).unwrap_or(true))
        .map(|(id, name, files)| DeviceFiles { id, name, files })
        .collect())
}

#[tauri::command]
async fn link_player_update(state: State<'_, AppState>, mirror: PlayerMirror) -> Result<(), String> {
    state.link.update_player(mirror).await;
    Ok(())
}

#[tauri::command]
async fn link_remote_start(state: State<'_, AppState>, id: String) -> Result<RemoteView, String> {
    state.link.remote_start(&id).await
}

#[tauri::command]
async fn link_remote_stop(state: State<'_, AppState>) -> Result<(), String> {
    state.link.remote_stop().await;
    Ok(())
}

#[tauri::command]
async fn link_remote_watch(state: State<'_, AppState>, open: bool) -> Result<(), String> {
    state.link.remote_watch(open);
    if open {
        state.link.poll_remote().await;
    }
    Ok(())
}

#[tauri::command]
async fn link_remote_command(state: State<'_, AppState>, action: String, position: Option<f64>) -> Result<(), String> {
    let mut body = serde_json::json!({ "action": action });
    if let Some(p) = position {
        body["position"] = serde_json::json!((p * 1000.0) as i64);
    }
    state.link.remote_call("/control", Some(body)).await?;
    state.link.poll_remote().await;
    Ok(())
}

#[tauri::command]
async fn link_remote_play(
    state: State<'_, AppState>,
    songs: Vec<SongItem>,
    index: usize,
    position: Option<f64>,
    mode: Option<String>,
    title: Option<String>,
) -> Result<(), String> {
    state
        .link
        .remote_play(songs, index, position.unwrap_or(0.0), mode.as_deref().unwrap_or("play"), title)
        .await
}

#[tauri::command]
async fn link_remote_queue(state: State<'_, AppState>, action: String, index: i64) -> Result<(), String> {
    let path = if action == "remove" { "/remove" } else { "/jump" };
    state.link.remote_call(path, Some(serde_json::json!({ "index": index }))).await?;
    state.link.poll_remote().await;
    Ok(())
}

#[tauri::command]
async fn link_remote_settings(state: State<'_, AppState>, key: Option<String>, value: Option<Value>) -> Result<Value, String> {
    let body = key.map(|k| serde_json::json!({ "key": k, "value": value.unwrap_or(Value::Null) }));
    state.link.remote_call("/settings", body).await
}

// ------------------------------------------------------------------ songs on this computer

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalTrackView {
    song: SongItem,
    quality: String,
    bytes: u64,
    path: String,
}

#[tauri::command]
async fn local_tracks(state: State<'_, AppState>) -> Result<Vec<LocalTrackView>, String> {
    Ok(state
        .local
        .all()
        .await
        .into_iter()
        .map(|t| LocalTrackView { song: t.song(), quality: t.quality(), bytes: t.bytes, path: t.path })
        .collect())
}

#[tauri::command]
async fn local_rescan(state: State<'_, AppState>) -> Result<usize, String> {
    let folders = state.library.get_settings().await.shared_folders;
    Ok(state.local.rescan(folders).await)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageStatsView {
    data_dir: String,
    library_bytes: u64,
    local_track_count: usize,
    local_audio_bytes: u64,
    stream_cache_count: usize,
    lyrics_cache_count: usize,
    palette_cache_count: usize,
}

#[tauri::command]
async fn storage_stats(state: State<'_, AppState>) -> Result<StorageStatsView, String> {
    let local_all = state.local.all().await;
    let local_audio_bytes: u64 = local_all.iter().map(|t| t.bytes).sum();
    Ok(StorageStatsView {
        data_dir: state.library.data_dir().to_string_lossy().into_owned(),
        library_bytes: state.library.store_size_bytes(),
        local_track_count: local_all.len(),
        local_audio_bytes,
        stream_cache_count: state.innertube.stream_cache_len().await,
        lyrics_cache_count: state.lyrics.cache_len().await,
        palette_cache_count: state.palettes.len(),
    })
}

#[tauri::command]
async fn clear_app_caches(state: State<'_, AppState>) -> Result<usize, String> {
    let a = state.innertube.clear_stream_cache().await;
    let b = state.lyrics.clear_cache().await;
    let c = state.palettes.clear();
    Ok(a + b + c)
}

#[tauri::command]
async fn pick_local_folder(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().into_owned()));
    });
    rx.await.map_err(|_| "Folder picker canceled".to_string())
}

#[tauri::command]
async fn export_user_data(app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    let json = state.library.export_json().await?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name("mochy-backup.json")
        .add_filter("JSON", &["json"])
        .save_file(move |file| {
            let _ = tx.send(file.and_then(|f| f.into_path().ok()));
        });
    let Some(path) = rx.await.ok().flatten() else {
        return Ok(false);
    };
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn import_user_data(app: AppHandle, state: State<'_, AppState>) -> Result<Option<(AppSettings, LibrarySnapshot)>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .pick_file(move |file| {
            let _ = tx.send(file.and_then(|f| f.into_path().ok()));
        });
    let Some(path) = rx.await.ok().flatten() else {
        return Ok(None);
    };
    let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let snap = state.library.import_json(&raw).await?;
    let settings = state.library.get_settings().await;
    Ok(Some((settings, snap)))
}

// ------------------------------------------------------------------ cover colours

// youtube's covers come in any size; a small one is all a 24x24 squeeze needs
fn small_cover(url: &str) -> String {
    if url.contains("googleusercontent.com") || url.contains("ggpht.com") {
        if let Some(pos) = url.rfind('=') {
            return format!("{}=w96-h96-l90-rj", &url[..pos]);
        }
    }
    url.to_string()
}

#[tauri::command]
async fn cover_palette(state: State<'_, AppState>, url: String) -> Result<Option<Palette>, String> {
    if url.is_empty() {
        return Ok(None);
    }
    if let Some(hit) = state.palettes.get(&url) {
        return Ok(Some(hit));
    }
    let bytes: Option<Vec<u8>> = if let Some(id) = url.strip_prefix("local-art:") {
        state.local.art(id).await.map(|(b, _)| b)
    } else if let Some(rest) = url.strip_prefix("link-art:") {
        let (device, file) = rest.split_once(':').unwrap_or((rest, ""));
        match state.link.file_url(device, &format!("/art/{}", file)).await {
            Some(u) => match state.link.stream_client().get(u).send().await {
                Ok(r) => r.bytes().await.ok().map(|b| b.to_vec()),
                Err(_) => None,
            },
            None => None,
        }
    } else {
        match state.innertube.http.get(small_cover(&url)).send().await {
            Ok(r) => r.bytes().await.ok().map(|b| b.to_vec()),
            Err(_) => None,
        }
    };
    let Some(bytes) = bytes else { return Ok(None) };
    let palette = tokio::task::spawn_blocking(move || palette::from_bytes(&bytes)).await.ok().flatten();
    if let Some(p) = &palette {
        state.palettes.put(url, p.clone());
    }
    Ok(palette)
}

fn main() {
    let innertube = InnerTube::new();
    let lyrics = LyricsService::new(innertube.clone());
    let library = Library::new();
    let local = LocalMusic::new(&library.data_dir());
    let link = LinkHub::new(library.clone(), local.clone());

    let proxy = youtube::proxy::ProxyContext {
        innertube: innertube.clone(),
        local: local.clone(),
        link: link.clone(),
    };
    let link_for_setup = link.clone();
    let local_for_setup = local.clone();
    let library_for_setup = library.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            innertube,
            lyrics,
            library,
            local,
            link,
            palettes: PaletteCache::default(),
        })
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            menu::install(app.handle());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                youtube::proxy::start_proxy(proxy).await;
            });
            tauri::async_runtime::spawn(async move {
                link_for_setup.start(handle.clone()).await;
                // the shared folders are read again on every launch; only new or changed files are opened
                let folders = library_for_setup.get_settings().await.shared_folders;
                let count = local_for_setup.rescan(folders).await;
                let _ = handle.emit("local://changed", count);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_init,
            yt_home,
            yt_home_continuation,
            yt_discover,
            yt_search_suggestions,
            yt_search_summary,
            yt_search,
            yt_search_continuation,
            yt_album,
            yt_artist,
            yt_playlist,
            yt_playlist_continuation,
            yt_browse_section,
            yt_moods,
            yt_next,
            yt_stream,
            lyrics_get,
            lyrics_all_candidates,
            lyrics_choose,
            lyrics_forget,
            lib_snapshot,
            lib_toggle_like,
            lib_record_play,
            lib_create_playlist,
            lib_rename_playlist,
            lib_toggle_pin,
            lib_delete_playlist,
            lib_add_to_playlist,
            lib_remove_from_playlist,
            lib_clear_history,
            lib_songs_by_ids,
            lib_save_session,
            settings_update,
            link_state,
            link_pairing_open,
            link_pairing_close,
            link_pair,
            link_unlink,
            link_update_device,
            link_sync,
            link_files,
            link_player_update,
            link_remote_start,
            link_remote_stop,
            link_remote_watch,
            link_remote_command,
            link_remote_play,
            link_remote_queue,
            link_remote_settings,
            local_tracks,
            local_rescan,
            storage_stats,
            clear_app_caches,
            pick_local_folder,
            export_user_data,
            import_user_data,
            cover_palette,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mochy");
}
