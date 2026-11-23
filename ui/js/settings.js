// ============================================================================
// Settings and the audio lab, in a card that floats over the app
// The list sits at the left (title, search, category bubbles), the picked page beside it
// ============================================================================
(function () {
  "use strict";

  const FX = () => window.MochyAudioFX;

  function defaultPrefs() {
    const lab = FX() ? FX().defaultAudioLabState() : {};
    return {
      audioLab: lab,
      playback: {
        pauseWhenMuted: false,
        saveLastState: true,
        keepShuffleOn: true,
        skipSilence: false,
        dontSkipOnFailure: false,
        skipTimeoutSec: 6
      },
      nowPlaying: {
        lyricsHighBloom: true
      },
      behaviour: {
        disableSettingDescriptions: false,
        dataSaver: false
      },
      customisation: {
        coverRoundingPx: 14,
        blurEnabled: true,
        elementBlur: true,
        animationEnabled: true
      },
      experimental: {
        showStreamSourceToast: false
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
    // older saves still carry reverb, crossmix and friends, which nothing reads any more
    for (const key of Object.keys(settings.prefs.audioLab)) if (!(key in def.audioLab)) delete settings.prefs.audioLab[key];
    return settings.prefs;
  }

  const CATEGORIES = [
    { id: "audio_lab", title: "Audio Lab", icon: "eq", sub: "Equalizer, quality" },
    { id: "playback", title: "Playback", icon: "play", sub: "Queue, loudness, failures, skip silence" },
    { id: "now_playing", title: "Now playing", icon: "lyrics", sub: "Lyrics size, blur and glow" },
    { id: "behaviour", title: "App behaviour", icon: "tune", sub: "Data saver, explicit songs" },
    { id: "customisation", title: "Customisation", icon: "palette", sub: "Rounding, blur, animation" },
    { id: "storage", title: "Storage", icon: "storage", sub: "Usage, cache, backup", gapBefore: true },
    { id: "devices", title: "Device integration", icon: "devices", sub: "Pair your phone, control it, share songs" },
    { id: "local", title: "Local music", icon: "folder", sub: "Music folders, rescan" },
    { id: "integrations", title: "Advanced", icon: "puzzle", sub: "Lyrics sources, diagnostics, reset" }
  ];

  const SEARCH_INDEX = [
    { cat: "audio_lab", sub: "equalizer", title: "Equalizer", kw: "eq parametric 10 band autoeq preset bass treble preamp" },
    { cat: "audio_lab", sub: "quality", title: "Audio Quality", kw: "bitrate opus aac streaming tier" },
    { cat: "playback", title: "Pause music when muted", kw: "volume zero auto pause" },
    { cat: "playback", title: "Save Player's last state", kw: "persistent queue session restore" },
    { cat: "playback", title: "Keep shuffle on", kw: "persistent shuffle across queues" },
    { cat: "playback", title: "Skip Silence", kw: "trim quiet gaps silence detector" },
    { cat: "playback", title: "Even out songs", kw: "normalize normalise loudness volume level replaygain" },
    { cat: "playback", title: "Don't skip on failure & Timeout", kw: "stream failure retry timeout 5 20s" },
    { cat: "now_playing", title: "Lyrics text size, blur & glow", kw: "blur glow bloom size" },
    { cat: "behaviour", title: "Data saver", kw: "bandwidth lower quality" },
    { cat: "behaviour", title: "Hide explicit songs on Home", kw: "explicit clean filter" },
    { cat: "customisation", title: "Cover rounding", kw: "corner radius px square round 0 32" },
    { cat: "customisation", title: "Auto-advance Home hero", kw: "hero slides carousel" },
    { cat: "customisation", title: "Blur & animations", kw: "glass frosted motion transition ambient backdrop" },
    { cat: "storage", title: "Storage breakdown & clear cache", kw: "cache clear usage" },
    { cat: "storage", title: "Export / Import user data", kw: "backup restore json transfer" },
    { cat: "devices", title: "Device integration & pairing", kw: "phone tablet computer pair code link wifi sync remote control mirror" },
    { cat: "devices", title: "This computer's name", kw: "device name rename" },
    { cat: "devices", title: "Let your devices play songs from here", kw: "share local files stream flac" },
    { cat: "local", title: "Local music folders & Rescan", kw: "flac mp3 wav shared folders" },
    { cat: "integrations", title: "Lyrics Provider Priority", kw: "order enable disable drag move" },
    { cat: "integrations", title: "Diagnostics & reset", kw: "stream source toast diagnostics reset defaults" }
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
    folder: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="11" cy="14.5" r="1.8"/><path d="M12.8 14.5V10l2.7-.8"/></svg>`,
    puzzle: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`,
    closeThin: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`
  };

  // the small dark glyphs inside each row's light round badge, like the phone's settings rows
  const ROW_GLYPHS = {
    volumeOff: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    skip: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    wave: '<path d="M2 12h3l3-7 4 14 3-9 2 2h5"/>',
    textSize: '<path d="M4 7V5h10v2M9 5v14M7 19h4M14 13v-2h7v2M17.5 11v8M16 19h3"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    glow: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    data: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    explicit: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M14 8h-4v8h4M10 12h3"/>',
    lines: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    corner: '<path d="M4 20V10a6 6 0 0 1 6-6h10"/>',
    slides: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M19 8v8M22 10v4"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9.5" r="1"/><circle cx="14.5" cy="9.5" r="1"/><circle cx="9" cy="14" r="1"/>',
    glass: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7 17 17 7"/>',
    motion: '<path d="M5 12h9M9 7h11M7 17h8"/>',
    bars: '<path d="M6 18v-6M12 18V6M18 18v-9"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'
  };

  const ROW_ICONS = {
    "aq-stream": "bars",
    "aq-hq-toggle": "wave",
    "pb-pause-mute": "volumeOff",
    "pb-even-out": "volume",
    "pb-save-state": "restore",
    "pb-keep-shuffle": "shuffle",
    "pb-skip-silence": "skip",
    "pb-dont-skip": "skip",
    "pb-skip-timeout": "timer",
    "np-lyr-size": "textSize",
    "np-lyr-blur": "drop",
    "np-lyr-glow": "glow",
    "bh-datasaver": "data",
    "bh-hide-explicit": "explicit",
    "bh-no-desc": "lines",
    "cu-rounding": "corner",
    "cu-hero-auto": "slides",
    "cu-anim-bg": "palette",
    "cu-blur": "glass",
    "cu-el-blur": "drop",
    "cu-anim": "motion",
    "ex-stream-toast": "bell"
  };

  function rowIconHtml(id) {
    const glyph = ROW_GLYPHS[ROW_ICONS[id]];
    if (!glyph) return "";
    return `<span class="ms-row-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></span>`;
  }

  let modalState = {
    host: null,
    open: false,
    hideTimer: 0,
    category: "audio_lab",
    audioLabSub: null, // null | "equalizer" | "quality"
    eqTab: "graph", // "graph" | "bands" | "autoeq"
    selectedEqNode: 0,
    searchQuery: "",
    autoEqQuery: "",
    remoteAutoEqList: null,
    remoteAutoEqLoading: false,
    storageStats: null,
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
        ${rowIconHtml(id)}
        <div class="ms-row-text">
          <div class="ms-row-title">${esc(title)}</div>
          ${!hideDesc && desc ? `<div class="ms-row-desc" title="${esc(desc)}">${esc(desc)}</div>` : ""}
        </div>
        <button class="toggle-switch ${checked ? "on" : ""}" id="${esc(id)}" aria-pressed="${checked ? "true" : "false"}"></button>
      </div>`;
  }

  function sliderRowHtml(id, title, desc, valText, { min, max, step = 1, value }, hideDesc) {
    return `
      <div class="ms-row ms-row-col">
        <div class="ms-row-head">
          ${rowIconHtml(id)}
          <div class="ms-row-text">
            <div class="ms-row-title">${esc(title)}</div>
            ${!hideDesc && desc ? `<div class="ms-row-desc" title="${esc(desc)}">${esc(desc)}</div>` : ""}
          </div>
          <span class="ms-val-pill" id="${esc(id)}-val">${esc(valText)}</span>
        </div>
        <input class="ms-slider" type="range" id="${esc(id)}" min="${min}" max="${max}" step="${step}" value="${value}" />
      </div>`;
  }

  function selectRowHtml(id, title, desc, options, currentVal, hideDesc) {
    return `
      <div class="ms-row">
        ${rowIconHtml(id)}
        <div class="ms-row-text">
          <div class="ms-row-title">${esc(title)}</div>
          ${!hideDesc && desc ? `<div class="ms-row-desc" title="${esc(desc)}">${esc(desc)}</div>` : ""}
        </div>
        <select class="ms-select" id="${esc(id)}">
          ${options
            .map(([val, label]) => `<option value="${esc(val)}" ${val === currentVal ? "selected" : ""}>${esc(label)}</option>`)
            .join("")}
        </select>
      </div>`;
  }

  // the list stays at the left and the picked page opens beside it, both inside the floating card
  function renderSettingsPage(ctx) {
    const host = modalState.host;
    if (!host) return;

    const settings = ctx.getSettings();
    const prefs = ensurePrefsOnSettings(settings);
    const hideDesc = !!prefs.behaviour.disableSettingDescriptions;
    // flipping a switch redraws the page, so both columns keep their place unless a different page opens
    const pageKey = `${modalState.category}/${modalState.audioLabSub || ""}`;
    const keepPage = host._pageKey === pageKey;
    const listTop = host.querySelector(".sp-list")?.scrollTop || 0;
    const pageTop = keepPage ? document.getElementById("ms-right-pane")?.scrollTop || 0 : 0;
    host._pageKey = pageKey;

    host.innerHTML = `
      <aside class="sp-list">
        <h1 class="page-title" id="sp-title">Settings</h1>
        <div class="pill-field">
          <span class="pill-field-lead">${UI_ICONS.search}</span>
          <input type="text" id="ms-search-input" placeholder="Search settings" value="${esc(modalState.searchQuery)}" autocomplete="off" spellcheck="false" />
          <button class="pill-field-clear ${modalState.searchQuery ? "" : "hidden"}" id="ms-search-clear" title="Clear">${UI_ICONS.close}</button>
        </div>
        <div class="sp-list-body" id="sp-list-body">${listBodyHtml()}</div>
      </aside>
      <div class="sp-divider"></div>
      <main class="ms-right-pane" id="ms-right-pane">
        ${renderCategoryHtml(modalState.category, settings, prefs, hideDesc, ctx)}
      </main>
      <button class="sp-close" id="sp-close" title="Close (Esc)" aria-label="Close settings">${UI_ICONS.closeThin}</button>
    `;

    host.querySelector(".sp-list").scrollTop = listTop;
    document.getElementById("ms-right-pane").scrollTop = pageTop;
    bindSettingsEvents(host, ctx);
  }

  // the category bubbles, or while searching, one bubble per setting that matches
  function listBodyHtml() {
    const q = modalState.searchQuery.trim();
    if (!q) {
      return CATEGORIES.map(
        (c) => `
        <button class="sp-bubble ${modalState.category === c.id ? "selected" : ""} ${c.gapBefore ? "gap-before" : ""}" data-ms-cat="${esc(c.id)}">
          <span class="sp-bubble-icon">${UI_ICONS[c.icon]}</span>
          <span class="sp-bubble-title">${esc(c.title)}</span>
        </button>`
      ).join("");
    }
    const needle = q.toLowerCase();
    const hits = SEARCH_INDEX.filter(
      (item) => item.title.toLowerCase().includes(needle) || item.kw.toLowerCase().includes(needle) || item.cat.toLowerCase().includes(needle)
    );
    if (!hits.length) return `<div class="ms-empty">Nothing matches "${esc(q)}".</div>`;
    return hits
      .map((h) => {
        const cat = CATEGORIES.find((c) => c.id === h.cat);
        return `
          <button class="sp-bubble hit" data-hit-cat="${esc(h.cat)}" data-hit-sub="${esc(h.sub || "")}">
            <span class="sp-bubble-icon small">${UI_ICONS.tune}</span>
            <span class="sp-bubble-text">
              <span class="sp-bubble-title">${esc(h.title)}</span>
              <span class="sp-bubble-page">${esc(cat?.title || h.cat)}</span>
            </span>
          </button>`;
      })
      .join("");
  }

  function renderCategoryHtml(cat, settings, prefs, hideDesc, ctx) {
    switch (cat) {
      case "audio_lab":
        if (modalState.audioLabSub === "equalizer") return renderEqualizerHtml(prefs, hideDesc);
        if (modalState.audioLabSub === "quality") return renderAudioQualityHtml(settings, prefs, hideDesc);
        return renderAudioLabHubHtml(settings, prefs);
      case "playback":
        return renderPlaybackHtml(settings, prefs, hideDesc);
      case "now_playing":
        return renderNowPlayingHtml(settings, prefs, hideDesc);
      case "behaviour":
        return renderBehaviourHtml(settings, prefs, hideDesc);
      case "customisation":
        return renderCustomisationHtml(settings, prefs, hideDesc);
      case "storage":
        return renderStorageHtml(settings, prefs, hideDesc);
      case "devices":
        return window.MochyDevices ? window.MochyDevices.pageHtml(ctx) : "";
      case "local":
        return renderLocalMusicHtml(settings);
      case "integrations":
        return renderIntegrationsHtml(settings, prefs, hideDesc, ctx);
      default:
        return "";
    }
  }

  // --------------------------------------------------------------------------
  // 1. audio lab hub and its two pages, the equalizer and audio quality
  // --------------------------------------------------------------------------
  function renderAudioLabHubHtml(settings, prefs) {
    const lab = prefs.audioLab;
    const presetObj =
      FX()?.EQ_PRESETS.find((p) => p.id === lab.eq.presetId) ||
      (lab.presets || []).find((p) => p.id === lab.eq.presetId);
    const eqStatus = !lab.eq.enabled ? "Off" : presetObj ? presetObj.name : "Custom";
    const quality = settings.audioQuality || lab.quality.stream;
    const qLabel = { auto: "Auto", high: "High (Opus)", medium: "Medium (AAC)", low: "Low" }[quality] || "Auto";

    return `
      <div class="ms-pane-head">
        <div>
          <h3 class="ms-pane-title">Audio <span style="opacity:0.6;">Lab</span></h3>
          <div class="ms-row-desc">Shape the sound with the equalizer and pick how good the streams are</div>
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

        <button class="alab-card big" data-alab-sub="quality">
          <div class="alab-card-top">
            <span class="alab-card-title">Audio Quality</span>
          </div>
          <div class="alab-card-sub">${esc(qLabel)}</div>
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
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 2. Playback
  // --------------------------------------------------------------------------
  function renderPlaybackHtml(settings, prefs, hideDesc) {
    const p = prefs.playback;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Playback</h3></div>
      <div class="ms-section-title">While you listen</div>
      <div class="ms-card-group">
        ${toggleRowHtml("pb-even-out", "Even out songs", "Plays every song at the same loudness", !!settings.normalizeVolume, hideDesc)}
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
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 3. Now Playing
  // --------------------------------------------------------------------------
  function renderNowPlayingHtml(settings, prefs, hideDesc) {
    const np = prefs.nowPlaying;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Now playing</h3></div>
      <div class="ms-section-title">Lyrics</div>
      <div class="ms-card-group">
        ${sliderRowHtml("np-lyr-size", "Text size", "Scale lyrics font size across right pane & full player", `${Math.round((settings.lyricsSize || 1) * 100)}%`, { min: 0.8, max: 1.35, step: 0.05, value: settings.lyricsSize || 1 }, hideDesc)}
        ${toggleRowHtml("np-lyr-blur", "Distance blur on inactive lines", "Apple Music-style progressive blur away from active line", settings.lyricsBlur !== false, hideDesc)}
        ${toggleRowHtml("np-lyr-glow", "High quality bloom", "Extra soft bloom glow on held notes", !!np.lyricsHighBloom, hideDesc)}
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 4. App Behaviour (Data Saver, Explicit Songs, Setting Descriptions)
  // --------------------------------------------------------------------------
  function renderBehaviourHtml(settings, prefs, hideDesc) {
    const b = prefs.behaviour;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">App behaviour</h3></div>
      <div class="ms-section-title">General</div>
      <div class="ms-card-group">
        ${toggleRowHtml("bh-datasaver", "Data saver", "Plays lighter streams to use less data", !!b.dataSaver, hideDesc)}
        ${toggleRowHtml("bh-hide-explicit", "Hide explicit songs on Home", "Filter explicit items out of Home cards and carousels", !!settings.hideExplicit, hideDesc)}
        ${toggleRowHtml("bh-no-desc", "Hide descriptions in settings", "Only titles show, for short clean rows", !!b.disableSettingDescriptions, hideDesc)}
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 5. Customisation
  // --------------------------------------------------------------------------
  function renderCustomisationHtml(settings, prefs, hideDesc) {
    const c = prefs.customisation;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Customisation</h3></div>
      <div class="ms-section-title">Layout</div>
      <div class="ms-card-group">
        ${sliderRowHtml("cu-rounding", "Cover rounding", "Corner radius across album cards and hero badges", `${c.coverRoundingPx} px`, { min: 0, max: 32, step: 1, value: c.coverRoundingPx ?? 14 }, hideDesc)}
        ${toggleRowHtml("cu-hero-auto", "Auto-advance Home hero", "Smoothly cycle hero slides every few seconds", settings.heroAutoTurn !== false, hideDesc)}
      </div>

      <div class="ms-section-title">Glass & motion</div>
      <div class="ms-card-group">
        ${toggleRowHtml("cu-anim-bg", "Animated ambient backdrop", "Moving colour behind the full player", settings.animatedBackgrounds !== false, hideDesc)}
        ${toggleRowHtml("cu-blur", "Blur", "Frosted glass on the top bar, panes, menus and the hero", c.blurEnabled !== false, hideDesc)}
        ${toggleRowHtml("cu-el-blur", "Soft blur on lyrics and sections", "Lines away from the sung one and sections as they appear", c.elementBlur !== false, hideDesc)}
        ${toggleRowHtml("cu-anim", "Animations", "Smooth springs and page slides", c.animationEnabled !== false, hideDesc)}
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 6. Storage & Cache
  // --------------------------------------------------------------------------
  function renderStorageHtml(settings, prefs, hideDesc) {
    const st = modalState.storageStats;
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

      <div class="ms-section-title">Cleanup</div>
      <div class="ms-card-group">
        <div class="ms-btn-row">
          <button class="ms-action-btn" id="st-clear-cache-btn">Clear stream, lyrics & cover cache</button>
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
  // 7. Local music (Device integration has its own page in devices.js)
  // --------------------------------------------------------------------------
  function renderLocalMusicHtml(settings) {
    const folders = settings.sharedFolders || [];

    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Local music</h3></div>
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
    const ex = prefs.experimental;
    const providers = ctx.getProviders() || [];

    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Advanced</h3></div>

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

      <div class="ms-section-title">Diagnostics</div>
      <div class="ms-card-group">
        ${toggleRowHtml("ex-stream-toast", "Show where songs play from", "Display stream codec & source toast on track start", !!ex.showStreamSourceToast, hideDesc)}
        <div class="ms-btn-row" style="margin-top:6px;">
          <button class="ms-action-btn" id="ex-diag-btn">Inspect Playback Diagnostics</button>
          <button class="ms-action-btn danger" id="ex-reset-prefs-btn">Reset all Settings to Default</button>
        </div>
        ${modalState.diagnosticsInfo ? `<pre class="ms-diag-box">${esc(modalState.diagnosticsInfo)}</pre>` : ""}
      </div>

      <div class="ms-section-title">About Mochy</div>
      <div class="ms-card-group">
        <div class="ms-row-desc">Mochy for desktop, still in alpha. Built with Tauri and Rust.</div>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // Event Binding
  // --------------------------------------------------------------------------
  function bindSettingsEvents(layer, ctx) {
    const settings = ctx.getSettings();
    const prefs = ensurePrefsOnSettings(settings);
    const lab = prefs.audioLab;

    // a save can land after the card closed, and then there's nothing to redraw
    const rerender = () => modalState.open && renderSettingsPage(ctx);
    const save = () => ctx.saveSettings(false);
    const saveAndRerender = async () => {
      await ctx.saveSettings(true);
      rerender();
    };

    // typing only redraws the list under the field, so the field keeps its focus
    const searchInput = document.getElementById("ms-search-input");
    const clrSearch = document.getElementById("ms-search-clear");
    if (searchInput) {
      searchInput.oninput = () => {
        modalState.searchQuery = searchInput.value;
        clrSearch?.classList.toggle("hidden", !searchInput.value);
        refreshListBody(layer, ctx);
      };
      searchInput.onkeydown = (e) => {
        if (e.key !== "Escape" || !searchInput.value) return;
        e.stopPropagation();
        searchInput.value = "";
        searchInput.oninput();
      };
    }
    if (clrSearch) {
      clrSearch.onclick = () => {
        searchInput.value = "";
        searchInput.oninput();
        searchInput.focus();
      };
    }
    bindListBody(layer, ctx);
    document.getElementById("sp-close").onclick = closeSettings;

    layer.querySelectorAll("[data-alab-sub]").forEach((btn) => {
      btn.onclick = () => {
        modalState.audioLabSub = btn.dataset.alabSub;
        rerender();
      };
    });
    layer.querySelectorAll("[data-ms-back]").forEach((btn) => {
      btn.onclick = () => {
        modalState.audioLabSub = null;
        rerender();
      };
    });

    // the whole row flips its switch, like the phone
    const bindToggle = (id, get, set, shouldRerender = true) => {
      const el = document.getElementById(id);
      if (!el) return;
      (el.closest(".ms-row") || el).onclick = async () => {
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

    // Audio Quality
    bindSelect("aq-stream", (v) => {
      settings.audioQuality = v;
      settings.highQualityAudio = v === "high" || v === "auto";
      lab.quality.stream = v;
    });
    bindToggle("aq-hq-toggle", () => settings.highQualityAudio !== false, (v) => {
      settings.highQualityAudio = v;
      settings.audioQuality = v ? "high" : "low";
    });

    // Playback category
    const pb = prefs.playback;
    bindToggle("pb-even-out", () => !!settings.normalizeVolume, (v) => (settings.normalizeVolume = v));
    bindToggle("pb-pause-mute", () => !!pb.pauseWhenMuted, (v) => (pb.pauseWhenMuted = v));
    bindToggle("pb-save-state", () => pb.saveLastState !== false, (v) => (pb.saveLastState = v));
    bindToggle("pb-keep-shuffle", () => pb.keepShuffleOn !== false, (v) => (pb.keepShuffleOn = v));
    bindToggle("pb-skip-silence", () => !!pb.skipSilence, (v) => (pb.skipSilence = v));
    bindToggle("pb-dont-skip", () => !!pb.dontSkipOnFailure, (v) => (pb.dontSkipOnFailure = v));
    bindSlider("pb-skip-timeout", (v) => `${Math.round(v)} s`, (v) => (pb.skipTimeoutSec = Math.round(v)));

    // Now Playing category
    const np = prefs.nowPlaying;
    bindSlider("np-lyr-size", (v) => `${Math.round(v * 100)}%`, (v) => (settings.lyricsSize = v));
    bindToggle("np-lyr-blur", () => settings.lyricsBlur !== false, (v) => (settings.lyricsBlur = v));
    bindToggle("np-lyr-glow", () => !!np.lyricsHighBloom, (v) => { np.lyricsHighBloom = v; settings.lyricsGlow = v; });

    // Behaviour category
    const bh = prefs.behaviour;
    bindToggle("bh-no-desc", () => !!bh.disableSettingDescriptions, (v) => (bh.disableSettingDescriptions = v));
    bindToggle("bh-datasaver", () => !!bh.dataSaver, (v) => (bh.dataSaver = v));
    bindToggle("bh-hide-explicit", () => !!settings.hideExplicit, (v) => {
      settings.hideExplicit = v;
      ctx.onHomeRefresh();
    });

    // Customisation category
    const cu = prefs.customisation;
    bindSlider("cu-rounding", (v) => `${Math.round(v)} px`, (v) => (cu.coverRoundingPx = Math.round(v)));
    bindToggle("cu-hero-auto", () => settings.heroAutoTurn !== false, (v) => {
      settings.heroAutoTurn = v;
      ctx.onHeroAutoChange();
    });
    bindToggle("cu-anim-bg", () => settings.animatedBackgrounds !== false, (v) => (settings.animatedBackgrounds = v));
    bindToggle("cu-blur", () => cu.blurEnabled !== false, (v) => (cu.blurEnabled = v));
    bindToggle("cu-el-blur", () => cu.elementBlur !== false, (v) => (cu.elementBlur = v));
    bindToggle("cu-anim", () => cu.animationEnabled !== false, (v) => (cu.animationEnabled = v));

    // Storage category
    const clrCacheBtn = document.getElementById("st-clear-cache-btn");
    if (clrCacheBtn) {
      clrCacheBtn.onclick = async () => {
        await ctx.invoke("clear_app_caches");
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

    // Device integration binds its own page, Local music its folders
    if (modalState.category === "devices") window.MochyDevices?.bindPage(ctx);
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

    // Advanced
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
    bindToggle("ex-stream-toast", () => !!prefs.experimental.showStreamSourceToast, (v) => (prefs.experimental.showStreamSourceToast = v));

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

  function refreshListBody(host, ctx) {
    const body = document.getElementById("sp-list-body");
    if (!body) return;
    body.innerHTML = listBodyHtml();
    bindListBody(host, ctx);
  }

  // a bubble opens its page beside the list; a search hit does the same and clears the search
  function bindListBody(host, ctx) {
    host.querySelectorAll("[data-ms-cat], [data-hit-cat]").forEach((btn) => {
      btn.onclick = () => {
        const isHit = !!btn.dataset.hitCat;
        modalState.category = isHit ? btn.dataset.hitCat : btn.dataset.msCat;
        modalState.audioLabSub = isHit ? btn.dataset.hitSub || null : null;
        if (isHit) modalState.searchQuery = "";
        if (modalState.category === "storage") loadStorageStats(ctx);
        // device integration always opens on its list, like the phone's sheet
        if (modalState.category === "devices") window.MochyDevices?.reset();
        renderSettingsPage(ctx);
      };
    });
  }

  // late answers (storage stats) only redraw while the card is open on their page
  function pageIsShowing(category) {
    return modalState.open && modalState.category === category;
  }

  async function loadStorageStats(ctx) {
    try {
      modalState.storageStats = await ctx.invoke("storage_stats");
      if (pageIsShowing("storage")) renderSettingsPage(ctx);
    } catch (_) {}
  }

  // the card is built once and kept; closing only hides it and empties the page inside
  function ensureLayer() {
    let layer = document.getElementById("settings-layer");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.id = "settings-layer";
    layer.className = "settings-layer hidden";
    layer.innerHTML = `<div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="sp-title" tabindex="-1"></div>`;
    // only a click that starts and ends on the dim closes, so a slider dragged off the card doesn't
    let downOnScrim = false;
    layer.onpointerdown = (e) => (downOnScrim = e.target === layer);
    layer.onclick = (e) => {
      if (downOnScrim && e.target === layer) closeSettings();
    };
    (document.getElementById("app") || document.body).appendChild(layer);
    return layer;
  }

  function motionIsReduced() {
    return !!document.querySelector(".app-root.no-anim") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // the page is drawn while the layer is still hidden, then the card grows in on the next style pass
  function showLayer(layer) {
    clearTimeout(modalState.hideTimer);
    modalState.open = true;
    document.getElementById("app")?.classList.add("settings-open");
    layer.classList.remove("hidden");
    void layer.offsetWidth;
    layer.classList.add("open");
    modalState.host.focus({ preventScroll: true });
  }

  function closeSettings() {
    if (!modalState.open) return false;
    modalState.open = false;
    const layer = document.getElementById("settings-layer");
    layer.classList.remove("open");
    document.getElementById("app")?.classList.remove("settings-open");
    // emptying the page also stops the device page's timers, which look for their own DOM
    modalState.hideTimer = setTimeout(() => {
      layer.classList.add("hidden");
      modalState.host.innerHTML = "";
      modalState.host._pageKey = null;
    }, motionIsReduced() ? 0 : 280);
    return true;
  }

  window.MochySettingsUI = {
    defaultPrefs,
    ensurePrefsOnSettings,
    // floats the card in, on a category (and an audio lab page) when given; already open, it just switches page
    open(ctx, initialCat = null, initialSub = null) {
      const layer = ensureLayer();
      modalState.host = layer.querySelector(".settings-card");
      if (initialCat) {
        modalState.category = initialCat;
        modalState.audioLabSub = initialSub;
      }
      if (modalState.category === "storage") loadStorageStats(ctx);
      if (initialCat === "devices") window.MochyDevices?.reset();
      renderSettingsPage(ctx);
      if (!modalState.open) showLayer(layer);
    },
    // true when there was a card to close, so escape knows it was used up
    close: closeSettings
  };
})();
