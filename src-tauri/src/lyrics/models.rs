use crate::youtube::models::SongItem;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricWord {
    pub text: String,
    pub start: f64,
    pub end: f64,
    pub space_after: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackingVocal {
    pub time: f64,
    pub text: String,
    pub words: Vec<LyricWord>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub id: usize,
    pub time: f64,
    pub text: String,
    pub words: Vec<LyricWord>,
    pub agent: Option<String>,
    pub backing: Option<BackingVocal>,
    pub end: Option<f64>,
    pub sub_line: Option<String>,
    pub is_opposite_voice: bool,
    pub is_group_voice: bool,
}

impl LyricLine {
    pub fn new(
        id: usize,
        time: f64,
        text: String,
        words: Vec<LyricWord>,
        agent: Option<String>,
        backing: Option<BackingVocal>,
        end: Option<f64>,
        sub_line: Option<String>,
    ) -> Self {
        let is_opposite_voice = matches!(agent.as_deref(), Some("v2") | Some("v2000"));
        let is_group_voice = agent.as_deref() == Some("v1000");
        Self {
            id,
            time,
            text,
            words,
            agent,
            backing,
            end,
            sub_line,
            is_opposite_voice,
            is_group_voice,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LyricsSync {
    Plain = 1,
    Line = 2,
    Word = 3,
}

impl LyricsSync {
    pub fn label(&self) -> &'static str {
        match self {
            LyricsSync::Plain => "Plain",
            LyricsSync::Line => "Line synced",
            LyricsSync::Word => "Word synced",
        }
    }

    pub fn raw_value(&self) -> i32 {
        match self {
            LyricsSync::Plain => 1,
            LyricsSync::Line => 2,
            LyricsSync::Word => 3,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LyricsProvider {
    BetterLyrics,
    YouLyPlus,
    Paxsenix,
    SimpMusic,
    LrcLib,
    Deezer,
    YouTubeSubtitle,
    YouTubeMusic,
    NetEase,
    QQMusic,
    Kugou,
    YouTubeCaptions,
}

impl LyricsProvider {
    pub const DEFAULT_ORDER: [LyricsProvider; 12] = [
        LyricsProvider::BetterLyrics,
        LyricsProvider::YouLyPlus,
        LyricsProvider::Paxsenix,
        LyricsProvider::SimpMusic,
        LyricsProvider::LrcLib,
        LyricsProvider::Deezer,
        LyricsProvider::YouTubeSubtitle,
        LyricsProvider::YouTubeMusic,
        LyricsProvider::NetEase,
        LyricsProvider::QQMusic,
        LyricsProvider::Kugou,
        LyricsProvider::YouTubeCaptions,
    ];

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::BetterLyrics => "BetterLyrics",
            Self::YouLyPlus => "YouLyPlus",
            Self::Paxsenix => "Paxsenix",
            Self::SimpMusic => "SimpMusic",
            Self::LrcLib => "LrcLib",
            Self::Deezer => "Deezer",
            Self::YouTubeSubtitle => "YouTubeSubtitle",
            Self::YouTubeMusic => "YouTubeMusic",
            Self::NetEase => "NetEase",
            Self::QQMusic => "QQMusic",
            Self::Kugou => "Kugou",
            Self::YouTubeCaptions => "YouTubeCaptions",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.trim() {
            "BetterLyrics" => Some(Self::BetterLyrics),
            "YouLyPlus" => Some(Self::YouLyPlus),
            "Paxsenix" => Some(Self::Paxsenix),
            "SimpMusic" => Some(Self::SimpMusic),
            "LrcLib" => Some(Self::LrcLib),
            "Deezer" => Some(Self::Deezer),
            "YouTubeSubtitle" => Some(Self::YouTubeSubtitle),
            "YouTubeMusic" => Some(Self::YouTubeMusic),
            "NetEase" => Some(Self::NetEase),
            "QQMusic" => Some(Self::QQMusic),
            "Kugou" => Some(Self::Kugou),
            "YouTubeCaptions" => Some(Self::YouTubeCaptions),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::BetterLyrics => "Apple Music",
            Self::YouLyPlus => "YouLyPlus",
            Self::Paxsenix => "PaxSenix",
            Self::SimpMusic => "SimpMusic",
            Self::LrcLib => "LrcLib",
            Self::Deezer => "Deezer",
            Self::YouTubeSubtitle => "YouTube Subtitle",
            Self::YouTubeMusic => "YouTube Music",
            Self::NetEase => "NetEase",
            Self::QQMusic => "QQ Music",
            Self::Kugou => "KuGou",
            Self::YouTubeCaptions => "YouTube Auto Captions",
        }
    }

    pub fn detail(&self) -> &'static str {
        match self {
            Self::BetterLyrics => "Word by word, with duets and backing vocals",
            Self::YouLyPlus => "Word by word from LyricsPlus",
            Self::Paxsenix => "Apple Music lyrics through PaxSenix",
            Self::SimpMusic => "Matched to the exact YouTube video",
            Self::LrcLib => "Free, community synced lyrics",
            Self::Deezer => "Deezer's own synced lyrics",
            Self::YouTubeSubtitle => "The subtitles uploaded with the video",
            Self::YouTubeMusic => "YouTube Music's plain lyrics",
            Self::NetEase => "Best for Chinese songs, often word by word",
            Self::QQMusic => "Best for Chinese songs",
            Self::Kugou => "Best for Chinese songs",
            Self::YouTubeCaptions => "Speech recognition, only when nothing else has lyrics",
        }
    }

    pub fn is_chinese(&self) -> bool {
        matches!(self, Self::NetEase | Self::QQMusic | Self::Kugou)
    }

    pub fn is_language_reference(&self) -> bool {
        matches!(self, Self::YouTubeMusic | Self::YouTubeSubtitle)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lyrics {
    pub lines: Vec<LyricLine>,
    pub sync: LyricsSync,
    pub sync_label: String,
    pub sync_raw: i32,
    pub provider: LyricsProvider,
    pub provider_name: String,
    pub is_synced: bool,
    pub has_duet: bool,
    pub has_voice_tags: bool,
}

impl Lyrics {
    pub fn new(lines: Vec<LyricLine>, sync: LyricsSync, provider: LyricsProvider) -> Self {
        let is_synced = sync != LyricsSync::Plain;
        let has_duet = lines.iter().any(|l| l.is_opposite_voice)
            && lines
                .iter()
                .any(|l| !l.is_opposite_voice && l.agent.is_some());
        let has_voice_tags = lines.iter().any(|l| l.agent.is_some());
        Self {
            lines,
            sync,
            sync_label: sync.label().to_string(),
            sync_raw: sync.raw_value(),
            provider,
            provider_name: provider.display_name().to_string(),
            is_synced,
            has_duet,
            has_voice_tags,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsCandidate {
    pub id: String,
    pub provider: LyricsProvider,
    pub provider_name: String,
    pub lyrics: Lyrics,
    pub order: usize,
    pub script: Script,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsOutcome {
    pub best: Option<Lyrics>,
    pub candidates: Vec<LyricsCandidate>,
}

#[derive(Clone, Debug)]
pub struct LyricsQuery {
    pub video_id: String,
    pub title: String,
    pub artist: String,
    pub first_artist: String,
    pub album: Option<String>,
    pub duration: i64,
    pub lyrics_browse_id: Option<String>,
}

impl LyricsQuery {
    pub fn from_song(
        song: &SongItem,
        duration: Option<i64>,
        lyrics_browse_id: Option<String>,
    ) -> Self {
        Self {
            video_id: song.id.clone(),
            title: song.title.clone(),
            artist: song.artist_names(),
            first_artist: song
                .artists
                .first()
                .map(|a| a.name.clone())
                .unwrap_or_default(),
            album: song.album.as_ref().map(|a| a.name.clone()),
            duration: duration.or(song.duration).unwrap_or(-1),
            lyrics_browse_id,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Script {
    Latin,
    Han,
    Kana,
    Hangul,
    Cyrillic,
    Arabic,
    Devanagari,
    Thai,
    Greek,
    Hebrew,
    Unknown,
}

impl Script {
    pub fn is_native(&self) -> bool {
        !matches!(self, Self::Latin | Self::Unknown)
    }

    pub fn is_unspaced(&self) -> bool {
        matches!(self, Self::Han | Self::Kana | Self::Thai)
    }

    pub fn of_char(c: char) -> Option<Self> {
        let v = c as u32;
        match v {
            0x41..=0x5A | 0x61..=0x7A | 0xC0..=0x24F | 0x1E00..=0x1EFF => Some(Self::Latin),
            0x3040..=0x30FF | 0x31F0..=0x31FF | 0xFF66..=0xFF9F => Some(Self::Kana),
            0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0xF900..=0xFAFF => Some(Self::Han),
            0xAC00..=0xD7AF | 0x1100..=0x11FF | 0x3130..=0x318F => Some(Self::Hangul),
            0x0400..=0x04FF => Some(Self::Cyrillic),
            0x0600..=0x06FF | 0x0750..=0x077F => Some(Self::Arabic),
            0x0900..=0x097F => Some(Self::Devanagari),
            0x0E00..=0x0E7F => Some(Self::Thai),
            0x0370..=0x03FF => Some(Self::Greek),
            0x0590..=0x05FF => Some(Self::Hebrew),
            _ => None,
        }
    }

    pub fn is_char_unspaced(c: char) -> bool {
        Self::of_char(c).map(|s| s.is_unspaced()).unwrap_or(false)
    }

    pub fn dominant(text: &str) -> Self {
        let mut counts: HashMap<Script, usize> = HashMap::new();
        for c in text.chars() {
            if let Some(s) = Self::of_char(c) {
                *counts.entry(s).or_insert(0) += 1;
            }
        }
        let Some((&top_script, _)) = counts.iter().max_by_key(|(_, &cnt)| cnt) else {
            return Self::Unknown;
        };
        if top_script == Self::Han && counts.get(&Self::Kana).copied().unwrap_or(0) > 0 {
            return Self::Kana;
        }
        top_script
    }
}
