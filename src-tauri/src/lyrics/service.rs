use crate::lyrics::models::{
    Lyrics, LyricsCandidate, LyricsOutcome, LyricsProvider, LyricsQuery, LyricsSync, Script,
};
use crate::lyrics::parser::LyricsParser;
use crate::lyrics::providers::{self, LyricsHTTP};
use crate::youtube::innertube::InnerTube;
use crate::youtube::models::WatchEndpoint;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};

pub struct LyricsService {
    http: Arc<LyricsHTTP>,
    innertube: Arc<InnerTube>,
    cache: RwLock<HashMap<String, LyricsOutcome>>,
    chosen: RwLock<HashMap<String, Lyrics>>,
}

impl LyricsService {
    pub fn new(innertube: Arc<InnerTube>) -> Arc<Self> {
        Arc::new(Self {
            http: LyricsHTTP::new(),
            innertube,
            cache: RwLock::new(HashMap::new()),
            chosen: RwLock::new(HashMap::new()),
        })
    }

    pub async fn lyrics(
        &self,
        query: LyricsQuery,
        ordered_enabled: &[LyricsProvider],
    ) -> LyricsOutcome {
        if let Some(picked) = self.chosen.read().await.get(&query.video_id).cloned() {
            let candidates = self
                .cache
                .read()
                .await
                .get(&query.video_id)
                .map(|c| c.candidates.clone())
                .unwrap_or_default();
            return LyricsOutcome {
                best: Some(picked),
                candidates,
            };
        }

        if let Some(cached) = self.cache.read().await.get(&query.video_id).cloned() {
            return cached;
        }

        let regular: Vec<LyricsProvider> = ordered_enabled
            .iter()
            .copied()
            .filter(|&p| p != LyricsProvider::YouTubeCaptions)
            .collect();
        let mut candidates = self
            .collect(&query, &regular, ordered_enabled, true)
            .await;
        let mut best = Self::pick_best(&candidates, &query, ordered_enabled.len());

        if best.is_none() && ordered_enabled.contains(&LyricsProvider::YouTubeCaptions) {
            let cap = self
                .collect(
                    &query,
                    &[LyricsProvider::YouTubeCaptions],
                    ordered_enabled,
                    false,
                )
                .await;
            candidates.extend(cap);
            best = Self::pick_best(&candidates, &query, ordered_enabled.len());
        }

        let outcome = LyricsOutcome {
            best: best.map(|b| b.lyrics),
            candidates,
        };
        if outcome.best.as_ref().map(|b| b.is_synced).unwrap_or(false) {
            self.cache
                .write()
                .await
                .insert(query.video_id.clone(), outcome.clone());
        }
        outcome
    }

    pub async fn all_candidates(
        &self,
        query: LyricsQuery,
        ordered_enabled: &[LyricsProvider],
    ) -> Vec<LyricsCandidate> {
        let candidates = self
            .collect(&query, ordered_enabled, ordered_enabled, false)
            .await;
        let mut cache = self.cache.write().await;
        if let Some(existing) = cache.get_mut(&query.video_id) {
            existing.candidates = candidates.clone();
        }
        candidates
    }

    pub async fn choose(&self, lyrics: Lyrics, video_id: &str) {
        self.chosen
            .write()
            .await
            .insert(video_id.to_string(), lyrics);
    }

    pub async fn forget(&self, video_id: &str) {
        self.cache.write().await.remove(video_id);
        self.chosen.write().await.remove(video_id);
    }

    pub async fn cache_len(&self) -> usize {
        self.cache.read().await.len()
    }

    pub async fn clear_cache(&self) -> usize {
        let mut cache = self.cache.write().await;
        let n = cache.len();
        cache.clear();
        n
    }

