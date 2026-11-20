// a phone's library as it sends it (its whole room database, gzipped) read into this app's own terms,
// and this app's changes written as the rows that database takes

use crate::library::{JournalEntry, RemoteLibrary};
use crate::youtube::models::{AlbumRef, ArtistRef, SongItem};
use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::Path;

pub fn gunzip(bytes: &[u8]) -> std::io::Result<Vec<u8>> {
    let mut out = Vec::new();
    flate2::read::GzDecoder::new(bytes).read_to_end(&mut out)?;
    Ok(out)
}

fn web_url(url: Option<String>) -> String {
    url.filter(|u| u.starts_with("http://") || u.starts_with("https://")).unwrap_or_default()
}

// only youtube's own ids open a page here; a phone's made-up artist and album ids don't
fn channel_id(id: String) -> Option<String> {
    (id.starts_with("UC") || id.starts_with("MPLA")).then_some(id)
}

// reads what the desktop shows from a phone's library: every song (for its files), likes, playlists and recent plays
pub fn read(path: &Path, device_id: &str, events_since: i64) -> rusqlite::Result<RemoteLibrary> {
    let db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
    let mut remote = RemoteLibrary::default();

    let mut artists: HashMap<String, Vec<ArtistRef>> = HashMap::new();
    if let Ok(mut stmt) = db.prepare(
        "SELECT m.songId, a.id, a.name FROM song_artist_map m JOIN artist a ON a.id = m.artistId ORDER BY m.songId, m.position",
    ) {
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)))?;
        for (song, id, name) in rows.flatten() {
            artists.entry(song).or_default().push(ArtistRef { name, id: channel_id(id) });
        }
    }

    let mut stmt = db.prepare(
        "SELECT id, title, duration, thumbnailUrl, albumId, albumName, explicit, liked, likedDate, isLocal FROM song",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<i64>>(2)?,
            r.get::<_, Option<String>>(3)?,
            r.get::<_, Option<String>>(4)?,
            r.get::<_, Option<String>>(5)?,
            r.get::<_, Option<i64>>(6)?,
            r.get::<_, Option<i64>>(7)?,
            r.get::<_, Option<i64>>(8)?,
            r.get::<_, Option<i64>>(9)?,
        ))
    })?;
    for (id, title, duration, thumb, album_id, album_name, explicit, liked, liked_date, is_local) in rows.flatten() {
        // a song that only exists as a file on the phone can only ever play from the phone
        let phone_only = is_local.unwrap_or(0) != 0 || id.starts_with("LOCAL_");
        let song = SongItem {
            id: id.clone(),
            title,
            artists: artists.remove(&id).unwrap_or_default(),
            album: match (album_id, album_name) {
                (Some(aid), Some(name)) if aid.starts_with("MPRE") => Some(AlbumRef { name, id: aid }),
                (_, Some(name)) if !name.is_empty() => Some(AlbumRef { name, id: String::new() }),
                _ => None,
            },
            duration: duration.filter(|d| *d > 0),
            thumbnail: web_url(thumb),
            explicit: explicit.unwrap_or(0) != 0,
            music_video_type: None,
            source: phone_only.then(|| format!("link:{}", device_id)),
        };
        if liked.unwrap_or(0) != 0 {
            remote.liked.push((id.clone(), liked_date.unwrap_or(0)));
        }
        remote.known.insert(id.clone());
        remote.songs.insert(id, song);
    }
    drop(stmt);

    let mut names: Vec<(String, String)> = Vec::new();
    if let Ok(mut stmt) = db.prepare("SELECT id, name FROM playlist ORDER BY name") {
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        names.extend(rows.flatten());
    }
    let mut members: HashMap<String, Vec<String>> = HashMap::new();
    if let Ok(mut stmt) = db.prepare("SELECT playlistId, songId FROM playlist_song_map ORDER BY playlistId, position") {
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for (pid, sid) in rows.flatten() {
            members.entry(pid).or_default().push(sid);
        }
    }
    for (pid, name) in names {
        if let Some(ids) = members.remove(&pid) {
            remote.playlists.push((pid, name, ids));
        }
    }

    if let Ok(mut stmt) = db.prepare("SELECT songId, timestamp FROM event WHERE timestamp > ?1 ORDER BY timestamp DESC LIMIT 20000") {
        let rows = stmt.query_map([events_since], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
        remote.events.extend(rows.flatten());
    }
    Ok(remote)
}

