/* ==========================================================================
   Mochy — home shelves: "title >" headers, cover, collection and video cards, and paged song lists (after HomeCards.kt)
   ========================================================================== */

window.MochyShelves = (() => {
  "use strict";

  // youtube's music video kinds; plain audio tracks are ATV and podcasts have their own
  const VIDEO_TYPES = new Set(["MUSIC_VIDEO_TYPE_OMV", "MUSIC_VIDEO_TYPE_UGC", "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC"]);
  const GRID_MIN_SONGS = 3;
  const GRID_ROWS = 3;
  const VIDEO_TAGS = /\s*[([][^)\]]*\b(official|video|m\/?v|lyrics?|audio|visuali[sz]er|4k|hd)\b[^)\]]*[)\]]/gi;

  // app.js's helpers: esc, proxyImg, sizedCover, songThumb, artistNames, itemCardHtml, playingBarsHtml, icons, nowPlaying
  let d = null;

  function init(deps) {
    d = deps;
  }

  // a feed section drawn the way its items suit: videos wide, songs as a paged list, playlists tall, the rest as covers
  function feedSectionHtml(sec, key, lists, opts = {}) {
    const items = sec.items || [];
    const more = sec.moreBrowseId ? { browseId: sec.moreBrowseId, params: sec.moreParams, title: sec.title } : null;
    const head = { title: sec.title, label: sec.label, thumb: sec.thumbnail, more };
    const songs = items.every((i) => i.kind === "song") ? items.map((i) => i.data) : null;

    if (songs && songs.length && songs.every(isVideo)) {
      return sectionHtml(key, head, opts, `<div class="shelf-row">${songs.map((s) => videoCardHtml(s)).join("")}</div>`);
    }
    if (songs && songs.length >= GRID_MIN_SONGS) {
      lists[key] = songs;
      return trackSectionHtml(key, { ...head, playAll: true }, songs, opts);
    }
    if (items.length && items.every((i) => i.kind === "playlist")) {
      return sectionHtml(key, head, opts, `<div class="shelf-row">${items.map(collectionCardHtml).join("")}</div>`);
    }
    return sectionHtml(key, head, opts, `<div class="shelf-row">${items.map((i) => d.itemCardHtml(i)).join("")}</div>`);
  }

  // a row of square covers, like recently played
  function coverSectionHtml(key, head, items, opts = {}) {
    return sectionHtml(key, head, opts, `<div class="shelf-row">${items.map((i) => d.itemCardHtml(i)).join("")}</div>`);
  }

  // the paged "list" and "Rank" grids: columns of three rows that snap a column at a time
  function trackSectionHtml(key, head, songs, opts = {}) {
    const rows = Math.min(GRID_ROWS, songs.length);
    const body = `
      <div class="shelf-grid ${opts.ranked ? "ranked" : ""}" style="--rows:${rows}">
        ${songs.map((s, i) => trackRowHtml(s, i, opts)).join("")}
      </div>`;
    return sectionHtml(key, head, opts, body);
  }

  function sectionHtml(key, head, opts, body) {
    return `
      <section class="shelf ${opts.tucked ? "home-tucked-section" : "reveal-section"}">
        ${headerHtml(key, head)}
        ${body}
      </section>`;
  }

  // "Title >": the whole line opens the full section, and the dots play all of it
  function headerHtml(key, { title, label, thumb, roundThumb, more, playAll }) {
    const link = more?.route
      ? `data-more-route="${d.esc(more.route)}"`
      : more
      ? `data-more-browse="${d.esc(more.browseId)}" data-more-params="${d.esc(more.params || "")}" data-more-title="${d.esc(more.title)}"`
      : "";
    return `
      <div class="shelf-head ${more ? "is-link" : ""}" ${link}>
        ${thumb ? `<img class="shelf-head-thumb ${roundThumb ? "round" : ""}" src="${d.esc(d.proxyImg(d.sizedCover(thumb, 80)))}" alt="" />` : ""}
        <div class="shelf-head-titles">
          ${label ? `<span class="shelf-head-label">${d.esc(label)}</span>` : ""}
          <span class="shelf-head-title">${d.esc(title)}</span>
        </div>
        ${playAll ? `<button class="shelf-head-dots" data-play-list="${d.esc(key)}" title="Play all">${d.icons.more}</button>` : ""}
        ${more ? `<span class="shelf-head-chevron">${d.icons.chevron}</span>` : ""}
      </div>`;
  }

  // a song row: cover, two lines and a more button; ranked rows lead with their place
  function trackRowHtml(song, index, opts) {
    const json = d.esc(JSON.stringify(song));
    const current = d.nowPlaying().id === song.id;
    const thumb = d.songThumb(song);
    return `
      <div class="track-row ${current ? "active" : ""}" data-song-json="${json}" data-list-id="${d.esc(opts.listId || "")}" data-song-idx="${index}">
        ${opts.ranked ? `<span class="track-row-rank">${index + 1}</span>` : ""}
        <div class="track-row-art">
          ${thumb ? `<img src="${d.esc(d.proxyImg(d.sizedCover(thumb, 120)))}" loading="lazy" alt="" />` : ""}
          ${current ? `<div class="track-row-playing">${d.playingBarsHtml(d.nowPlaying().playing)}</div>` : ""}
        </div>
        <div class="track-row-meta">
          <div class="track-row-title">${d.esc(song.title)}${song.explicit ? ` <span class="explicit-badge">E</span>` : ""}</div>
          <div class="track-row-sub">${d.esc(d.artistNames(song))}</div>
        </div>
        <button class="track-row-more" data-more-song="${json}" title="More">${d.icons.more}</button>
      </div>`;
  }

  // the tall "Collections" card: the cover fills it and the words sit on a dark foot with a chevron
  function collectionCardHtml(item) {
    const v = item.data || item.value;
    if (!v) return "";
    const thumb = d.songThumb(v);
    return `
      <div class="collection-card" data-playlist-id="${d.esc(v.id)}">
        ${thumb ? `<img src="${d.esc(d.proxyImg(d.sizedCover(thumb, 480)))}" loading="lazy" alt="" />` : ""}
        <div class="collection-card-foot">
          <div class="collection-card-text">
            <div class="collection-card-title">${d.esc(v.title)}</div>
            <div class="collection-card-sub">${d.esc(v.author || v.songCountText || "Playlist")}</div>
          </div>
          <span class="collection-card-chevron">${d.icons.chevron}</span>
        </div>
      </div>`;
  }

  // the wide "Concert" frame for music videos: the 16:9 still with its words over a dark top edge
  function videoCardHtml(song) {
    const current = d.nowPlaying().id === song.id;
    const fallback = d.songThumb(song);
    const still = d.proxyImg(`https://i.ytimg.com/vi/${encodeURIComponent(song.id)}/hq720.jpg`);
    return `
      <div class="video-card ${current ? "active" : ""}" data-song-json="${d.esc(JSON.stringify(song))}">
        <img src="${d.esc(still)}" ${fallback ? `data-fallback="${d.esc(d.proxyImg(fallback))}"` : ""} loading="lazy" alt="" />
        ${current ? `<div class="video-card-playing">${d.playingBarsHtml(d.nowPlaying().playing)}</div>` : ""}
        <div class="video-card-text">
          <div class="video-card-title">${d.esc(videoTitle(song))}</div>
          <div class="video-card-sub">${d.esc(d.artistNames(song))}</div>
        </div>
      </div>`;
  }

  function isVideo(song) {
    return !!song && VIDEO_TYPES.has(song.musicVideoType);
  }

  // "Song (Official Music Video)" reads as just "Song" on a card that already looks like a video
  function videoTitle(song) {
    return song.title.replace(VIDEO_TAGS, "").trim() || song.title;
  }

  return { init, feedSectionHtml, coverSectionHtml, trackSectionHtml };
})();
