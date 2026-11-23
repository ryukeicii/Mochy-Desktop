use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistRef {
    pub name: String,
    pub id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumRef {
    pub name: String,
    pub id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongItem {
    pub id: String,
    pub title: String,
    pub artists: Vec<ArtistRef>,
    #[serde(default)]
    pub album: Option<AlbumRef>,
    #[serde(default)]
    pub duration: Option<i64>,
    pub thumbnail: String,
    #[serde(default)]
    pub explicit: bool,
    #[serde(default)]
    pub music_video_type: Option<String>,
    // where the audio lives when it isn't youtube: "local" for a file on this computer, "link:<device id>" for one on a paired device
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

impl SongItem {
    pub fn artist_names(&self) -> String {
        self.artists
            .iter()
            .map(|a| a.name.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    }

    pub fn is_video(&self) -> bool {
        match &self.music_video_type {
            Some(t) => t != "MUSIC_VIDEO_TYPE_ATV",
            None => false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumItem {
    pub browse_id: String,
    #[serde(default)]
    pub playlist_id: Option<String>,
    pub title: String,
    pub artists: Vec<ArtistRef>,
    #[serde(default)]
    pub year: Option<i64>,
    pub thumbnail: String,
    #[serde(default)]
    pub explicit: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistItem {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub thumbnail: Option<String>,
    #[serde(default)]
    pub subtitle: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistItem {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub song_count_text: Option<String>,
    #[serde(default)]
    pub thumbnail: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum YTItem {
    Song(SongItem),
    Album(AlbumItem),
    Artist(ArtistItem),
    Playlist(PlaylistItem),
}

impl YTItem {
    pub fn id(&self) -> String {
        match self {
            YTItem::Song(s) => format!("song-{}", s.id),
            YTItem::Album(a) => format!("album-{}", a.browse_id),
            YTItem::Artist(a) => format!("artist-{}", a.id),
            YTItem::Playlist(p) => format!("playlist-{}", p.id),
        }
    }

    pub fn title(&self) -> &str {
        match self {
            YTItem::Song(s) => &s.title,
            YTItem::Album(a) => &a.title,
            YTItem::Artist(a) => &a.title,
            YTItem::Playlist(p) => &p.title,
        }
    }

    pub fn thumbnail(&self) -> Option<&str> {
        match self {
            YTItem::Song(s) => Some(&s.thumbnail),
            YTItem::Album(a) => Some(&a.thumbnail),
            YTItem::Artist(a) => a.thumbnail.as_deref(),
            YTItem::Playlist(p) => p.thumbnail.as_deref(),
        }
    }

    pub fn song(&self) -> Option<&SongItem> {
        if let YTItem::Song(s) = self {
            Some(s)
        } else {
            None
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchEndpoint {
    #[serde(default)]
    pub video_id: Option<String>,
    #[serde(default)]
    pub playlist_id: Option<String>,
    #[serde(default)]
    pub params: Option<String>,
    #[serde(default)]
    pub index: Option<usize>,
}

impl WatchEndpoint {
    pub fn radio(video_id: &str) -> Self {
        Self {
            video_id: Some(video_id.to_string()),
            playlist_id: Some(format!("RDAMVM{}", video_id)),
            params: Some("wAEB".to_string()),
            index: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedSection {
    pub title: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub thumbnail: Option<String>,
    #[serde(default)]
    pub more_browse_id: Option<String>,
    #[serde(default)]
    pub more_params: Option<String>,
    pub items: Vec<YTItem>,
}

impl FeedSection {
    pub fn id(&self) -> String {
        let first_id = self.items.first().map(|i| i.id()).unwrap_or_default();
        format!("{}{}", self.title, first_id)
    }

    pub fn is_all_songs(&self) -> bool {
        !self.items.is_empty() && self.items.iter().all(|i| i.song().is_some())
    }
}

// one tile on search's moods & genres page: a name, its colour stripe and the page it opens
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodItem {
    pub title: String,
    pub stripe_color: Option<i64>,
    pub browse_id: String,
    pub params: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodSection {
    pub title: String,
    pub items: Vec<MoodItem>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeChip {
    pub title: String,
    pub params: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HomePage {
    pub chips: Vec<HomeChip>,
    pub sections: Vec<FeedSection>,
    pub continuation: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSummary {
    pub top: Option<YTItem>,
    pub sections: Vec<FeedSection>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub items: Vec<YTItem>,
    pub continuation: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSuggestions {
    pub queries: Vec<String>,
    pub items: Vec<YTItem>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumPage {
    pub album: AlbumItem,
    pub songs: Vec<SongItem>,
    pub other_versions: Vec<YTItem>,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistPage {
    pub artist: ArtistItem,
    pub banner: Option<String>,
    pub subscribers: Option<String>,
    pub monthly_listeners: Option<String>,
    pub description: Option<String>,
    pub shuffle_endpoint: Option<WatchEndpoint>,
    pub radio_endpoint: Option<WatchEndpoint>,
    pub sections: Vec<FeedSection>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistPage {
    pub playlist: PlaylistItem,
    pub songs: Vec<SongItem>,
    pub continuation: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NextResult {
    pub items: Vec<SongItem>,
    pub current_index: Option<usize>,
    pub continuation: Option<String>,
    pub lyrics_browse_id: Option<String>,
    pub related_browse_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamInfo {
    pub url: String,
    pub proxy_url: String,
    pub headers: HashMap<String, String>,
    pub codec: String,
    pub sample_rate: Option<i64>,
    pub bitrate: Option<i64>,
    pub loudness_db: Option<f64>,
    pub expires_at_unix: i64,
    pub is_hls: bool,
    pub approx_duration: Option<f64>,
    pub format_label: String,
    #[serde(skip)]
    pub patched_init: Option<Vec<u8>>,
}
