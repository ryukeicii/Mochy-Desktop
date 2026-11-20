use crate::youtube::json::Json;
use crate::youtube::models::{
    AlbumItem, AlbumRef, ArtistItem, ArtistRef, FeedSection, PlaylistItem, SongItem, YTItem,
};

#[derive(Clone, Debug)]
pub struct Run {
    pub text: String,
    pub endpoint: Json,
}

impl Run {
    pub fn browse_id(&self) -> Option<String> {
        self.endpoint
            .get("browseEndpoint")
            .get("browseId")
            .string()
    }

    pub fn video_id(&self) -> Option<String> {
        self.endpoint
            .get("watchEndpoint")
            .get("videoId")
            .string()
    }

    pub fn page_type(&self) -> Option<String> {
        self.endpoint
            .get("browseEndpoint")
            .get("browseEndpointContextSupportedConfigs")
            .get("browseEndpointContextMusicConfig")
            .get("pageType")
            .string()
    }

    pub fn music_video_type(&self) -> Option<String> {
        self.endpoint
            .get("watchEndpoint")
            .get("watchEndpointMusicSupportedConfigs")
            .get("watchEndpointMusicConfig")
            .get("musicVideoType")
            .string()
    }
}

impl Json {
    pub fn runs(&self) -> Vec<Run> {
        self.get("runs")
            .array()
            .into_iter()
            .filter_map(|run| {
                run.get("text").string().map(|text| Run {
                    text,
                    endpoint: run.get("navigationEndpoint"),
                })
            })
            .collect()
    }

    pub fn text(&self) -> Option<String> {
        let joined: String = self.runs().into_iter().map(|r| r.text).collect();
        if joined.is_empty() {
            self.get("simpleText").string()
        } else {
            Some(joined)
        }
    }

    pub fn thumbnail_url(&self) -> Option<String> {
        let thumbnails = if self
            .get("musicThumbnailRenderer")
            .get("thumbnail")
            .get("thumbnails")
            .exists()
        {
            self.get("musicThumbnailRenderer")
                .get("thumbnail")
                .get("thumbnails")
        } else if self.get("thumbnail").get("thumbnails").exists() {
            self.get("thumbnail").get("thumbnails")
        } else {
            self.get("thumbnails")
        };
        thumbnails.last().get("url").string()
    }

    pub fn continuation(&self) -> Option<String> {
        let list = if self.get("continuations").exists() {
            self.get("continuations")
        } else {
            self.clone()
        };
        list.first()
            .get("nextContinuationData")
            .get("continuation")
            .string()
            .or_else(|| {
                list.first()
                    .get("nextRadioContinuationData")
                    .get("continuation")
                    .string()
            })
            .or_else(|| {
                self.last()
                    .get("continuationItemRenderer")
                    .get("continuationEndpoint")
                    .get("continuationCommand")
                    .get("token")
                    .string()
            })
    }

    pub fn page_type(&self) -> Option<String> {
        self.get("browseEndpoint")
            .get("browseEndpointContextSupportedConfigs")
            .get("browseEndpointContextMusicConfig")
            .get("pageType")
            .string()
    }

    pub fn has_explicit_badge(&self) -> bool {
        self.array().into_iter().any(|item| {
            item.get("musicInlineBadgeRenderer")
                .get("icon")
                .get("iconType")
                .str()
                == Some("MUSIC_EXPLICIT_BADGE")
        })
    }

    pub fn play_button_endpoint(&self) -> Json {
        let play = self
            .get("musicItemThumbnailOverlayRenderer")
            .get("content")
            .get("musicPlayButtonRenderer")
            .get("playNavigationEndpoint");
        if play.get("watchPlaylistEndpoint").exists() {
            play.get("watchPlaylistEndpoint")
        } else {
            play.get("watchEndpoint")
        }
    }
}

pub fn split_by_separator(runs: &[Run]) -> Vec<Vec<Run>> {
    let mut parts: Vec<Vec<Run>> = vec![Vec::new()];
    for run in runs {
        if run.text == " • " {
            parts.push(Vec::new());
        } else if let Some(last) = parts.last_mut() {
            last.push(run.clone());
        }
    }
    parts.into_iter().filter(|p| !p.is_empty()).collect()
}

pub fn names_only(runs: &[Run]) -> Vec<Run> {
    runs.iter()
        .enumerate()
        .filter(|(idx, _)| idx % 2 == 0)
        .map(|(_, r)| r.clone())
        .collect()
}