// another computer's library, sent as plain json
pub fn read_json(value: &Value, device_id: &str) -> RemoteLibrary {
    let mut remote = RemoteLibrary::default();
    if let Some(songs) = value.get("songs").and_then(|s| s.as_array()) {
        for s in songs {
            if let Ok(mut song) = serde_json::from_value::<SongItem>(s.clone()) {
                if song.source.as_deref() == Some("local") {
                    song.source = Some(format!("link:{}", device_id));
                }
                remote.known.insert(song.id.clone());
                remote.songs.insert(song.id.clone(), song);
            }
        }
    }
    for l in value.get("liked").and_then(|v| v.as_array()).into_iter().flatten() {
        if let Some(id) = l.get("id").and_then(|v| v.as_str()) {
            remote.liked.push((id.to_string(), l.get("at").and_then(|v| v.as_i64()).unwrap_or(0)));
        }
    }
    for p in value.get("playlists").and_then(|v| v.as_array()).into_iter().flatten() {
        let ids: Vec<String> = p
            .get("songIds")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect())
            .unwrap_or_default();
        if let (Some(id), Some(name)) = (p.get("id").and_then(|v| v.as_str()), p.get("name").and_then(|v| v.as_str())) {
            remote.playlists.push((id.to_string(), name.to_string(), ids));
        }
    }
    for e in value.get("events").and_then(|v| v.as_array()).into_iter().flatten() {
        if let (Some(id), Some(at)) = (e.get("songId").and_then(|v| v.as_str()), e.get("at").and_then(|v| v.as_i64())) {
            remote.events.push((id.to_string(), at));
        }
    }
    remote
}

// an artist with no youtube id gets one made from its name, the way the phone makes its own
fn artist_row_id(artist: &ArtistRef) -> String {
    if let Some(id) = &artist.id {
        return id.clone();
    }
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in artist.name.to_lowercase().as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("LA{:014x}", hash & 0x00ff_ffff_ffff_ffff)
}

