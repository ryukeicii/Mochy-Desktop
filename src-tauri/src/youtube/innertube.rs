use crate::youtube::client::YouTubeClient;
use crate::youtube::json::Json;
use crate::youtube::models::*;
use crate::youtube::proxy;
use crate::youtube::renderers;
use base64::Engine;
use regex::Regex;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

pub struct InnerTube {
    pub http: Client,
    pub stream_http: Client,
    visitor_data: RwLock<Option<String>>,
    stream_cache: RwLock<HashMap<String, StreamInfo>>,
    proxy_port: RwLock<u16>,
}

impl InnerTube {
    pub fn new() -> Arc<Self> {
        let http = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
        let stream_http = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .read_timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create stream HTTP client");
        Arc::new(Self {
            http,
            stream_http,
            visitor_data: RwLock::new(None),
            stream_cache: RwLock::new(HashMap::new()),
            proxy_port: RwLock::new(0),
        })
    }

    pub async fn set_proxy_port(&self, port: u16) {
        *self.proxy_port.write().await = port;
    }

    pub async fn get_proxy_port(&self) -> u16 {
        *self.proxy_port.read().await
    }

    pub async fn ensure_visitor_data(&self) -> Option<String> {
        if let Some(existing) = self.visitor_data.read().await.clone() {
            return Some(existing);
        }
        let fetched = self.fetch_visitor_data().await;
        if let Some(ref val) = fetched {
            *self.visitor_data.write().await = Some(val.clone());
        }
        fetched
    }

    pub async fn reset_visitor_data(&self) {
        *self.visitor_data.write().await = None;
    }

    async fn fetch_visitor_data(&self) -> Option<String> {
        let resp = self
            .http
            .get("https://music.youtube.com/sw.js_data")
            .header("User-Agent", YouTubeClient::WEB_USER_AGENT)
            .send()
            .await
            .ok()?;
        let text = resp.text().await.ok()?;
        if text.len() <= 5 {
            return None;
        }
        let json = Json::from_str(&text[5..]).ok()?;
        json.at(0)
            .at(2)
            .array()
            .into_iter()
            .filter_map(|v| v.string())
            .find(|s| s.starts_with("Cgt") || s.starts_with("Cgs"))
    }

