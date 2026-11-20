// the songs in this computer's shared folders: read once for their tags, kept in an index, played here and streamed to paired devices

use crate::youtube::models::{AlbumRef, ArtistRef, SongItem};
use lofty::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;
use tokio::sync::RwLock;

const AUDIO: &[&str] = &["flac", "mp3", "m4a", "aac", "alac", "ogg", "oga", "opus", "wav", "aif", "aiff", "wv", "ape"];
const COVERS: &[&str] = &["cover.jpg", "cover.png", "folder.jpg", "folder.png", "front.jpg", "front.png", "album.jpg", "Cover.jpg", "Folder.jpg"];
const MAX_TRACKS: usize = 50_000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTrack {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: i64,
    pub track: Option<u32>,
    pub mime: String,
    pub format: String,
    pub bytes: u64,
    pub modified: u64,
    pub sample_rate: Option<u32>,
    pub bit_depth: Option<u8>,
    pub has_art: bool,
}

impl LocalTrack {
    pub fn song(&self) -> SongItem {
        SongItem {
            id: self.id.clone(),
            title: self.title.clone(),
            artists: if self.artist.is_empty() {
                Vec::new()
            } else {
                vec![ArtistRef { name: self.artist.clone(), id: None }]
            },
            album: if self.album.is_empty() {
                None
            } else {
                Some(AlbumRef { name: self.album.clone(), id: String::new() })
            },
            duration: (self.duration > 0).then_some(self.duration),
            thumbnail: format!("local-art:{}", self.id),
            explicit: false,
            music_video_type: None,
            source: Some("local".into()),
        }
    }

    // what a paired device is told about the file, its own fields first so an older app still reads it
    pub fn wire(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "bytes": self.bytes,
            "mime": self.mime,
            "local": true,
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "duration": self.duration,
            "track": self.track,
            "format": self.format,
            "sampleRate": self.sample_rate,
            "bitDepth": self.bit_depth,
            "art": self.has_art,
        })
    }

    pub fn quality(&self) -> String {
        match (self.bit_depth, self.sample_rate) {
            (Some(b), Some(r)) => format!("{} · {}-bit {:.1} kHz", self.format, b, r as f64 / 1000.0),
            (_, Some(r)) => format!("{} · {:.1} kHz", self.format, r as f64 / 1000.0),
            _ => self.format.clone(),
        }
    }
}

#[derive(Default, Serialize, Deserialize)]
struct IndexFile {
    tracks: Vec<LocalTrack>,
}

pub struct LocalMusic {
    path: PathBuf,
    tracks: RwLock<HashMap<String, LocalTrack>>,
    scanning: tokio::sync::Mutex<()>,
}

// a stable id from the file's path, so a device that queued it yesterday still finds it
pub fn id_for(path: &Path) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in path.to_string_lossy().as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("pc{:016x}", hash)
}

fn mime_of(ext: &str) -> &'static str {
    match ext {
        "flac" => "audio/flac",
        "mp3" => "audio/mpeg",
        "m4a" | "aac" | "alac" => "audio/mp4",
        "ogg" | "oga" => "audio/ogg",
        "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "aif" | "aiff" => "audio/aiff",
        "wv" => "audio/x-wavpack",
        "ape" => "audio/x-ape",
        _ => "application/octet-stream",
    }
}

fn format_of(ext: &str) -> &'static str {
    match ext {
        "flac" => "FLAC",
        "mp3" => "MP3",
        "m4a" | "alac" => "M4A",
        "aac" => "AAC",
        "ogg" | "oga" => "OGG",
        "opus" => "OPUS",
        "wav" => "WAV",
        "aif" | "aiff" => "AIFF",
        "wv" => "WAVPACK",
        "ape" => "APE",
        _ => "AUDIO",
    }
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    if depth > 12 || out.len() >= MAX_TRACKS {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        if name.to_string_lossy().starts_with('.') {
            continue;
        }
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_dir() {
            walk(&path, out, depth + 1);
        } else if kind.is_file() {
            let ext = path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
            if AUDIO.contains(&ext.as_str()) {
                out.push(path);
            }
        }
    }
}

fn read_track(path: &Path, bytes: u64, modified: u64) -> LocalTrack {
    let ext = path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let folder = path.parent().and_then(|p| p.file_name()).map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let mut track = LocalTrack {
        id: id_for(path),
        path: path.to_string_lossy().into_owned(),
        title: stem.clone(),
        artist: String::new(),
        album: folder,
        duration: 0,
        track: None,
        mime: mime_of(&ext).to_string(),
        format: format_of(&ext).to_string(),
        bytes,
        modified,
        sample_rate: None,
        bit_depth: None,
        has_art: false,
    };
    if let Ok(tagged) = lofty::read_from_path(path) {
        let props = tagged.properties();
        track.duration = props.duration().as_secs() as i64;
        track.sample_rate = props.sample_rate();
        track.bit_depth = props.bit_depth();
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(t) = tag.title().filter(|t| !t.trim().is_empty()) {
                track.title = t.trim().to_string();
            }
            if let Some(a) = tag.artist().filter(|a| !a.trim().is_empty()) {
                track.artist = a.trim().to_string();
            } else if let Some(a) = tag.get_string(ItemKey::AlbumArtist) {
                track.artist = a.trim().to_string();
            }
            if let Some(a) = tag.album().filter(|a| !a.trim().is_empty()) {
                track.album = a.trim().to_string();
            }
            track.track = tag.track();
            track.has_art = !tag.pictures().is_empty();
        }
    }
    // a file named "Artist - Title" with no tags still reads well
    if track.artist.is_empty() {
        if let Some((a, t)) = stem.split_once(" - ") {
            track.artist = a.trim().to_string();
            if track.title == stem {
                track.title = t.trim().to_string();
            }
        }
    }
    if !track.has_art {
        track.has_art = folder_cover(path).is_some();
    }
    track
}