    async fn collect(
        &self,
        query: &LyricsQuery,
        providers: &[LyricsProvider],
        full_order: &[LyricsProvider],
        settle_early: bool,
    ) -> Vec<LyricsCandidate> {
        if providers.is_empty() {
            return Vec::new();
        }
        let (tx, mut rx) = mpsc::unbounded_channel::<Option<LyricsCandidate>>();
        let mut handles = Vec::new();

        for &provider in providers {
            let rank = full_order
                .iter()
                .position(|&p| p == provider)
                .unwrap_or(full_order.len());
            let q = query.clone();
            let http = self.http.clone();
            let it = self.innertube.clone();
            let tx_clone = tx.clone();
            handles.push(tokio::spawn(async move {
                let res = Self::ask(provider, &q, rank, &http, &it).await;
                let _ = tx_clone.send(res);
            }));
        }
        drop(tx);

        let mut found = Vec::new();
        let mut pending = providers.len();
        let deadline = tokio::time::sleep(Duration::from_secs(if settle_early { 9 } else { 14 }));
        tokio::pin!(deadline);

        let mut settle_timer: Option<std::pin::Pin<Box<tokio::time::Sleep>>> = None;

        loop {
            tokio::select! {
                _ = &mut deadline => {
                    break;
                }
                _ = async {
                    if let Some(ref mut timer) = settle_timer {
                        timer.as_mut().await;
                    } else {
                        std::future::pending::<()>().await;
                    }
                } => {
                    break;
                }
                maybe_msg = rx.recv() => {
                    let Some(candidate_opt) = maybe_msg else {
                        break;
                    };
                    pending = pending.saturating_sub(1);
                    if let Some(candidate) = candidate_opt {
                        let is_good_word = candidate.lyrics.sync == LyricsSync::Word && !candidate.provider.is_chinese();
                        found.push(candidate);
                        if settle_early && settle_timer.is_none() {
                            if is_good_word {
                                settle_timer = Some(Box::pin(tokio::time::sleep(Duration::from_millis(1500))));
                            } else if found.len() == 1 {
                                settle_timer = Some(Box::pin(tokio::time::sleep(Duration::from_secs(4))));
                            }
                        }
                    }
                    if pending == 0 {
                        break;
                    }
                }
            }
        }

        for h in handles {
            h.abort();
        }

        found
    }

