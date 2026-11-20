// ============================================================================
// Mochy Desktop Settings & Audio Lab UI (Full Mochy Android Option Parity)
// Two-pane sheet: Settings + Search Pill + 8 Category Bubbles | Interactive Right Pane
// ============================================================================
(function () {
  "use strict";

  const FX = () => window.MochyAudioFX;

  function defaultPrefs() {
    const lab = FX() ? FX().defaultAudioLabState() : {};
    return {
      audioLab: lab,
      playback: {
        keepPlayingWhenClosed: true,
        playAlongsideOtherApps: false,
        resumeOnBluetooth: false,
        pauseWhenMuted: false,
        saveLastState: true,
        keepShuffleOn: true,
        skipSilence: false,
        dontSkipOnFailure: false,
        skipTimeoutSec: 6
      },
      nowPlaying: {
        showFormatBadge: true,
        showSampleRate: false,
        youtubeCaptionTranslation: true,
        syncLyricsToVideo: true,
        romanizeAsMain: false,
        lyricsHighBloom: true,
        floatingLyrics: false,
        playVideoBackground: false,
        timestampMatching: true,
        videoQuality: "AUTO",
        disableVideoAutoplay: false,
        studioForVideos: false,
        canvasEnabled: true,
        canvasOrder: "APPLE_TIDAL_SPOTIFY",
        spotifyCanvas: false,
        canvasWifiOnly: true
      },
      behaviour: {
        larpMode: false,
        larpLevel: "MAXXING",
        appLanguage: "SYSTEM_DEFAULT",
        disableUpdateNotices: false,
        disableSettingDescriptions: false,
        offlineMode: false,
        dataSaver: false,
        dataSaverMobileOnly: true,
        proxyEnabled: false,
        proxyAddress: "",
        proxyType: "HTTP",
        proxyUsername: "",
        proxyPassword: "",
        albumsFromLikedSongs: false,
        localAutoMetadata: true,
        pauseSearchHistory: false,
        ytReportPlays: true
      },
      customisation: {
        appIcon: "Default",
        coverRoundingPx: 14,
        playlistStyle: "FLOW",
        playerStyle: "FLAGSHIP",
        landscapeFullCover: false,
        homeStyle: "MOCHYY",
        blurEnabled: true,
        progressiveBlur: true,
        blurQuality: "HIGH",
        blurStrengthPx: 26,
        elementBlur: true,
        animationEnabled: true,
        animationSpeed: 1.0,
        lyricsMotionStyle: "MOTION",
        romanisationEnabled: true,
        translateLyrics: false,
        showTopBarOnPlayer: false,
        showBottomBarOnPlayer: false,
        swipeRightAction: "Library",
        swipeLeftAction: "Queue",
        swipeDownAnywhere: false,
        openWithFinger: true
      },
      storage: {
        cacheLimitMb: 1024
      },
      devices: {
        stayReachable: true,
        showInPlayerMenu: true,
        syncNotifications: true
      },
      integrations: {
        discordEnabled: false,
        discordRefreshSeconds: 3,
        discordClearOnPause: false,
        discordActivityType: "LISTENING",
        discordActivityName: "{artist} on {app}",
        discordDetails: "{name}",
        discordState: "{artist}",
        discordLargeHover: "",
        discordSmallHover: "{quality}",
        discordSmallImage: "PLAYBACK_STATUS",
        discordBigImage: "ARTWORK",
        discordSpinSeconds: 8,
        discordSpinFps: 25,
        discordBtn1Label: "See on YouTube Music",
        discordBtn1Target: "YOUTUBE_MUSIC",
        discordBtn2Label: "Open Mochy",
        discordBtn2Target: "MOCHY",
        lastfmEnabled: true,
        lastfmNowPlaying: true,
        lastfmSendLikes: false,
        librefmEnabled: false,
        ytmAutoSync: true,
        ytmNewPlaylistsToYt: false,
        ytmReportPlays: true,
        ytmCopyHistory: false,
        ytmExcludeImports: false
      },
      experimental: {
        unlockLandscape: false,
        showStreamSourceToast: false,
        streamBackend: "INNERTUBEX",
        forcePlayback: false,
        forceYtBlur1500: false,
        forceMonthlyRecap: false,
        bigDiscStyles: false,
        musicHaptics: false,
        hapticSensitivity: "MEDIUM",
        hapticFocus: "VIBE"
      }
    };
  }

  function deepMerge(target, patch) {
    if (!patch || typeof patch !== "object") return target;
    const out = Array.isArray(target) ? [...target] : { ...target };
    for (const k of Object.keys(patch)) {
      const pv = patch[k];
      const tv = out[k];
      if (pv && typeof pv === "object" && !Array.isArray(pv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
        out[k] = deepMerge(tv, pv);
      } else if (pv !== undefined) {
        out[k] = pv;
      }
    }
    return out;
  }

  function ensurePrefsOnSettings(settings) {
    const def = defaultPrefs();
    settings.prefs = deepMerge(def, settings.prefs || {});
    return settings.prefs;
  }

  const LARP_LEVELS = [
    { id: "SKIBIDI", name: "Skibidi larper", badge: "FLAC · 24-bit / 96 kHz", dac: "FiiO KA17" },
    { id: "SIXTY_SEVEN", name: "67 larper", badge: "FLAC · 24-bit / 192 kHz", dac: "Chord Mojo 2" },
    { id: "BRAINROT", name: "Brainrot larper", badge: "FLAC · 32-bit / 384 kHz", dac: "Chord Hugo TT2" },
    { id: "MAXXING", name: "Maxxing larper", badge: "FLAC · 32-bit / 768 kHz", dac: "Wadax Atlantis Reference" }
  ];

  const APP_LANGUAGES = [
    ["SYSTEM_DEFAULT", "System default"],
    ["en", "English"],
    ["id", "Bahasa Indonesia"],
    ["ja", "日本語 (Japanese)"],
    ["ko", "한국어 (Korean)"],
    ["zh-CN", "简体中文"],
    ["zh-TW", "繁體中文"],
    ["es", "Español"],
    ["fr", "Français"],
    ["de", "Deutsch"],
    ["pt-BR", "Português (Brasil)"],
    ["ru", "Русский"],
    ["ar", "العربية"],
    ["hi", "हिन्दी"],
    ["vi", "Tiếng Việt"],
    ["th", "ไทย"],
    ["ms", "Bahasa Melayu"],
    ["tr", "Türkçe"],
    ["pl", "Polski"],
    ["it", "Italiano"],
    ["nl", "Nederlands"]
  ];

  const VIDEO_QUALITIES = [
    ["AUTO", "Auto · Drops lower on slow internet"],
    ["Q2160", "4K (2160p)"],
    ["Q1440", "1440p"],
    ["Q1080", "1080p"],
    ["Q720", "720p"],
    ["Q480", "480p"],
    ["Q360", "360p"],
    ["Q240", "240p"],
    ["Q144", "144p"]
  ];

  const CACHE_STOPS = [
    [0, "Off"],
    [256, "256 MB"],
    [512, "512 MB"],
    [1024, "1 GB"],
    [2048, "2 GB"],
    [4096, "4 GB"],
    [8192, "8 GB"],
    [-1, "Unlimited"]
  ];

  const ANIM_SPEED_STOPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  const SWIPE_ACTIONS = ["Library", "Queue", "Download", "PlayNext", "AddToPlaylist", "Details"];

  const CATEGORIES = [
    { id: "audio_lab", title: "Audio Lab", icon: "eq", sub: "Equalizer, Audio FX, CrossMix, Quality" },
    { id: "playback", title: "Playback", icon: "play", sub: "Queue, failures, skip silence, background" },
    { id: "now_playing", title: "Now playing", icon: "lyrics", sub: "Format badge, lyrics, videos, canvas" },
    { id: "behaviour", title: "App behaviour", icon: "tune", sub: "Larp mode, network, proxy, privacy" },
    { id: "customisation", title: "Customisation", icon: "palette", sub: "Rounding, styles, blur, animation" },
    { id: "storage", title: "Storage", icon: "storage", sub: "Usage breakdown, cache limit, backup" },
    { id: "devices", title: "Devices & Local", icon: "devices", sub: "Device link, local folders, rescan" },
    { id: "integrations", title: "Integrations & Lab", icon: "puzzle", sub: "Discord, scrobble, providers, experimental" }
  ];

  const SEARCH_INDEX = [
    { cat: "audio_lab", sub: "equalizer", title: "Equalizer", kw: "eq parametric 10 band autoeq preset bass treble preamp" },
    { cat: "audio_lab", sub: "audio_fx", title: "Reverb", kw: "room hall cathedral studio plate dreamy wet dry damping fx" },
    { cat: "audio_lab", sub: "audio_fx", title: "Loudness", kw: "boost compressor limiter gentle punchy night max normalize replaygain" },
    { cat: "audio_lab", sub: "audio_fx", title: "Spatial audio", kw: "crossfeed speakers 3d head shadow angle binaural" },
    { cat: "audio_lab", sub: "audio_fx", title: "Mono audio", kw: "both ears one earbud mono mix" },
    { cat: "audio_lab", sub: "audio_fx", title: "Dolby Atmos & surround", kw: "atmos binaural surround 5.1 7.1" },
    { cat: "audio_lab", sub: "audio_fx", title: "Playback speed & pitch", kw: "tempo slowed reverb nightcore semitones preserve pitch" },
    { cat: "audio_lab", sub: "audio_fx", title: "Exponential volume", kw: "logarithmic volume curve exponent limit" },
    { cat: "audio_lab", sub: "transition", title: "Transition & CrossMix", kw: "crossfade automix gapless 27 styles blend fade skip" },
    { cat: "audio_lab", sub: "transition", title: "Pause, play & skip fade", kw: "transport fade layered effect echo tape stop rewind filter" },
    { cat: "audio_lab", sub: "quality", title: "Audio Quality", kw: "bitrate opus aac flac lossless streaming download tier" },
    { cat: "audio_lab", sub: "pass", title: "Audio Pass", kw: "usb dac hi-res 32-bit resampler bit-perfect passthrough blockers" },
    { cat: "playback", title: "Keep playing even when closed", kw: "background playback" },
    { cat: "playback", title: "Play alongside other apps", kw: "audio focus mix" },
    { cat: "playback", title: "Resume on output connect", kw: "bluetooth headphones auto resume" },
    { cat: "playback", title: "Pause music when muted", kw: "volume zero auto pause" },
    { cat: "playback", title: "Save Player's last state", kw: "persistent queue session restore" },
    { cat: "playback", title: "Keep shuffle on", kw: "persistent shuffle across queues" },
    { cat: "playback", title: "Skip Silence", kw: "trim quiet gaps silence detector" },
    { cat: "playback", title: "Don't skip on failure & Timeout", kw: "stream failure retry timeout 5 20s" },
    { cat: "now_playing", title: "Audio format badge & sample rate", kw: "codec opus aac flac khz badge" },
    { cat: "now_playing", title: "Lyrics visuals & text size", kw: "blur glow bloom size alignment left center right" },
    { cat: "now_playing", title: "Romanisation & YouTube translations", kw: "romaji pinyin sync captions video" },
    { cat: "now_playing", title: "YouTube video background & Canvas", kw: "video quality canvas order wifi spotify" },
    { cat: "behaviour", title: "Larp mode", kw: "67 skibidi brainrot maxxing wadax atlantis 768 khz dac flex" },
    { cat: "behaviour", title: "Profile name & Hero auto-advance", kw: "user name greeting hero" },
    { cat: "behaviour", title: "Hide explicit songs on Home", kw: "explicit clean filter" },
    { cat: "behaviour", title: "Offline mode & Data saver", kw: "bandwidth lower quality offline" },
    { cat: "behaviour", title: "Proxy configuration", kw: "http socks5 host port auth" },
    { cat: "behaviour", title: "Albums from liked songs & Privacy", kw: "library pause search history youtube plays" },
    { cat: "customisation", title: "Cover rounding", kw: "corner radius px square round 0 45" },
    { cat: "customisation", title: "Home, Playlist & Player styles", kw: "mochyy listen now hop in flagship studio flow" },
    { cat: "customisation", title: "Blur, Progressive blur & Strength", kw: "glass frosted px quality" },
    { cat: "customisation", title: "Animation speed & Element blur", kw: "motion transition speed 0.5x 2x page wipe" },
    { cat: "customisation", title: "Lyrics animation style", kw: "style 1 2 boring plain romanisation translation" },
    { cat: "customisation", title: "Swipe gestures", kw: "left right queue library details" },
    { cat: "storage", title: "Storage breakdown & Cache limit", kw: "cache 256mb 1gb 8gb unlimited clear" },
    { cat: "storage", title: "Export / Import user data", kw: "backup restore json transfer" },
    { cat: "devices", title: "Device link & Pairing", kw: "phone tv sync remote mirror" },
    { cat: "devices", title: "Local music folders & Rescan", kw: "flac mp3 wav shared folders" },
    { cat: "integrations", title: "Discord Rich Presence", kw: "rpc listening playing activity hover spin" },
    { cat: "integrations", title: "Last.fm & Libre.fm scrobbling", kw: "scrobble now playing likes" },
    { cat: "integrations", title: "Lyrics Provider Priority", kw: "order enable disable drag move" },
    { cat: "integrations", title: "Experimental & Diagnostics", kw: "haptics cipher potoken crossmix test big disc" }
  ];

  const UI_ICONS = {
    search: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2" stroke-linecap="round"/></svg>`,
    eq: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="4" x2="5" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="19" y1="4" x2="19" y2="20"/><circle cx="5" cy="9" r="2.2" fill="currentColor"/><circle cx="12" cy="15" r="2.2" fill="currentColor"/><circle cx="19" cy="8" r="2.2" fill="currentColor"/></svg>`,
    play: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.5 5.2c0-1 1.1-1.6 2-1.1l10.2 6.8c.8.5.8 1.7 0 2.2L9.5 19.9c-.9.5-2-.1-2-1.1V5.2z"/></svg>`,
    lyrics: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/></svg>`,
    tune: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>`,
    palette: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="9.5" cy="9.5" r="1" fill="currentColor"/><circle cx="14.5" cy="9.5" r="1" fill="currentColor"/><circle cx="9" cy="14" r="1" fill="currentColor"/></svg>`,
    storage: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="6.5" rx="2"/><rect x="3" y="13.5" width="18" height="6.5" rx="2"/><circle cx="7" cy="7.25" r="1" fill="currentColor"/><circle cx="7" cy="16.75" r="1" fill="currentColor"/></svg>`,
    devices: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="15" height="11" rx="2"/><rect x="14" y="10" width="8" height="11" rx="1.8"/><line x1="6" y1="19" x2="11" y2="19"/></svg>`,
    puzzle: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`
  };

  let modalState = {
    category: "audio_lab",
    audioLabSub: null, // null | "equalizer" | "audio_fx" | "transition" | "quality" | "pass"
    eqTab: "graph", // "graph" | "bands" | "autoeq"
    selectedEqNode: 0,
    searchQuery: "",
    autoEqQuery: "",
    remoteAutoEqList: null,
    remoteAutoEqLoading: false,
    storageStats: null,
    linkState: null,
    pairing: null,
    showLarpSheet: false,
    diagnosticsInfo: ""
  };

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBytes(b) {
    const n = Number(b || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function activeFxList(lab) {
    const list = [];
    if (lab.reverb?.enabled) list.push("Reverb");
    if (lab.loudness?.enabled) list.push("Loudness");
    if (lab.spatial?.enabled) list.push(lab.spatial.mode === "Speakers" ? "Speakers" : "Crossfeed");
    if (lab.spatial?.mono) list.push("Mono");
    if (lab.spatial?.surround) list.push("Atmos");
    if ((lab.playback?.speed || 1) !== 1 || !lab.playback?.preservePitch || (lab.playback?.pitchSemitones || 0) !== 0) list.push(`${(lab.playback?.speed || 1).toFixed(2)}×`);
    if (lab.volume?.enabled) list.push("Volume curve");
    return list;
  }

  function eqCurveSvgPath(eqState, width, height, paddingY = 8) {
    if (!FX()) return "";
    const pts = [];
    const steps = 64;
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const f = Math.pow(10, minLog + ((maxLog - minLog) * i) / steps);
      const db = Math.max(-13, Math.min(13, FX().combinedEqResponseDb(eqState, f)));
      const y = height / 2 - (db / 13) * (height / 2 - paddingY);
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }

  function eqMiniHubCardSvg(eq) {
    const d = eqCurveSvgPath(eq, 220, 62, 10);
    const col = eq.enabled ? "#ffffff" : "rgba(255,255,255,0.34)";
    return `
      <svg viewBox="0 0 220 62" width="100%" height="58" style="display:block;">
        <line x1="0" y1="31" x2="220" y2="31" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"/>
        <path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }

  function toggleRowHtml(id, title, desc, checked, hideDesc) {
    return `
      <div class="ms-row" data-setting-row="${esc(id)}">
        <div class="ms-row-text">
          <div class="ms-row-title">${esc(title)}</div>
          ${!hideDesc && desc ? `<div class="ms-row-desc">${esc(desc)}</div>` : ""}
        </div>
        <button class="toggle-switch ${checked ? "on" : ""}" id="${esc(id)}" aria-pressed="${checked ? "true" : "false"}"></button>
      </div>`;
  }

  function sliderRowHtml(id, title, desc, valText, { min, max, step = 1, value }, hideDesc) {
    return `
      <div class="ms-row ms-row-col">
        <div class="ms-row-head">
          <div class="ms-row-text">
            <div class="ms-row-title">${esc(title)}</div>
            ${!hideDesc && desc ? `<div class="ms-row-desc">${esc(desc)}</div>` : ""}
          </div>
          <span class="ms-val-pill" id="${esc(id)}-val">${esc(valText)}</span>
        </div>
        <input class="ms-slider" type="range" id="${esc(id)}" min="${min}" max="${max}" step="${step}" value="${value}" />
      </div>`;
  }

  function selectRowHtml(id, title, desc, options, currentVal, hideDesc) {
    return `
      <div class="ms-row">
        <div class="ms-row-text">
          <div class="ms-row-title">${esc(title)}</div>
          ${!hideDesc && desc ? `<div class="ms-row-desc">${esc(desc)}</div>` : ""}
        </div>
        <select class="ms-select" id="${esc(id)}">
          ${options
            .map(([val, label]) => `<option value="${esc(val)}" ${val === currentVal ? "selected" : ""}>${esc(label)}</option>`)
            .join("")}
        </select>
      </div>`;
  }

  function renderSettingsModal(ctx) {
    const layer = document.getElementById("modal-layer");
    if (!layer) return;
    layer.classList.remove("hidden");

    const settings = ctx.getSettings();
    const prefs = ensurePrefsOnSettings(settings);
    const hideDesc = !!prefs.behaviour.disableSettingDescriptions;
    const isSearching = modalState.searchQuery.trim().length > 0;

    layer.innerHTML = `
      <div class="mochy-settings-sheet" id="modal-inner">
        <button class="ms-close-btn" id="ms-close-btn" title="Close (Esc)">${UI_ICONS.close}</button>

        <aside class="ms-left-rail">
          <h2 class="ms-title">Settings</h2>
          <div class="ms-search-pill">
            ${UI_ICONS.search}
            <input type="text" id="ms-search-input" placeholder="Search settings" value="${esc(modalState.searchQuery)}" />
            ${modalState.searchQuery ? `<button class="ms-search-clear" id="ms-search-clear">${UI_ICONS.close}</button>` : ""}
          </div>
          <nav class="ms-cat-list">
            ${CATEGORIES.map(
              (c) => `
              <button class="ms-cat-pill ${!isSearching && modalState.category === c.id ? "selected" : ""}" data-ms-cat="${esc(c.id)}">
                <span class="ms-cat-icon">${UI_ICONS[c.icon]}</span>
                <span class="ms-cat-title">${esc(c.title)}</span>
              </button>`
            ).join("")}
          </nav>
        </aside>

        <div class="ms-divider"></div>

        <main class="ms-right-pane" id="ms-right-pane">
          ${
            isSearching
              ? renderSearchResultsHtml(modalState.searchQuery)
              : renderCategoryHtml(modalState.category, settings, prefs, hideDesc, ctx)
          }
        </main>
      </div>
    `;

    bindSettingsEvents(layer, ctx);
  }

  function renderSearchResultsHtml(q) {
    const needle = q.trim().toLowerCase();
    const hits = SEARCH_INDEX.filter(
      (item) => item.title.toLowerCase().includes(needle) || item.kw.toLowerCase().includes(needle) || item.cat.toLowerCase().includes(needle)
    );
    return `
      <div class="ms-pane-head">
        <h3 class="ms-pane-title">Results for "${esc(q.trim())}"</h3>
      </div>
      ${
        hits.length
          ? `<div class="ms-section-stack">
              ${hits
                .map((h) => {
                  const cat = CATEGORIES.find((c) => c.id === h.cat);
                  return `
                    <button class="ms-search-hit" data-hit-cat="${esc(h.cat)}" data-hit-sub="${esc(h.sub || "")}">
                      <div>
                        <div class="ms-row-title">${esc(h.title)}</div>
                        <div class="ms-row-desc">${esc(cat?.title || h.cat)}</div>
                      </div>
                      <span class="ms-pill-tag">Open</span>
                    </button>`;
                })
                .join("")}
            </div>`
          : `<div class="ms-empty">Nothing matches "${esc(q.trim())}"</div>`
      }`;
  }

  function renderCategoryHtml(cat, settings, prefs, hideDesc, ctx) {
    switch (cat) {
      case "audio_lab":
        if (modalState.audioLabSub === "equalizer") return renderEqualizerHtml(prefs, hideDesc);
        if (modalState.audioLabSub === "audio_fx") return renderAudioFxHtml(settings, prefs, hideDesc);
        if (modalState.audioLabSub === "transition") return renderTransitionHtml(prefs, hideDesc);
        if (modalState.audioLabSub === "quality") return renderAudioQualityHtml(settings, prefs, hideDesc);
        if (modalState.audioLabSub === "pass") return renderAudioPassHtml(settings, prefs, hideDesc);
        return renderAudioLabHubHtml(prefs);
      case "playback":
        return renderPlaybackHtml(prefs, hideDesc);
      case "now_playing":
        return renderNowPlayingHtml(settings, prefs, hideDesc);
      case "behaviour":
        return renderBehaviourHtml(settings, prefs, hideDesc);
      case "customisation":
        return renderCustomisationHtml(settings, prefs, hideDesc);
      case "storage":
        return renderStorageHtml(settings, prefs, hideDesc);
      case "devices":
        return renderDevicesHtml(settings, prefs, hideDesc, ctx);
      case "integrations":
        return renderIntegrationsHtml(settings, prefs, hideDesc, ctx);
      default:
        return "";
    }
  }

  // --------------------------------------------------------------------------
  // 1. Audio Lab Hub + Subscreens (Equalizer, Audio FX, Transition, Quality, Pass)
  // --------------------------------------------------------------------------
  function renderAudioLabHubHtml(prefs) {
    const lab = prefs.audioLab;
    const fxActive = activeFxList(lab);
    const fxStatus = fxActive.length ? fxActive.slice(0, 3).join(", ") : "Off";
    const presetObj =
      FX()?.EQ_PRESETS.find((p) => p.id === lab.eq.presetId) ||
      (lab.presets || []).find((p) => p.id === lab.eq.presetId);
    const eqStatus = !lab.eq.enabled ? "Off" : presetObj ? presetObj.name : "Custom";
    const cmMode = lab.crossmix.mode;
    const cmStatus =
      cmMode === "OFF"
        ? "Off"
        : cmMode === "AUTO_CROSSFADE"
        ? "Auto Crossfade (5s)"
        : cmMode === "MANUAL_CROSSFADE"
        ? `Crossfade (${lab.crossmix.crossfadeDuration}s)`
        : "CrossMix";
    const qLabel = { auto: "Auto", high: "High (Opus)", medium: "Medium (AAC)", low: "Low" }[lab.quality.stream] || "Auto";
    const passStatus = lab.pass.usbPassthrough ? lab.pass.mode.replace("_", " ") : "System Output";

    return `
      <div class="ms-pane-head">
        <div>
          <h3 class="ms-pane-title">Audio <span style="opacity:0.6;">Lab</span></h3>
          <div class="ms-row-desc">Real-time Web Audio equalizer, FX rack, CrossMix & quality</div>
        </div>
      </div>

      <div class="alab-hub-grid-2">
        <button class="alab-card big ${lab.eq.enabled ? "active" : ""}" data-alab-sub="equalizer">
          <div class="alab-card-top">
            <span class="alab-card-title">Equalizer</span>
            <span class="alab-dot ${lab.eq.enabled ? "on" : ""}"></span>
          </div>
          <div class="alab-card-sub">${esc(eqStatus)}${lab.eq.correction && lab.eq.correctionEnabled ? ` + ${esc(lab.eq.correction.model)}` : ""}</div>
          <div class="alab-sketch">${eqMiniHubCardSvg(lab.eq)}</div>
        </button>

        <button class="alab-card big ${fxActive.length ? "active" : ""}" data-alab-sub="audio_fx">
          <div class="alab-card-top">
            <span class="alab-card-title">Audio FX</span>
            <span class="alab-dot ${fxActive.length ? "on" : ""}"></span>
          </div>
          <div class="alab-card-sub">${esc(fxStatus)}</div>
          <div class="alab-fx-pills">
            ${["Reverb", "Loudness", "Spatial", "Atmos", `${(lab.playback.speed || 1).toFixed(2)}×`]
              .map((tag) => `<span class="alab-mini-tag ${fxActive.some((x) => x.startsWith(tag.slice(0, 4))) ? "on" : ""}">${tag}</span>`)
              .join("")}
          </div>
        </button>
      </div>

      <div class="alab-hub-grid-3">
        <button class="alab-card small ${cmMode !== "OFF" ? "active" : ""}" data-alab-sub="transition">
          <div class="alab-card-title">Transition</div>
          <div class="alab-card-sub">${esc(cmStatus)}</div>
        </button>
        <button class="alab-card small" data-alab-sub="quality">
          <div class="alab-card-title">Audio Quality</div>
          <div class="alab-card-sub">${esc(qLabel)}</div>
        </button>
        <button class="alab-card small ${lab.pass.usbPassthrough || lab.pass.preferUsbDac ? "active" : ""}" data-alab-sub="pass">
          <div class="alab-card-title">Audio Pass</div>
          <div class="alab-card-sub">${esc(passStatus)}</div>
        </button>
      </div>`;
  }

  function renderSubHeadHtml(title, backTarget, extraHtml = "") {
    return `
      <div class="ms-pane-head sub">
        <div class="ms-sub-left">
          <button class="ms-back-pill" data-ms-back="${esc(backTarget)}">${UI_ICONS.arrowLeft}<span>Audio Lab</span></button>
          <h3 class="ms-pane-title">${esc(title)}</h3>
        </div>
        <div class="ms-sub-actions">${extraHtml}</div>
      </div>`;
  }

  function renderEqualizerHtml(prefs, hideDesc) {
    const eq = prefs.audioLab.eq;
    const headroom = FX().computeAutoHeadroomDb(eq);
    const effectivePreamp = ((eq.preamp || 0) + (eq.autoPreamp ? headroom : 0)).toFixed(1);
    const nodes = eq.nodes || FX().flatNodes();
    const selIdx = Math.max(0, Math.min(nodes.length - 1, modalState.selectedEqNode));
    const selNode = nodes[selIdx] || nodes[0];

    const headerRight = `
      <button class="ms-mini-btn" id="eq-reset-btn">Reset</button>
      <button class="ms-mini-btn" id="eq-save-btn">Save</button>
      <button class="toggle-switch ${eq.enabled ? "on" : ""}" id="eq-master-toggle"></button>`;

    const presetChips = `
      <div class="ms-chip-scroll">
        ${(prefs.audioLab.presets || [])
          .map(
            (p) => `
          <div class="ms-chip-wrap">
            <button class="ms-chip ${eq.presetId === p.id ? "active" : ""}" data-eq-user-preset="${esc(p.id)}">${esc(p.name)}</button>
            <button class="ms-chip-del" data-eq-del-preset="${esc(p.id)}" title="Delete">×</button>
          </div>`
          )
          .join("")}
        ${eq.presetId == null ? `<button class="ms-chip active" disabled>Custom</button>` : ""}
        ${FX().EQ_PRESETS.map(
          (p) => `<button class="ms-chip ${eq.presetId === p.id ? "active" : ""}" data-eq-preset="${esc(p.id)}">${esc(p.name)}</button>`
        ).join("")}
      </div>`;

    let bodyHtml = "";
    if (modalState.eqTab === "graph") {
      const W = 540, H = 190, PAD_Y = 18;
      const minLog = Math.log10(20), maxLog = Math.log10(20000);
      const fToX = (f) => ((Math.log10(Math.max(20, Math.min(20000, f))) - minLog) / (maxLog - minLog)) * W;
      const dbToY = (db) => H / 2 - (Math.max(-13, Math.min(13, db)) / 13) * (H / 2 - PAD_Y);
      const gridFreqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const pathD = eqCurveSvgPath(eq, W, H, PAD_Y);
      const areaD = `${pathD} L${W},${H / 2} L0,${H / 2} Z`;

      bodyHtml = `
        <div class="eq-graph-card">
          <div class="eq-graph-toolbar">
            <span>20 Hz – 20 kHz Parametric Curve (${nodes.length}/16 nodes)</span>
            <button class="ms-mini-btn" id="eq-add-node-btn" ${nodes.length >= 16 ? "disabled" : ""}>+ Add node</button>
          </div>
          <svg class="eq-graph-svg" id="eq-graph-svg" viewBox="0 0 ${W} ${H}">
            <defs>
              <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
                <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
              </linearGradient>
            </defs>
            ${gridFreqs
              .map((f) => {
                const x = fToX(f).toFixed(1);
                return `<line x1="${x}" y1="6" x2="${x}" y2="${H - 18}" stroke="rgba(255,255,255,0.06)"/>
                        <text x="${x}" y="${H - 4}" text-anchor="middle" fill="rgba(255,255,255,0.38)" font-size="9">${f >= 1000 ? `${f / 1000}k` : f}</text>`;
              })
              .join("")}
            ${[-12, -6, 0, 6, 12]
              .map((db) => `<line x1="0" y1="${dbToY(db).toFixed(1)}" x2="${W}" y2="${dbToY(db).toFixed(1)}" stroke="rgba(255,255,255,${db === 0 ? "0.18" : "0.06"})"/>`)
              .join("")}
            <path d="${areaD}" fill="url(#eqFill)"/>
            <path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
            ${nodes
              .map((n, i) => {
                const cx = fToX(n.freq).toFixed(1);
                const cy = dbToY(n.gain).toFixed(1);
                const active = i === selIdx;
                return `<circle class="eq-node-dot ${active ? "selected" : ""} ${n.enabled === false ? "muted" : ""}" data-eq-node="${i}" cx="${cx}" cy="${cy}" r="${active ? 7 : 5}" />`;
              })
              .join("")}
          </svg>
        </div>

        <div class="ms-card-group">
          <div class="ms-node-pills">
            ${nodes
              .map(
                (n, i) => `
              <button class="ms-node-pill ${i === selIdx ? "active" : ""}" data-eq-sel="${i}">
                #${i + 1} · ${n.freq >= 1000 ? `${(n.freq / 1000).toFixed(1)}k` : Math.round(n.freq)}
              </button>`
              )
              .join("")}
          </div>
          ${
            selNode
              ? `
            <div class="ms-filter-chips">
              ${[
                ["LSC", "Low shelf"],
                ["PK", "Peak"],
                ["HSC", "High shelf"]
              ]
                .map(([t, lbl]) => `<button class="ms-chip ${selNode.type === t ? "active" : ""}" data-eq-type="${t}">${lbl}</button>`)
                .join("")}
              <button class="toggle-switch ${selNode.enabled !== false ? "on" : ""}" id="eq-node-enable" title="Enable node"></button>
              ${nodes.length > 1 ? `<button class="ms-mini-btn danger" id="eq-remove-node-btn">Remove</button>` : ""}
            </div>
            ${sliderRowHtml("eq-node-gain", "Gain", "Boost or cut for this node", `${selNode.gain > 0 ? "+" : ""}${Number(selNode.gain).toFixed(1)} dB`, { min: -12, max: 12, step: 0.1, value: selNode.gain }, hideDesc)}
            ${sliderRowHtml("eq-node-freq", "Frequency", "Center / corner frequency", `${Math.round(selNode.freq)} Hz`, { min: Math.log10(20).toFixed(3), max: Math.log10(20000).toFixed(3), step: 0.005, value: Math.log10(Math.max(20, selNode.freq)).toFixed(3) }, hideDesc)}
            ${sliderRowHtml("eq-node-q", "Q factor", "Bandwidth sharpness", `${Number(selNode.q).toFixed(2)}`, { min: -1, max: 1, step: 0.01, value: Math.log10(Math.max(0.1, selNode.q)).toFixed(2) }, hideDesc)}
          `
              : ""
          }
        </div>`;
    } else if (modalState.eqTab === "bands") {
      bodyHtml = `
        <div class="eq-bands-wrap">
          ${nodes
            .slice(0, 16)
            .map(
              (n, i) => `
            <div class="eq-band-col">
              <span class="eq-band-db" id="eq-band-val-${i}">${n.gain > 0 ? "+" : ""}${Number(n.gain).toFixed(1)}</span>
              <input class="eq-vert-slider" type="range" orient="vertical" min="-12" max="12" step="0.5" value="${n.gain}" data-eq-band="${i}" />
              <span class="eq-band-hz">${n.freq >= 1000 ? `${Math.round((n.freq / 1000) * 10) / 10}k` : Math.round(n.freq)}</span>
            </div>`
            )
            .join("")}
        </div>`;
    } else {
      const corr = eq.correction;
      const q = modalState.autoEqQuery.trim().toLowerCase();
      const basePool = modalState.remoteAutoEqList || FX().BUILTIN_AUTOEQ_MODELS;
      const matches = (q
        ? basePool.filter((m) => m.model.toLowerCase().includes(q) || (m.source || "").toLowerCase().includes(q))
        : basePool
      ).slice(0, 14);

      bodyHtml = `
        <div class="ms-card-group">
          ${
            corr
              ? `
            <div class="ms-row">
              <div class="ms-row-text">
                <div class="ms-row-title">${esc(corr.model)}</div>
                <div class="ms-row-desc">${esc(corr.source)}${corr.rig ? ` · ${esc(corr.rig)}` : ""} · ${corr.filters?.length || 0} filters</div>
              </div>
              <button class="ms-mini-btn danger" id="autoeq-remove-btn">Remove</button>
            </div>
            ${toggleRowHtml("autoeq-enable-toggle", "Apply correction", "Flattens headphones toward Harman target under your curve", eq.correctionEnabled !== false, hideDesc)}
            ${sliderRowHtml("autoeq-bass", "Target Bass", "Low shelf warmth adjustment", `${(corr.tuning?.bass || 0) > 0 ? "+" : ""}${Number(corr.tuning?.bass || 0).toFixed(0)} dB`, { min: -6, max: 6, step: 1, value: corr.tuning?.bass || 0 }, hideDesc)}
          `
              : `<div class="ms-row-desc" style="padding:4px 2px;">Pick your headphones below or search AutoEQ catalog.</div>`
          }
          <div class="ms-inline-search">
            <input type="text" class="ms-input" id="autoeq-search-input" placeholder="Search headphones (AirPods, Sony XM5, HD 600...)" value="${esc(modalState.autoEqQuery)}" />
            <button class="ms-mini-btn" id="autoeq-fetch-btn">${modalState.remoteAutoEqLoading ? "Loading..." : modalState.remoteAutoEqList ? `${modalState.remoteAutoEqList.length} loaded` : "Load full GitHub DB"}</button>
          </div>
          <div class="autoeq-list">
            ${matches
              .map(
                (m) => `
              <button class="ms-row autoeq-item" data-autoeq-pick="${esc(m.path)}">
                <div class="ms-row-text">
                  <div class="ms-row-title">${esc(m.model)}</div>
                  <div class="ms-row-desc">${esc(m.source)}${m.rig ? ` · ${esc(m.rig)}` : ""}</div>
                </div>
                <span class="ms-pill-tag">${corr?.path === m.path ? "Active" : "Apply"}</span>
              </button>`
              )
              .join("")}
          </div>
        </div>`;
    }

    return `
      ${renderSubHeadHtml("Equalizer", "audio_lab", headerRight)}
      <div class="ms-seg-bar">
        <button class="ms-seg-btn ${modalState.eqTab === "graph" ? "active" : ""}" data-eq-tab="graph">Graph</button>
        <button class="ms-seg-btn ${modalState.eqTab === "bands" ? "active" : ""}" data-eq-tab="bands">Bands</button>
        <button class="ms-seg-btn ${modalState.eqTab === "autoeq" ? "active" : ""}" data-eq-tab="autoeq">AutoEQ</button>
      </div>
      ${presetChips}
      ${bodyHtml}
      <div class="ms-section-title">Output</div>
      <div class="ms-card-group">
        ${sliderRowHtml("eq-preamp-slider", "Preamp", `Effective output: ${effectivePreamp} dB (with Auto preamp: ${headroom.toFixed(1)} dB)`, `${eq.preamp > 0 ? "+" : ""}${Number(eq.preamp || 0).toFixed(1)} dB`, { min: -12, max: 6, step: 0.5, value: eq.preamp || 0 }, hideDesc)}
        ${toggleRowHtml("eq-auto-preamp", "Auto preamp", "Automatically backs off gain when boosts approach digital clipping", eq.autoPreamp !== false, hideDesc)}
      </div>`;
  }

  function renderAudioFxHtml(settings, prefs, hideDesc) {
    const lab = prefs.audioLab;
    const rv = lab.reverb;
    const ld = lab.loudness;
    const sp = lab.spatial;
    const pb = lab.playback;
    const vol = lab.volume;
    const norm = lab.normalize;

    return `
      ${renderSubHeadHtml("Audio FX", "audio_lab")}

      <div class="fx-card ${rv.enabled ? "on" : ""}">
        <div class="fx-card-head">
          <div><div class="ms-row-title">Reverb</div><div class="ms-row-desc">Reverb the music with Freeverb impulse response</div></div>
          <button class="toggle-switch ${rv.enabled ? "on" : ""}" id="fx-reverb-toggle"></button>
        </div>
        ${
          rv.enabled
            ? `
          <div class="ms-chip-scroll">
            ${rv.presetId == null ? `<button class="ms-chip active" disabled>Custom</button>` : ""}
            ${FX().REVERB_PRESETS.map((p) => `<button class="ms-chip ${rv.presetId === p.id ? "active" : ""}" data-reverb-preset="${esc(p.id)}">${esc(p.name)}</button>`).join("")}
          </div>
          ${sliderRowHtml("rv-mix", "Mix", "", `${Math.round(rv.mix * 100)}%`, { min: 0, max: 1, step: 0.01, value: rv.mix }, true)}
          ${sliderRowHtml("rv-size", "Room size", "", `${Math.round(rv.roomSize * 100)}%`, { min: 0, max: 1, step: 0.01, value: rv.roomSize }, true)}
          ${sliderRowHtml("rv-damp", "Damping", "", `${Math.round(rv.damping * 100)}%`, { min: 0, max: 1, step: 0.01, value: rv.damping }, true)}
          ${sliderRowHtml("rv-wet", "Wet", "", `${Math.round(rv.wet * 100)}%`, { min: 0, max: 1, step: 0.01, value: rv.wet }, true)}
          <div class="fx-fine-label">FINE TUNE</div>
          ${sliderRowHtml("rv-dry", "Dry", "", `${Math.round(rv.dry * 100)}%`, { min: 0, max: 1, step: 0.01, value: rv.dry }, true)}
          ${sliderRowHtml("rv-width", "Width", "", `${Math.round(rv.width * 100)}%`, { min: 0, max: 1, step: 0.01, value: rv.width }, true)}
          ${sliderRowHtml("rv-predelay", "Pre-delay", "", `${Math.round(rv.preDelayMs)} ms`, { min: 0, max: 120, step: 1, value: rv.preDelayMs }, true)}
          ${sliderRowHtml("rv-lowcut", "Low cut", "", `${Math.round(rv.lowCutHz)} Hz`, { min: 20, max: 1000, step: 10, value: rv.lowCutHz }, true)}
        `
            : ""
        }
      </div>

      <div class="fx-card ${ld.enabled ? "on" : ""}">
        <div class="fx-card-head">
          <div><div class="ms-row-title">Loudness</div><div class="ms-row-desc">Louder and fuller, never clipping</div></div>
          <button class="toggle-switch ${ld.enabled ? "on" : ""}" id="fx-loudness-toggle"></button>
        </div>
        ${
          ld.enabled
            ? `
          <div class="ms-chip-scroll">
            ${FX().LOUDNESS_PRESETS.map((p) => `<button class="ms-chip ${ld.boostDb === p.boostDb && ld.compression === p.compression ? "active" : ""}" data-loud-preset="${esc(p.id)}">${esc(p.name)}</button>`).join("")}
          </div>
          ${sliderRowHtml("ld-boost", "Boost", "", `+${Number(ld.boostDb).toFixed(1)} dB`, { min: 0, max: 12, step: 0.5, value: ld.boostDb }, true)}
          ${sliderRowHtml("ld-comp", "Compression", "", `${Math.round(ld.compression * 100)}%`, { min: 0, max: 1, step: 0.01, value: ld.compression }, true)}
        `
            : ""
        }
        <div class="fx-divider"></div>
        ${toggleRowHtml("fx-norm-toggle", "Even out songs", "Plays every song at the same loudness", settings.normalizeVolume, hideDesc)}
        ${
          settings.normalizeVolume
            ? `
          <div class="ms-chip-scroll">
            ${["Track", "Album"].map((m) => `<button class="ms-chip ${norm.replayGainMode === m ? "active" : ""}" data-rg-mode="${m}">ReplayGain: ${m}</button>`).join("")}
          </div>
          ${sliderRowHtml("rg-preamp", "Normalization Preamp", "", `${norm.preampDb > 0 ? "+" : ""}${Number(norm.preampDb).toFixed(1)} dB`, { min: -6, max: 6, step: 0.5, value: norm.preampDb }, true)}
        `
            : ""
        }
      </div>

      <div class="fx-card ${sp.enabled ? "on" : ""}">
        <div class="fx-card-head">
          <div><div class="ms-row-title">Spatial audio</div><div class="ms-row-desc">Takes stereo out of your head and puts it in front of you</div></div>
          <button class="toggle-switch ${sp.enabled ? "on" : ""}" id="fx-spatial-toggle"></button>
        </div>
        ${
          sp.enabled
            ? `
          <div class="ms-seg-bar">
            <button class="ms-seg-btn ${sp.mode === "Crossfeed" ? "active" : ""}" data-sp-mode="Crossfeed">Crossfeed</button>
            <button class="ms-seg-btn ${sp.mode === "Speakers" ? "active" : ""}" data-sp-mode="Speakers">Speakers</button>
          </div>
          ${
            sp.mode === "Crossfeed"
              ? `
            <div class="ms-chip-scroll">
              ${FX().SPATIAL_PRESETS.map((p) => `<button class="ms-chip ${sp.cutoffHz === p.cutoffHz && sp.feedDb === p.feedDb ? "active" : ""}" data-sp-preset="${esc(p.id)}">${esc(p.name)}</button>`).join("")}
            </div>
            ${sliderRowHtml("sp-cutoff", "Head shadow", "", `${Math.round(sp.cutoffHz)} Hz`, { min: 300, max: 1500, step: 10, value: sp.cutoffHz }, true)}
            ${sliderRowHtml("sp-feed", "Crossfeed", "", `-${Number(sp.feedDb).toFixed(1)} dB`, { min: 1, max: 15, step: 0.5, value: sp.feedDb }, true)}
          `
              : `${sliderRowHtml("sp-angle", "Speaker angle", "", `±${Math.round(sp.speakerAngle)}°`, { min: 10, max: 90, step: 1, value: sp.speakerAngle }, true)}`
          }
          ${sliderRowHtml("sp-amount", "Amount", "", `${Math.round(sp.amount * 100)}%`, { min: 0, max: 1, step: 0.01, value: sp.amount }, true)}
        `
            : ""
        }
      </div>

      <div class="fx-card ${sp.mono ? "on" : ""}">
        ${toggleRowHtml("fx-mono-toggle", "Mono audio", "Both ears hear the whole mix: for one earbud or hearing in one ear", !!sp.mono, hideDesc)}
      </div>

      <div class="fx-card ${sp.surround ? "on" : ""}">
        ${toggleRowHtml("fx-atmos-toggle", "Dolby Atmos & surround", "Binaural spatial width rendering on any headphones", !!sp.surround, hideDesc)}
      </div>

      <div class="fx-card ${pb.speed !== 1 || !pb.preservePitch || pb.pitchSemitones !== 0 ? "on" : ""}">
        <div class="fx-card-head">
          <div><div class="ms-row-title">Playback speed</div><div class="ms-row-desc">${Number(pb.speed || 1).toFixed(2)}×${pb.preservePitch ? "" : " · pitched"}${pb.pitchSemitones ? ` · ${pb.pitchSemitones > 0 ? "+" : ""}${pb.pitchSemitones} st` : ""}</div></div>
          <div class="ms-sub-actions">
            <button class="ms-mini-btn" id="fx-speed-minus">−0.05</button>
            <button class="ms-mini-btn" id="fx-speed-plus">+0.05</button>
            <button class="ms-mini-btn" id="fx-speed-reset">Reset</button>
          </div>
        </div>
        <div class="ms-chip-scroll">
          ${FX().SPEED_PRESETS.map((p) => `<button class="ms-chip ${pb.speed === p.speed && pb.preservePitch === p.preservePitch ? "active" : ""}" data-speed-preset="${esc(p.id)}">${esc(p.name)}</button>`).join("")}
        </div>
        ${sliderRowHtml("pb-speed", "Speed", "", `${Number(pb.speed || 1).toFixed(2)}×`, { min: 0.25, max: 3.0, step: 0.01, value: pb.speed || 1 }, true)}
        ${toggleRowHtml("pb-preserve-pitch", "Preserve pitch", "Keep the original key when changing speed", pb.preservePitch !== false, hideDesc)}
        ${
          pb.preservePitch !== false
            ? sliderRowHtml("pb-pitch-st", "Pitch shift", "", `${pb.pitchSemitones > 0 ? "+" : ""}${pb.pitchSemitones || 0} st`, { min: -12, max: 12, step: 1, value: pb.pitchSemitones || 0 }, true)
            : ""
        }
      </div>

      <div class="fx-card ${vol.enabled ? "on" : ""}">
        <div class="fx-card-head">
          <div><div class="ms-row-title">Exponential volume</div><div class="ms-row-desc">A logarithmic curve, for finer control at low volume</div></div>
          <button class="toggle-switch ${vol.enabled ? "on" : ""}" id="fx-volume-toggle"></button>
        </div>
        ${
          vol.enabled
            ? `
          <div class="ms-chip-scroll">
            ${FX().VOLUME_PRESETS.map((p) => `<button class="ms-chip ${vol.exponent === p.exponent ? "active" : ""}" data-vol-preset="${esc(p.id)}">${esc(p.name)}</button>`).join("")}
          </div>
          ${sliderRowHtml("vol-exp", "Curve", "", `x^${Number(vol.exponent).toFixed(1)}`, { min: 1, max: 4, step: 0.1, value: vol.exponent }, true)}
          ${sliderRowHtml("vol-limit", "Volume limit", "", `${Math.round(vol.limit * 100)}%`, { min: 0.2, max: 1, step: 0.01, value: vol.limit }, true)}
        `
            : ""
        }
      </div>`;
  }

  function renderTransitionHtml(prefs, hideDesc) {
    const cm = prefs.audioLab.crossmix;
    const isOff = cm.mode === "OFF";
    const stylesByGroup = ["Auto", "Everyday", "Lift", "Fall", "Flavour"];

    return `
      ${renderSubHeadHtml("Transition", "audio_lab", `<button class="ms-mini-btn" id="cm-test-btn">Test FX</button>`)}

      <div class="ms-section-title">Music transitions</div>
      <div class="ms-card-group">
        ${toggleRowHtml("cm-off-toggle", "Off", "Boring boring boring — disable smooth song-to-song transitions", isOff, hideDesc)}
      </div>

      <div class="cm-mode-grid">
        ${[
          ["AUTO_CROSSFADE", "Auto Crossfade", "Smooth 5s blend near the end of each song"],
          ["MANUAL_CROSSFADE", "Manual Crossfade", `Custom ${cm.crossfadeDuration}s crossfade length`],
          ["CROSSMIX", "CrossMix", "DJ-style FX & smart tempo-matched transitions"]
        ]
          .map(
            ([id, title, sub]) => `
          <button class="cm-mode-card ${cm.mode === id ? "selected" : ""}" data-cm-mode="${id}">
            <div class="ms-row-title">${esc(title)}</div>
            <div class="ms-row-desc">${esc(sub)}</div>
          </button>`
          )
          .join("")}
      </div>

      ${
        cm.mode === "MANUAL_CROSSFADE"
          ? `<div class="ms-card-group">${sliderRowHtml("cm-dur", "Length", "", `${cm.crossfadeDuration} s`, { min: 1, max: 20, step: 1, value: cm.crossfadeDuration }, hideDesc)}</div>`
          : ""
      }

      ${
        cm.mode === "CROSSMIX"
          ? `
        <div class="ms-card-group">
          <div class="ms-row">
            <div class="ms-row-text">
              <div class="ms-row-title">Transition Style</div>
              ${!hideDesc ? `<div class="ms-row-desc">Let Mochy choose or pick one of the 27 DJ mix envelopes</div>` : ""}
            </div>
            <select class="ms-select" id="cm-style-select">
              ${stylesByGroup
                .map(
                  (grp) => `
                <optgroup label="${esc(grp)}">
                  ${FX()
                    .CROSSMIX_STYLES.filter((s) => s.group === grp)
                    .map((s) => `<option value="${esc(s.id)}" ${cm.style === s.id ? "selected" : ""}>${esc(s.name)}</option>`)
                    .join("")}
                </optgroup>`
                )
                .join("")}
            </select>
          </div>
          <div class="ms-row">
            <div class="ms-row-text"><div class="ms-row-title">Length</div></div>
            <div class="ms-seg-inline">
              ${["SHORT", "MEDIUM", "LONG"].map((v) => `<button class="ms-seg-btn ${cm.length === v ? "active" : ""}" data-cm-len="${v}">${v[0] + v.slice(1).toLowerCase()}</button>`).join("")}
            </div>
          </div>
          <div class="ms-row">
            <div class="ms-row-text"><div class="ms-row-title">Tempo match</div></div>
            <div class="ms-seg-inline">
              ${["OFF", "GENTLE", "FULL"].map((v) => `<button class="ms-seg-btn ${cm.tempoMatch === v ? "active" : ""}" data-cm-tempo="${v}">${v[0] + v.slice(1).toLowerCase()}</button>`).join("")}
            </div>
          </div>
          ${toggleRowHtml("cm-always-mix", "Always mix", "Real blend of two songs even without a locked beat", cm.alwaysMix !== false, hideDesc)}
          ${toggleRowHtml("cm-stunts", "Stunts", "Allow backspins, tape stops, and risers on energy jumps", cm.stunts !== false, hideDesc)}
        </div>`
          : ""
      }

      ${
        !isOff
          ? `<div class="ms-card-group">${toggleRowHtml("cm-gapless", "Keep gapless albums intact", "Skip crossfading between consecutive album tracks", cm.gapless !== false, hideDesc)}</div>`
          : ""
      }

      <div class="ms-section-title">Pause, play, forward and backward</div>
      <div class="ms-card-group">
        ${toggleRowHtml("tf-enable", "Enable fade", "Smooth volume envelope on play & pause", cm.transportFadeEnabled !== false, hideDesc)}
        ${toggleRowHtml("tf-skip-blend", "Blend skips", "Crossfade cleanly when skipping forward or back", !!cm.skipBlend, hideDesc)}
        ${
          cm.skipBlend
            ? sliderRowHtml("tf-ahead", "Songs loaded ahead", "", `${cm.skipBlendAhead || 1}`, { min: 1, max: 4, step: 1, value: cm.skipBlendAhead || 1 }, hideDesc)
            : ""
        }
        ${
          cm.transportFadeEnabled || cm.skipBlend
            ? sliderRowHtml("tf-sec", "Length", "", `${Number(cm.transportFadeSeconds || 0.6).toFixed(1)} s`, { min: 0.5, max: 10, step: 0.5, value: cm.transportFadeSeconds || 0.6 }, hideDesc)
            : ""
        }
        ${
          cm.transportFadeEnabled
            ? selectRowHtml(
                "tf-effect",
                "Layered effect",
                "Effect applied during pause/play fade",
                [
                  ["OFF", "None"],
                  ["ECHO", "Echo"],
                  ["REWIND", "Rewind"],
                  ["TAPE_STOP", "Tape stop"],
                  ["FAR_AWAY", "Fade to far"],
                  ["REVERB", "Reverb wash"],
                  ["FILTER", "Filter sweep"]
                ],
                cm.transportEffect || "OFF",
                hideDesc
              )
            : ""
        }
      </div>`;
  }

  function renderAudioQualityHtml(settings, prefs, hideDesc) {
    const q = prefs.audioLab.quality;
    return `
      ${renderSubHeadHtml("Audio Quality", "audio_lab")}
      <div class="ms-section-title">Streaming</div>
      <div class="ms-card-group">
        ${selectRowHtml(
          "aq-stream",
          "YouTube Music",
          "High picks highest bitrate Opus/AAC; Medium saves data (~128 kbps)",
          [
            ["auto", "Auto · Best available"],
            ["high", "High · Highest bitrate (~160+ kbps)"],
            ["medium", "Medium · Balanced (~128 kbps AAC)"],
            ["low", "Low · Data saver (~50–70 kbps)"]
          ],
          settings.audioQuality || q.stream || "auto",
          hideDesc
        )}
        ${toggleRowHtml("aq-hq-toggle", "Prefer highest bitrate streams", "Always ask InnerTube for top audio stream", settings.highQualityAudio !== false, hideDesc)}
        ${toggleRowHtml("aq-yt-enabled", "Enable YouTube Music provider", "Turn off to play only local or paired library files", q.youtubeEnabled !== false, hideDesc)}
      </div>
      <div class="ms-section-title">Download</div>
      <div class="ms-card-group">
        ${selectRowHtml(
          "aq-download",
          "Download & offline quality",
          "Quality used when caching or mirroring tracks",
          [
            ["high", "High · Best bitrate"],
            ["medium", "Medium · ~128 kbps AAC"],
            ["low", "Low · Compact (~64 kbps)"]
          ],
          q.download || "high",
          hideDesc
        )}
      </div>`;
  }

  function renderAudioPassHtml(settings, prefs, hideDesc) {
    const lab = prefs.audioLab;
    const pass = lab.pass;
    const blockers = [];
    if (lab.eq.enabled) blockers.push("Equalizer");
    if (activeFxList(lab).length) blockers.push("Audio FX");
    if (settings.normalizeVolume) blockers.push("Normalization");
    if (lab.crossmix.mode !== "OFF") blockers.push("Transitions");

    return `
      ${renderSubHeadHtml("Audio Pass", "audio_lab")}
      <div class="ms-card-group">
        <div class="ms-row">
          <div class="ms-row-text">
            <div class="ms-row-title">Desktop Output Pipeline</div>
            <div class="ms-row-desc">Web Audio 32-bit float graph active · Local FLAC/ALAC & YouTube lossless proxy</div>
          </div>
          <span class="ms-pill-tag">${pass.usbPassthrough ? "Direct" : "CoreAudio"}</span>
        </div>
        ${toggleRowHtml("pass-usb", "Use DAC when connected", "Route to USB/external audio device automatically", !!pass.preferUsbDac, hideDesc)}
        ${toggleRowHtml("pass-hires", "Hi-res output (32-bit float)", "Keep 32-bit float precision through internal processing", pass.hiResOutput !== false, hideDesc)}
        ${toggleRowHtml("pass-resampler", "Mochy Hi-fi resampler", "Cleaner interpolation filter before system output", pass.hiFiResampler !== false, hideDesc)}
        ${toggleRowHtml("pass-direct", "Bit-perfect passthrough", "Bypass DSP stages when supported by your output", !!pass.usbPassthrough, hideDesc)}
        ${
          pass.usbPassthrough
            ? selectRowHtml(
                "pass-mode",
                "Passthrough mode",
                "",
                [
                  ["SONG_RATE", "Song's rate"],
                  ["BIT_PERFECT", "Bit-perfect"],
                  ["DIRECT_USB", "Direct USB"],
                  ["EXCLUSIVE_USB", "Exclusive USB"],
                  ["EXCLUSIVE_DAC", "Built-in DAC"]
                ],
                pass.mode || "SONG_RATE",
                hideDesc
              )
            : ""
        }
        ${
          pass.usbPassthrough && pass.mode === "DIRECT_USB"
            ? `${sliderRowHtml("pass-dac-vol", "DAC volume", "", `${Math.round((pass.dacVolume ?? 1) * 100)}%`, { min: 0.05, max: 1, step: 0.05, value: pass.dacVolume ?? 1 }, true)}
               ${toggleRowHtml("pass-fixed-vol", "DAC without own volume", "Keep digital level untouched for line-level DACs", !!pass.fixedVolume, hideDesc)}`
            : ""
        }
      </div>
      ${
        blockers.length
          ? `<div class="ms-card-group" style="margin-top:10px;">
               <div class="ms-row">
                 <div class="ms-row-text">
                   <div class="ms-row-title">Active DSP stages (${blockers.join(", ")})</div>
                   <div class="ms-row-desc">True bit-perfect requires disabling software FX & transitions.</div>
                 </div>
                 <button class="ms-mini-btn" id="pass-clear-blockers">Turn these off</button>
               </div>
             </div>`
          : ""
      }`;
  }

  // --------------------------------------------------------------------------
  // 2. Playback
  // --------------------------------------------------------------------------
  function renderPlaybackHtml(prefs, hideDesc) {
    const p = prefs.playback;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Playback</h3></div>
      <div class="ms-section-title">While you listen</div>
      <div class="ms-card-group">
        ${toggleRowHtml("pb-keep-playing", "Keep playing even when closed", "Continue playback when window is closed or hidden", p.keepPlayingWhenClosed !== false, hideDesc)}
        ${toggleRowHtml("pb-mix-apps", "Play alongside other apps", "Do not interrupt other desktop audio sources", !!p.playAlongsideOtherApps, hideDesc)}
        ${toggleRowHtml("pb-resume-bt", "Resume on Bluetooth connection", "Continue paused music when headphones connect", !!p.resumeOnBluetooth, hideDesc)}
        ${toggleRowHtml("pb-pause-mute", "Pause music when muted", "Pause automatically when volume hits zero and resume when raised", !!p.pauseWhenMuted, hideDesc)}
        ${toggleRowHtml("pb-save-state", "Save Player's last state", "Restore current track and queue across restarts", p.saveLastState !== false, hideDesc)}
        ${toggleRowHtml("pb-keep-shuffle", "Keep shuffle on", "Shuffle stays active when switching albums or playlists", p.keepShuffleOn !== false, hideDesc)}
        ${toggleRowHtml("pb-skip-silence", "Skip Silence", "Jump over quiet gaps in songs automatically", !!p.skipSilence, hideDesc)}
      </div>
      <div class="ms-section-title">When a song won't play</div>
      <div class="ms-card-group">
        ${toggleRowHtml("pb-dont-skip", "Don't skip on failure", "Stay on a failed stream instead of jumping to the next track", !!p.dontSkipOnFailure, hideDesc)}
        ${
          !p.dontSkipOnFailure
            ? sliderRowHtml("pb-skip-timeout", "Skip timeout", "Seconds before skipping a stalled stream", `${p.skipTimeoutSec || 6} s`, { min: 5, max: 20, step: 1, value: p.skipTimeoutSec || 6 }, hideDesc)
            : ""
        }
      </div>
      <div class="ms-section-title">Related</div>
      <div class="ms-card-group">
        <button class="ms-link-row" data-jump-alab="transition"><span>Transition & CrossMix</span><span class="ms-pill-tag">Open</span></button>
        <button class="ms-link-row" data-jump-alab="pass"><span>Audio Pass</span><span class="ms-pill-tag">Open</span></button>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 3. Now Playing
  // --------------------------------------------------------------------------
  function renderNowPlayingHtml(settings, prefs, hideDesc) {
    const np = prefs.nowPlaying;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Now playing</h3></div>
      <div class="ms-section-title">On the player</div>
      <div class="ms-card-group">
        ${toggleRowHtml("np-format-badge", "Audio format badge", "Shows codec beside song title in Full Player", np.showFormatBadge !== false, hideDesc)}
        ${np.showFormatBadge !== false ? toggleRowHtml("np-sample-rate", "Show sample rate", "Show kHz rate next to format badge", !!np.showSampleRate, hideDesc) : ""}
      </div>
      <div class="ms-section-title">Lyrics</div>
      <div class="ms-card-group">
        ${sliderRowHtml("np-lyr-size", "Text size", "Scale lyrics font size across right pane & full player", `${Math.round((settings.lyricsSize || 1) * 100)}%`, { min: 0.8, max: 1.35, step: 0.05, value: settings.lyricsSize || 1 }, hideDesc)}
        ${selectRowHtml("np-lyr-pos", "Line position", "Alignment for single-singer lines", [["left", "Left"], ["center", "Center"], ["right", "Right"]], settings.lyricsPosition || "left", hideDesc)}
        ${toggleRowHtml("np-lyr-blur", "Distance blur on inactive lines", "Apple Music-style progressive blur away from active line", settings.lyricsBlur !== false, hideDesc)}
        ${toggleRowHtml("np-lyr-glow", "High quality bloom", "Extra soft bloom glow on held notes", !!np.lyricsHighBloom, hideDesc)}
        ${toggleRowHtml("np-yt-trans", "Translations from YouTube", "Prefer creator-written captions when available", np.youtubeCaptionTranslation !== false, hideDesc)}
        ${toggleRowHtml("np-sync-vid", "Sync lyrics to music videos", "Adjust lyric timestamps to video pacing", np.syncLyricsToVideo !== false, hideDesc)}
        ${toggleRowHtml("np-rom-main", "Romanisation as the main line", "Promotes romanised text above original script", !!np.romanizeAsMain, hideDesc)}
      </div>
      <div class="ms-section-title">Videos & Canvas</div>
      <div class="ms-card-group">
        ${toggleRowHtml("np-vid-bg", "Always enable YouTube background", "Stream video background on player when available", !!np.playVideoBackground, hideDesc)}
        ${np.playVideoBackground ? toggleRowHtml("np-vid-ts", "Timestamp matching", "Keep video background aligned to lyrics", np.timestampMatching !== false, hideDesc) : ""}
        ${selectRowHtml("np-vid-q", "Video quality", "Resolution for music video playback", VIDEO_QUALITIES, np.videoQuality || "AUTO", hideDesc)}
        ${toggleRowHtml("np-vid-noauto", "Disable YouTube video autoplay", "Play album art cover instead of video for MV tracks", !!np.disableVideoAutoplay, hideDesc)}
        ${toggleRowHtml("np-vid-studio", "Studio version for music videos", "Prefer studio audio album master instead of MV cut", !!np.studioForVideos, hideDesc)}
        ${toggleRowHtml("np-canvas", "Enable animated canvas", "Looping visuals for supported tracks", np.canvasEnabled !== false, hideDesc)}
        ${
          np.canvasEnabled !== false
            ? `${selectRowHtml(
                "np-canvas-order",
                "Canvas order",
                "",
                [
                  ["APPLE_TIDAL_SPOTIFY", "Apple Music -> Tidal -> Spotify"],
                  ["APPLE_SPOTIFY_TIDAL", "Apple Music -> Spotify -> Tidal"],
                  ["TIDAL_APPLE_SPOTIFY", "Tidal -> Apple Music -> Spotify"],
                  ["SPOTIFY_APPLE_TIDAL", "Spotify -> Apple Music -> Tidal"]
                ],
                np.canvasOrder || "APPLE_TIDAL_SPOTIFY",
                hideDesc
              )}
              ${toggleRowHtml("np-spotify-canvas", "Use Spotify Canvas", "Look for looping canvases on Spotify", !!np.spotifyCanvas, hideDesc)}
              ${toggleRowHtml("np-canvas-wifi", "Canvas on Wi-Fi only", "Skip metered connections", np.canvasWifiOnly !== false, hideDesc)}`
            : ""
        }
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 4. App Behaviour (includes Larp Mode, Language, Network, Proxy, Privacy)
  // --------------------------------------------------------------------------
  function renderBehaviourHtml(settings, prefs, hideDesc) {
    const b = prefs.behaviour;
    const activeLarp = LARP_LEVELS.find((l) => l.id === b.larpLevel) || LARP_LEVELS[3];
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">App behaviour</h3></div>
      <div class="ms-card-group">
        <div class="ms-row">
          <div class="ms-row-text">
            <div class="ms-row-title">Your Name</div>
            ${!hideDesc ? `<div class="ms-row-desc">Shown on Home hero greeting & profile badge</div>` : ""}
          </div>
          <input class="settings-input-boxed" id="bh-profile-name" value="${esc(settings.profileName || "")}" placeholder="Your name" />
        </div>
        ${toggleRowHtml("bh-larp-toggle", "Larp mode", b.larpMode ? `Active: ${activeLarp.name} (${activeLarp.badge} · ${activeLarp.dac})` : "Fill your 67 dopamine — shows hi-res FLAC DAC badge in player", !!b.larpMode, hideDesc)}
        ${
          b.larpMode
            ? `<div class="larp-grid">
                 ${LARP_LEVELS.map(
                   (l) => `
                   <button class="larp-card ${b.larpLevel === l.id ? "selected" : ""}" data-larp-pick="${l.id}">
                     <div class="ms-row-title">${esc(l.name)}</div>
                     <div class="ms-row-desc">${esc(l.badge)}</div>
                     <div class="ms-row-desc" style="opacity:0.9;">${esc(l.dac)}</div>
                   </button>`
                 ).join("")}
               </div>`
            : ""
        }
      </div>

      <div class="ms-section-title">General app settings</div>
      <div class="ms-card-group">
        ${selectRowHtml("bh-lang", "App language", "Choose interface locale", APP_LANGUAGES, b.appLanguage || "SYSTEM_DEFAULT", hideDesc)}
        ${toggleRowHtml("bh-no-updates", "Disable app update notices", "Suppress update banner popups", !!b.disableUpdateNotices, hideDesc)}
        ${toggleRowHtml("bh-no-desc", "Disable description on settings", "Only titles show, for minimal clean rows", !!b.disableSettingDescriptions, hideDesc)}
      </div>

      <div class="ms-section-title">Network & data</div>
      <div class="ms-card-group">
        ${toggleRowHtml("bh-offline", "Offline mode", "Play downloaded and local music only", !!b.offlineMode, hideDesc)}
        ${toggleRowHtml("bh-datasaver", "Data saver", "Lighter streams and no video backgrounds", !!b.dataSaver, hideDesc)}
        ${b.dataSaver ? toggleRowHtml("bh-datasaver-mob", "Only on mobile data", "On Wi-Fi everything plays as usual", b.dataSaverMobileOnly !== false, hideDesc) : ""}
        ${toggleRowHtml("bh-proxy-en", "Use a proxy", "Route requests through HTTP or SOCKS5 proxy", !!b.proxyEnabled, hideDesc)}
        ${
          b.proxyEnabled
            ? `<div class="ms-row">
                 <div class="ms-row-text"><div class="ms-row-title">Proxy address</div></div>
                 <input class="settings-input-boxed" id="bh-proxy-addr" value="${esc(b.proxyAddress || "")}" placeholder="127.0.0.1:7890" />
               </div>
               ${selectRowHtml("bh-proxy-type", "Proxy type", "", [["HTTP", "HTTP"], ["SOCKS", "SOCKS5"]], b.proxyType || "HTTP", hideDesc)}`
            : ""
        }
      </div>

      <div class="ms-section-title">Library & privacy</div>
      <div class="ms-card-group">
        ${toggleRowHtml("bh-hide-explicit", "Hide explicit songs on Home", "Filter explicit items out of Home cards and carousels", !!settings.hideExplicit, hideDesc)}
        ${toggleRowHtml("bh-albums-likes", "Albums from liked songs", "Liking a song also surfaces its album in Albums", !!b.albumsFromLikedSongs, hideDesc)}
        ${toggleRowHtml("bh-local-meta", "Local song automatic metadata", "Match local tracks with online artwork & metadata", b.localAutoMetadata !== false, hideDesc)}
        ${toggleRowHtml("bh-pause-search", "Pause search history", "Stop recording new searches locally", !!b.pauseSearchHistory, hideDesc)}
        ${toggleRowHtml("bh-yt-plays", "Count plays on YouTube", "Report played tracks to YouTube Music history", b.ytReportPlays !== false, hideDesc)}
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 5. Customisation
  // --------------------------------------------------------------------------
  function renderCustomisationHtml(settings, prefs, hideDesc) {
    const c = prefs.customisation;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Customisation</h3></div>
      <div class="ms-section-title">Visual Styles & Layout</div>
      <div class="ms-card-group">
        ${sliderRowHtml("cu-rounding", "Cover rounding", "Corner radius across album cards and hero badges", `${c.coverRoundingPx} px`, { min: 0, max: 32, step: 1, value: c.coverRoundingPx ?? 14 }, hideDesc)}
        ${toggleRowHtml("cu-hero-auto", "Auto-advance Home hero", "Smoothly cycle hero slides every few seconds", settings.heroAutoTurn !== false, hideDesc)}
        ${selectRowHtml("cu-home-style", "Home style", "", [["MOCHYY", "Mochyy"], ["LISTEN_NOW", "Listen now"], ["HOP_IN", "Hop in"]], c.homeStyle || "MOCHYY", hideDesc)}
        ${selectRowHtml("cu-playlist-style", "Playlist style", "", [["FLOW", "Flow"], ["CLASSIC", "Classic"], ["MINIMAL", "Minimal"]], c.playlistStyle || "FLOW", hideDesc)}
        ${selectRowHtml("cu-player-style", "Player style", "", [["FLAGSHIP", "Flagship"], ["TURNTABLE", "Turntable"], ["IPOD", "iPod"], ["POSTER", "Poster"], ["STUDIO", "Studio"]], c.playerStyle || "FLAGSHIP", hideDesc)}
        ${toggleRowHtml("cu-full-cover", "Full cover in wide player", "Edge-to-edge full cover art in wide layout", !!c.landscapeFullCover, hideDesc)}
      </div>

      <div class="ms-section-title">Glass, Blur & Motion</div>
      <div class="ms-card-group">
        ${toggleRowHtml("cu-anim-bg", "Animated ambient backdrop", "Live WebGL fluid gradient behind full player", settings.animatedBackgrounds !== false, hideDesc)}
        ${toggleRowHtml("cu-blur", "Blur", "Frosted glass blur across top bar, panes, and menus", c.blurEnabled !== false, hideDesc)}
        ${c.blurEnabled !== false ? toggleRowHtml("cu-prog-blur", "Progressive blur", "Smooth gradient blur along hero top & bottom edges", c.progressiveBlur !== false, hideDesc) : ""}
        ${c.blurEnabled !== false ? sliderRowHtml("cu-blur-px", "Blur strength", "Backdrop blur radius in pixels", `${c.blurStrengthPx || 26} px`, { min: 8, max: 48, step: 2, value: c.blurStrengthPx || 26 }, hideDesc) : ""}
        ${toggleRowHtml("cu-el-blur", "Element blur transitions", "Blur during hero wipes, scroll away, and route transitions", c.elementBlur !== false, hideDesc)}
        ${toggleRowHtml("cu-anim", "Animations", "Smooth UI springs and page wipe transitions", c.animationEnabled !== false, hideDesc)}
        ${
          c.animationEnabled !== false
            ? sliderRowHtml("cu-anim-spd", "Animation speed", "Scale duration multiplier (lower is faster)", `${Number(c.animationSpeed || 1).toFixed(2)}×`, { min: 0.5, max: 2.0, step: 0.25, value: c.animationSpeed || 1 }, hideDesc)
            : ""
        }
      </div>

      <div class="ms-section-title">Lyrics Animation & Gestures</div>
      <div class="ms-card-group">
        ${selectRowHtml("cu-lyr-motion", "Lyrics animation", "", [["MOTION", "Style 1 (Word sweep + glow)"], ["LEGACY", "Style 2"], ["BORING", "Boring"], ["PLAIN", "Plain"]], c.lyricsMotionStyle || "MOTION", hideDesc)}
        ${toggleRowHtml("cu-romanise", "Romanisation", "Readings for Japanese, Korean, Chinese & Cyrillic lyrics", c.romanisationEnabled !== false, hideDesc)}
        ${toggleRowHtml("cu-translate-lyr", "Translate lyrics", "Automatically translate lyrics when available", !!c.translateLyrics, hideDesc)}
        ${selectRowHtml("cu-swipe-r", "Swipe right action", "Action when swiping a song card right", SWIPE_ACTIONS.map((a) => [a, a]), c.swipeRightAction || "Library", hideDesc)}
        ${selectRowHtml("cu-swipe-l", "Swipe left action", "Action when swiping a song card left", SWIPE_ACTIONS.map((a) => [a, a]), c.swipeLeftAction || "Queue", hideDesc)}
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 6. Storage & Cache
  // --------------------------------------------------------------------------
  function renderStorageHtml(settings, prefs, hideDesc) {
    const st = modalState.storageStats;
    const stopIdx = Math.max(0, CACHE_STOPS.findIndex(([mb]) => mb === (prefs.storage.cacheLimitMb ?? 1024)));
    const stopLabel = CACHE_STOPS[stopIdx]?.[1] || "1 GB";
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Storage</h3></div>
      <div class="ms-card-group">
        <div class="ms-stat-grid">
          <div class="ms-stat-box"><span>Library DB</span><strong>${st ? formatBytes(st.libraryBytes) : "…"}</strong></div>
          <div class="ms-stat-box"><span>Local Audio (${st ? st.localTrackCount : "…"})</span><strong>${st ? formatBytes(st.localAudioBytes) : "…"}</strong></div>
          <div class="ms-stat-box"><span>Cached Streams / Lyrics</span><strong>${st ? `${st.streamCacheCount} streams · ${st.lyricsCacheCount} lyrics` : "…"}</strong></div>
        </div>
        ${st?.dataDir ? `<div class="ms-row-desc" style="margin-top:6px;word-break:break-all;">Data path: ${esc(st.dataDir)}</div>` : ""}
      </div>

      <div class="ms-section-title">Cache limit & cleanup</div>
      <div class="ms-card-group">
        ${sliderRowHtml("st-cache-limit", "Set music cache limit", "Maximum disk budget for cached streams & artwork", stopLabel, { min: 0, max: CACHE_STOPS.length - 1, step: 1, value: stopIdx }, hideDesc)}
        <div class="ms-btn-row">
          <button class="ms-action-btn" id="st-clear-cache-btn">Clear stream, lyrics & cover cache</button>
          <button class="ms-action-btn danger" id="st-clear-history-btn">Clear listening history</button>
        </div>
      </div>

      <div class="ms-section-title">Transfer & Backup</div>
      <div class="ms-card-group">
        <div class="ms-btn-row">
          <button class="ms-action-btn" id="st-export-btn">Export user data (.json)</button>
          <button class="ms-action-btn" id="st-import-btn">Import user data (.json)</button>
        </div>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 7. Devices & Local Music
  // --------------------------------------------------------------------------
  function renderDevicesHtml(settings, prefs, hideDesc, ctx) {
    const dev = prefs.devices;
    const ls = modalState.linkState;
    const folders = settings.sharedFolders || [];

    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Devices & Local</h3></div>
      <div class="ms-section-title">Device link</div>
      <div class="ms-card-group">
        <div class="ms-row">
          <div class="ms-row-text"><div class="ms-row-title">This Computer's Name</div></div>
          <input class="settings-input-boxed" id="dev-name-input" value="${esc(settings.deviceName || "")}" placeholder="${esc(ctx.getDeviceName() || "Mac / Desktop")}" />
        </div>
        ${toggleRowHtml("dev-share-local", "Share local files with paired devices", "Allow your Mochy Android / TV devices to stream local FLAC & audio files", settings.shareLocalFiles !== false, hideDesc)}
        ${toggleRowHtml("dev-reachable", "Stay reachable in background", "Keep listening on local Wi-Fi link while idle", dev.stayReachable !== false, hideDesc)}
        ${toggleRowHtml("dev-in-menu", "Show devices in player menu", "Allow handing playback off from top player", dev.showInPlayerMenu !== false, hideDesc)}
        <div class="ms-btn-row" style="margin-top:6px;">
          <button class="ms-action-btn" id="dev-pair-btn">${modalState.pairing ? `Code: ${esc(modalState.pairing.code)}` : "Show pairing code"}</button>
          <button class="ms-action-btn" id="dev-sync-btn">Sync paired devices</button>
        </div>
        ${
          ls?.devices?.length
            ? `<div class="ms-device-list">
                 ${ls.devices
                   .map(
                     (d) => `
                   <div class="ms-row">
                     <div class="ms-row-text">
                       <div class="ms-row-title">${esc(d.name)} ${d.live ? "· Online" : ""}</div>
                       <div class="ms-row-desc">${esc(d.kind || "device")}</div>
                     </div>
                     <button class="ms-mini-btn danger" data-dev-unlink="${esc(d.id)}">Unlink</button>
                   </div>`
                   )
                   .join("")}
               </div>`
            : `<div class="ms-row-desc" style="padding:4px 2px;">No paired devices found on your Wi-Fi right now.</div>`
        }
      </div>

      <div class="ms-section-title">Local Music Folders</div>
      <div class="ms-card-group">
        <div class="ms-btn-row" style="margin-bottom:8px;">
          <button class="ms-action-btn" id="loc-add-folder-btn">+ Add music folder</button>
          <button class="ms-action-btn" id="loc-rescan-btn">Rescan folders</button>
        </div>
        ${
          folders.length
            ? folders
                .map(
                  (f, idx) => `
                <div class="ms-row">
                  <div class="ms-row-text"><div class="ms-row-title" style="font-size:12px;word-break:break-all;">${esc(f)}</div></div>
                  <button class="ms-mini-btn danger" data-loc-rm="${idx}">Remove</button>
                </div>`
                )
                .join("")
            : `<div class="ms-row-desc">No shared music folders configured.</div>`
        }
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 8. Integrations, Lyrics Providers & Experimental
  // --------------------------------------------------------------------------
  function renderIntegrationsHtml(settings, prefs, hideDesc, ctx) {
    const itg = prefs.integrations;
    const ex = prefs.experimental;
    const providers = ctx.getProviders() || [];

    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Integrations & Lab</h3></div>

      <div class="ms-section-title">Lyrics Provider Priority</div>
      <div class="ms-card-group">
        ${providers
          .map(
            (p, idx) => `
          <div class="provider-order-row">
            <div>
              <div class="ms-row-title" style="font-size:12.5px;">${idx + 1}. ${esc(p.displayName)}</div>
              ${!hideDesc && p.detail ? `<div class="ms-row-desc">${esc(p.detail)}</div>` : ""}
            </div>
            <div class="provider-order-btns" style="align-items:center;">
              <button data-move-prov="${idx}" data-dir="-1">↑</button>
              <button data-move-prov="${idx}" data-dir="1">↓</button>
              <button class="toggle-switch ${p.enabled ? "on" : ""}" data-toggle-prov="${esc(p.id)}" style="transform:scale(0.8);"></button>
            </div>
          </div>`
          )
          .join("")}
      </div>

      <div class="ms-section-title">Discord & Scrobbling</div>
      <div class="ms-card-group">
        ${toggleRowHtml("itg-discord", "Discord Rich Presence formatting", "Format details, state & small badge rules", !!itg.discordEnabled, hideDesc)}
        ${
          itg.discordEnabled
            ? `<div class="ms-row"><span class="ms-row-title">Activity Name</span><input class="settings-input-boxed" id="itg-dc-act" value="${esc(itg.discordActivityName || "")}" /></div>
               <div class="ms-row"><span class="ms-row-title">Details String</span><input class="settings-input-boxed" id="itg-dc-det" value="${esc(itg.discordDetails || "")}" /></div>
               <div class="ms-row"><span class="ms-row-title">State String</span><input class="settings-input-boxed" id="itg-dc-st" value="${esc(itg.discordState || "")}" /></div>
               ${toggleRowHtml("itg-dc-clear", "Clear status when paused", "", !!itg.discordClearOnPause, true)}`
            : ""
        }
        ${toggleRowHtml("itg-lastfm", "Last.fm scrobbling preference", "Prepare scrobble state alongside likes & now playing", !!itg.lastfmEnabled, hideDesc)}
        ${toggleRowHtml("itg-librefm", "Libre.fm scrobbling preference", "", !!itg.librefmEnabled, hideDesc)}
      </div>

      <div class="ms-section-title">Experimental & Diagnostics</div>
      <div class="ms-card-group">
        ${toggleRowHtml("ex-xmix-tools", "Crossmix test tools", "Show quick mix test buttons in Audio Lab", !!ex.crossmixTestTools, hideDesc)}
        ${toggleRowHtml("ex-stream-toast", "Show where songs play from", "Display stream codec & source toast on track start", !!ex.showStreamSourceToast, hideDesc)}
        ${selectRowHtml("ex-stream-backend", "Stream backend", "", [["INNERTUBEX", "InnerTubeX, then classic"], ["CLASSIC", "Classic only"]], ex.streamBackend || "INNERTUBEX", hideDesc)}
        ${toggleRowHtml("ex-force-play", "Force playback fallback", "If a provider fails, try the next available source", !!ex.forcePlayback, hideDesc)}
        ${toggleRowHtml("ex-force-recap", "Force show monthly recap", "Unlock monthly recap card early", !!ex.forceMonthlyRecap, hideDesc)}
        ${toggleRowHtml("ex-big-disc", "Big disc cover styles", "Oversized vinyl artwork mode in full player", !!ex.bigDiscStyles, hideDesc)}
        ${toggleRowHtml("ex-haptics", "Music haptics / beat pulse", "Pulse UI accents slightly in sync with audio bass", !!ex.musicHaptics, hideDesc)}
        <div class="ms-btn-row" style="margin-top:6px;">
          <button class="ms-action-btn" id="ex-diag-btn">Inspect Playback Diagnostics</button>
          <button class="ms-action-btn danger" id="ex-reset-prefs-btn">Reset all Settings to Default</button>
        </div>
        ${modalState.diagnosticsInfo ? `<pre class="ms-diag-box">${esc(modalState.diagnosticsInfo)}</pre>` : ""}
      </div>

      <div class="ms-section-title">About Mochy</div>
      <div class="ms-card-group">
        <div class="ms-row-desc">Mochy Desktop (Tauri + Rust InnerTube + Web Audio DSP) · Inter SemiBold / Bold typography & Mochy Android option parity.</div>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // Event Binding
  // --------------------------------------------------------------------------
  function bindSettingsEvents(layer, ctx) {
    const settings = ctx.getSettings();
    const prefs = ensurePrefsOnSettings(settings);
    const lab = prefs.audioLab;

    const close = () => layer.classList.add("hidden");
    const rerender = () => renderSettingsModal(ctx);
    const save = () => ctx.saveSettings(false);
    const saveAndRerender = async () => {
      await ctx.saveSettings(true);
      rerender();
    };

    layer.onclick = (e) => {
      if (!e.target.closest("#modal-inner")) close();
    };
    document.getElementById("ms-close-btn").onclick = close;

    const searchInput = document.getElementById("ms-search-input");
    if (searchInput) {
      searchInput.oninput = () => {
        const pos = searchInput.selectionStart;
        modalState.searchQuery = searchInput.value;
        rerender();
        const next = document.getElementById("ms-search-input");
        if (next) {
          next.focus();
          try {
            next.setSelectionRange(pos, pos);
          } catch (_) {}
        }
      };
    }
    const clrSearch = document.getElementById("ms-search-clear");
    if (clrSearch) {
      clrSearch.onclick = () => {
        modalState.searchQuery = "";
        rerender();
      };
    }

    layer.querySelectorAll("[data-ms-cat]").forEach((btn) => {
      btn.onclick = () => {
        modalState.searchQuery = "";
        modalState.category = btn.dataset.msCat;
        modalState.audioLabSub = null;
        if (modalState.category === "storage") loadStorageStats(ctx);
        if (modalState.category === "devices") loadLinkState(ctx);
        rerender();
      };
    });

    layer.querySelectorAll("[data-hit-cat]").forEach((btn) => {
      btn.onclick = () => {
        modalState.category = btn.dataset.hitCat;
        modalState.audioLabSub = btn.dataset.hitSub || null;
        modalState.searchQuery = "";
        if (modalState.category === "storage") loadStorageStats(ctx);
        if (modalState.category === "devices") loadLinkState(ctx);
        rerender();
      };
    });

    layer.querySelectorAll("[data-alab-sub]").forEach((btn) => {
      btn.onclick = () => {
        modalState.audioLabSub = btn.dataset.alabSub;
        rerender();
      };
    });
    layer.querySelectorAll("[data-jump-alab]").forEach((btn) => {
      btn.onclick = () => {
        modalState.category = "audio_lab";
        modalState.audioLabSub = btn.dataset.jumpAlab;
        rerender();
      };
    });
    layer.querySelectorAll("[data-ms-back]").forEach((btn) => {
      btn.onclick = () => {
        modalState.audioLabSub = null;
        rerender();
      };
    });

    const bindToggle = (id, get, set, shouldRerender = true) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onclick = async () => {
        set(!get());
        ctx.applyAllEffects();
        await save();
        if (shouldRerender) rerender();
      };
    };

    const bindSlider = (id, getLabel, set, onLive, onRelease) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = () => {
        const val = parseFloat(el.value);
        set(val);
        const pill = document.getElementById(`${id}-val`);
        if (pill) pill.textContent = getLabel(val);
        ctx.applyAllEffects();
        if (onLive) onLive(val);
      };
      el.onchange = async () => {
        await save();
        if (onRelease) onRelease();
      };
    };

    const bindSelect = (id, set, rerenderAfter = true) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onchange = async () => {
        set(el.value);
        ctx.applyAllEffects();
        await save();
        if (rerenderAfter) rerender();
      };
    };

    // Equalizer bindings
    bindToggle("eq-master-toggle", () => lab.eq.enabled, (v) => (lab.eq.enabled = v));
    bindToggle("eq-auto-preamp", () => lab.eq.autoPreamp !== false, (v) => (lab.eq.autoPreamp = v));
    bindSlider(
      "eq-preamp-slider",
      (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`,
      (v) => (lab.eq.preamp = v),
      null,
      () => rerender()
    );

    const eqReset = document.getElementById("eq-reset-btn");
    if (eqReset) {
      eqReset.onclick = async () => {
        lab.eq.nodes = FX().flatNodes();
        lab.eq.preamp = 0;
        lab.eq.presetId = "flat";
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }

    const eqSave = document.getElementById("eq-save-btn");
    if (eqSave) {
      eqSave.onclick = () => {
        const name = window.prompt("Preset name:", `Preset ${(lab.presets?.length || 0) + 1}`);
        if (!name || !name.trim()) return;
        const preset = {
          id: `user_${Date.now()}`,
          name: name.trim(),
          nodes: JSON.parse(JSON.stringify(lab.eq.nodes)),
          preamp: lab.eq.preamp || 0
        };
        lab.presets = [...(lab.presets || []), preset];
        lab.eq.presetId = preset.id;
        saveAndRerender();
      };
    }

    layer.querySelectorAll("[data-eq-tab]").forEach((btn) => {
      btn.onclick = () => {
        modalState.eqTab = btn.dataset.eqTab;
        rerender();
      };
    });

    layer.querySelectorAll("[data-eq-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const preset = FX().EQ_PRESETS.find((p) => p.id === btn.dataset.eqPreset);
        if (!preset) return;
        lab.eq.enabled = true;
        lab.eq.presetId = preset.id;
        lab.eq.nodes = FX().EQ_FREQUENCIES.map((freq, idx) => ({
          freq,
          gain: preset.gains[idx],
          q: 1.41,
          type: "PK",
          enabled: true
        }));
        modalState.selectedEqNode = 0;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });

    layer.querySelectorAll("[data-eq-user-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const preset = (lab.presets || []).find((p) => p.id === btn.dataset.eqUserPreset);
        if (!preset) return;
        lab.eq.enabled = true;
        lab.eq.presetId = preset.id;
        lab.eq.nodes = JSON.parse(JSON.stringify(preset.nodes));
        lab.eq.preamp = preset.preamp || 0;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    layer.querySelectorAll("[data-eq-del-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.eqDelPreset;
        lab.presets = (lab.presets || []).filter((p) => p.id !== id);
        if (lab.eq.presetId === id) lab.eq.presetId = null;
        await saveAndRerender();
      };
    });

    // Graph nodes + interactive drag
    layer.querySelectorAll("[data-eq-sel]").forEach((btn) => {
      btn.onclick = () => {
        modalState.selectedEqNode = Number(btn.dataset.eqSel);
        rerender();
      };
    });
    const addNodeBtn = document.getElementById("eq-add-node-btn");
    if (addNodeBtn) {
      addNodeBtn.onclick = async () => {
        if ((lab.eq.nodes || []).length >= 16) return;
        lab.eq.nodes.push({ freq: 1000, gain: 0, q: 1.0, type: "PK", enabled: true });
        lab.eq.presetId = null;
        modalState.selectedEqNode = lab.eq.nodes.length - 1;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }
    const rmNodeBtn = document.getElementById("eq-remove-node-btn");
    if (rmNodeBtn) {
      rmNodeBtn.onclick = async () => {
        if (lab.eq.nodes.length <= 1) return;
        lab.eq.nodes.splice(modalState.selectedEqNode, 1);
        lab.eq.presetId = null;
        modalState.selectedEqNode = Math.max(0, modalState.selectedEqNode - 1);
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }

    const selNode = lab.eq.nodes?.[modalState.selectedEqNode];
    if (selNode) {
      bindToggle("eq-node-enable", () => selNode.enabled !== false, (v) => {
        selNode.enabled = v;
        lab.eq.presetId = null;
      });
      layer.querySelectorAll("[data-eq-type]").forEach((btn) => {
        btn.onclick = async () => {
          selNode.type = btn.dataset.eqType;
          if (selNode.type === "LSC" || selNode.type === "HSC") selNode.q = 0.7;
          lab.eq.presetId = null;
          ctx.applyAllEffects();
          await saveAndRerender();
        };
      });
      bindSlider("eq-node-gain", (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`, (v) => {
        selNode.gain = Math.abs(v) < 0.35 ? 0 : Number(v.toFixed(1));
        lab.eq.presetId = null;
      }, null, () => rerender());
      bindSlider("eq-node-freq", (v) => `${Math.round(Math.pow(10, v))} Hz`, (v) => {
        selNode.freq = Math.round(Math.pow(10, v));
        lab.eq.presetId = null;
      }, null, () => rerender());
      bindSlider("eq-node-q", (v) => `${Math.pow(10, v).toFixed(2)}`, (v) => {
        selNode.q = Number(Math.pow(10, v).toFixed(2));
        lab.eq.presetId = null;
      }, null, () => rerender());
    }

    // SVG pointer drag for EQ graph dots
    const svg = document.getElementById("eq-graph-svg");
    if (svg) {
      let draggingIdx = -1;
      const rectToNode = (clientX, clientY) => {
        const r = svg.getBoundingClientRect();
        const xFrac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        const yFrac = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
        const minLog = Math.log10(20), maxLog = Math.log10(20000);
        const freq = Math.round(Math.pow(10, minLog + xFrac * (maxLog - minLog)));
        const padFrac = 18 / 190;
        const normY = (0.5 - yFrac) / (0.5 - padFrac);
        let gain = Math.max(-12, Math.min(12, normY * 13));
        gain = Math.abs(gain) < 0.35 ? 0 : Math.round(gain * 10) / 10;
        return { freq, gain };
      };
      svg.querySelectorAll("[data-eq-node]").forEach((dot) => {
        dot.onpointerdown = (e) => {
          e.stopPropagation();
          draggingIdx = Number(dot.dataset.eqNode);
          modalState.selectedEqNode = draggingIdx;
          svg.setPointerCapture?.(e.pointerId);
        };
      });
      svg.onpointermove = (e) => {
        if (draggingIdx < 0 || !lab.eq.nodes[draggingIdx]) return;
        const { freq, gain } = rectToNode(e.clientX, e.clientY);
        lab.eq.nodes[draggingIdx].freq = freq;
        lab.eq.nodes[draggingIdx].gain = gain;
        lab.eq.presetId = null;
        lab.eq.enabled = true;
        ctx.applyAllEffects();
        // Fast live SVG path + dot update without tearing down pointer capture
        const pathEl = svg.querySelector("path[fill='none']");
        const fillEl = svg.querySelector("path[fill^='url']");
        if (pathEl) {
          const d = eqCurveSvgPath(lab.eq, 540, 190, 18);
          pathEl.setAttribute("d", d);
          if (fillEl) fillEl.setAttribute("d", `${d} L540,95 L0,95 Z`);
        }
        const dotEl = svg.querySelector(`[data-eq-node='${draggingIdx}']`);
        if (dotEl) {
          const minLog = Math.log10(20), maxLog = Math.log10(20000);
          dotEl.setAttribute("cx", (((Math.log10(freq) - minLog) / (maxLog - minLog)) * 540).toFixed(1));
          dotEl.setAttribute("cy", (95 - (gain / 13) * (95 - 18)).toFixed(1));
        }
      };
      svg.onpointerup = async () => {
        if (draggingIdx >= 0) {
          draggingIdx = -1;
          await saveAndRerender();
        }
      };
    }

    // 10-band sliders
    layer.querySelectorAll("[data-eq-band]").forEach((inp) => {
      const idx = Number(inp.dataset.eqBand);
      inp.oninput = () => {
        let v = parseFloat(inp.value);
        if (Math.abs(v) < 0.5) v = 0;
        if (lab.eq.nodes[idx]) lab.eq.nodes[idx].gain = v;
        lab.eq.enabled = true;
        lab.eq.presetId = null;
        const lbl = document.getElementById(`eq-band-val-${idx}`);
        if (lbl) lbl.textContent = `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
        ctx.applyAllEffects();
      };
      inp.onchange = () => saveAndRerender();
    });

    // AutoEQ tab bindings
    const aeqSearch = document.getElementById("autoeq-search-input");
    if (aeqSearch) {
      aeqSearch.oninput = () => {
        const pos = aeqSearch.selectionStart;
        modalState.autoEqQuery = aeqSearch.value;
        rerender();
        const el = document.getElementById("autoeq-search-input");
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(pos, pos);
          } catch (_) {}
        }
      };
    }
    const aeqFetch = document.getElementById("autoeq-fetch-btn");
    if (aeqFetch) {
      aeqFetch.onclick = async () => {
        if (modalState.remoteAutoEqLoading || modalState.remoteAutoEqList) return;
        modalState.remoteAutoEqLoading = true;
        rerender();
        try {
          const resp = await fetch("https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results/INDEX.md");
          const md = await resp.text();
          const parsed = [];
          for (const line of md.split("\n")) {
            const m = line.match(/^\-\s+\[([^\]]+)\]\(([^)]+)\)\s+by\s+(.+?)\s+on\s+(.+)$/i);
            if (m) {
              parsed.push({
                model: m[1].trim(),
                path: decodeURIComponent(m[2]).replace(/^\.\//, ""),
                source: m[3].trim(),
                rig: m[4].trim(),
                preamp: -4.0,
                filters: []
              });
            }
          }
          if (parsed.length) modalState.remoteAutoEqList = parsed;
        } catch (_) {}
        modalState.remoteAutoEqLoading = false;
        rerender();
      };
    }
    layer.querySelectorAll("[data-autoeq-pick]").forEach((btn) => {
      btn.onclick = async () => {
        const path = btn.dataset.autoeqPick;
        const pool = modalState.remoteAutoEqList || FX().BUILTIN_AUTOEQ_MODELS;
        let pick = pool.find((m) => m.path === path);
        if (!pick) return;
        pick = JSON.parse(JSON.stringify(pick));
        // If remote model without parsed filters yet, fetch its ParametricEQ.txt
        if (!pick.filters || !pick.filters.length) {
          try {
            const name = pick.path.split("/").pop();
            const txtUrl = `https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results/${encodeURI(pick.path)}/${encodeURIComponent(name)}%20ParametricEQ.txt`;
            const res = await fetch(txtUrl);
            if (res.ok) {
              const txt = await res.text();
              const filters = [];
              for (const row of txt.split("\n")) {
                const pm = row.match(/Preamp:\s*([-\d.]+)/i);
                if (pm) pick.preamp = parseFloat(pm[1]);
                const fm = row.match(/Filter\s+\d+:\s+ON\s+(PK|LSC|HSC)\s+Fc\s+([\d.]+)\s+Hz\s+Gain\s+([-\d.]+)\s+dB\s+Q\s+([\d.]+)/i);
                if (fm) filters.push({ type: fm[1], freq: parseFloat(fm[2]), gain: parseFloat(fm[3]), q: parseFloat(fm[4]), enabled: true });
              }
              pick.filters = filters;
            }
          } catch (_) {}
        }
        if (!pick.filters.length) {
          pick.filters = [{ freq: 105, gain: 3.5, q: 0.7, type: "LSC", enabled: true }];
        }
        pick.tuning = { bass: 0, tilt: 0 };
        lab.eq.correction = pick;
        lab.eq.correctionEnabled = true;
        lab.eq.enabled = true;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    const aeqRm = document.getElementById("autoeq-remove-btn");
    if (aeqRm) {
      aeqRm.onclick = async () => {
        lab.eq.correction = null;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }
    bindToggle("autoeq-enable-toggle", () => lab.eq.correctionEnabled !== false, (v) => (lab.eq.correctionEnabled = v));
    bindSlider(
      "autoeq-bass",
      (v) => `${v > 0 ? "+" : ""}${Math.round(v)} dB`,
      (v) => {
        if (!lab.eq.correction) return;
        lab.eq.correction.tuning = lab.eq.correction.tuning || {};
        lab.eq.correction.tuning.bass = v;
        const idx = lab.eq.correction.filters.findIndex((f) => f._bass);
        if (idx >= 0) lab.eq.correction.filters[idx].gain = v;
        else if (v !== 0) lab.eq.correction.filters.unshift({ freq: 105, gain: v, q: 0.7, type: "LSC", enabled: true, _bass: true });
      },
      null,
      () => rerender()
    );

    // Audio FX bindings
    bindToggle("fx-reverb-toggle", () => lab.reverb.enabled, (v) => (lab.reverb.enabled = v));
    layer.querySelectorAll("[data-reverb-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const p = FX().REVERB_PRESETS.find((x) => x.id === btn.dataset.reverbPreset);
        if (!p) return;
        Object.assign(lab.reverb, { ...p, presetId: p.id, enabled: true });
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    const setRvCustom = () => {
      lab.reverb.presetId = null;
    };
    bindSlider("rv-mix", (v) => `${Math.round(v * 100)}%`, (v) => { lab.reverb.mix = v; setRvCustom(); });
    bindSlider("rv-size", (v) => `${Math.round(v * 100)}%`, (v) => { lab.reverb.roomSize = v; setRvCustom(); });
    bindSlider("rv-damp", (v) => `${Math.round(v * 100)}%`, (v) => { lab.reverb.damping = v; setRvCustom(); });
    bindSlider("rv-wet", (v) => `${Math.round(v * 100)}%`, (v) => { lab.reverb.wet = v; setRvCustom(); });
    bindSlider("rv-dry", (v) => `${Math.round(v * 100)}%`, (v) => { lab.reverb.dry = v; setRvCustom(); });
    bindSlider("rv-width", (v) => `${Math.round(v * 100)}%`, (v) => { lab.reverb.width = v; setRvCustom(); });
    bindSlider("rv-predelay", (v) => `${Math.round(v)} ms`, (v) => { lab.reverb.preDelayMs = v; setRvCustom(); });
    bindSlider("rv-lowcut", (v) => `${Math.round(v)} Hz`, (v) => { lab.reverb.lowCutHz = v; setRvCustom(); });

    bindToggle("fx-loudness-toggle", () => lab.loudness.enabled, (v) => (lab.loudness.enabled = v));
    layer.querySelectorAll("[data-loud-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const p = FX().LOUDNESS_PRESETS.find((x) => x.id === btn.dataset.loudPreset);
        if (!p) return;
        lab.loudness.boostDb = p.boostDb;
        lab.loudness.compression = p.compression;
        lab.loudness.enabled = true;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    bindSlider("ld-boost", (v) => `+${v.toFixed(1)} dB`, (v) => (lab.loudness.boostDb = v));
    bindSlider("ld-comp", (v) => `${Math.round(v * 100)}%`, (v) => (lab.loudness.compression = v));
    bindToggle("fx-norm-toggle", () => settings.normalizeVolume, (v) => (settings.normalizeVolume = v));
    layer.querySelectorAll("[data-rg-mode]").forEach((btn) => {
      btn.onclick = async () => {
        lab.normalize.replayGainMode = btn.dataset.rgMode;
        await saveAndRerender();
      };
    });
    bindSlider("rg-preamp", (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`, (v) => (lab.normalize.preampDb = v));

    bindToggle("fx-spatial-toggle", () => lab.spatial.enabled, (v) => (lab.spatial.enabled = v));
    layer.querySelectorAll("[data-sp-mode]").forEach((btn) => {
      btn.onclick = async () => {
        lab.spatial.mode = btn.dataset.spMode;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    layer.querySelectorAll("[data-sp-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const p = FX().SPATIAL_PRESETS.find((x) => x.id === btn.dataset.spPreset);
        if (!p) return;
        lab.spatial.cutoffHz = p.cutoffHz;
        lab.spatial.feedDb = p.feedDb;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    bindSlider("sp-cutoff", (v) => `${Math.round(v)} Hz`, (v) => (lab.spatial.cutoffHz = v));
    bindSlider("sp-feed", (v) => `-${v.toFixed(1)} dB`, (v) => (lab.spatial.feedDb = v));
    bindSlider("sp-angle", (v) => `±${Math.round(v)}°`, (v) => (lab.spatial.speakerAngle = v));
    bindSlider("sp-amount", (v) => `${Math.round(v * 100)}%`, (v) => (lab.spatial.amount = v));
    bindToggle("fx-mono-toggle", () => lab.spatial.mono, (v) => (lab.spatial.mono = v));
    bindToggle("fx-atmos-toggle", () => lab.spatial.surround, (v) => (lab.spatial.surround = v));

    layer.querySelectorAll("[data-speed-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const p = FX().SPEED_PRESETS.find((x) => x.id === btn.dataset.speedPreset);
        if (!p) return;
        lab.playback.speed = p.speed;
        lab.playback.preservePitch = p.preservePitch;
        if (p.disableReverb) lab.reverb.enabled = false;
        if (p.reverbPreset) {
          const rv = FX().REVERB_PRESETS.find((r) => r.id === p.reverbPreset);
          if (rv) Object.assign(lab.reverb, { ...rv, presetId: rv.id, enabled: true });
        }
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    const spMinus = document.getElementById("fx-speed-minus");
    if (spMinus) {
      spMinus.onclick = async () => {
        lab.playback.speed = Math.max(0.25, Number((lab.playback.speed - 0.05).toFixed(2)));
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }
    const spPlus = document.getElementById("fx-speed-plus");
    if (spPlus) {
      spPlus.onclick = async () => {
        lab.playback.speed = Math.min(3.0, Number((lab.playback.speed + 0.05).toFixed(2)));
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }
    const spReset = document.getElementById("fx-speed-reset");
    if (spReset) {
      spReset.onclick = async () => {
        lab.playback = { speed: 1.0, preservePitch: true, pitchSemitones: 0 };
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }
    bindSlider("pb-speed", (v) => `${v.toFixed(2)}×`, (v) => (lab.playback.speed = Number(v.toFixed(2))));
    bindToggle("pb-preserve-pitch", () => lab.playback.preservePitch !== false, (v) => (lab.playback.preservePitch = v));
    bindSlider("pb-pitch-st", (v) => `${v > 0 ? "+" : ""}${Math.round(v)} st`, (v) => (lab.playback.pitchSemitones = Math.round(v)));

    bindToggle("fx-volume-toggle", () => lab.volume.enabled, (v) => (lab.volume.enabled = v));
    layer.querySelectorAll("[data-vol-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const p = FX().VOLUME_PRESETS.find((x) => x.id === btn.dataset.volPreset);
        if (!p) return;
        lab.volume.enabled = true;
        lab.volume.exponent = p.exponent;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    bindSlider("vol-exp", (v) => `x^${v.toFixed(1)}`, (v) => (lab.volume.exponent = v));
    bindSlider("vol-limit", (v) => `${Math.round(v * 100)}%`, (v) => (lab.volume.limit = v));

    // CrossMix & Transport Fade
    bindToggle("cm-off-toggle", () => lab.crossmix.mode === "OFF", (v) => (lab.crossmix.mode = v ? "OFF" : "CROSSMIX"));
    layer.querySelectorAll("[data-cm-mode]").forEach((btn) => {
      btn.onclick = async () => {
        lab.crossmix.mode = btn.dataset.cmMode;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    bindSlider("cm-dur", (v) => `${Math.round(v)} s`, (v) => (lab.crossmix.crossfadeDuration = Math.round(v)));
    bindSelect("cm-style-select", (v) => (lab.crossmix.style = v), false);
    layer.querySelectorAll("[data-cm-len]").forEach((btn) => {
      btn.onclick = async () => {
        lab.crossmix.length = btn.dataset.cmLen;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    layer.querySelectorAll("[data-cm-tempo]").forEach((btn) => {
      btn.onclick = async () => {
        lab.crossmix.tempoMatch = btn.dataset.cmTempo;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    bindToggle("cm-always-mix", () => lab.crossmix.alwaysMix !== false, (v) => (lab.crossmix.alwaysMix = v));
    bindToggle("cm-stunts", () => lab.crossmix.stunts !== false, (v) => (lab.crossmix.stunts = v));
    bindToggle("cm-gapless", () => lab.crossmix.gapless !== false, (v) => (lab.crossmix.gapless = v));
    bindToggle("tf-enable", () => lab.crossmix.transportFadeEnabled !== false, (v) => (lab.crossmix.transportFadeEnabled = v));
    bindToggle("tf-skip-blend", () => !!lab.crossmix.skipBlend, (v) => (lab.crossmix.skipBlend = v));
    bindSlider("tf-ahead", (v) => `${Math.round(v)}`, (v) => (lab.crossmix.skipBlendAhead = Math.round(v)));
    bindSlider("tf-sec", (v) => `${v.toFixed(1)} s`, (v) => (lab.crossmix.transportFadeSeconds = v));
    bindSelect("tf-effect", (v) => (lab.crossmix.transportEffect = v), false);
    const cmTestBtn = document.getElementById("cm-test-btn");
    if (cmTestBtn) cmTestBtn.onclick = () => ctx.testCrossmix();

    // Audio Quality & Pass
    bindSelect("aq-stream", (v) => {
      settings.audioQuality = v;
      settings.highQualityAudio = v === "high" || v === "auto";
      lab.quality.stream = v;
    });
    bindToggle("aq-hq-toggle", () => settings.highQualityAudio !== false, (v) => {
      settings.highQualityAudio = v;
      settings.audioQuality = v ? "high" : "low";
    });
    bindToggle("aq-yt-enabled", () => lab.quality.youtubeEnabled !== false, (v) => (lab.quality.youtubeEnabled = v));
    bindSelect("aq-download", (v) => (lab.quality.download = v), false);

    bindToggle("pass-usb", () => !!lab.pass.preferUsbDac, (v) => (lab.pass.preferUsbDac = v));
    bindToggle("pass-hires", () => lab.pass.hiResOutput !== false, (v) => (lab.pass.hiResOutput = v));
    bindToggle("pass-resampler", () => lab.pass.hiFiResampler !== false, (v) => (lab.pass.hiFiResampler = v));
    bindToggle("pass-direct", () => !!lab.pass.usbPassthrough, (v) => (lab.pass.usbPassthrough = v));
    bindSelect("pass-mode", (v) => (lab.pass.mode = v));
    bindSlider("pass-dac-vol", (v) => `${Math.round(v * 100)}%`, (v) => (lab.pass.dacVolume = v));
    bindToggle("pass-fixed-vol", () => !!lab.pass.fixedVolume, (v) => (lab.pass.fixedVolume = v));
    const clearBlockers = document.getElementById("pass-clear-blockers");
    if (clearBlockers) {
      clearBlockers.onclick = async () => {
        lab.eq.enabled = false;
        lab.reverb.enabled = false;
        lab.loudness.enabled = false;
        lab.spatial.enabled = false;
        lab.spatial.mono = false;
        lab.spatial.surround = false;
        lab.volume.enabled = false;
        settings.normalizeVolume = false;
        lab.crossmix.mode = "OFF";
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }

    // Playback category
    const pb = prefs.playback;
    bindToggle("pb-keep-playing", () => pb.keepPlayingWhenClosed !== false, (v) => (pb.keepPlayingWhenClosed = v));
    bindToggle("pb-mix-apps", () => !!pb.playAlongsideOtherApps, (v) => (pb.playAlongsideOtherApps = v));
    bindToggle("pb-resume-bt", () => !!pb.resumeOnBluetooth, (v) => (pb.resumeOnBluetooth = v));
    bindToggle("pb-pause-mute", () => !!pb.pauseWhenMuted, (v) => (pb.pauseWhenMuted = v));
    bindToggle("pb-save-state", () => pb.saveLastState !== false, (v) => (pb.saveLastState = v));
    bindToggle("pb-keep-shuffle", () => pb.keepShuffleOn !== false, (v) => (pb.keepShuffleOn = v));
    bindToggle("pb-skip-silence", () => !!pb.skipSilence, (v) => (pb.skipSilence = v));
    bindToggle("pb-dont-skip", () => !!pb.dontSkipOnFailure, (v) => (pb.dontSkipOnFailure = v));
    bindSlider("pb-skip-timeout", (v) => `${Math.round(v)} s`, (v) => (pb.skipTimeoutSec = Math.round(v)));

    // Now Playing category
    const np = prefs.nowPlaying;
    bindToggle("np-format-badge", () => np.showFormatBadge !== false, (v) => (np.showFormatBadge = v));
    bindToggle("np-sample-rate", () => !!np.showSampleRate, (v) => (np.showSampleRate = v));
    bindSlider("np-lyr-size", (v) => `${Math.round(v * 100)}%`, (v) => (settings.lyricsSize = v));
    bindSelect("np-lyr-pos", (v) => (settings.lyricsPosition = v), false);
    bindToggle("np-lyr-blur", () => settings.lyricsBlur !== false, (v) => (settings.lyricsBlur = v));
    bindToggle("np-lyr-glow", () => !!np.lyricsHighBloom, (v) => { np.lyricsHighBloom = v; settings.lyricsGlow = v; });
    bindToggle("np-yt-trans", () => np.youtubeCaptionTranslation !== false, (v) => (np.youtubeCaptionTranslation = v));
    bindToggle("np-sync-vid", () => np.syncLyricsToVideo !== false, (v) => (np.syncLyricsToVideo = v));
    bindToggle("np-rom-main", () => !!np.romanizeAsMain, (v) => (np.romanizeAsMain = v));
    bindToggle("np-vid-bg", () => !!np.playVideoBackground, (v) => (np.playVideoBackground = v));
    bindToggle("np-vid-ts", () => np.timestampMatching !== false, (v) => (np.timestampMatching = v));
    bindSelect("np-vid-q", (v) => (np.videoQuality = v), false);
    bindToggle("np-vid-noauto", () => !!np.disableVideoAutoplay, (v) => (np.disableVideoAutoplay = v));
    bindToggle("np-vid-studio", () => !!np.studioForVideos, (v) => (np.studioForVideos = v));
    bindToggle("np-canvas", () => np.canvasEnabled !== false, (v) => (np.canvasEnabled = v));
    bindSelect("np-canvas-order", (v) => (np.canvasOrder = v), false);
    bindToggle("np-spotify-canvas", () => !!np.spotifyCanvas, (v) => (np.spotifyCanvas = v));
    bindToggle("np-canvas-wifi", () => np.canvasWifiOnly !== false, (v) => (np.canvasWifiOnly = v));

    // Behaviour category
    const bh = prefs.behaviour;
    const profInput = document.getElementById("bh-profile-name");
    if (profInput) {
      profInput.onchange = async () => {
        settings.profileName = profInput.value.trim();
        await save();
        ctx.onProfileChange();
      };
    }
    bindToggle("bh-larp-toggle", () => !!bh.larpMode, (v) => (bh.larpMode = v));
    layer.querySelectorAll("[data-larp-pick]").forEach((btn) => {
      btn.onclick = async () => {
        bh.larpLevel = btn.dataset.larpPick;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    });
    bindSelect("bh-lang", (v) => (bh.appLanguage = v), false);
    bindToggle("bh-no-updates", () => !!bh.disableUpdateNotices, (v) => (bh.disableUpdateNotices = v));
    bindToggle("bh-no-desc", () => !!bh.disableSettingDescriptions, (v) => (bh.disableSettingDescriptions = v));
    bindToggle("bh-offline", () => !!bh.offlineMode, (v) => (bh.offlineMode = v));
    bindToggle("bh-datasaver", () => !!bh.dataSaver, (v) => (bh.dataSaver = v));
    bindToggle("bh-datasaver-mob", () => bh.dataSaverMobileOnly !== false, (v) => (bh.dataSaverMobileOnly = v));
    bindToggle("bh-proxy-en", () => !!bh.proxyEnabled, (v) => (bh.proxyEnabled = v));
    const pxAddr = document.getElementById("bh-proxy-addr");
    if (pxAddr) {
      pxAddr.onchange = async () => {
        bh.proxyAddress = pxAddr.value.trim();
        await save();
      };
    }
    bindSelect("bh-proxy-type", (v) => (bh.proxyType = v), false);
    bindToggle("bh-hide-explicit", () => !!settings.hideExplicit, (v) => {
      settings.hideExplicit = v;
      ctx.onHomeRefresh();
    });
    bindToggle("bh-albums-likes", () => !!bh.albumsFromLikedSongs, (v) => (bh.albumsFromLikedSongs = v));
    bindToggle("bh-local-meta", () => bh.localAutoMetadata !== false, (v) => (bh.localAutoMetadata = v));
    bindToggle("bh-pause-search", () => !!bh.pauseSearchHistory, (v) => (bh.pauseSearchHistory = v));
    bindToggle("bh-yt-plays", () => bh.ytReportPlays !== false, (v) => (bh.ytReportPlays = v));

    // Customisation category
    const cu = prefs.customisation;
    bindSlider("cu-rounding", (v) => `${Math.round(v)} px`, (v) => (cu.coverRoundingPx = Math.round(v)));
    bindToggle("cu-hero-auto", () => settings.heroAutoTurn !== false, (v) => {
      settings.heroAutoTurn = v;
      ctx.onHeroAutoChange();
    });
    bindSelect("cu-home-style", (v) => (cu.homeStyle = v), false);
    bindSelect("cu-playlist-style", (v) => (cu.playlistStyle = v), false);
    bindSelect("cu-player-style", (v) => (cu.playerStyle = v), false);
    bindToggle("cu-full-cover", () => !!cu.landscapeFullCover, (v) => (cu.landscapeFullCover = v));
    bindToggle("cu-anim-bg", () => settings.animatedBackgrounds !== false, (v) => (settings.animatedBackgrounds = v));
    bindToggle("cu-blur", () => cu.blurEnabled !== false, (v) => (cu.blurEnabled = v));
    bindToggle("cu-prog-blur", () => cu.progressiveBlur !== false, (v) => (cu.progressiveBlur = v));
    bindSlider("cu-blur-px", (v) => `${Math.round(v)} px`, (v) => (cu.blurStrengthPx = Math.round(v)));
    bindToggle("cu-el-blur", () => cu.elementBlur !== false, (v) => (cu.elementBlur = v));
    bindToggle("cu-anim", () => cu.animationEnabled !== false, (v) => (cu.animationEnabled = v));
    bindSlider("cu-anim-spd", (v) => `${v.toFixed(2)}×`, (v) => (cu.animationSpeed = v));
    bindSelect("cu-lyr-motion", (v) => (cu.lyricsMotionStyle = v), false);
    bindToggle("cu-romanise", () => cu.romanisationEnabled !== false, (v) => (cu.romanisationEnabled = v));
    bindToggle("cu-translate-lyr", () => !!cu.translateLyrics, (v) => (cu.translateLyrics = v));
    bindSelect("cu-swipe-r", (v) => (cu.swipeRightAction = v), false);
    bindSelect("cu-swipe-l", (v) => (cu.swipeLeftAction = v), false);

    // Storage category
    bindSlider("st-cache-limit", (idx) => CACHE_STOPS[Math.round(idx)]?.[1] || "1 GB", (idx) => {
      prefs.storage.cacheLimitMb = CACHE_STOPS[Math.round(idx)]?.[0] ?? 1024;
    });
    const clrCacheBtn = document.getElementById("st-clear-cache-btn");
    if (clrCacheBtn) {
      clrCacheBtn.onclick = async () => {
        await ctx.invoke("clear_app_caches");
        await loadStorageStats(ctx);
        rerender();
      };
    }
    const clrHistBtn = document.getElementById("st-clear-history-btn");
    if (clrHistBtn) {
      clrHistBtn.onclick = async () => {
        await ctx.onClearHistory();
        await loadStorageStats(ctx);
        rerender();
      };
    }
    const expBtn = document.getElementById("st-export-btn");
    if (expBtn) expBtn.onclick = () => ctx.invoke("export_user_data").catch((e) => ctx.showError(e));
    const impBtn = document.getElementById("st-import-btn");
    if (impBtn) {
      impBtn.onclick = async () => {
        const res = await ctx.invoke("import_user_data").catch((e) => {
          ctx.showError(e);
          return null;
        });
        if (Array.isArray(res) && res[0]) {
          await ctx.onImportedBackup(res[0], res[1]);
          rerender();
        }
      };
    }

    // Devices & Local
    const devNameIn = document.getElementById("dev-name-input");
    if (devNameIn) {
      devNameIn.onchange = async () => {
        settings.deviceName = devNameIn.value.trim();
        await save();
      };
    }
    bindToggle("dev-share-local", () => settings.shareLocalFiles !== false, (v) => (settings.shareLocalFiles = v));
    bindToggle("dev-reachable", () => prefs.devices.stayReachable !== false, (v) => (prefs.devices.stayReachable = v));
    bindToggle("dev-in-menu", () => prefs.devices.showInPlayerMenu !== false, (v) => (prefs.devices.showInPlayerMenu = v));
    const pairBtn = document.getElementById("dev-pair-btn");
    if (pairBtn) {
      pairBtn.onclick = async () => {
        modalState.pairing = modalState.pairing ? (await ctx.invoke("link_pairing_close"), null) : await ctx.invoke("link_pairing_open");
        rerender();
      };
    }
    const syncBtn = document.getElementById("dev-sync-btn");
    if (syncBtn) {
      syncBtn.onclick = async () => {
        try {
          await ctx.invoke("link_sync", { id: null });
        } catch (e) {
          ctx.showError(e);
        }
        await loadLinkState(ctx);
        rerender();
      };
    }
    layer.querySelectorAll("[data-dev-unlink]").forEach((btn) => {
      btn.onclick = async () => {
        await ctx.invoke("link_unlink", { id: btn.dataset.devUnlink });
        await loadLinkState(ctx);
        rerender();
      };
    });
    const addFolderBtn = document.getElementById("loc-add-folder-btn");
    if (addFolderBtn) {
      addFolderBtn.onclick = async () => {
        const path = await ctx.invoke("pick_local_folder");
        if (path && !(settings.sharedFolders || []).includes(path)) {
          settings.sharedFolders = [...(settings.sharedFolders || []), path];
          await saveAndRerender();
        }
      };
    }
    const rescanBtn = document.getElementById("loc-rescan-btn");
    if (rescanBtn) {
      rescanBtn.onclick = async () => {
        await ctx.invoke("local_rescan");
        await loadStorageStats(ctx);
      };
    }
    layer.querySelectorAll("[data-loc-rm]").forEach((btn) => {
      btn.onclick = async () => {
        const idx = Number(btn.dataset.locRm);
        settings.sharedFolders.splice(idx, 1);
        await saveAndRerender();
      };
    });

    // Integrations & Experimental
    layer.querySelectorAll("[data-move-prov]").forEach((btn) => {
      btn.onclick = async () => {
        const idx = Number(btn.dataset.moveProv);
        const dir = Number(btn.dataset.dir);
        const arr = [...(settings.lyricsProviderOrder || [])];
        const target = idx + dir;
        if (target < 0 || target >= arr.length) return;
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        settings.lyricsProviderOrder = arr;
        await saveAndRerender();
      };
    });
    layer.querySelectorAll("[data-toggle-prov]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.toggleProv;
        const dis = new Set(settings.lyricsProvidersDisabled || []);
        if (dis.has(id)) dis.delete(id);
        else dis.add(id);
        settings.lyricsProvidersDisabled = [...dis];
        await saveAndRerender();
      };
    });
    bindToggle("itg-discord", () => !!prefs.integrations.discordEnabled, (v) => (prefs.integrations.discordEnabled = v));
    bindToggle("itg-dc-clear", () => !!prefs.integrations.discordClearOnPause, (v) => (prefs.integrations.discordClearOnPause = v));
    bindToggle("itg-lastfm", () => !!prefs.integrations.lastfmEnabled, (v) => (prefs.integrations.lastfmEnabled = v));
    bindToggle("itg-librefm", () => !!prefs.integrations.librefmEnabled, (v) => (prefs.integrations.librefmEnabled = v));

    const bindInput = (id, set) => {
      const el = document.getElementById(id);
      if (el) el.onchange = () => { set(el.value); save(); };
    };
    bindInput("itg-dc-act", (v) => (prefs.integrations.discordActivityName = v));
    bindInput("itg-dc-det", (v) => (prefs.integrations.discordDetails = v));
    bindInput("itg-dc-st", (v) => (prefs.integrations.discordState = v));

    bindToggle("ex-xmix-tools", () => !!prefs.experimental.crossmixTestTools, (v) => (prefs.experimental.crossmixTestTools = v));
    bindToggle("ex-stream-toast", () => !!prefs.experimental.showStreamSourceToast, (v) => (prefs.experimental.showStreamSourceToast = v));
    bindSelect("ex-stream-backend", (v) => (prefs.experimental.streamBackend = v), false);
    bindToggle("ex-force-play", () => !!prefs.experimental.forcePlayback, (v) => (prefs.experimental.forcePlayback = v));
    bindToggle("ex-force-recap", () => !!prefs.experimental.forceMonthlyRecap, (v) => (prefs.experimental.forceMonthlyRecap = v));
    bindToggle("ex-big-disc", () => !!prefs.experimental.bigDiscStyles, (v) => (prefs.experimental.bigDiscStyles = v));
    bindToggle("ex-haptics", () => !!prefs.experimental.musicHaptics, (v) => (prefs.experimental.musicHaptics = v));

    const diagBtn = document.getElementById("ex-diag-btn");
    if (diagBtn) {
      diagBtn.onclick = () => {
        modalState.diagnosticsInfo = ctx.getDiagnosticsText();
        rerender();
      };
    }
    const resetPrefsBtn = document.getElementById("ex-reset-prefs-btn");
    if (resetPrefsBtn) {
      resetPrefsBtn.onclick = async () => {
        settings.prefs = defaultPrefs();
        settings.highQualityAudio = true;
        settings.audioQuality = "auto";
        settings.normalizeVolume = true;
        settings.hideExplicit = false;
        settings.lyricsBlur = true;
        settings.lyricsGlow = true;
        settings.animatedBackgrounds = true;
        settings.heroAutoTurn = true;
        ctx.applyAllEffects();
        await saveAndRerender();
      };
    }
  }

  async function loadStorageStats(ctx) {
    try {
      modalState.storageStats = await ctx.invoke("storage_stats");
      if (!document.getElementById("modal-layer")?.classList.contains("hidden") && modalState.category === "storage") {
        renderSettingsModal(ctx);
      }
    } catch (_) {}
  }

  async function loadLinkState(ctx) {
    try {
      modalState.linkState = await ctx.invoke("link_state");
      if (!document.getElementById("modal-layer")?.classList.contains("hidden") && modalState.category === "devices") {
        renderSettingsModal(ctx);
      }
    } catch (_) {}
  }

  window.MochySettingsUI = {
    LARP_LEVELS,
    defaultPrefs,
    ensurePrefsOnSettings,
    open(ctx, initialCat = null, initialSub = null) {
      if (initialCat) modalState.category = initialCat;
      if (initialSub !== null) modalState.audioLabSub = initialSub;
      if (modalState.category === "storage") loadStorageStats(ctx);
      if (modalState.category === "devices") loadLinkState(ctx);
      renderSettingsModal(ctx);
    }
  };
})();
