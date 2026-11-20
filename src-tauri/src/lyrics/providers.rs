use crate::lyrics::models::{LyricsQuery, Script};
use crate::lyrics::ttml::TTMLParser;
use crate::youtube::json::Json;
use base64::Engine;
use regex::Regex;
use reqwest::Client;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

pub const USER_AGENT: &str = "Mochy (+https://github.com/realidkroo/Mochy-Music)";

pub struct LyricsHTTP {
    pub client: Client,
    deezer_token: RwLock<Option<(String, i64)>>,
}

impl LyricsHTTP {
    pub fn new() -> Arc<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(12))
            .user_agent(USER_AGENT)
            .build()
            .expect("Failed to build LyricsHTTP client");
        Arc::new(Self {
            client,
            deezer_token: RwLock::new(None),
        })
    }

    pub fn encode_unreserved(text: &str) -> String {
        let mut out = String::new();
        for b in text.as_bytes() {
            let c = *b as char;
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_' | '~') {
                out.push(c);
            } else {
                out.push_str(&format!("%{:02X}", b));
            }
        }
        out
    }

    pub async fn get_json(
        &self,
        base: &str,
        query: &[(&str, Option<&str>)],
        headers: &[(&str, &str)],
        timeout_secs: u64,
    ) -> Result<Json, String> {
        let mut pairs: Vec<(&str, &str)> = query
            .iter()
            .filter_map(|(k, v)| v.map(|val| (*k, val)))
            .collect();
        pairs.sort_by_key(|(k, _)| *k);

        let url = if pairs.is_empty() {
            base.to_string()
        } else {
            let qs: String = pairs
                .into_iter()
                .map(|(k, v)| format!("{}={}", Self::encode_unreserved(k), Self::encode_unreserved(v)))
                .collect::<Vec<_>>()
                .join("&");
            if base.contains('?') {
                format!("{}&{}", base, qs)
            } else {
                format!("{}?{}", base, qs)
            }
        };

        let mut req = self
            .client
            .get(&url)
            .header("Accept", "application/json, text/plain, */*")
            .timeout(Duration::from_secs(timeout_secs));
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        let resp = req.send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status().as_u16()));
        }
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        Json::from_slice(&bytes)
    }

    pub async fn post_json(
        &self,
        url: &str,
        body: &Value,
        headers: &[(&str, &str)],
    ) -> Result<Json, String> {
        let mut req = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/plain, */*")
            .timeout(Duration::from_secs(10));
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        let resp = req.json(body).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status().as_u16()));
        }
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        Json::from_slice(&bytes)
    }

    pub async fn deezer_jwt(&self) -> Result<String, String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        if let Some((ref jwt, exp)) = *self.deezer_token.read().await {
            if now < exp {
                return Ok(jwt.clone());
            }
        }
        let json = self
            .get_json(
                "https://auth.deezer.com/login/anonymous",
                &[("jo", Some("p")), ("rto", Some("c"))],
                &[],
                10,
            )
            .await?;
        let jwt = json
            .get("jwt")
            .string()
            .ok_or_else(|| "Missing Deezer JWT".to_string())?;
        let exp = Self::jwt_expiry(&jwt).unwrap_or(now + 300) - 30;
        *self.deezer_token.write().await = Some((jwt.clone(), exp));
        Ok(jwt)
    }

    pub async fn forget_deezer_jwt(&self) {
        *self.deezer_token.write().await = None;
    }

    fn jwt_expiry(jwt: &str) -> Option<i64> {
        let part = jwt.split('.').nth(1)?;
        let mut payload = part.replace('-', "+").replace('_', "/");
        while payload.len() % 4 != 0 {
            payload.push('=');
        }
        let bytes = base64::engine::general_purpose::STANDARD.decode(&payload).ok()?;
        let json = Json::from_slice(&bytes).ok()?;
        json.get("exp").int()
    }
}

pub struct LyricsMatch;

impl LyricsMatch {
    pub fn clean_title(title: &str) -> String {
        let patterns = [
            r"(?i)\s*\(.*?(official|video|audio|lyrics|lyric|visualizer|hd|hq|4k|remaster|remix|live|acoustic|version|edit|extended|radio|clean|explicit).*?\)",
            r"(?i)\s*\[.*?(official|video|audio|lyrics|lyric|visualizer|hd|hq|4k|remaster|remix|live|acoustic|version|edit|extended|radio|clean|explicit).*?\]",
            r"\s*【.*?】",
            r"\s*\|.*$",
            r"(?i)\s*-\s*(official|video|audio|lyrics|lyric|visualizer).*$",
            r"(?i)\s*\(feat\..*?\)",
            r"(?i)\s*\(ft\..*?\)",
            r"(?i)\s*feat\..*$",
            r"(?i)\s*ft\..*$",
        ];
        let mut cleaned = title.trim().to_string();
        for pat in patterns {
            if let Ok(re) = Regex::new(pat) {
                cleaned = re.replace_all(&cleaned, "").to_string();
            }
        }
        cleaned.trim().to_string()
    }

    pub fn clean_artist(artist: &str) -> String {
        let trimmed = artist.trim();
        let lower = trimmed.to_lowercase();
        let separators = [
            " & ",
            " and ",
            ", ",
            " x ",
            " feat. ",
            " feat ",
            " ft. ",
            " ft ",
            " featuring ",
            " with ",
        ];
        for sep in separators {
            if let Some(idx) = lower.find(sep) {
                return trimmed[..idx].trim().to_string();
            }
        }
        trimmed.to_string()
    }

    pub fn normalize(text: &str) -> String {
        let re = Regex::new(r"\s*[(（\[【「『《].*?[)）\]】」』》]").unwrap();
        let stripped = re.replace_all(text, "");
        stripped
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect()
    }

    pub fn similarity(first: &str, second: &str) -> f64 {
        let a = first.trim().to_lowercase();
        let b = second.trim().to_lowercase();
        if a == b {
            return 1.0;
        }
        if a.is_empty() || b.is_empty() {
            return 0.0;
        }
        let contains: f64 = if a.contains(&b) || b.contains(&a) {
            0.8
        } else {
            0.0
        };
        let ac: Vec<char> = a.chars().collect();
        let bc: Vec<char> = b.chars().collect();
        let dist = Self::levenshtein(&ac, &bc);
        let max_len = ac.len().max(bc.len()) as f64;
        contains.max(1.0 - (dist as f64) / max_len)
    }

    fn levenshtein(a: &[char], b: &[char]) -> usize {
        if a.is_empty() {
            return b.len();
        }
        if b.is_empty() {
            return a.len();
        }
        let mut prev: Vec<usize> = (0..=b.len()).collect();
        for i in 1..=a.len() {
            let mut curr = vec![0; b.len() + 1];
            curr[0] = i;
            for j in 1..=b.len() {
                let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
                curr[j] = (prev[j] + 1).min(curr[j - 1] + 1).min(prev[j - 1] + cost);
            }
            prev = curr;
        }
        prev[b.len()]
    }
}

pub struct TrackCandidate<Ref> {
    pub titles: Vec<String>,
    pub artists: Vec<String>,
    pub duration_sec: i64,
    pub r#ref: Ref,
}

pub fn best_match<Ref: Clone>(
    candidates: &[TrackCandidate<Ref>],
    title: &str,
    artist: &str,
    duration_sec: i64,
) -> Option<Ref> {
    let wanted_title = LyricsMatch::normalize(title);
    let wanted_artist = LyricsMatch::normalize(artist);
    if wanted_title.is_empty() {
        return None;
    }
    let mut best: Option<(Ref, i32)> = None;
    for candidate in candidates {
        if duration_sec > 0 && (candidate.duration_sec - duration_sec).abs() > 8 {
            continue;
        }
        let title_score = candidate
            .titles
            .iter()
            .map(|t| LyricsMatch::normalize(t))
            .filter(|n| !n.is_empty())
            .map(|name| {
                if name == wanted_title {
                    2
                } else if name.contains(&wanted_title) || wanted_title.contains(&name) {
                    1
                } else {
                    0
                }
            })
            .max()
            .unwrap_or(0);
        if title_score == 0 {
            continue;
        }
        let artist_score = if !wanted_artist.is_empty()
            && candidate
                .artists
                .iter()
                .map(|a| LyricsMatch::normalize(a))
                .any(|name| {
                    !name.is_empty()
                        && (wanted_artist.contains(&name) || name.contains(&wanted_artist))
                }) {
            2
        } else {
            0
        };
        let score = title_score + artist_score;
        if best.as_ref().map(|(_, s)| score > *s).unwrap_or(true) {
            best = Some((candidate.r#ref.clone(), score));
        }
    }
    best.map(|(r, _)| r)
}

#[derive(Clone, Debug)]
pub struct TimedLine {
    pub start_ms: i64,
    pub text: String,
    pub words: Vec<(String, i64, i64)>,
}

impl TimedLine {
    pub fn stamp(ms: i64) -> String {
        format!(
            "[{:02}:{:02}.{:03}]",
            ms / 60_000,
            (ms / 1000) % 60,
            ms % 1000
        )
    }

    pub fn to_lrc(lines: &[TimedLine]) -> String {
        let mut out = String::new();
        for line in lines {
            out.push_str(&Self::stamp(line.start_ms));
            out.push_str(&line.text);
            out.push('\n');
            let words: Vec<(String, i64, i64)> = line
                .words
                .iter()
                .map(|(t, s, e)| {
                    let clean: String =
                        t.trim().chars().filter(|c| !":|<>".contains(*c)).collect();
                    (clean, *s, *e)
                })
                .filter(|(t, _, _)| !t.is_empty())
                .collect();
            if !words.is_empty() {
                let joined: String = words
                    .into_iter()
                    .map(|(t, s, e)| format!("{}:{}:{}", t, (s as f64) / 1000.0, (e as f64) / 1000.0))
                    .collect::<Vec<_>>()
                    .join("|");
                out.push('<');
                out.push_str(&joined);
                out.push_str(">\n");
            }
        }
        out.trim().to_string()
    }

    pub fn without_credits(lines: &[TimedLine]) -> Vec<TimedLine> {
        let re = Regex::new(r"^[^:：]{1,32}[:：].+$").unwrap();
        let is_credit = |line: &TimedLine| -> bool {
            if !re.is_match(&line.text) {
                return false;
            }
            let label = line
                .text
                .split(|c| c == ':' || c == '：')
                .next()
                .unwrap_or("");
            label.split_whitespace().count() <= 4
        };
        let head_cut = lines
            .iter()
            .take(15)
            .rposition(is_credit)
            .map(|i| i + 1)
            .unwrap_or(0);
        let body = &lines[head_cut..];
        let tail_start = body.len().saturating_sub(6);
        if let Some(rel) = body[tail_start..].iter().position(is_credit) {
            return body[..tail_start + rel].to_vec();
        }
        body.to_vec()
    }

    pub fn has_lyrics(lines: &[TimedLine]) -> bool {
        let sung: Vec<&TimedLine> = lines.iter().filter(|l| !l.text.trim().is_empty()).collect();
        !sung.is_empty() && !sung.iter().any(|l| l.text.contains("纯音乐"))
    }
}

pub fn parse_lrc_lines(lrc: &str) -> Vec<TimedLine> {
    let re = Regex::new(r"^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$").unwrap();
    lrc.lines()
        .filter_map(|raw| {
            let row = raw.trim();
            let caps = re.captures(row)?;
            let minutes = caps.get(1)?.as_str().parse::<i64>().unwrap_or(0);
            let seconds = caps.get(2)?.as_str().parse::<i64>().unwrap_or(0);
            let frac = caps.get(3).map(|m| m.as_str()).unwrap_or("0");
            let padded = format!("{}000", frac);
            let millis = padded[..3].parse::<i64>().unwrap_or(0);
            let text = caps.get(4)?.as_str().trim().to_string();
            Some(TimedLine {
                start_ms: minutes * 60_000 + seconds * 1000 + millis,
                text,
                words: Vec::new(),
            })
        })
        .collect()
}

// 1. BetterLyrics (Apple Music TTML)
pub async fn better_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    let clean_title = LyricsMatch::clean_title(&query.title);
    let dur_str = if query.duration > 0 {
        Some(query.duration.to_string())
    } else {
        None
    };
    let album = query.album.as_deref().filter(|a| !a.is_empty());
    let json = http
        .get_json(
            "https://lyrics-api.boidu.dev/getLyrics",
            &[
                ("s", Some(&clean_title)),
                ("a", Some(&query.artist)),
                ("d", dur_str.as_deref()),
                ("al", album),
            ],
            &[],
            15,
        )
        .await
        .ok()?;
    let ttml = json.get("ttml").string()?;
    TTMLParser::to_lrc(&ttml)
}

// 2. YouLyPlus
pub async fn youlyplus_lyrics(http: &Arc<LyricsHTTP>, query: &LyricsQuery) -> Option<String> {
    let servers = [
        "https://lyricsplus.binimum.org",
        "https://lyricsplus.prjktla.my.id",
    ];
    for server in servers {
        if let Some(res) = youlyplus_fetch(http, server, query).await {
            if !res.is_empty() {
                return Some(res);
            }
        }
    }
    None
}

async fn youlyplus_fetch(
    http: &LyricsHTTP,
    server: &str,
    query: &LyricsQuery,
) -> Option<String> {
    let clean_title = LyricsMatch::clean_title(&query.title);
    let dur_str = query.duration.to_string();
    let json = http
        .get_json(
            &format!("{}/v2/lyrics/get", server),
            &[
                ("title", Some(&clean_title)),
                ("artist", Some(&query.artist)),
                ("duration", Some(&dur_str)),
                ("album", query.album.as_deref()),
                ("id", Some(&query.video_id)),
            ],
            &[],
            8,
        )
        .await
        .ok()?;
    if let Some(synced) = json.get("syncedLyrics").string() {
        if !synced.is_empty() {
            return Some(synced);
        }
    }
    if let Some(converted) = youlyplus_convert(&json.get("lyrics").array()) {
        if !converted.is_empty() {
            return Some(converted);
        }
    }
    if let Some(plain) = json.get("plainLyrics").string() {
        if !plain.is_empty() {
            return Some(plain);
        }
    }
    None
}

fn youlyplus_convert(items: &[Json]) -> Option<String> {
    if items.is_empty() {
        return None;
    }
    let fmt = |ms: i64, syllable: bool| -> String {
        let body = format!("{:02}:{:02}.{:03}", ms / 60_000, (ms / 1000) % 60, ms % 1000);
        if syllable {
            format!("<{}>", body)
        } else {
            format!("[{}]", body)
        }
    };
    let lines: Vec<String> = items
        .iter()
        .map(|item| {
            let line_stamp = fmt(item.get("time").int().unwrap_or(0), false);
            let syllables = item.get("syllabus").array();
            let is_bg = syllables
                .iter()
                .any(|s| s.get("isBackground").bool() == Some(true));
            let singer = item.get("element").get("singer").string().unwrap_or_default();
            let marker = if is_bg {
                "{bg}".to_string()
            } else if singer.is_empty() {
                String::new()
            } else {
                format!("{{agent:{}}}", singer)
            };
            if syllables.is_empty() {
                return format!(
                    "{}{}{}",
                    line_stamp,
                    marker,
                    item.get("text").string().unwrap_or_default()
                );
            }
            let texts: Vec<String> = syllables
                .iter()
                .map(|s| s.get("text").string().unwrap_or_default())
                .collect();
            let spaced_by_api = texts
                .iter()
                .take(texts.len().saturating_sub(1))
                .any(|t| t.chars().next_back().map(|c| c.is_whitespace()).unwrap_or(false));
            let mut line = format!("{}{}", line_stamp, marker);
            for (idx, syl) in syllables.iter().enumerate() {
                line.push_str(&fmt(syl.get("time").int().unwrap_or(0), true));
                line.push_str(&texts[idx]);
                if !spaced_by_api
                    && idx + 1 < syllables.len()
                    && !texts[idx]
                        .chars()
                        .next_back()
                        .map(|c| c.is_whitespace())
                        .unwrap_or(false)
                {
                    line.push(' ');
                }
            }
            line.trim().to_string()
        })
        .collect();
    Some(lines.join("\n"))
}

// 3. Paxsenix
pub async fn paxsenix_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    let title = LyricsMatch::clean_title(&query.title);
    let artist = LyricsMatch::clean_artist(&query.artist);
    let mut queries = vec![format!("{} {}", title, artist), title.clone()];
    if let Some(ref alb) = query.album {
        if !alb.is_empty() {
            queries.push(format!("{} {} {}", title, artist, alb));
        }
    }
    let headers = [("User-Agent", "Mochy/0.1 (macOS)")];
    let mut hits = Vec::new();
    for q in queries {
        if let Ok(json) = http
            .get_json(
                "https://lyrics.paxsenix.org/apple-music/search",
                &[("q", Some(&q))],
                &headers,
                6,
            )
            .await
        {
            for item in json.array() {
                let id = item
                    .get("id")
                    .string()
                    .or_else(|| item.get("id").int().map(|v| v.to_string()));
                if let Some(id) = id {
                    hits.push((
                        id,
                        item.get("trackName")
                            .string()
                            .or_else(|| item.get("songName").string())
                            .unwrap_or_default(),
                        item.get("artistName").string().unwrap_or_default(),
                        item.get("duration").int(),
                    ));
                }
            }
            if !hits.is_empty() {
                break;
            }
        }
    }
    if hits.is_empty() {
        return None;
    }

    let mut fallback = None;
    for (id, _, _, _) in hits.into_iter().take(3) {
        if let Ok(json) = http
            .get_json(
                "https://lyrics.paxsenix.org/apple-music/lyrics",
                &[("id", Some(&id))],
                &headers,
                8,
            )
            .await
        {
            let lrc = json
                .get("ttmlContent")
                .string()
                .filter(|s| !s.is_empty())
                .and_then(|t| TTMLParser::to_lrc(&t))
                .or_else(|| json.get("elrcMultiPerson").string().filter(|s| !s.is_empty()))
                .or_else(|| json.get("elrc").string().filter(|s| !s.is_empty()))
                .or_else(|| json.get("plain").string().filter(|s| !s.is_empty()));
            if let Some(lrc) = lrc {
                if lrc.contains('<') && lrc.contains('>') {
                    return Some(lrc);
                }
                if fallback.is_none() {
                    fallback = Some(lrc);
                }
            }
        }
    }
    fallback
}

// 4. SimpMusic
pub async fn simpmusic_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    let servers = [
        "https://api-lyrics.simpmusic.org/v1/",
        "https://musicfy-yt-music-server.onrender.com/v1/",
    ];
    for server in servers {
        let Ok(json) = http
            .get_json(
                &format!("{}{}", server, query.video_id),
                &[],
                &[("User-Agent", "SimpMusicLyrics/1.0")],
                10,
            )
            .await
        else {
            continue;
        };
        if json.get("type").str() != Some("success") {
            return None;
        }
        let mut tracks = json.get("data").array();
        if query.duration > 0 {
            tracks.retain(|t| {
                (t.get("durationSeconds").int().unwrap_or(0) - query.duration).abs() <= 10
            });
            tracks.sort_by_key(|t| {
                (t.get("durationSeconds").int().unwrap_or(0) - query.duration).abs()
            });
        }
        let best = tracks.first()?;
        for key in ["richSyncLyrics", "syncedLyrics", "plainLyric"] {
            if let Some(text) = best.get(key).string() {
                if !text.trim().is_empty() {
                    return Some(text);
                }
            }
        }
        return None;
    }
    None
}

// 5. LrcLib
pub async fn lrclib_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    #[derive(Clone)]
    struct Track {
        track_name: String,
        artist_name: String,
        duration: f64,
        synced: Option<String>,
        plain: Option<String>,
    }

    let clean_title = LyricsMatch::clean_title(&query.title);
    let clean_artist = LyricsMatch::clean_artist(&query.artist);
    let q_both = format!("{} {}", clean_artist, clean_title);

    let attempts: Vec<Vec<(&str, Option<&str>)>> = vec![
        vec![
            ("track_name", Some(&clean_title)),
            ("artist_name", Some(&clean_artist)),
            ("album_name", query.album.as_deref()),
        ],
        vec![("track_name", Some(&clean_title))],
        vec![("q", Some(&q_both))],
        vec![("q", Some(&clean_title))],
    ];

    let mut tracks: Vec<Track> = Vec::new();
    for params in attempts {
        let Ok(json) = http
            .get_json("https://lrclib.net/api/search", &params, &[], 10)
            .await
        else {
            continue;
        };
        for item in json.array() {
            let synced = item
                .get("syncedLyrics")
                .string()
                .filter(|s| !s.trim().is_empty());
            let plain = item
                .get("plainLyrics")
                .string()
                .filter(|s| !s.trim().is_empty());
            if synced.is_some() || plain.is_some() {
                tracks.push(Track {
                    track_name: item.get("trackName").string().unwrap_or_default(),
                    artist_name: item.get("artistName").string().unwrap_or_default(),
                    duration: item.get("duration").double().unwrap_or(0.0),
                    synced,
                    plain,
                });
            }
        }
        if !tracks.is_empty() {
            break;
        }
    }
    if tracks.is_empty() {
        return None;
    }

    let pick = if query.duration <= 0 {
        let score = |t: &Track| -> f64 {
            (LyricsMatch::similarity(&clean_title, &t.track_name)
                + LyricsMatch::similarity(&clean_artist, &t.artist_name))
                / 2.0
                + if t.synced.is_some() { 0.1 } else { 0.0 }
        };
        tracks
            .into_iter()
            .max_by(|a, b| score(a).partial_cmp(&score(b)).unwrap_or(std::cmp::Ordering::Equal))
            .filter(|t| score(t) > 0.6)
    } else {
        let close = |t: &Track| ((t.duration as i64) - query.duration).abs() <= 5;
        tracks
            .iter()
            .filter(|t| t.synced.is_some() && close(t))
            .min_by(|a, b| {
                (a.duration - query.duration as f64)
                    .abs()
                    .partial_cmp(&(b.duration - query.duration as f64).abs())
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .cloned()
            .or_else(|| {
                tracks
                    .into_iter()
                    .filter(|t| close(t))
                    .min_by(|a, b| {
                        (a.duration - query.duration as f64)
                            .abs()
                            .partial_cmp(&(b.duration - query.duration as f64).abs())
                            .unwrap_or(std::cmp::Ordering::Equal)
                    })
            })
    };

    pick.and_then(|p| p.synced.or(p.plain))
}

// 6. Deezer
pub async fn deezer_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    let clean_title = LyricsMatch::clean_title(&query.title);
    let q = format!("{} {}", clean_title, query.first_artist);
    let search = http
        .get_json(
            "https://api.deezer.com/search",
            &[("q", Some(&q)), ("limit", Some("10"))],
            &[],
            10,
        )
        .await
        .ok()?;
    let candidates: Vec<TrackCandidate<i64>> = search
        .get("data")
        .array()
        .into_iter()
        .filter_map(|track| {
            let id = track.get("id").int()?;
            Some(TrackCandidate {
                titles: vec![
                    track.get("title").string().unwrap_or_default(),
                    track.get("title_short").string().unwrap_or_default(),
                ],
                artists: vec![track.get("artist").get("name").string().unwrap_or_default()],
                duration_sec: track.get("duration").int().unwrap_or(0),
                r#ref: id,
            })
        })
        .collect();
    let track_id = best_match(&candidates, &clean_title, &query.artist, query.duration)?;
    let graphql = format!(
        "query {{ track(trackId: \"{}\") {{ lyrics {{ text synchronizedLines {{ milliseconds line }} synchronizedWordByWordLines {{ start words {{ start end word }} }} }} }} }}",
        track_id
    );
    let token = http.deezer_jwt().await.ok()?;
    let auth = format!("Bearer {}", token);
    let response = match http
        .post_json(
            "https://pipe.deezer.com/api",
            &json!({ "query": graphql }),
            &[("Authorization", &auth)],
        )
        .await
    {
        Ok(r) => r,
        Err(_) => {
            http.forget_deezer_jwt().await;
            return None;
        }
    };

    let lyrics = response.get("data").get("track").get("lyrics");
    let mut lines: Vec<TimedLine> = lyrics
        .get("synchronizedWordByWordLines")
        .array()
        .into_iter()
        .map(|line| {
            let words: Vec<(String, i64, i64)> = line
                .get("words")
                .array()
                .into_iter()
                .map(|w| {
                    (
                        w.get("word").string().unwrap_or_default(),
                        w.get("start").int().unwrap_or(0),
                        w.get("end").int().unwrap_or(0),
                    )
                })
                .collect();
            let text = join_deezer_words(&words);
            TimedLine {
                start_ms: line.get("start").int().unwrap_or(0),
                text,
                words,
            }
        })
        .collect();

    if lines.is_empty() {
        lines = lyrics
            .get("synchronizedLines")
            .array()
            .into_iter()
            .map(|l| TimedLine {
                start_ms: l.get("milliseconds").int().unwrap_or(0),
                text: l.get("line").string().unwrap_or_default().trim().to_string(),
                words: Vec::new(),
            })
            .collect();
    }

    if TimedLine::has_lyrics(&lines) {
        return Some(TimedLine::to_lrc(&lines));
    }
    lyrics
        .get("text")
        .string()
        .map(|s| s.replace("\r\n", "\n"))
        .filter(|s| !s.trim().is_empty())
}

fn join_deezer_words(words: &[(String, i64, i64)]) -> String {
    let mut out = String::new();
    for (w, _, _) in words {
        let word = w.trim();
        let Some(first) = word.chars().next() else {
            continue;
        };
        let attached = ",.!?;:)]}…".contains(first)
            || (out
                .chars()
                .next_back()
                .map(Script::is_char_unspaced)
                .unwrap_or(false)
                && Script::is_char_unspaced(first));
        if !out.is_empty() && !attached {
            out.push(' ');
        }
        out.push_str(word);
    }
    out
}

// 7. NetEase
pub async fn netease_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    let clean_title = LyricsMatch::clean_title(&query.title);
    let s = format!("{} {}", clean_title, query.first_artist);
    let search = http
        .get_json(
            "https://music.163.com/api/search/get",
            &[
                ("s", Some(&s)),
                ("type", Some("1")),
                ("limit", Some("10")),
            ],
            &[],
            10,
        )
        .await
        .ok()?;
    let candidates: Vec<TrackCandidate<i64>> = search
        .get("result")
        .get("songs")
        .array()
        .into_iter()
        .filter_map(|song| {
            let id = song.get("id").int()?;
            let mut titles = vec![song.get("name").string().unwrap_or_default()];
            titles.extend(song.get("alias").array().into_iter().filter_map(|a| a.string()));
            let artists = song
                .get("artists")
                .array()
                .into_iter()
                .filter_map(|a| a.get("name").string())
                .collect();
            Some(TrackCandidate {
                titles,
                artists,
                duration_sec: song.get("duration").int().unwrap_or(0) / 1000,
                r#ref: id,
            })
        })
        .collect();
    let song_id = best_match(&candidates, &clean_title, &query.artist, query.duration)?;
    let id_str = song_id.to_string();
    let response = http
        .get_json(
            "https://music.163.com/api/song/lyric",
            &[
                ("id", Some(&id_str)),
                ("lv", Some("1")),
                ("yv", Some("1")),
            ],
            &[],
            10,
        )
        .await
        .ok()?;
    let mut lines = response
        .get("yrc")
        .get("lyric")
        .string()
        .map(|y| parse_yrc(&y))
        .unwrap_or_default();
    if lines.is_empty() {
        lines = response
            .get("lrc")
            .get("lyric")
            .string()
            .map(|l| parse_lrc_lines(&l))
            .unwrap_or_default();
    }
    let clean = TimedLine::without_credits(&lines);
    if TimedLine::has_lyrics(&clean) {
        Some(TimedLine::to_lrc(&clean))
    } else {
        None
    }
}

fn parse_yrc(yrc: &str) -> Vec<TimedLine> {
    let line_re = Regex::new(r"^\[(\d+),\d+\](.*)$").unwrap();
    let word_re = Regex::new(r"\((\d+),(\d+),-?\d+\)([^\(]*)").unwrap();
    yrc.lines()
        .filter_map(|raw| {
            let row = raw.trim();
            let caps = line_re.captures(row)?;
            let start = caps.get(1)?.as_str().parse::<i64>().unwrap_or(0);
            let body = caps.get(2)?.as_str();
            let words: Vec<(String, i64, i64)> = word_re
                .captures_iter(body)
                .filter_map(|wc| {
                    let ws = wc.get(1)?.as_str().parse::<i64>().unwrap_or(0);
                    let wl = wc.get(2)?.as_str().parse::<i64>().unwrap_or(0);
                    let wt = wc.get(3)?.as_str().to_string();
                    Some((wt, ws, ws + wl))
                })
                .collect();
            let text: String = words.iter().map(|(t, _, _)| t.as_str()).collect::<String>();
            Some(TimedLine {
                start_ms: start,
                text: text.trim().to_string(),
                words,
            })
        })
        .collect()
}

// 8. QQMusic
pub async fn qqmusic_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    let clean_title = LyricsMatch::clean_title(&query.title);
    let q = format!("{} {}", clean_title, query.first_artist);
    let search = http
        .post_json(
            "https://u.y.qq.com/cgi-bin/musicu.fcg",
            &json!({
                "req": {
                    "module": "music.search.SearchCgiService",
                    "method": "DoSearchForQQMusicDesktop",
                    "param": {
                        "query": q,
                        "num_per_page": 10,
                        "page_num": 1,
                        "search_type": 0
                    }
                }
            }),
            &[],
        )
        .await
        .ok()?;
    let candidates: Vec<TrackCandidate<(i64, String)>> = search
        .get("req")
        .get("data")
        .get("body")
        .get("song")
        .get("list")
        .array()
        .into_iter()
        .filter_map(|song| {
            let id = song.get("id").int()?;
            let mid = song.get("mid").string()?;
            Some(TrackCandidate {
                titles: vec![song.get("name").string().unwrap_or_default()],
                artists: song
                    .get("singer")
                    .array()
                    .into_iter()
                    .filter_map(|s| s.get("name").string())
                    .collect(),
                duration_sec: song.get("interval").int().unwrap_or(0),
                r#ref: (id, mid),
            })
        })
        .collect();
    let (id, mid) = best_match(&candidates, &clean_title, &query.artist, query.duration)?;
    let response = http
        .post_json(
            "https://u.y.qq.com/cgi-bin/musicu.fcg",
            &json!({
                "req": {
                    "module": "music.musichallSong.PlayLyricInfo",
                    "method": "GetPlayLyricInfo",
                    "param": {
                        "songMID": mid,
                        "songID": id
                    }
                }
            }),
            &[],
        )
        .await
        .ok()?;
    let encoded = response.get("req").get("data").get("lyric").string()?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded.trim())
        .ok()?;
    let lrc = String::from_utf8(bytes).ok()?;
    let lines = TimedLine::without_credits(&parse_lrc_lines(&lrc));
    if TimedLine::has_lyrics(&lines) {
        Some(TimedLine::to_lrc(&lines))
    } else {
        None
    }
}

// 9. KuGou
pub async fn kugou_lyrics(http: &LyricsHTTP, query: &LyricsQuery) -> Option<String> {
    let title = LyricsMatch::clean_title(&query.title);
    let artist = query
        .artist
        .replace(", ", "、")
        .replace(" & ", "、")
        .replace('.', "");
    let mut keyword = format!("{} - {}", title, artist);
    if let Some(ref alb) = query.album {
        if !alb.is_empty() {
            keyword.push(' ');
            keyword.push_str(alb);
        }
    }

    if let Ok(songs) = http
        .get_json(
            "https://mobileservice.kugou.com/api/v3/search/song",
            &[
                ("version", Some("9108")),
                ("plat", Some("0")),
                ("pagesize", Some("8")),
                ("showtype", Some("0")),
                ("keyword", Some(&keyword)),
            ],
            &[],
            10,
        )
        .await
    {
        for song in songs.get("data").get("info").array() {
            let Some(hash) = song.get("hash").string() else {
                continue;
            };
            if query.duration > 0
                && (song.get("duration").int().unwrap_or(0) - query.duration).abs() > 8
            {
                continue;
            }
            if let Some((id, key)) = kugou_search_lyrics(http, &[("hash", Some(&hash))]).await {
                if let Some(lrc) = kugou_download(http, &id, &key).await {
                    return Some(lrc);
                }
            }
        }
    }

    let dur_ms = if query.duration > 0 {
        Some((query.duration * 1000).to_string())
    } else {
        None
    };
    let (id, key) = kugou_search_lyrics(
        http,
        &[
            ("keyword", Some(&keyword)),
            ("duration", dur_ms.as_deref()),
        ],
    )
    .await?;
    kugou_download(http, &id, &key).await
}

async fn kugou_search_lyrics(
    http: &LyricsHTTP,
    extra: &[(&str, Option<&str>)],
) -> Option<(String, String)> {
    let mut params = vec![
        ("ver", Some("1")),
        ("man", Some("yes")),
        ("client", Some("pc")),
    ];
    params.extend_from_slice(extra);
    let json = http
        .get_json("https://lyrics.kugou.com/search", &params, &[], 10)
        .await
        .ok()?;
    let cand = json.get("candidates").array().into_iter().next()?;
    let id = cand
        .get("id")
        .string()
        .or_else(|| cand.get("id").int().map(|v| v.to_string()))?;
    let key = cand.get("accesskey").string()?;
    Some((id, key))
}

async fn kugou_download(http: &LyricsHTTP, id: &str, key: &str) -> Option<String> {
    let json = http
        .get_json(
            "https://lyrics.kugou.com/download",
            &[
                ("fmt", Some("lrc")),
                ("charset", Some("utf8")),
                ("client", Some("pc")),
                ("ver", Some("1")),
                ("id", Some(id)),
                ("accesskey", Some(key)),
            ],
            &[],
            10,
        )
        .await
        .ok()?;
    let content = json.get("content").string()?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content.trim())
        .ok()?;
    let lrc = String::from_utf8(bytes).ok()?;
    let lines = TimedLine::without_credits(&parse_lrc_lines(&lrc));
    if TimedLine::has_lyrics(&lines) {
        Some(TimedLine::to_lrc(&lines))
    } else {
        None
    }
}