    pub async fn post(
        &self,
        endpoint: &str,
        client: &YouTubeClient,
        mut body: Value,
        query: &[(&str, &str)],
    ) -> Result<Json, String> {
        let mut url = format!(
            "https://music.youtube.com/youtubei/v1/{}?prettyPrint=false",
            endpoint
        );
        for (k, v) in query {
            let encoded_v: String = url::form_urlencoded::byte_serialize(v.as_bytes()).collect();
            url.push_str(&format!("&{}={}", k, encoded_v));
        }

        let visitor = self.visitor_data.read().await.clone();
        if let Some(obj) = body.as_object_mut() {
            obj.insert(
                "context".to_string(),
                client.context(visitor.as_deref()),
            );
        }

        let mut req = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .header("User-Agent", client.user_agent)
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("X-Goog-Api-Format-Version", "1")
            .header("X-YouTube-Client-Name", client.id)
            .header("X-YouTube-Client-Version", client.version)
            .header("X-Origin", "https://music.youtube.com")
            .header("Referer", "https://music.youtube.com/");

        if let Some(ref v) = visitor {
            req = req.header("X-Goog-Visitor-Id", v);
        }

        let resp = req
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            return Err(format!(
                "YouTube answered with an error ({}).",
                status.as_u16()
            ));
        }

        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        Json::from_slice(&bytes)
    }

    pub async fn home(&self, params: Option<&str>) -> Result<HomePage, String> {
        self.ensure_visitor_data().await;
        let mut body = json!({ "browseId": "FEmusic_home" });
        if let Some(p) = params {
            body["params"] = json!(p);
        }
        let response = self
            .post("browse", &YouTubeClient::WEB_REMIX, body, &[])
            .await?;
        let section_list = response
            .get("contents")
            .get("singleColumnBrowseResultsRenderer")
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer");

        let chips = section_list
            .get("header")
            .get("chipCloudRenderer")
            .get("chips")
            .array()
            .into_iter()
            .filter_map(|chip| {
                let renderer = chip.get("chipCloudChipRenderer");
                let title = renderer.get("text").text()?;
                Some(HomeChip {
                    title,
                    params: renderer
                        .get("navigationEndpoint")
                        .get("browseEndpoint")
                        .get("params")
                        .string(),
                })
            })
            .collect();

        let sections = section_list
            .get("contents")
            .array()
            .iter()
            .filter_map(renderers::section)
            .collect();

        Ok(HomePage {
            chips,
            sections,
            continuation: section_list.continuation(),
        })
    }

    pub async fn home_continuation(&self, token: &str) -> Result<HomePage, String> {
        let response = self
            .post(
                "browse",
                &YouTubeClient::WEB_REMIX,
                json!({}),
                &[("continuation", token), ("ctoken", token)],
            )
            .await?;
        let list = response
            .get("continuationContents")
            .get("sectionListContinuation");
        let sections = list
            .get("contents")
            .array()
            .iter()
            .filter_map(renderers::section)
            .collect();
        Ok(HomePage {
            chips: Vec::new(),
            sections,
            continuation: list.continuation(),
        })
    }

    pub async fn search_suggestions(&self, input: &str) -> Result<SearchSuggestions, String> {
        let response = self
            .post(
                "music/get_search_suggestions",
                &YouTubeClient::WEB_REMIX,
                json!({ "input": input }),
                &[],
            )
            .await?;
        let groups: Vec<Json> = response
            .get("contents")
            .array()
            .into_iter()
            .map(|g| g.get("searchSuggestionsSectionRenderer").get("contents"))
            .collect();
        let queries = groups
            .iter()
            .flat_map(|g| g.children("searchSuggestionRenderer"))
            .filter_map(|r| r.get("suggestion").text())
            .collect();
        let items = groups
            .iter()
            .flat_map(|g| g.children("musicResponsiveListItemRenderer"))
            .filter_map(|r| renderers::list_item(&r, None))
            .collect();
        Ok(SearchSuggestions { queries, items })
    }

    pub async fn search_summary(&self, query: &str) -> Result<SearchSummary, String> {
        let response = self
            .post(
                "search",
                &YouTubeClient::WEB_REMIX,
                json!({ "query": query }),
                &[],
            )
            .await?;
        let contents = response
            .get("contents")
            .get("tabbedSearchResultsRenderer")
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer")
            .get("contents");

        let mut summary = SearchSummary {
            top: None,
            sections: Vec::new(),
        };
        let mut loose: Vec<YTItem> = Vec::new();

        for content in contents.array() {
            let card = content.get("musicCardShelfRenderer");
            if card.exists() {
                summary.top = Self::top_result(&card);
                for item in card
                    .get("contents")
                    .children("musicResponsiveListItemRenderer")
                {
                    if let Some(parsed) = renderers::list_item(&item, None) {
                        loose.push(parsed);
                    }
                }
            } else if content.get("itemSectionRenderer").exists() {
                for item in content
                    .get("itemSectionRenderer")
                    .get("contents")
                    .children("musicResponsiveListItemRenderer")
                {
                    if let Some(parsed) = renderers::list_item(&item, None) {
                        loose.push(parsed);
                    }
                }
            } else if let Some(sec) = renderers::section(&content) {
                summary.sections.push(sec);
            }
        }

        let top_id = summary.top.as_ref().map(|t| t.id());
        let filtered_loose: Vec<YTItem> = loose
            .into_iter()
            .filter(|i| Some(i.id()) != top_id)
            .collect();
        summary
            .sections
            .extend(Self::grouped_by_kind(&filtered_loose));

        Ok(summary)
    }

    fn grouped_by_kind(items: &[YTItem]) -> Vec<FeedSection> {
        let mut sections = Vec::new();
        let songs: Vec<YTItem> = items
            .iter()
            .filter(|i| i.song().map(|s| !s.is_video()).unwrap_or(false))
            .cloned()
            .collect();
        if !songs.is_empty() {
            sections.push(FeedSection {
                title: "Songs".to_string(),
                label: None,
                thumbnail: None,
                more_browse_id: None,
                more_params: None,
                items: songs,
            });
        }

        let videos: Vec<YTItem> = items
            .iter()
            .filter(|i| i.song().map(|s| s.is_video()).unwrap_or(false))
            .cloned()
            .collect();
        if !videos.is_empty() {
            sections.push(FeedSection {
                title: "Videos".to_string(),
                label: None,
                thumbnail: None,
                more_browse_id: None,
                more_params: None,
                items: videos,
            });
        }

        let albums: Vec<YTItem> = items
            .iter()
            .filter(|i| matches!(i, YTItem::Album(_)))
            .cloned()
            .collect();
        if !albums.is_empty() {
            sections.push(FeedSection {
                title: "Albums".to_string(),
                label: None,
                thumbnail: None,
                more_browse_id: None,
                more_params: None,
                items: albums,
            });
        }

        let artists: Vec<YTItem> = items
            .iter()
            .filter(|i| matches!(i, YTItem::Artist(_)))
            .cloned()
            .collect();
        if !artists.is_empty() {
            sections.push(FeedSection {
                title: "Artists".to_string(),
                label: None,
                thumbnail: None,
                more_browse_id: None,
                more_params: None,
                items: artists,
            });
        }

        let playlists: Vec<YTItem> = items
            .iter()
            .filter(|i| matches!(i, YTItem::Playlist(_)))
            .cloned()
            .collect();
        if !playlists.is_empty() {
            sections.push(FeedSection {
                title: "Playlists".to_string(),
                label: None,
                thumbnail: None,
                more_browse_id: None,
                more_params: None,
                items: playlists,
            });
        }

        sections
    }

    pub async fn search(&self, query: &str, filter: &str) -> Result<SearchResult, String> {
        let params = match filter {
            "songs" => Some("EgWKAQIIAWoKEAkQBRAKEAMQBA=="),
            "videos" => Some("EgWKAQIQAWoKEAkQChAFEAMQBA=="),
            "albums" => Some("EgWKAQIYAWoKEAkQChAFEAMQBA=="),
            "artists" => Some("EgWKAQIgAWoKEAkQChAFEAMQBA=="),
            "playlists" => Some("EgeKAQQoAEABagoQAxAEEAoQCRAF"),
            _ => None,
        };
        let mut body = json!({ "query": query });
        if let Some(p) = params {
            body["params"] = json!(p);
        }
        let response = self
            .post("search", &YouTubeClient::WEB_REMIX, body, &[])
            .await?;
        let shelf = response
            .get("contents")
            .get("tabbedSearchResultsRenderer")
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer")
            .get("contents")
            .first_child("musicShelfRenderer");
        let items = shelf
            .get("contents")
            .children("musicResponsiveListItemRenderer")
            .into_iter()
            .filter_map(|r| renderers::list_item(&r, None))
            .collect();
        Ok(SearchResult {
            items,
            continuation: shelf.continuation(),
        })
    }

    pub async fn search_continuation(&self, token: &str) -> Result<SearchResult, String> {
        let response = self
            .post(
                "search",
                &YouTubeClient::WEB_REMIX,
                json!({}),
                &[("continuation", token), ("ctoken", token)],
            )
            .await?;
        let shelf = response
            .get("continuationContents")
            .get("musicShelfContinuation");
        let items: Vec<YTItem> = shelf
            .get("contents")
            .children("musicResponsiveListItemRenderer")
            .into_iter()
            .filter_map(|r| renderers::list_item(&r, None))
            .collect();
        let continuation = if items.is_empty() {
            None
        } else {
            shelf.continuation()
        };
        Ok(SearchResult {
            items,
            continuation,
        })
    }

    pub async fn album(&self, browse_id: &str) -> Result<AlbumPage, String> {
        let response = self
            .post(
                "browse",
                &YouTubeClient::WEB_REMIX,
                json!({ "browseId": browse_id }),
                &[],
            )
            .await?;
        let columns = response.get("contents").get("twoColumnBrowseResultsRenderer");
        let header = columns
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer")
            .get("contents")
            .first_child("musicResponsiveHeaderRenderer");
        let title = header
            .get("title")
            .text()
            .ok_or_else(|| "YouTube's answer was missing the album title.".to_string())?;

        let canonical = response
            .get("microformat")
            .get("microformatDataRenderer")
            .get("urlCanonical")
            .string();
        let playlist_id = canonical
            .and_then(|c| c.split("list=").nth(1).map(|s| s.to_string()));

        let album = AlbumItem {
            browse_id: browse_id.to_string(),
            playlist_id,
            title,
            artists: renderers::as_artists(&renderers::names_only(
                &header.get("straplineTextOne").runs(),
            )),
            year: header
                .get("subtitle")
                .runs()
                .last()
                .and_then(|r| r.text.parse::<i64>().ok()),
            thumbnail: header.get("thumbnail").thumbnail_url().unwrap_or_default(),
            explicit: false,
        };

        let secondary = columns
            .get("secondaryContents")
            .get("sectionListRenderer")
            .get("contents");
        let tracks = secondary
            .first_child("musicShelfRenderer")
            .get("contents")
            .children("musicResponsiveListItemRenderer");
        let songs = tracks
            .into_iter()
            .filter_map(|r| renderers::list_item(&r, Some(&album)).and_then(|i| i.song().cloned()))
            .collect();
        let other_versions = secondary
            .array()
            .iter()
            .find_map(renderers::section)
            .map(|s| s.items)
            .unwrap_or_default();

        Ok(AlbumPage {
            album,
            songs,
            other_versions,
            description: header
                .get("description")
                .get("musicDescriptionShelfRenderer")
                .get("description")
                .text(),
        })
    }

    pub async fn artist(&self, browse_id: &str) -> Result<ArtistPage, String> {
        let response = self
            .post(
                "browse",
                &YouTubeClient::WEB_REMIX,
                json!({ "browseId": browse_id }),
                &[],
            )
            .await?;
        let header = if response.get("header").get("musicImmersiveHeaderRenderer").exists() {
            response.get("header").get("musicImmersiveHeaderRenderer")
        } else {
            response.get("header").get("musicVisualHeaderRenderer")
        };
        let name = header
            .get("title")
            .text()
            .ok_or_else(|| "YouTube's answer was missing the artist name.".to_string())?;
        let contents = response
            .get("contents")
            .get("singleColumnBrowseResultsRenderer")
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer")
            .get("contents");
        let subscribe = header
            .get("subscriptionButton")
            .get("subscribeButtonRenderer");

        Ok(ArtistPage {
            artist: ArtistItem {
                id: browse_id.to_string(),
                title: name,
                thumbnail: header
                    .get("thumbnail")
                    .thumbnail_url()
                    .or_else(|| header.get("foregroundThumbnail").thumbnail_url()),
                subtitle: None,
            },
            banner: header.get("thumbnail").thumbnail_url(),
            subscribers: subscribe
                .get("longSubscriberCountText")
                .text()
                .or_else(|| subscribe.get("shortSubscriberCountText").text()),
            monthly_listeners: header.get("monthlyListenerCount").text(),
            description: header.get("description").text().or_else(|| {
                contents
                    .first_child("musicDescriptionShelfRenderer")
                    .get("description")
                    .text()
            }),
            shuffle_endpoint: Self::watch_endpoint(
                &header
                    .get("playButton")
                    .get("buttonRenderer")
                    .get("navigationEndpoint"),
            ),
            radio_endpoint: Self::watch_endpoint(
                &header
                    .get("startRadioButton")
                    .get("buttonRenderer")
                    .get("navigationEndpoint"),
            ),
            sections: contents
                .array()
                .iter()
                .filter_map(renderers::section)
                .collect(),
        })
    }

    pub async fn playlist(&self, playlist_id: &str) -> Result<PlaylistPage, String> {
        let browse_id = if playlist_id.starts_with("VL") {
            playlist_id.to_string()
        } else {
            format!("VL{}", playlist_id)
        };
        let response = self
            .post(
                "browse",
                &YouTubeClient::WEB_REMIX,
                json!({ "browseId": browse_id }),
                &[],
            )
            .await?;
        let columns = response.get("contents").get("twoColumnBrowseResultsRenderer");
        let base = columns
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer")
            .get("contents")
            .at(0);
        let header = if base.get("musicResponsiveHeaderRenderer").exists() {
            base.get("musicResponsiveHeaderRenderer")
        } else {
            base.get("musicEditablePlaylistDetailHeaderRenderer")
                .get("header")
                .get("musicResponsiveHeaderRenderer")
        };
        let title = header
            .get("title")
            .text()
            .ok_or_else(|| "YouTube's answer was missing the playlist title.".to_string())?;
        let shelf = columns
            .get("secondaryContents")
            .get("sectionListRenderer")
            .get("contents")
            .at(0)
            .get("musicPlaylistShelfRenderer");

        let songs = shelf
            .get("contents")
            .children("musicResponsiveListItemRenderer")
            .into_iter()
            .filter_map(|r| renderers::list_item(&r, None).and_then(|i| i.song().cloned()))
            .collect();

        Ok(PlaylistPage {
            playlist: PlaylistItem {
                id: playlist_id.to_string(),
                title,
                author: header.get("straplineTextOne").text(),
                song_count_text: header
                    .get("secondSubtitle")
                    .runs()
                    .first()
                    .map(|r| r.text.clone()),
                thumbnail: header.get("thumbnail").thumbnail_url(),
            },
            songs,
            continuation: shelf
                .get("contents")
                .continuation()
                .or_else(|| shelf.continuation()),
        })
    }

    pub async fn playlist_continuation(
        &self,
        token: &str,
    ) -> Result<(Vec<SongItem>, Option<String>), String> {
        let response = self
            .post(
                "browse",
                &YouTubeClient::WEB_REMIX,
                json!({}),
                &[("continuation", token), ("ctoken", token)],
            )
            .await?;
        let appended = response
            .get("onResponseReceivedActions")
            .at(0)
            .get("appendContinuationItemsAction")
            .get("continuationItems");
        if appended.exists() {
            let songs = appended
                .children("musicResponsiveListItemRenderer")
                .into_iter()
                .filter_map(|r| renderers::list_item(&r, None).and_then(|i| i.song().cloned()))
                .collect();
            return Ok((songs, appended.continuation()));
        }
        let shelf = response
            .get("continuationContents")
            .get("musicPlaylistShelfContinuation");
        let songs = shelf
            .get("contents")
            .children("musicResponsiveListItemRenderer")
            .into_iter()
            .filter_map(|r| renderers::list_item(&r, None).and_then(|i| i.song().cloned()))
            .collect();
        Ok((songs, shelf.continuation()))
    }

    pub async fn browse_section(
        &self,
        browse_id: &str,
        params: Option<&str>,
    ) -> Result<Vec<YTItem>, String> {
        let mut body = json!({ "browseId": browse_id });
        if let Some(p) = params {
            body["params"] = json!(p);
        }
        let response = self
            .post("browse", &YouTubeClient::WEB_REMIX, body, &[])
            .await?;
        let contents = response
            .get("contents")
            .get("singleColumnBrowseResultsRenderer")
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer")
            .get("contents");
        let mut items = Vec::new();
        for content in contents.array() {
            if let Some(sec) = renderers::section(&content) {
                items.extend(sec.items);
            }
            let grid = content.get("gridRenderer").get("items");
            for item in grid.array() {
                if item.get("musicTwoRowItemRenderer").exists() {
                    if let Some(parsed) =
                        renderers::two_row_item(&item.get("musicTwoRowItemRenderer"))
                    {
                        items.push(parsed);
                    }
                }
            }
        }
        Ok(items)
    }

    // the moods & genres page search opens on: each grid's title and its tiles
    pub async fn moods_and_genres(&self) -> Result<Vec<MoodSection>, String> {
        self.ensure_visitor_data().await;
        let response = self
            .post(
                "browse",
                &YouTubeClient::WEB_REMIX,
                json!({ "browseId": "FEmusic_moods_and_genres" }),
                &[],
            )
            .await?;
        let contents = response
            .get("contents")
            .get("singleColumnBrowseResultsRenderer")
            .get("tabs")
            .at(0)
            .get("tabRenderer")
            .get("content")
            .get("sectionListRenderer")
            .get("contents");
        let sections = contents
            .array()
            .into_iter()
            .filter_map(|content| {
                let grid = content.get("gridRenderer");
                let title = grid
                    .get("header")
                    .get("gridHeaderRenderer")
                    .get("title")
                    .text()?;
                let items: Vec<MoodItem> = grid
                    .get("items")
                    .children("musicNavigationButtonRenderer")
                    .into_iter()
                    .filter_map(|button| {
                        let endpoint = button.get("clickCommand").get("browseEndpoint");
                        Some(MoodItem {
                            title: button.get("buttonText").text()?,
                            stripe_color: button.get("solid").get("leftStripeColor").int(),
                            browse_id: endpoint.get("browseId").string()?,
                            params: endpoint.get("params").string(),
                        })
                    })
                    .collect();
                (!items.is_empty()).then_some(MoodSection { title, items })
            })
            .collect();
        Ok(sections)
    }

    pub fn next<'a>(
        &'a self,
        endpoint: WatchEndpoint,
        continuation: Option<String>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<NextResult, String>> + Send + 'a>>
    {
        Box::pin(async move {
            let mut body = json!({
                "enablePersistentPlaylistPanel": true,
                "isAudioOnly": true,
            });
            if let Some(ref v) = endpoint.video_id {
                body["videoId"] = json!(v);
            }
            if let Some(ref p) = endpoint.playlist_id {
                body["playlistId"] = json!(p);
            }
            if let Some(ref p) = endpoint.params {
                body["params"] = json!(p);
            }
            if let Some(idx) = endpoint.index {
                body["index"] = json!(idx);
            }
            if let Some(ref c) = continuation {
                body["continuation"] = json!(c);
            }

            let response = self
                .post("next", &YouTubeClient::WEB_REMIX, body, &[])
                .await?;
            let tabs = response
                .get("contents")
                .get("singleColumnMusicWatchNextResultsRenderer")
                .get("tabbedRenderer")
                .get("watchNextTabbedResultsRenderer")
                .get("tabs");
            let panel = if response
                .get("continuationContents")
                .get("playlistPanelContinuation")
                .exists()
            {
                response
                    .get("continuationContents")
                    .get("playlistPanelContinuation")
            } else {
                tabs.at(0)
                    .get("tabRenderer")
                    .get("content")
                    .get("musicQueueRenderer")
                    .get("content")
                    .get("playlistPanelRenderer")
            };

            let mut items = Vec::new();
            let mut current_index = None;
            for content in panel.get("contents").array() {
                let renderer = if content.get("playlistPanelVideoRenderer").exists() {
                    content.get("playlistPanelVideoRenderer")
                } else {
                    content
                        .get("playlistPanelVideoWrapperRenderer")
                        .get("primaryRenderer")
                        .get("playlistPanelVideoRenderer")
                };
                if let Some(song) = renderers::queue_item(&renderer) {
                    if renderer.get("selected").bool() == Some(true) {
                        current_index = Some(items.len());
                    }
                    items.push(song);
                }
            }

            let lyrics_browse_id = tabs
                .at(1)
                .get("tabRenderer")
                .get("endpoint")
                .get("browseEndpoint")
                .get("browseId")
                .string();
            let related_browse_id = tabs
                .at(2)
                .get("tabRenderer")
                .get("endpoint")
                .get("browseEndpoint")
                .get("browseId")
                .string();

            let automix = panel
                .get("contents")
                .last()
                .get("automixPreviewVideoRenderer")
                .get("content")
                .get("automixPlaylistVideoRenderer")
                .get("navigationEndpoint")
                .get("watchPlaylistEndpoint");

            if continuation.is_none() {
                if let Some(playlist_id) = automix.get("playlistId").string() {
                    if let Ok(mix) = self
                        .next(
                            WatchEndpoint {
                                video_id: None,
                                playlist_id: Some(playlist_id),
                                params: automix.get("params").string(),
                                index: None,
                            },
                            None,
                        )
                        .await
                    {
                        let known: HashSet<String> = items.iter().map(|i| i.id.clone()).collect();
                        items.extend(mix.items.into_iter().filter(|i| !known.contains(&i.id)));
                        return Ok(NextResult {
                            items,
                            current_index,
                            continuation: mix.continuation,
                            lyrics_browse_id,
                            related_browse_id,
                        });
                    }
                }
            }

            Ok(NextResult {
                items,
                current_index,
                continuation: panel.continuation(),
                lyrics_browse_id,
                related_browse_id,
            })
        })
    }

    pub async fn lyrics(&self, browse_id: &str) -> Result<Option<String>, String> {
        let response = self
            .post(
                "browse",
                &YouTubeClient::WEB_REMIX,
                json!({ "browseId": browse_id }),
                &[],
            )
            .await?;
        Ok(response
            .get("contents")
            .get("sectionListRenderer")
            .get("contents")
            .at(0)
            .get("musicDescriptionShelfRenderer")
            .get("description")
            .text())
    }

    pub async fn stream(
        &self,
        video_id: &str,
        prefer_high_quality: bool,
    ) -> Result<StreamInfo, String> {
        self.stream_with_quality(video_id, prefer_high_quality, None).await
    }

    pub async fn stream_with_quality(
        &self,
        video_id: &str,
        prefer_high_quality: bool,
        quality: Option<&str>,
    ) -> Result<StreamInfo, String> {
        let now_unix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        if let Some(cached) = self.stream_cache.read().await.get(video_id).cloned() {
            if cached.expires_at_unix > now_unix {
                return Ok(cached);
            }
        }

        self.ensure_visitor_data().await;
        let mut reasons = Vec::new();
        let clients = [YouTubeClient::VISION_OS, YouTubeClient::IPAD_OS];
        let port = self.get_proxy_port().await;

        for client in &clients {
            let mut answer = self.player(client, video_id).await;
            // a bot check usually clears with a fresh visitor id, and it's worth one more ask since only visionos links play to the end
            if matches!(&answer, Err(reason) if reason.contains("not a bot")) {
                self.reset_visitor_data().await;
                self.ensure_visitor_data().await;
                answer = self.player(client, video_id).await;
            }
            let response = match answer {
                Ok(r) => r,
                Err(reason) => {
                    reasons.push(format!("{}: {}", client.name, reason));
                    continue;
                }
            };

            let Some((mut info, size, init_end)) =
                self.pick_stream(&response, client, prefer_high_quality, quality, video_id, port)
            else {
                reasons.push(format!("{}: no playable stream found", client.name));
                continue;
            };
            let (whole, patched_init) = tokio::join!(
                self.serves_whole_song(&info, size),
                self.fetch_patched_init(&info, init_end)
            );
            if !whole {
                reasons.push(format!("{}: only serves the start of the song", client.name));
                continue;
            }
            info.patched_init = patched_init;
            self.stream_cache
                .write()
                .await
                .insert(video_id.to_string(), info.clone());
            return Ok(info);
        }

        self.reset_visitor_data().await;
        Err(reasons
            .into_iter()
            .next()
            .unwrap_or_else(|| "Couldn't play this song.".to_string()))
    }

    pub async fn cached_stream(&self, video_id: &str) -> Option<StreamInfo> {
        self.stream_cache.read().await.get(video_id).cloned()
    }

    pub async fn invalidate_stream(&self, video_id: &str) {
        self.stream_cache.write().await.remove(video_id);
    }

    pub async fn stream_cache_len(&self) -> usize {
        self.stream_cache.read().await.len()
    }

    pub async fn clear_stream_cache(&self) -> usize {
        let mut guard = self.stream_cache.write().await;
        let n = guard.len();
        guard.clear();
        n
    }

    // one client's player answer, or youtube's reason when it won't play the song for that client
    async fn player(&self, client: &YouTubeClient, video_id: &str) -> Result<Json, String> {
        let response = self
            .post(
                "player",
                client,
                json!({
                    "videoId": video_id,
                    "contentCheckOk": true,
                    "racyCheckOk": true,
                }),
                &[],
            )
            .await?;
        let playability = response.get("playabilityStatus");
        let status = playability.get("status").string().unwrap_or_else(|| "UNKNOWN".to_string());
        if status != "OK" {
            return Err(playability.get("reason").string().unwrap_or(status));
        }
        Ok(response)
    }

    // ipad links answer 403 past their first megabyte, and webkit then plays silence until the song's full length
    async fn serves_whole_song(&self, info: &StreamInfo, size: Option<u64>) -> bool {
        // without a size, ask well past that first megabyte, where a song shorter than that answers 416
        let (byte, size_known) = match size {
            Some(s) if s > 1 => (s - 1, true),
            _ => (2 * 1024 * 1024, false),
        };
        let mut req = self
            .http
            .get(&info.url)
            .header("Range", format!("bytes={}-{}", byte, byte))
            .timeout(Duration::from_secs(8));
        for (k, v) in &info.headers {
            req = req.header(k, v);
        }
        match req.send().await {
            Ok(resp) => resp.status().is_success() || (!size_known && resp.status().as_u16() == 416),
            Err(_) => false,
        }
    }

    // fetch the fMP4 init segment (ftyp + moov) and zero its header durations so CoreMedia doesn't double-count them
    async fn fetch_patched_init(&self, info: &StreamInfo, init_end: Option<u64>) -> Option<Vec<u8>> {
        if info.codec != "AAC" {
            return None;
        }
        let end = init_end.filter(|&e| (32..=65_535).contains(&e)).unwrap_or(4095);
        let mut req = self
            .http
            .get(&info.url)
            .header("Range", format!("bytes=0-{}", end))
            .timeout(Duration::from_secs(8));
        for (k, v) in &info.headers {
            req = req.header(k, v);
        }
        let resp = req.send().await.ok()?;
        let status = resp.status().as_u16();
        if status != 200 && status != 206 {
            return None;
        }
        if status == 206 {
            let cr = resp.headers().get("content-range")?.to_str().ok()?;
            if !cr.trim().starts_with("bytes 0-") {
                return None;
            }
        }
        let mut buf = resp.bytes().await.ok()?.to_vec();
        let moov_end = proxy::patch_fmp4_init(&mut buf)?;
        buf.truncate(moov_end);
        Some(buf)
    }

    fn pick_stream(
        &self,
        response: &Json,
        client: &YouTubeClient,
        prefer_high_quality: bool,
        quality: Option<&str>,
        video_id: &str,
        proxy_port: u16,
    ) -> Option<(StreamInfo, Option<u64>, Option<u64>)> {
        let streaming = response.get("streamingData");
        let lifetime = streaming.get("expiresInSeconds").int().unwrap_or(21_540);
        let now_unix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let expires_at_unix = now_unix + lifetime - 60;
        let loudness = response
            .get("playerConfig")
            .get("audioConfig")
            .get("loudnessDb")
            .double();

        let mut audio: Vec<Json> = streaming
            .get("adaptiveFormats")
            .array()
            .into_iter()
            .filter(|f| {
                let mime = f.get("mimeType").string().unwrap_or_default();
                (mime.starts_with("audio/mp4") || mime.starts_with("audio/webm"))
                    && f.get("url").string().is_some()
            })
            .collect();

        // Prefer audio/mp4 (AAC) first for universal WebView compatibility across macOS/Win/Linux
        audio.sort_by_key(|f| {
            let is_mp4 = f
                .get("mimeType")
                .string()
                .unwrap_or_default()
                .starts_with("audio/mp4");
            let bitrate = f.get("bitrate").int().unwrap_or(0);
            (if is_mp4 { 1 } else { 0 }, bitrate)
        });

        let tier = quality.unwrap_or(if prefer_high_quality { "high" } else { "low" });
        let format = match tier {
            "low" => audio
                .iter()
                .filter(|f| f.get("mimeType").string().unwrap_or_default().starts_with("audio/mp4"))
                .min_by_key(|f| f.get("bitrate").int().unwrap_or(i64::MAX))
                .or_else(|| audio.first()),
            "medium" => {
                let mp4s: Vec<&Json> = audio
                    .iter()
                    .filter(|f| f.get("mimeType").string().unwrap_or_default().starts_with("audio/mp4"))
                    .collect();
                mp4s.iter()
                    .rev()
                    .find(|f| f.get("bitrate").int().unwrap_or(0) <= 145_000)
                    .copied()
                    .or_else(|| mp4s.first().copied())
                    .or_else(|| audio.first())
            }
            _ => {
                if prefer_high_quality || tier == "high" || tier == "auto" {
                    audio.last()
                } else {
                    audio
                        .iter()
                        .find(|f| f.get("mimeType").string().unwrap_or_default().starts_with("audio/mp4"))
                        .or_else(|| audio.first())
                }
            }
        }?;

        let url = format.get("url").string()?;
        let mime = format.get("mimeType").string().unwrap_or_default();
        let codec = if mime.starts_with("audio/mp4") {
            "AAC".to_string()
        } else {
            "Opus".to_string()
        };
        let sample_rate = format.get("audioSampleRate").int();
        let format_label = match sample_rate {
            Some(sr) => format!("{} · {:.1} kHz", codec, (sr as f64) / 1000.0),
            None => codec.clone(),
        };
        let proxy_url = format!("http://127.0.0.1:{}/stream/{}", proxy_port, video_id);

        let info = StreamInfo {
            url,
            proxy_url,
            headers: client.stream_headers(),
            codec,
            sample_rate,
            bitrate: format.get("bitrate").int(),
            loudness_db: format.get("loudnessDb").double().or(loudness),
            expires_at_unix,
            is_hls: false,
            approx_duration: format.get("approxDurationMs").double().map(|ms| ms / 1000.0),
            format_label,
            patched_init: None,
        };
        let size = format.get("contentLength").int().and_then(|n| u64::try_from(n).ok());
        let init_end = format
            .get("initRange")
            .get("end")
            .int()
            .and_then(|n| u64::try_from(n).ok());
        Some((info, size, init_end))
    }

    pub async fn transcript(&self, video_id: &str) -> Result<Option<String>, String> {
        let mut raw = vec![0x0au8, 0x0bu8];
        raw.extend_from_slice(video_id.as_bytes());
        let params = base64::engine::general_purpose::STANDARD.encode(&raw);
        let response = self
            .post(
                "get_transcript",
                &YouTubeClient::WEB,
                json!({ "params": params }),
                &[],
            )
            .await?;
        let groups = response
            .get("actions")
            .at(0)
            .get("updateEngagementPanelAction")
            .get("content")
            .get("transcriptRenderer")
            .get("body")
            .get("transcriptBodyRenderer")
            .get("cueGroups")
            .array();
        let mut lines = Vec::new();
        for group in groups {
            let cue = group
                .get("transcriptCueGroupRenderer")
                .get("cues")
                .at(0)
                .get("transcriptCueRenderer");
            if let (Some(ms), Some(text)) = (
                cue.get("startOffsetMs").int(),
                cue.get("cue").get("simpleText").string(),
            ) {
                let clean = text.trim_matches(|c: char| c == '♪' || c.is_whitespace());
                if !clean.is_empty() {
                    lines.push(format!(
                        "[{:02}:{:02}.{:03}]{}",
                        ms / 60_000,
                        (ms / 1000) % 60,
                        ms % 1000,
                        clean
                    ));
                }
            }
        }
        if lines.is_empty() {
            Ok(None)
        } else {
            Ok(Some(lines.join("\n")))
        }
    }

    pub async fn subtitle_lyrics(&self, video_id: &str) -> Result<Option<String>, String> {
        if let Ok(Some(uploaded)) = self.caption_lyrics(video_id, true).await {
            return Ok(Some(uploaded));
        }
        Ok(self.transcript(video_id).await.ok().flatten())
    }

    pub async fn caption_lyrics(
        &self,
        video_id: &str,
        uploaded_only: bool,
    ) -> Result<Option<String>, String> {
        self.ensure_visitor_data().await;
        let clients = [
            YouTubeClient::VISION_OS,
            YouTubeClient::IPAD_OS,
            YouTubeClient::WEB_REMIX,
        ];
        for client in &clients {
            let Ok(response) = self
                .post(
                    "player",
                    client,
                    json!({
                        "videoId": video_id,
                        "contentCheckOk": true,
                        "racyCheckOk": true,
                    }),
                    &[],
                )
                .await
            else {
                continue;
            };
            let tracks = response
                .get("captions")
                .get("playerCaptionsTracklistRenderer")
                .get("captionTracks")
                .array();
            let Some(auto_track) = tracks
                .iter()
                .find(|t| t.get("kind").str() == Some("asr"))
            else {
                continue;
            };
            let language = auto_track
                .get("languageCode")
                .string()
                .and_then(|l| l.split('-').next().map(|s| s.to_string()));
            let uploaded = tracks.iter().find(|t| {
                t.get("kind").str() != Some("asr")
                    && t.get("languageCode")
                        .string()
                        .and_then(|l| l.split('-').next().map(|s| s.to_string()))
                        == language
            });
            let track = if uploaded_only {
                uploaded
            } else {
                uploaded.or(Some(auto_track))
            };
            let Some(track) = track else {
                return Ok(None);
            };
            let Some(base_url) = track.get("baseUrl").string() else {
                continue;
            };
            let url = if base_url.contains("fmt=") {
                let re = Regex::new(r"fmt=[^&]+").unwrap();
                re.replace(&base_url, "fmt=json3").to_string()
            } else {
                format!("{}&fmt=json3", base_url)
            };
            let Ok(resp) = self
                .http
                .get(&url)
                .header("User-Agent", client.user_agent)
                .timeout(Duration::from_secs(10))
                .send()
                .await
            else {
                continue;
            };
            let Ok(bytes) = resp.bytes().await else {
                continue;
            };
            let Ok(json) = Json::from_slice(&bytes) else {
                continue;
            };
            if let Some(lrc) = Self::timed_text_to_lrc(&json) {
                if !lrc.is_empty() {
                    return Ok(Some(lrc));
                }
            }
        }
        Ok(None)
    }

    fn timed_text_to_lrc(json: &Json) -> Option<String> {
        let mut lines = Vec::new();
        let mut previous: Option<String> = None;
        let bracket_re = Regex::new(r"\[[^\]]*\]").unwrap();
        let ws_re = Regex::new(r"\s+").unwrap();

        for event in json.get("events").array() {
            let Some(start) = event.get("tStartMs").int() else {
                continue;
            };
            let joined: String = event
                .get("segs")
                .array()
                .into_iter()
                .filter_map(|s| s.get("utf8").string())
                .collect();
            let step1 = bracket_re.replace_all(&joined, " ");
            let step2 = step1.replace('♪', " ");
            let text = ws_re.replace_all(&step2, " ").trim().to_string();
            if text.is_empty() || previous.as_deref() == Some(text.as_str()) {
                continue;
            }
            previous = Some(text.clone());
            lines.push(format!(
                "[{:02}:{:02}.{:03}]{}",
                start / 60_000,
                (start / 1000) % 60,
                start % 1000,
                text
            ));
        }
        if lines.is_empty() {
            None
        } else {
            Some(lines.join("\n"))
        }
    }

    fn top_result(card: &Json) -> Option<YTItem> {
        let endpoint = card
            .get("title")
            .runs()
            .first()
            .map(|r| r.endpoint.clone())
            .unwrap_or_else(Json::null);
        let title = card.get("title").text().unwrap_or_default();
        let subtitle = card.get("subtitle").runs();
        let thumbnail = card.get("thumbnail").thumbnail_url();

        if let Some(video_id) = endpoint.get("watchEndpoint").get("videoId").string() {
            let mut artists: Vec<ArtistRef> = subtitle
                .iter()
                .filter(|r| {
                    r.browse_id()
                        .as_deref()
                        .map(|id| id.starts_with("UC"))
                        .unwrap_or(false)
                })
                .map(|r| ArtistRef {
                    name: r.text.clone(),
                    id: r.browse_id(),
                })
                .collect();
            if artists.is_empty() {
                artists = renderers::split_by_separator(&subtitle)
                    .get(1)
                    .map(|p| renderers::as_artists(&renderers::names_only(p)))
                    .unwrap_or_default();
            }
            let album = subtitle
                .iter()
                .find(|r| {
                    r.browse_id()
                        .as_deref()
                        .map(|id| id.starts_with("MPREb_"))
                        .unwrap_or(false)
                })
                .and_then(|r| {
                    r.browse_id().map(|id| AlbumRef {
                        name: r.text.clone(),
                        id,
                    })
                });
            return Some(YTItem::Song(SongItem {
                id: video_id,
                title,
                artists,
                album,
                duration: subtitle
                    .last()
                    .and_then(|r| renderers::parsed_duration(&r.text)),
                thumbnail: thumbnail.unwrap_or_default(),
                explicit: false,
                music_video_type: endpoint
                    .get("watchEndpoint")
                    .get("watchEndpointMusicSupportedConfigs")
                    .get("watchEndpointMusicConfig")
                    .get("musicVideoType")
                    .string(),
                source: None,
            }));
        }

        let browse_id = endpoint.get("browseEndpoint").get("browseId").string()?;
        match endpoint.page_type().as_deref() {
            Some("MUSIC_PAGE_TYPE_ARTIST") => Some(YTItem::Artist(ArtistItem {
                id: browse_id,
                title,
                thumbnail,
                subtitle: card.get("subtitle").text(),
            })),
            Some("MUSIC_PAGE_TYPE_ALBUM") | Some("MUSIC_PAGE_TYPE_AUDIOBOOK") => {
                Some(YTItem::Album(AlbumItem {
                    browse_id,
                    playlist_id: None,
                    title,
                    artists: subtitle
                        .iter()
                        .filter(|r| r.browse_id().is_some())
                        .map(|r| ArtistRef {
                            name: r.text.clone(),
                            id: r.browse_id(),
                        })
                        .collect(),
                    year: None,
                    thumbnail: thumbnail.unwrap_or_default(),
                    explicit: false,
                }))
            }
            Some("MUSIC_PAGE_TYPE_PLAYLIST") => Some(YTItem::Playlist(PlaylistItem {
                id: browse_id
                    .strip_prefix("VL")
                    .unwrap_or(&browse_id)
                    .to_string(),
                title,
                author: subtitle.last().map(|r| r.text.clone()),
                song_count_text: None,
                thumbnail,
            })),
            _ => None,
        }
    }

    fn watch_endpoint(navigation: &Json) -> Option<WatchEndpoint> {
        let endpoint = if navigation.get("watchEndpoint").exists() {
            navigation.get("watchEndpoint")
        } else {
            navigation.get("watchPlaylistEndpoint")
        };
        if !endpoint.exists() {
            return None;
        }
        Some(WatchEndpoint {
            video_id: endpoint.get("videoId").string(),
            playlist_id: endpoint.get("playlistId").string(),
            params: endpoint.get("params").string(),
            index: None,
        })
    }
}