fn folder_cover(path: &Path) -> Option<PathBuf> {
    let dir = path.parent()?;
    COVERS.iter().map(|n| dir.join(n)).find(|p| p.is_file())
}

impl LocalMusic {
    pub fn new(data_dir: &Path) -> Arc<Self> {
        let path = data_dir.join("LocalIndex.json");
        let tracks = fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<IndexFile>(&s).ok())
            .map(|f| f.tracks.into_iter().map(|t| (t.id.clone(), t)).collect())
            .unwrap_or_default();
        Arc::new(Self { path, tracks: RwLock::new(tracks), scanning: tokio::sync::Mutex::new(()) })
    }

    // walks the folders again, reading tags only for files that are new or changed since the last time
    pub async fn rescan(&self, folders: Vec<String>) -> usize {
        let _guard = self.scanning.lock().await;
        let known: HashMap<String, LocalTrack> = self.tracks.read().await.clone();
        let scanned = tokio::task::spawn_blocking(move || {
            let mut files = Vec::new();
            for folder in &folders {
                walk(Path::new(folder), &mut files, 0);
            }
            let mut out = HashMap::new();
            for file in files {
                let Ok(meta) = fs::metadata(&file) else { continue };
                let modified = meta.modified().ok().and_then(|m| m.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
                let id = id_for(&file);
                let track = match known.get(&id) {
                    Some(t) if t.modified == modified && t.bytes == meta.len() => t.clone(),
                    _ => read_track(&file, meta.len(), modified),
                };
                out.insert(id, track);
            }
            out
        })
        .await
        .unwrap_or_default();
        let count = scanned.len();
        let index = IndexFile { tracks: scanned.values().cloned().collect() };
        *self.tracks.write().await = scanned;
        if let Ok(json) = serde_json::to_string(&index) {
            let _ = fs::write(&self.path, json);
        }
        count
    }

    pub async fn get(&self, id: &str) -> Option<LocalTrack> {
        self.tracks.read().await.get(id).cloned()
    }

    // every track, by artist then album then track number, the way a folder of albums reads
    pub async fn all(&self) -> Vec<LocalTrack> {
        let mut list: Vec<LocalTrack> = self.tracks.read().await.values().cloned().collect();
        list.sort_by(|a, b| {
            (a.artist.to_lowercase(), a.album.to_lowercase(), a.track.unwrap_or(0), a.title.to_lowercase())
                .cmp(&(b.artist.to_lowercase(), b.album.to_lowercase(), b.track.unwrap_or(0), b.title.to_lowercase()))
        });
        list
    }

    pub async fn len(&self) -> usize {
        self.tracks.read().await.len()
    }

    // the embedded front cover, or the folder's cover image
    pub async fn art(&self, id: &str) -> Option<(Vec<u8>, String)> {
        let track = self.get(id).await?;
        tokio::task::spawn_blocking(move || {
            let path = Path::new(&track.path);
            if let Ok(tagged) = lofty::read_from_path(path) {
                for tag in tagged.tags() {
                    let pictures = tag.pictures();
                    let picked = pictures
                        .iter()
                        .find(|p| p.pic_type() == lofty::picture::PictureType::CoverFront)
                        .or_else(|| pictures.first());
                    if let Some(p) = picked {
                        let mime = p.mime_type().map(|m| m.as_str().to_string()).unwrap_or_else(|| "image/jpeg".into());
                        return Some((p.data().to_vec(), mime));
                    }
                }
            }
            let cover = folder_cover(path)?;
            let mime = if cover.extension().map(|e| e.eq_ignore_ascii_case("png")).unwrap_or(false) { "image/png" } else { "image/jpeg" };
            fs::read(&cover).ok().map(|b| (b, mime.to_string()))
        })
        .await
        .ok()
        .flatten()
    }

    // a .lrc beside the file, for synced lyrics that need no lookup
    pub async fn sidecar_lyrics(&self, id: &str) -> Option<String> {
        let track = self.get(id).await?;
        let lrc = Path::new(&track.path).with_extension("lrc");
        tokio::fs::read_to_string(lrc).await.ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_stable_and_prefixed() {
        let a = id_for(Path::new("/Music/a.flac"));
        assert_eq!(a, id_for(Path::new("/Music/a.flac")));
        assert_ne!(a, id_for(Path::new("/Music/b.flac")));
        assert!(a.starts_with("pc") && a.len() == 18);
    }
}