pub fn as_artists(runs: &[Run]) -> Vec<ArtistRef> {
    runs.iter()
        .map(|r| ArtistRef {
            name: r.text.clone(),
            id: r.browse_id(),
        })
        .collect()
}

pub fn parsed_duration(s: &str) -> Option<i64> {
    let parts: Vec<Option<i64>> = s.split(':').map(|p| p.parse::<i64>().ok()).collect();
    if !(2..=3).contains(&parts.len()) || parts.iter().any(|p| p.is_none()) {
        return None;
    }
    Some(parts.into_iter().flatten().fold(0, |acc, v| acc * 60 + v))
}

pub fn is_artist_page(pt: &str) -> bool {
    matches!(
        pt,
        "MUSIC_PAGE_TYPE_ARTIST"
            | "MUSIC_PAGE_TYPE_LIBRARY_ARTIST"
            | "MUSIC_PAGE_TYPE_USER_CHANNEL"
    )
}

pub fn is_album_page(pt: &str) -> bool {
    matches!(pt, "MUSIC_PAGE_TYPE_ALBUM" | "MUSIC_PAGE_TYPE_AUDIOBOOK")
}

pub fn two_row_item(renderer: &Json) -> Option<YTItem> {
    let title = renderer.get("title").runs().first()?.text.clone();
    let endpoint = renderer.get("navigationEndpoint");
    let thumbnail = renderer.get("thumbnailRenderer").thumbnail_url();
    let subtitle = renderer.get("subtitle").runs();

    if let Some(video_id) = endpoint.get("watchEndpoint").get("videoId").string() {
        let parts = names_only(&subtitle);
        let mut artists: Vec<ArtistRef> = parts
            .iter()
            .filter(|run| {
                run.browse_id()
                    .as_deref()
                    .map(|id| !id.starts_with("MPREb_"))
                    .unwrap_or(false)
            })
            .map(|r| ArtistRef {
                name: r.text.clone(),
                id: r.browse_id(),
            })
            .collect();
        if artists.is_empty() {
            if let Some(first) = subtitle.first() {
                artists = vec![ArtistRef {
                    name: first.text.clone(),
                    id: None,
                }];
            }
        }
        let album = parts
            .iter()
            .find(|r| {
                r.browse_id()
                    .as_deref()
                    .map(|id| id.starts_with("MPREb_"))
                    .unwrap_or(false)
            })
            .and_then(|run| {
                run.browse_id().map(|id| AlbumRef {
                    name: run.text.clone(),
                    id,
                })
            });
        return Some(YTItem::Song(SongItem {
            id: video_id,
            title,
            artists,
            album,
            duration: None,
            thumbnail: thumbnail.unwrap_or_default(),
            explicit: renderer.get("subtitleBadges").has_explicit_badge(),
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
    let page_type = endpoint.page_type().unwrap_or_default();

    if is_album_page(&page_type) {
        let names = names_only(&subtitle);
        let linked: Vec<ArtistRef> = names
            .iter()
            .filter(|r| r.browse_id().is_some())
            .map(|r| ArtistRef {
                name: r.text.clone(),
                id: r.browse_id(),
            })
            .collect();
        let artists = if linked.is_empty() {
            names
                .into_iter()
                .skip(1)
                .map(|r| ArtistRef {
                    name: r.text.clone(),
                    id: r.browse_id(),
                })
                .collect()
        } else {
            linked
        };
        return Some(YTItem::Album(AlbumItem {
            browse_id,
            playlist_id: renderer
                .get("thumbnailOverlay")
                .play_button_endpoint()
                .get("playlistId")
                .string(),
            title,
            artists,
            year: subtitle.last().and_then(|r| r.text.parse::<i64>().ok()),
            thumbnail: thumbnail.unwrap_or_default(),
            explicit: renderer.get("subtitleBadges").has_explicit_badge(),
        }));
    }

    if is_artist_page(&page_type) {
        return Some(YTItem::Artist(ArtistItem {
            id: browse_id,
            title: renderer
                .get("title")
                .runs()
                .last()
                .map(|r| r.text.clone())
                .unwrap_or(title),
            thumbnail,
            subtitle: renderer.get("subtitle").text(),
        }));
    }

    if page_type == "MUSIC_PAGE_TYPE_PLAYLIST" {
        let id = browse_id
            .strip_prefix("VL")
            .unwrap_or(&browse_id)
            .to_string();
        return Some(YTItem::Playlist(PlaylistItem {
            id,
            title,
            author: subtitle.first().map(|r| r.text.clone()),
            song_count_text: if subtitle.len() > 2 {
                subtitle.last().map(|r| r.text.clone())
            } else {
                None
            },
            thumbnail,
        }));
    }

    None
}

pub fn list_item(renderer: &Json, album: Option<&AlbumItem>) -> Option<YTItem> {
    let columns: Vec<Json> = renderer
        .get("flexColumns")
        .array()
        .into_iter()
        .map(|c| c.get("musicResponsiveListItemFlexColumnRenderer").get("text"))
        .collect();
    let title_run = columns.first()?.runs().into_iter().next()?;
    let endpoint = renderer.get("navigationEndpoint");
    let second_line = if columns.len() > 1 {
        columns[1].runs()
    } else {
        Vec::new()
    };
    let thumbnail = renderer.get("thumbnail").thumbnail_url();
    let explicit = renderer.get("badges").has_explicit_badge();
    let page_type = endpoint.page_type().unwrap_or_default();

    if let Some(browse_id) = endpoint.get("browseEndpoint").get("browseId").string() {
        let parts = split_by_separator(&second_line);
        if is_artist_page(&page_type) {
            return Some(YTItem::Artist(ArtistItem {
                id: browse_id,
                title: title_run.text,
                thumbnail,
                subtitle: columns.iter().skip(1).find_map(|c| c.text()),
            }));
        }
        if is_album_page(&page_type) {
            let linked: Vec<Run> = second_line
                .iter()
                .filter(|r| r.browse_id().is_some())
                .cloned()
                .collect();
            let artists = if linked.is_empty() {
                parts
                    .get(1)
                    .map(|p| as_artists(&names_only(p)))
                    .unwrap_or_default()
            } else {
                as_artists(&linked)
            };
            return Some(YTItem::Album(AlbumItem {
                browse_id,
                playlist_id: renderer
                    .get("overlay")
                    .play_button_endpoint()
                    .get("playlistId")
                    .string(),
                title: title_run.text,
                artists,
                year: parts
                    .last()
                    .and_then(|p| p.first())
                    .and_then(|r| r.text.parse::<i64>().ok()),
                thumbnail: thumbnail.unwrap_or_default(),
                explicit,
            }));
        }
        if page_type == "MUSIC_PAGE_TYPE_PLAYLIST" {
            let id = browse_id
                .strip_prefix("VL")
                .unwrap_or(&browse_id)
                .to_string();
            return Some(YTItem::Playlist(PlaylistItem {
                id,
                title: title_run.text,
                author: if parts.len() > 1 {
                    parts[1].first().map(|r| r.text.clone())
                } else {
                    parts.first().and_then(|p| p.first()).map(|r| r.text.clone())
                },
                song_count_text: parts.last().and_then(|p| p.last()).map(|r| r.text.clone()),
                thumbnail,
            }));
        }
        return None;
    }

    let video_id = renderer
        .get("playlistItemData")
        .get("videoId")
        .string()
        .or_else(|| title_run.video_id())?;
    let all_runs: Vec<Run> = columns.iter().flat_map(|c| c.runs()).collect();
    let mut artists: Vec<ArtistRef> = all_runs
        .iter()
        .filter(|r| is_artist_page(&r.page_type().unwrap_or_default()))
        .map(|r| ArtistRef {
            name: r.text.clone(),
            id: r.browse_id(),
        })
        .collect();
    if artists.is_empty() {
        let first_part = split_by_separator(&second_line)
            .into_iter()
            .next()
            .unwrap_or_default();
        artists = names_only(&first_part)
            .into_iter()
            .filter(|r| !matches!(r.text.as_str(), "Song" | "Video" | "Episode"))
            .map(|r| ArtistRef {
                name: r.text.clone(),
                id: r.browse_id(),
            })
            .collect();
    }
    if artists.is_empty() {
        if let Some(alb) = album {
            artists = alb.artists.clone();
        }
    }
    let album_run = all_runs
        .iter()
        .find(|r| is_album_page(&r.page_type().unwrap_or_default()));
    let duration_text = renderer
        .get("fixedColumns")
        .first()
        .get("musicResponsiveListItemFixedColumnRenderer")
        .get("text")
        .text()
        .or_else(|| {
            split_by_separator(&second_line)
                .last()
                .and_then(|p| p.first())
                .map(|r| r.text.clone())
        });
    let video_type = renderer
        .get("overlay")
        .play_button_endpoint()
        .get("watchEndpointMusicSupportedConfigs")
        .get("watchEndpointMusicConfig")
        .get("musicVideoType")
        .string()
        .or_else(|| title_run.music_video_type());

    let resolved_album = album_run
        .and_then(|r| {
            r.browse_id().map(|id| AlbumRef {
                name: r.text.clone(),
                id,
            })
        })
        .or_else(|| {
            album.map(|a| AlbumRef {
                name: a.title.clone(),
                id: a.browse_id.clone(),
            })
        });

    Some(YTItem::Song(SongItem {
        id: video_id,
        title: title_run.text,
        artists,
        album: resolved_album,
        duration: duration_text.as_deref().and_then(parsed_duration),
        thumbnail: thumbnail
            .or_else(|| album.map(|a| a.thumbnail.clone()))
            .unwrap_or_default(),
        explicit,
        music_video_type: video_type,
        source: None,
    }))
}

pub fn queue_item(renderer: &Json) -> Option<SongItem> {
    let video_id = renderer.get("videoId").string()?;
    let title = renderer.get("title").runs().first()?.text.clone();
    let byline = split_by_separator(&renderer.get("longBylineText").runs());
    let artists: Vec<ArtistRef> = byline
        .first()
        .map(|p| {
            names_only(p)
                .into_iter()
                .filter(|r| parsed_duration(&r.text).is_none())
                .map(|r| ArtistRef {
                    name: r.text.clone(),
                    id: r.browse_id(),
                })
                .collect()
        })
        .unwrap_or_default();
    let album_run = if byline.len() > 1 {
        byline[1].first()
    } else {
        None
    };

    Some(SongItem {
        id: video_id,
        title,
        artists,
        album: album_run.and_then(|r| {
            r.browse_id().map(|id| AlbumRef {
                name: r.text.clone(),
                id,
            })
        }),
        duration: renderer
            .get("lengthText")
            .text()
            .as_deref()
            .and_then(parsed_duration),
        thumbnail: renderer
            .get("thumbnail")
            .get("thumbnails")
            .last()
            .get("url")
            .string()
            .unwrap_or_default(),
        explicit: renderer.get("badges").has_explicit_badge(),
        music_video_type: renderer
            .get("navigationEndpoint")
            .get("watchEndpoint")
            .get("watchEndpointMusicSupportedConfigs")
            .get("watchEndpointMusicConfig")
            .get("musicVideoType")
            .string(),
        source: None,
    })
}

pub fn section(content: &Json) -> Option<FeedSection> {
    if content.get("musicCarouselShelfRenderer").exists() {
        let shelf = content.get("musicCarouselShelfRenderer");
        let header = shelf
            .get("header")
            .get("musicCarouselShelfBasicHeaderRenderer");
        let title = header.get("title").text()?;
        let items: Vec<YTItem> = shelf
            .get("contents")
            .array()
            .into_iter()
            .filter_map(|item| {
                if item.get("musicTwoRowItemRenderer").exists() {
                    two_row_item(&item.get("musicTwoRowItemRenderer"))
                } else if item.get("musicResponsiveListItemRenderer").exists() {
                    list_item(&item.get("musicResponsiveListItemRenderer"), None)
                } else {
                    None
                }
            })
            .collect();
        if items.is_empty() {
            return None;
        }
        return Some(FeedSection {
            title,
            label: header.get("strapline").text(),
            thumbnail: header.get("thumbnail").thumbnail_url(),
            more_browse_id: header
                .get("moreContentButton")
                .get("buttonRenderer")
                .get("navigationEndpoint")
                .get("browseEndpoint")
                .get("browseId")
                .string(),
            more_params: header
                .get("moreContentButton")
                .get("buttonRenderer")
                .get("navigationEndpoint")
                .get("browseEndpoint")
                .get("params")
                .string(),
            items,
        });
    }
    if content.get("musicShelfRenderer").exists() {
        let shelf = content.get("musicShelfRenderer");
        let items: Vec<YTItem> = shelf
            .get("contents")
            .children("musicResponsiveListItemRenderer")
            .into_iter()
            .filter_map(|r| list_item(&r, None))
            .collect();
        if items.is_empty() {
            return None;
        }
        let more = shelf.get("bottomEndpoint").get("browseEndpoint");
        return Some(FeedSection {
            title: shelf.get("title").text().unwrap_or_default(),
            label: None,
            thumbnail: None,
            more_browse_id: more.get("browseId").string(),
            more_params: more.get("params").string(),
            items,
        });
    }
    None
}