    async fn ask(
        provider: LyricsProvider,
        query: &LyricsQuery,
        order: usize,
        http: &Arc<LyricsHTTP>,
        innertube: &Arc<InnerTube>,
    ) -> Option<LyricsCandidate> {
        let raw = match provider {
            LyricsProvider::BetterLyrics => providers::better_lyrics(http, query).await,
            LyricsProvider::YouLyPlus => providers::youlyplus_lyrics(http, query).await,
            LyricsProvider::Paxsenix => providers::paxsenix_lyrics(http, query).await,
            LyricsProvider::SimpMusic => providers::simpmusic_lyrics(http, query).await,
            LyricsProvider::LrcLib => providers::lrclib_lyrics(http, query).await,
            LyricsProvider::Deezer => providers::deezer_lyrics(http, query).await,
            LyricsProvider::YouTubeSubtitle => innertube
                .subtitle_lyrics(&query.video_id)
                .await
                .ok()
                .flatten(),
            LyricsProvider::YouTubeMusic => {
                let mut browse_id = query.lyrics_browse_id.clone();
                if browse_id.is_none() {
                    browse_id = innertube
                        .next(
                            WatchEndpoint {
                                video_id: Some(query.video_id.clone()),
                                playlist_id: None,
                                params: None,
                                index: None,
                            },
                            None,
                        )
                        .await
                        .ok()
                        .and_then(|n| n.lyrics_browse_id);
                }
                if let Some(bid) = browse_id {
                    innertube
                        .lyrics(&bid)
                        .await
                        .ok()
                        .flatten()
                        .filter(|s| !s.trim().is_empty())
                } else {
                    None
                }
            }
            LyricsProvider::NetEase => providers::netease_lyrics(http, query).await,
            LyricsProvider::QQMusic => providers::qqmusic_lyrics(http, query).await,
            LyricsProvider::Kugou => providers::kugou_lyrics(http, query).await,
            LyricsProvider::YouTubeCaptions => innertube
                .caption_lyrics(&query.video_id, false)
                .await
                .ok()
                .flatten(),
        }?;

        if raw.trim().is_empty() {
            return None;
        }
        let lyrics = LyricsParser::parse(&raw, provider)?;
        if lyrics.lines.is_empty() {
            return None;
        }
        let sample_text: String = lyrics
            .lines
            .iter()
            .take(40)
            .map(|l| l.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        if !sample_text.chars().any(|c| c.is_alphabetic()) {
            return None;
        }
        let script = Script::dominant(&sample_text);
        Some(LyricsCandidate {
            id: provider.as_str().to_string(),
            provider,
            provider_name: provider.display_name().to_string(),
            lyrics,
            order,
            script,
        })
    }

    pub fn pick_best(
        candidates: &[LyricsCandidate],
        query: &LyricsQuery,
        provider_count: usize,
    ) -> Option<LyricsCandidate> {
        if candidates.is_empty() {
            return None;
        }
        let meta_joined = format!(
            "{} {} {}",
            query.title,
            query.artist,
            query.album.as_deref().unwrap_or("")
        );
        let metadata = Script::dominant(&meta_joined);
        let mut reference: Option<Script> = if metadata.is_native() {
            Some(metadata)
        } else {
            candidates
                .iter()
                .find(|c| c.provider.is_language_reference() && c.script.is_native())
                .map(|c| c.script)
        };
        if reference == Some(Script::Han) && candidates.iter().any(|c| c.script == Script::Kana) {
            reference = Some(Script::Kana);
        }

        let regular: Vec<&LyricsCandidate> = candidates
            .iter()
            .filter(|c| !c.provider.is_chinese() && c.provider != LyricsProvider::YouTubeCaptions)
            .collect();
        let reg_scripts: Vec<Script> = regular.iter().map(|c| c.script).collect();
        let chinese_song = reference == Some(Script::Han)
            || (reference.is_none()
                && Self::majority(&reg_scripts, 1) == Some(Script::Han)
                && !candidates.iter().any(|c| c.script == Script::Kana));
        let song_script = reference.or_else(|| Self::majority(&reg_scripts, 1));

        let mut pool = regular;
        if chinese_song {
            pool.extend(candidates.iter().filter(|c| c.provider.is_chinese()));
        } else {
            pool.extend(candidates.iter().filter(|c| {
                c.provider.is_chinese()
                    && c.lyrics.sync == LyricsSync::Word
                    && (song_script.is_none() || Some(c.script) == song_script)
            }));
        }
        if pool.is_empty() {
            pool = candidates
                .iter()
                .filter(|c| {
                    c.provider.is_chinese()
                        && (song_script.is_none()
                            || Some(c.script) == song_script
                            || !c.script.is_native())
                })
                .collect();
        }
        if pool.is_empty() {
            pool = candidates
                .iter()
                .filter(|c| c.provider == LyricsProvider::YouTubeCaptions)
                .collect();
        }
        if pool.is_empty() {
            return None;
        }

        let pool_scripts: Vec<Script> = pool.iter().map(|c| c.script).collect();
        let majority_script = if reference.is_none() {
            Self::majority(&pool_scripts, 2)
        } else {
            None
        };
        let mut trusted_native: HashSet<Script> = HashSet::new();
        if reference.is_none() && majority_script.is_none() {
            let mut counts: HashMap<Script, usize> = HashMap::new();
            for &s in &pool_scripts {
                if s.is_native() {
                    *counts.entry(s).or_insert(0) += 1;
                }
            }
            for (s, cnt) in counts {
                if cnt >= 2 || s == Script::Kana || s == Script::Hangul {
                    trusted_native.insert(s);
                }
            }
        }

        let score = |candidate: &LyricsCandidate| -> i64 {
            let script_score: i64 = if let Some(ref_script) = reference {
                let same_family = (candidate.script == Script::Han && ref_script == Script::Kana)
                    || (candidate.script == Script::Kana && ref_script == Script::Han);
                if candidate.script == ref_script {
                    3
                } else if same_family {
                    2
                } else if candidate.script == Script::Unknown {
                    1
                } else {
                    0
                }
            } else if let Some(maj) = majority_script {
                if candidate.script == maj {
                    3
                } else if candidate.script == Script::Unknown {
                    1
                } else {
                    0
                }
            } else if !trusted_native.is_empty() {
                if trusted_native.contains(&candidate.script) {
                    2
                } else if candidate.script == Script::Unknown {
                    1
                } else {
                    0
                }
            } else if candidate.script.is_native() {
                0
            } else {
                1
            };

            let sync_score = candidate.lyrics.sync.raw_value() as i64;
            let duet_score: i64 = if candidate.lyrics.has_duet {
                2
            } else if candidate.lyrics.has_voice_tags {
                1
            } else {
                0
            };
            let order_score: i64 = if chinese_song && candidate.provider.is_chinese() {
                (provider_count * 2).saturating_sub(candidate.order) as i64
            } else {
                provider_count.saturating_sub(candidate.order) as i64
            };
            script_score * 10_000 + sync_score * 1000 + duet_score * 100 + order_score
        };

        pool.into_iter().max_by_key(|c| score(c)).cloned()
    }

    fn majority(scripts: &[Script], min_votes: usize) -> Option<Script> {
        let mut counts: HashMap<Script, usize> = HashMap::new();
        for &s in scripts {
            if s != Script::Unknown {
                *counts.entry(s).or_insert(0) += 1;
            }
        }
        let mut ranked: Vec<(Script, usize)> = counts.into_iter().collect();
        ranked.sort_by(|a, b| b.1.cmp(&a.1));
        let &(top_script, top_val) = ranked.first()?;
        let runner_up = ranked.get(1).map(|r| r.1).unwrap_or(0);
        if top_val >= min_votes && top_val > runner_up {
            Some(top_script)
        } else {
            None
        }
    }
}