// the journal as the phone's /changes takes it: rows for songs it may not know, then plays, likes and unlikes
pub fn changes_body(entries: &[JournalEntry], songs: &[(SongItem, Option<i64>)], extra_likes: &[(SongItem, i64)]) -> Value {
    let now = chrono::Utc::now().timestamp_millis();
    let mut song_rows = Vec::new();
    let mut artist_rows = Vec::new();
    let mut map_rows = Vec::new();
    let mut seen_artists = HashSet::new();
    let mut add_song = |song: &SongItem, liked_at: Option<i64>| {
        // a song that lives on another device is already there or can't be made there
        if song.source.is_some() {
            return;
        }
        song_rows.push(json!({
            "id": song.id,
            "title": song.title,
            "duration": song.duration.unwrap_or(-1),
            "thumbnailUrl": if song.thumbnail.is_empty() { Value::Null } else { Value::String(song.thumbnail.clone()) },
            "albumId": song.album.as_ref().filter(|a| !a.id.is_empty()).map(|a| a.id.clone()),
            "albumName": song.album.as_ref().map(|a| a.name.clone()),
            "explicit": song.explicit as i64,
            "liked": liked_at.is_some() as i64,
            "likedDate": liked_at,
            "totalPlayTime": 0,
        }));
        for (position, artist) in song.artists.iter().enumerate() {
            let id = artist_row_id(artist);
            if seen_artists.insert(id.clone()) {
                artist_rows.push(json!({ "id": id, "name": artist.name, "lastUpdateTime": now, "isLocal": artist.id.is_none() as i64 }));
            }
            map_rows.push(json!({ "songId": song.id, "artistId": id, "position": position }));
        }
    };
    for (song, liked_at) in songs {
        add_song(song, *liked_at);
    }
    for (song, at) in extra_likes {
        add_song(song, Some(*at));
    }

    // the last word on each song decides whether it's liked or not
    let mut verdict: HashMap<&str, bool> = HashMap::new();
    let mut plays = Vec::new();
    for e in entries {
        match e.kind.as_str() {
            "like" => {
                verdict.insert(e.song_id.as_str(), true);
            }
            "unlike" => {
                verdict.insert(e.song_id.as_str(), false);
            }
            "play" => plays.push(json!({ "songId": e.song_id, "timestamp": e.at, "playTime": e.play_time })),
            _ => {}
        }
    }
    let mut liked: Vec<&str> = verdict.iter().filter(|(_, v)| **v).map(|(k, _)| *k).collect();
    liked.extend(extra_likes.iter().map(|(s, _)| s.id.as_str()));
    liked.sort();
    liked.dedup();
    let unliked: Vec<&str> = verdict.iter().filter(|(_, v)| !**v).map(|(k, _)| *k).collect();

    json!({
        "rows": { "song": song_rows, "artist": artist_rows, "song_artist_map": map_rows },
        "plays": plays,
        "liked": liked,
        "unliked": unliked,
        "added": [],
        "removed": [],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn song(id: &str) -> SongItem {
        SongItem {
            id: id.into(),
            title: format!("Song {id}"),
            artists: vec![ArtistRef { name: "A".into(), id: Some("UCx".into()) }, ArtistRef { name: "B".into(), id: None }],
            album: None,
            duration: Some(200),
            thumbnail: "https://x/y.jpg".into(),
            explicit: false,
            music_video_type: None,
            source: None,
        }
    }

    #[test]
    fn last_word_wins_and_rows_follow() {
        let entries = vec![
            JournalEntry { seq: 1, kind: "like".into(), song_id: "a".into(), at: 1, play_time: 0 },
            JournalEntry { seq: 2, kind: "like".into(), song_id: "b".into(), at: 2, play_time: 0 },
            JournalEntry { seq: 3, kind: "unlike".into(), song_id: "b".into(), at: 3, play_time: 0 },
            JournalEntry { seq: 4, kind: "play".into(), song_id: "a".into(), at: 4, play_time: 200_000 },
        ];
        let body = changes_body(&entries, &[(song("a"), Some(1)), (song("b"), None)], &[]);
        assert_eq!(body["liked"], json!(["a"]));
        assert_eq!(body["unliked"], json!(["b"]));
        assert_eq!(body["plays"][0]["playTime"], json!(200_000));
        assert_eq!(body["rows"]["song"].as_array().unwrap().len(), 2);
        // one row per artist, however many songs share it
        assert_eq!(body["rows"]["artist"].as_array().unwrap().len(), 2);
        assert_eq!(body["rows"]["song_artist_map"].as_array().unwrap().len(), 4);
        assert!(body["rows"]["artist"][1]["id"].as_str().unwrap().starts_with("LA"));
    }

    #[test]
    fn reads_a_phone_database() {
        let dir = std::env::temp_dir().join(format!("mochy-snap-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("lib.db");
        let _ = std::fs::remove_file(&path);
        let db = Connection::open(&path).unwrap();
        db.execute_batch(
            "CREATE TABLE song (id TEXT PRIMARY KEY, title TEXT NOT NULL, duration INTEGER NOT NULL, thumbnailUrl TEXT, albumId TEXT, albumName TEXT,
               explicit INTEGER NOT NULL DEFAULT 0, liked INTEGER NOT NULL, likedDate INTEGER, totalPlayTime INTEGER NOT NULL, isLocal INTEGER NOT NULL DEFAULT 0);
             CREATE TABLE artist (id TEXT PRIMARY KEY, name TEXT NOT NULL);
             CREATE TABLE song_artist_map (songId TEXT, artistId TEXT, position INTEGER);
             CREATE TABLE playlist (id TEXT PRIMARY KEY, name TEXT NOT NULL);
             CREATE TABLE playlist_song_map (id INTEGER PRIMARY KEY, playlistId TEXT, songId TEXT, position INTEGER);
             CREATE TABLE event (id INTEGER PRIMARY KEY, songId TEXT, timestamp INTEGER, playTime INTEGER);
             INSERT INTO song VALUES ('yt1','One',180,'https://i/1.jpg','MPREb1','Album',0,1,1000,0,0);
             INSERT INTO song VALUES ('LOCAL_9','Flac Song',240,'content://x',NULL,NULL,0,0,NULL,0,1);
             INSERT INTO artist VALUES ('UCa','Artist A');
             INSERT INTO song_artist_map VALUES ('yt1','UCa',0);
             INSERT INTO playlist VALUES ('p1','Road');
             INSERT INTO playlist_song_map VALUES (1,'p1','LOCAL_9',0);
             INSERT INTO event VALUES (1,'yt1',5000,1000);",
        )
        .unwrap();
        drop(db);
        let remote = read(&path, "dev", 0).unwrap();
        assert_eq!(remote.liked, vec![("yt1".to_string(), 1000)]);
        assert_eq!(remote.songs["yt1"].artists[0].id.as_deref(), Some("UCa"));
        assert_eq!(remote.songs["LOCAL_9"].source.as_deref(), Some("link:dev"));
        assert_eq!(remote.songs["LOCAL_9"].thumbnail, "");
        assert_eq!(remote.playlists, vec![("p1".to_string(), "Road".to_string(), vec!["LOCAL_9".to_string()])]);
        assert_eq!(remote.events, vec![("yt1".to_string(), 5000)]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
