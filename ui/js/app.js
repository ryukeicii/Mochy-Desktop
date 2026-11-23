/* ==========================================================================
   Mochy — Frontend Application (Tauri v2 + Native Smooth Transitions + WebGL)
   ========================================================================== */

(() => {
  "use strict";

  const invoke = window.__TAURI__?.core?.invoke
    ? (cmd, args = {}) => window.__TAURI__.core.invoke(cmd, args)
    : async () => { throw new Error("Tauri runtime not available"); };

  const tauriListen = window.__TAURI__?.event?.listen
    ? (ev, cb) => window.__TAURI__.event.listen(ev, (e) => cb(e?.payload))
    : () => {};

  // apple's push and sheet curve, the same one the css calls --ease-ios
  const IOS_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

  // --------------------------------------------------------------------------
  // Vector Icons (Exact paths from VectorIcons.swift + UI symbols)
  // --------------------------------------------------------------------------
  const ICONS = {
    home: `<svg viewBox="0 0 46 46" width="17" height="17" fill="none"><path d="M7 44H15C15.5523 44 16 43.5523 16 43V30C16 27.2386 18.2386 25 21 25H25C27.7614 25 30 27.2386 30 30V43C30 43.5523 30.4477 44 31 44H39C41.7614 44 44 41.7614 44 39V16.1553C44 15.8119 43.8236 15.4927 43.5332 15.3096L25.667 4.04492C24.0377 3.01776 21.9623 3.01776 20.333 4.04492L2.4668 15.3096C2.17637 15.4927 2 15.8119 2 16.1553V39C2 41.7614 4.23858 44 7 44Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
    homeFilled: `<svg viewBox="0 0 46 46" width="17" height="17" fill="currentColor"><path d="M0 39C0 42.866 3.13401 46 7 46H12C13.6569 46 15 44.6569 15 43V30C15 28.3431 16.3431 27 18 27H27.5C29.1569 27 30.5 28.3431 30.5 30V43C30.5 44.6569 31.8431 46 33.5 46H39C42.866 46 46 42.866 46 39V16.1551C46 15.1249 45.4714 14.1667 44.5999 13.6173L26.7331 2.35348C24.4521 0.915455 21.5479 0.915451 19.2669 2.35348L1.4001 13.6173C0.528615 14.1667 0 15.1249 0 16.1551V39Z"/></svg>`,
    search: `<svg viewBox="0 0 43 44" width="17" height="17" fill="none"><circle cx="17" cy="17" r="14.5" stroke="currentColor" stroke-width="5"/><line x1="28.5355" y1="30" x2="40" y2="41.4645" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`,
    searchFilled: `<svg viewBox="0 0 43 44" width="17" height="17" fill="currentColor"><circle cx="17" cy="17" r="17"/><line x1="15.5334" y1="15.1218" x2="40.1218" y2="41.4666" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`,
    library: `<svg viewBox="0 0 57 51" width="17" height="17" fill="none"><path d="M45 4H18C13.5817 4 10 7.58172 10 12V39C10 43.4183 13.5817 47 18 47H45C49.4183 47 53 43.4183 53 39V12C53 7.58172 49.4183 4 45 4Z" stroke="currentColor" stroke-width="5"/><line x1="2" y1="10" x2="2" y2="43" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M22 31.5C22 28.4624 24.4624 26 27.5 26H29.5C32.5376 26 35 28.4624 35 31.5C35 34.5376 32.5376 37 29.5 37H27.5C24.4624 37 22 34.5376 22 31.5Z" fill="currentColor"/><path d="M31 17C31 15.8954 31.8954 15 33 15C34.1046 15 35 15.8954 35 17V30C35 31.1046 34.1046 32 33 32C31.8954 32 31 31.1046 31 30V17Z" fill="currentColor"/><path d="M31 17C31 15.8954 31.8954 15 33 15H39C40.1046 15 41 15.8954 41 17C41 18.1046 40.1046 19 39 19H33C31.8954 19 31 18.1046 31 17Z" fill="currentColor"/></svg>`,
    libraryFilled: `<svg viewBox="0 0 57 51" width="17" height="17" fill="currentColor"><line x1="2" y1="10" x2="2" y2="43" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M45 0.5C51.3513 0.5 56.5 5.64873 56.5 12V39C56.5 45.3513 51.3513 50.5 45 50.5H18C11.6487 50.5 6.5 45.3513 6.5 39V12C6.5 5.64873 11.6487 0.5 18 0.5H45ZM33 15C31.8954 15 31 15.8954 31 17V26.208C30.5231 26.0731 30.0201 26 29.5 26H27.5C24.4624 26 22 28.4624 22 31.5C22 34.5376 24.4624 37 27.5 37H29.5C32.5376 37 35 34.5376 35 31.5C35 31.1796 34.9705 30.8659 34.918 30.5605C34.9699 30.3825 35 30.1948 35 30V19H39C40.1046 19 41 18.1046 41 17C41 15.8954 40.1046 15 39 15H33Z"/></svg>`,
    mochy: `<svg viewBox="55.67 50.42 135.16 135.16" width="20" height="20" fill="none"><path d="M163.5 96.3493C180.167 105.972 180.167 130.028 163.5 139.651L108 171.694C91.3333 181.316 70.5 169.288 70.5 150.043V85.9569C70.5 66.7119 91.3333 54.6838 108 64.3063L163.5 96.3493Z" stroke="currentColor" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/><path d="M97 112L108.5 98L120 112" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M110.325 125C111.871 133.439 121.868 148.704 142.944 149.92" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    play: `<svg viewBox="-1 -2 30 35" width="14" height="16" fill="currentColor"><path d="M25.2291 20.3919c3.6945-2.1078 3.6945-7.676 0-9.7838L7.83413 .683455C4.30091-1.33253.000003 1.35322.000002 5.57537L0 25.4247c0 4.2221 4.30091 6.9078 7.83413 4.8919l17.39497-9.9247z"/></svg>`,
    pause: `<svg viewBox="0 0 28 33" width="14" height="16" fill="currentColor"><path d="M28 5.5C28 2.46243 25.4928 0 22.4 0c-3.0927 0-5.6 2.46243-5.6 5.5v22c0 3.0376 2.5073 5.5 5.6 5.5 3.0928 0 5.6-2.4624 5.6-5.5v-22zM11.2 5.5C11.2 2.46243 8.69279 0 5.6 0 2.50721 0 0 2.46243 0 5.5v22C0 30.5376 2.50721 33 5.6 33c3.09279 0 5.6-2.4624 5.6-5.5v-22z"/></svg>`,
    prev: `<svg viewBox="0 -1 50 34" width="17" height="12" fill="currentColor"><path d="M3.90516 21.838c-3.667105-2.0192-3.667104-7.3532 0-9.3723L21.1712 2.95838c3.507-1.9312 7.7761.6416 7.7761 4.68618V26.6591c0 4.0446-4.2691 6.6173-7.7761 4.6862L3.90516 21.838z"/><path d="M24.9579 21.8381c-3.6671-2.0192-3.6671-7.3532 0-9.3724L42.224 2.95844C45.731 1.02724 50 3.60004 50 7.64463V26.6592c0 4.0445-4.269 6.6172-7.7761 4.6861l-17.266-9.5072z"/></svg>`,
    next: `<svg viewBox="0 -1 50 34" width="17" height="12" fill="currentColor"><path d="M46.0948 10.162c3.6671 2.0192 3.6671 7.3532 0 9.3723l-17.266 9.5073c-3.507 1.9312-7.7761-.6416-7.7761-4.6862V5.34091c0-4.04458 4.2691-6.61727 7.7761-4.686182L46.0948 10.162z"/><path d="M25.0421 10.1619c3.6671 2.0192 3.6671 7.3532 0 9.3724L7.77605 29.0416C4.26903 30.9728 0 28.4 0 24.3554V5.34085C.000002 1.29627 4.26903-1.27642 7.77605.654667L25.0421 10.1619z"/></svg>`,
    shuffle: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
    repeat: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    repeatOne: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7.5" font-weight="800" font-family="system-ui">1</text></svg>`,
    heart: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    heartFilled: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    lyrics: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="8.5" x2="16" y2="8.5"/><line x1="8" y1="12.5" x2="13" y2="12.5"/></svg>`,
    queue: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>`,
    music: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    volume: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    mute: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
    more: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`,
    expand: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    sidebar: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="5.5" y1="9" x2="6.8" y2="9"/><line x1="5.5" y1="12" x2="6.8" y2="12"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9.5 6 15.5 12 9.5 18"/></svg>`,
    sidebarExpand: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="12.5" y1="12" x2="17" y2="12"/><line x1="14.75" y1="9.75" x2="17" y2="12"/><line x1="14.75" y1="14.25" x2="17" y2="12"/></svg>`,
    swap: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v14M4.5 7.5L8 4l3.5 3.5M16 20V6M12.5 16.5L16 20l3.5-3.5"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
    sparkles: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>`,
    pointer: `<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><path d="M6.5 4.2c0-1.1 1.2-1.8 2.1-1.2l11.6 7.8c.8.5.8 1.8 0 2.4L8.6 21c-.9.6-2.1-.1-2.1-1.2V4.2z"/></svg>`,
    gachaDie: (spinning) => `
      <svg class="gacha-die-svg ${spinning ? "spinning" : ""}" viewBox="0 0 21 21">
        <rect x="0.5" y="0.5" width="20" height="20" rx="4.5" fill="#ffffff"/>
        <circle cx="5.9" cy="5.9" r="2.1" fill="#3c3c3c"/>
        <circle cx="15.1" cy="5.9" r="2.1" fill="#3c3c3c"/>
        <circle cx="10.5" cy="10.5" r="2.1" fill="#3c3c3c"/>
        <circle cx="5.9" cy="15.1" r="2.1" fill="#3c3c3c"/>
        <circle cx="15.1" cy="15.1" r="2.1" fill="#3c3c3c"/>
      </svg>`
  };

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const state = {
    proxyPort: 0,
    platform: "macos",
    userName: "",
    tab: "home", // "home" | "library" | "search"
    routeStack: [],

    // Responsive & Pane State
    userSidebarCollapsed: true,
    autoSidebarCollapsed: false,
    rightPaneOpen: false,
    rightPaneTab: "lyrics", // "queue" | "lyrics"
    showFullPlayer: false,
    fullPlayerMode: "lyrics",

    // Home & Hero State
    homePage: null,
    homeLoading: true,
    discoverPicks: [],
    quickPicks: [],
    heroCards: [],
    heroIndex: 0,
    heroShownId: null,
    heroHovered: false,
    heroScrollProgress: 0,

    // Gacha State (matching HeroCarousel.kt / Gacha.swift)
    gacha: {
      candidates: [],
      tints: {},
      phase: "idle", // "idle" | "rolling" | "landed"
      result: null,
      reel: 0,
      speed: 0,
      kick: 0,
      pop: 1,
      burst: 0
    },

    // Search State
    searchMode: "browse", // "browse" | "typing" | "results"
    searchQuery: "",
    searchSubmitted: "",
    searchSuggest: null,
    searchFilter: null,
    searchSummary: null,
    searchPage: null,
    searchLoading: false,
    moods: null,
    moodsLoading: false,

    // Library & Settings
    library: {
      likedIds: [],
      likedSongs: [],
      recentSongs: [],
      playlists: [],
      devicePlaylists: [],
      onRepeat: null,
      forgottenFavorites: [],
      gachaPool: [],
      recap: {
        monthLabel: "",
        plays: 0,
        minutes: 0,
        topSongs: [],
        topArtists: []
      }
    },
    libraryTab: "all", // "all" | "songs" | "playlists" | "albums" | "artists"
    libraryQuery: "",
    libraryExtraSongs: [],
    libraryExtraKey: null,
    providers: [],
    settings: {
      playerBarStyle: "auto",
      highQualityAudio: true,
      audioQuality: "auto",
      normalizeVolume: true,
      hideExplicit: false,
      lyricsBlur: true,
      lyricsGlow: true,
      animatedBackgrounds: true,
      lyricsSize: 1.0,
      lyricsPosition: "left",
      lyricsOpen: false,
      playerVolume: 0.85,
      profileName: "",
      recentSearches: [],
      lyricsProviderOrder: [],
      lyricsProvidersDisabled: [],
      sharedFolders: [],
      shareLocalFiles: true,
      deviceName: "",
      heroAutoTurn: true,
      prefs: {}
    },
    deviceName: "",
    currentStreamMeta: null,

    // Player & Queue
    currentSong: null,
    queue: [],
    unshuffledQueue: [],
    currentIndex: 0,
    isPlaying: false,
    isLoadingStream: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    isMuted: false,
    shuffleEnabled: false,
    repeatMode: "off", // "off" | "all" | "one"
    lyricsBrowseId: null,

    // Lyrics & Palette
    currentLyrics: null,
    lyricsCandidates: [],
    lyricsLoading: false,
    palette: [
      [0.16, 0.14, 0.28],
      [0.28, 0.12, 0.24],
      [0.09, 0.18, 0.30],
      [0.12, 0.10, 0.20]
    ]
  };

  // --------------------------------------------------------------------------
  // Helpers & Math
  // --------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smoothstep(from, to, x) {
    const t = clamp01((x - from) / Math.max(0.0001, to - from));
    return t * t * (3 - 2 * t);
  }

  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const err = ((ax * t + bx) * t + cx) * t - x;
        const slope = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(err) < 1e-6 || Math.abs(slope) < 1e-6) break;
        t -= err / slope;
      }
      t = clamp01(t);
      return ((ay * t + by) * t + cy) * t;
    };
  }

  const GACHA_EASE = cubicBezier(0.15, 0.45, 0.2, 1);

  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function songThumb(obj) {
    if (!obj) return "";
    return obj.thumbnail || obj.thumbnailURL || "";
  }

  function sizedCover(url, size = 1200) {
    if (!url) return "";
    if (url.includes("googleusercontent.com") || url.includes("ggpht.com")) {
      const idx = url.lastIndexOf("=");
      if (idx > 0) return `${url.slice(0, idx)}=w${size}-h${size}-l90-rj`;
    }
    return url;
  }

  function proxyImg(url) {
    if (!url) return "";
    if (!state.proxyPort) return url;
    if (url.startsWith("local-art:")) {
      return `http://127.0.0.1:${state.proxyPort}/art/${encodeURIComponent(url.slice("local-art:".length))}`;
    }
    if (url.startsWith("link-art:")) {
      const rest = url.slice("link-art:".length);
      const cut = rest.indexOf(":");
      const dev = cut >= 0 ? rest.slice(0, cut) : rest;
      const file = cut >= 0 ? rest.slice(cut + 1) : "";
      return `http://127.0.0.1:${state.proxyPort}/link-art/${encodeURIComponent(dev)}/${encodeURIComponent(file)}`;
    }
    return `http://127.0.0.1:${state.proxyPort}/image?url=${encodeURIComponent(url)}`;
  }

  function streamUrl(song) {
    if (!song) return "";
    if (song.source === "local") {
      return `http://127.0.0.1:${state.proxyPort}/local/${encodeURIComponent(song.id)}`;
    }
    // a song file that lives on a paired phone, streamed from it over the wi-fi
    if (song.source?.startsWith("link:")) {
      return `http://127.0.0.1:${state.proxyPort}/link/${encodeURIComponent(song.source.slice(5))}/${encodeURIComponent(song.id)}`;
    }
    return `http://127.0.0.1:${state.proxyPort}/stream/${encodeURIComponent(song.id)}?t=${Date.now()}`;
  }

  function formatTime(secs) {
    if (!secs || !isFinite(secs) || secs < 0) return "0:00";
    const total = Math.floor(secs);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function artistNames(song) {
    if (!song || !song.artists || !song.artists.length) return "Unknown Artist";
    return song.artists.map((a) => a.name).join(", ");
  }

  function isLiked(songId) {
    return (state.library.likedIds || []).includes(songId);
  }

  function showError(msg) {
    const toast = $("error-toast");
    const text = $("error-toast-text");
    if (toast && text) {
      text.textContent = String(msg);
      toast.classList.remove("hidden");
      clearTimeout(showError._timer);
      showError._timer = setTimeout(() => toast.classList.add("hidden"), 4500);
    }
  }

  function playingBarsHtml(animate) {
    return `<span class="playing-bars ${animate ? "animating" : ""}"><span></span><span></span><span></span></span>`;
  }

  function isSidebarMinimized() {
    return state.userSidebarCollapsed || state.autoSidebarCollapsed;
  }

  // --------------------------------------------------------------------------
  // Audio Engine (Web Audio EQ + Gacha Sounds)
  // --------------------------------------------------------------------------
  const audio = window.MochyAudioFX.createAudioEngine();
  let audioCtx = null;

  function ensureAudioContext() {
    audioCtx = audio.ensureContext();
    return audioCtx;
  }

  function applyLoudnessGain(loudnessDb) {
    audio.setLoudnessDb(loudnessDb);
  }

  function playGachaTick() {
    try {
      ensureAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(860 + Math.random() * 140, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.024);
      g.gain.setValueAtTime(0.065, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.028);
    } catch (_) {}
  }

  function playGachaWin() {
    try {
      ensureAudioContext();
      if (!audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const start = audioCtx.currentTime + i * 0.055;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.11, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch (_) {}
  }

  audio.addEventListener("timeupdate", (detail) => {
    state.currentTime = detail?.currentTime ?? audio.currentTime ?? 0;
    const dur = detail?.duration ?? audio.duration;
    if (dur && isFinite(dur)) {
      state.duration = dur;
    }
    updateSeekBarsOnly();
  });

  audio.addEventListener("play", () => {
    state.isPlaying = true;
    renderPlayerStateChange();
  });

  audio.addEventListener("pause", () => {
    state.isPlaying = false;
    renderPlayerStateChange();
  });

  audio.onAutoAdvance(() => {
    if (state.repeatMode === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      playNext();
    }
  });

  audio.addEventListener("error", () => {
    if (state.currentSong) {
      showError(`Stream error for "${state.currentSong.title}"`);
      const pb = state.settings.prefs?.playback;
      if (pb && !pb.dontSkipOnFailure && state.queue.length > 1) {
        const timeoutMs = (pb.skipTimeoutSec || 6) * 1000;
        clearTimeout(audio._failSkipTimer);
        audio._failSkipTimer = setTimeout(() => {
          if (audio.paused) playNext();
        }, timeoutMs);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Cover Palette & Gacha Tint Extraction (Rust `cover_palette` + Canvas fallback)
  // --------------------------------------------------------------------------
  const DEFAULT_GACHA_TINT = {
    light: [222, 160, 172],
    deep: [124, 130, 180]
  };
  const paletteMemory = new Map();

  function shiftTintFromPalette(stops) {
    if (!stops || !stops.length) return DEFAULT_GACHA_TINT;
    const sorted = [...stops].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    const scale = (c, peak) => {
      const top = Math.max(c[0], c[1], c[2], 0.05);
      const k = peak / top;
      return c.map((v) => Math.round(Math.min(255, Math.max(0, (v * k + (peak - v * k) * 0.18) * 255))));
    };
    return {
      light: scale(sorted[sorted.length - 1], 0.94),
      deep: scale(sorted[0], 0.52)
    };
  }

  async function fetchCoverPalette(url) {
    if (!url) return null;
    if (paletteMemory.has(url)) return paletteMemory.get(url);
    try {
      const res = await invoke("cover_palette", { url });
      if (res && res.stops) {
        paletteMemory.set(url, res);
        return res;
      }
    } catch (_) {}
    return null;
  }

  // --------------------------------------------------------------------------
  // Ambient Backdrop (uses MochyAmbient in ambient.js if loaded)
  // --------------------------------------------------------------------------
  let ambientInst = null;

  function initAmbient(canvas) {
    if (!canvas) return;
    ambientInst?.dispose();
    if (window.MochyAmbient) {
      ambientInst = new window.MochyAmbient(canvas);
      ambientInst.animated = state.settings.animatedBackgrounds !== false;
      ambientInst.setPalette(state.palette);
      ambientInst.render(performance.now(), true);
    }
  }

  // --------------------------------------------------------------------------
  // Playback, Shuffle & Queue Management
  // --------------------------------------------------------------------------
  async function playSong(song, queueSongs = null, startIndex = 0, { here = false } = {}) {
    if (!song || !song.id) return;
    const picked = queueSongs?.length ? queueSongs : [song];
    if (!here && window.MochyRemote?.playOnRemote(picked, queueSongs?.length ? startIndex : 0)) return;
    ensureAudioContext();
    if (queueSongs && state.settings.prefs?.playback?.keepShuffleOn === false) {
      state.shuffleEnabled = false;
    }

    if (queueSongs && queueSongs.length) {
      state.unshuffledQueue = queueSongs.slice();
      if (state.shuffleEnabled && queueSongs.length > 1) {
        const picked = queueSongs[Math.max(0, Math.min(startIndex, queueSongs.length - 1))];
        const rest = queueSongs.filter((s, idx) => idx !== startIndex);
        shuffleInPlace(rest);
        state.queue = [picked, ...rest];
        state.currentIndex = 0;
      } else {
        state.queue = queueSongs.slice();
        state.currentIndex = Math.max(0, Math.min(startIndex, state.queue.length - 1));
      }
    } else {
      const existingIdx = state.queue.findIndex((s) => s.id === song.id);
      if (existingIdx >= 0) {
        state.currentIndex = existingIdx;
      } else {
        state.queue = [song];
        state.unshuffledQueue = [song];
        state.currentIndex = 0;
      }
    }

    await loadAndPlayCurrent(true);

    if ((!queueSongs || queueSongs.length <= 1) && !song.source) {
      invoke("yt_next", {
        endpoint: {
          videoId: song.id,
          playlistId: `RDAMVM${song.id}`,
          params: "wAEB",
          index: null
        },
        continuation: null
      })
        .then((res) => {
          if (res && res.items && res.items.length > 1 && state.currentSong?.id === song.id) {
            state.unshuffledQueue = res.items.slice();
            if (state.shuffleEnabled) {
              const rest = res.items.filter((s) => s.id !== song.id);
              shuffleInPlace(rest);
              state.queue = [song, ...rest];
              state.currentIndex = 0;
            } else {
              state.queue = res.items;
              state.currentIndex = Math.max(0, res.currentIndex || 0);
            }
            state.lyricsBrowseId = res.lyricsBrowseId || null;
            saveSessionQuiet();
            if (state.rightPaneOpen && state.rightPaneTab === "queue") {
              renderRightPane();
            }
          }
        })
        .catch(() => {});
    }
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function applyShuffleState(enabled, forceReshuffle = false) {
    state.shuffleEnabled = enabled;
    if (!state.queue.length) return;
    const cur = state.queue[state.currentIndex];
    if (enabled) {
      if (!state.unshuffledQueue.length) state.unshuffledQueue = state.queue.slice();
      const rest = state.queue.filter((_, idx) => idx !== state.currentIndex);
      if (forceReshuffle || rest.length > 1) shuffleInPlace(rest);
      state.queue = cur ? [cur, ...rest] : rest;
      state.currentIndex = 0;
    } else if (state.unshuffledQueue.length) {
      state.queue = state.unshuffledQueue.slice();
      const found = cur ? state.queue.findIndex((s) => s.id === cur.id) : 0;
      state.currentIndex = Math.max(0, found);
    }
  }

  async function resolveSongStream(song) {
    if (song.source === "local") {
      return {
        url: streamUrl(song),
        codec: "Local Audio",
        formatLabel: "Local Hi-Res",
        loudnessDb: null,
        approxDuration: song.duration || null
      };
    }
    if (song.source?.startsWith("link:")) {
      return {
        url: streamUrl(song),
        codec: "From your device",
        formatLabel: "From your device",
        loudnessDb: null,
        approxDuration: song.duration || null
      };
    }
    const q = state.settings.prefs?.behaviour?.dataSaver
      ? "low"
      : state.settings.audioQuality || "auto";
    const resolved = await invoke("yt_stream", {
      videoId: song.id,
      preferHighQuality: state.settings.highQualityAudio ?? true,
      quality: q,
      forceRefresh: false
    });
    return {
      ...resolved,
      url: resolved.proxyUrl || streamUrl(song)
    };
  }

  async function loadAndPlayCurrent(autoPlay = true) {
    const song = state.queue[state.currentIndex];
    if (!song) return;
    clearTimeout(audio._failSkipTimer);

    state.currentSong = song;
    state.currentTime = 0;
    state.duration = song.duration || 0;
    state.isLoadingStream = true;
    audio.prepareLoad();
    renderAllPlayerSurfaces();
    syncHeroCards();

    const thumb = songThumb(song);
    if (thumb) {
      fetchCoverPalette(thumb).then((pal) => {
        if (pal?.stops && state.currentSong?.id === song.id) {
          state.palette = pal.stops;
          if (ambientInst) ambientInst.setPalette(pal.stops);
        }
      });
    }

    loadLyricsForSong(song);

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: artistNames(song),
          album: song.album?.name || "",
          artwork: thumb ? [{ src: sizedCover(thumb, 512) }] : []
        });
      } catch (_) {}
    }

    try {
      const resolved = await resolveSongStream(song);
      if (state.currentSong?.id !== song.id) return;
      if (resolved.approxDuration && !state.duration) {
        state.duration = resolved.approxDuration;
      }
      state.currentStreamMeta = resolved;

      audio.setVolume(state.volume, state.isMuted);
      await audio.loadUrl(resolved.url, {
        autoPlay,
        loudnessDb: resolved.loudnessDb ?? null
      });
      state.isLoadingStream = false;

      if (!autoPlay) {
        renderAllPlayerSurfaces();
      }

      if (state.settings.prefs?.experimental?.showStreamSourceToast && resolved.formatLabel) {
        showError(`Playing ${song.title} · ${resolved.formatLabel}`);
      }

      invoke("lib_record_play", { song })
        .then((snap) => {
          state.library = snap;
          if (state.tab === "library" && !state.routeStack.length) renderLibraryTab();
          syncHeroCards();
        })
        .catch(() => {});
      saveSessionQuiet();
    } catch (err) {
      state.isLoadingStream = false;
      showError(`Could not play "${song.title}": ${err}`);
      renderAllPlayerSurfaces();
    }
  }

  function togglePlayPause() {
    if (!state.currentSong) {
      if (state.queue.length) {
        loadAndPlayCurrent(true);
      } else {
        const fallback = state.library.recentSongs?.[0] || extractHeroPool()[0];
        if (fallback) playSong(fallback);
      }
      return;
    }
    ensureAudioContext();
    if (audio.paused) {
      if (!audio.src) {
        loadAndPlayCurrent(true);
      } else {
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
    }
  }

  function playNext() {
    if (!state.queue.length) return;
    if (state.currentIndex + 1 < state.queue.length) {
      state.currentIndex++;
      loadAndPlayCurrent(true);
    } else if (state.repeatMode === "all") {
      state.currentIndex = 0;
      loadAndPlayCurrent(true);
    }
  }

  function playPrevious() {
    if (!state.queue.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (state.currentIndex > 0) {
      state.currentIndex--;
      loadAndPlayCurrent(true);
    } else if (state.repeatMode === "all") {
      state.currentIndex = state.queue.length - 1;
      loadAndPlayCurrent(true);
    } else {
      audio.currentTime = 0;
    }
  }

  function seekToFraction(frac) {
    const dur = state.duration || audio.duration || 0;
    if (!dur) return;
    const target = Math.max(0, Math.min(dur, frac * dur));
    audio.currentTime = target;
    state.currentTime = target;
    updateSeekBarsOnly();
    window.MochyRemote?.reportPlayer();
  }

  function setVolume(vol) {
    state.volume = Math.max(0, Math.min(1, vol));
    state.isMuted = state.volume === 0;
    audio.setVolume(state.volume, state.isMuted);
    state.settings.playerVolume = state.volume;
    if (state.settings.prefs?.playback?.pauseWhenMuted) {
      if (state.volume === 0 && !audio.paused) audio.pause();
      else if (state.volume > 0 && audio.paused && audio.src) audio.play().catch(() => {});
    }
    renderAllPlayerSurfaces();
    invoke("settings_update", { settings: state.settings }).catch(() => {});
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    audio.setVolume(state.volume, state.isMuted);
    if (state.settings.prefs?.playback?.pauseWhenMuted) {
      if (state.isMuted && !audio.paused) audio.pause();
      else if (!state.isMuted && audio.paused && audio.src) audio.play().catch(() => {});
    }
    renderAllPlayerSurfaces();
  }

  function saveSessionQuiet() {
    if (!state.currentSong || state.settings.prefs?.playback?.saveLastState === false) return;
    invoke("lib_save_session", {
      session: {
        queue: state.queue.slice(0, 100),
        index: state.currentIndex,
        position: state.currentTime || 0,
        title: state.currentSong.title
      }
    }).catch(() => {});
  }

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // Lyrics Loading & 60fps Synced Frame Loop
  // --------------------------------------------------------------------------
  async function loadLyricsForSong(song) {
    if (!song) return;
    state.lyricsLoading = true;
    state.currentLyrics = null;
    state.lyricsCandidates = [];
    if (state.rightPaneOpen && state.rightPaneTab === "lyrics") renderRightPane();
    if (state.showFullPlayer) renderFullPlayer();

    try {
      const outcome = await invoke("lyrics_get", {
        song,
        duration: song.duration || null,
        lyricsBrowseId: state.lyricsBrowseId || null
      });
      if (state.currentSong?.id === song.id) {
        state.currentLyrics = outcome?.best || null;
        state.lyricsCandidates = outcome?.candidates || [];
        state.lyricsLoading = false;
        if (state.rightPaneOpen && state.rightPaneTab === "lyrics") renderRightPane();
        if (state.showFullPlayer) renderFullPlayer();
      }
    } catch (_) {
      if (state.currentSong?.id === song.id) {
        state.lyricsLoading = false;
        if (state.rightPaneOpen && state.rightPaneTab === "lyrics") renderRightPane();
        if (state.showFullPlayer) renderFullPlayer();
      }
    }
  }

  // the gacha field drifts slowly at rest, so a few frames a second look the same and leave the scroll alone
  const GACHA_IDLE_FRAME_MS = 1000 / 15;
  let gachaFieldDrawnAt = 0;

  function tickFrame(ts) {
    if (state.showFullPlayer && ambientInst && !fpMotionLive) {
      ambientInst.render(ts, false);
    }

    const lyricsVisible =
      (state.rightPaneOpen && state.rightPaneTab === "lyrics") ||
      (state.showFullPlayer && state.fullPlayerMode === "lyrics");

    if (lyricsVisible && state.currentLyrics?.lines?.length) {
      updateSyncedLyricsDOM(audio.currentTime || state.currentTime || 0);
    }

    if (
      state.tab === "home" &&
      !state.routeStack.length &&
      !state.showFullPlayer &&
      !heroSwitching &&
      state.heroScrollProgress < 0.85 &&
      (state.gacha.phase === "rolling" || state.gacha.burst > 0 || ts - gachaFieldDrawnAt >= GACHA_IDLE_FRAME_MS)
    ) {
      gachaFieldDrawnAt = ts;
      drawVisibleGachaFields(ts * 0.001);
    }

    requestAnimationFrame(tickFrame);
  }

  // one word of the sung line: the sweep, the rise and the bloom, written only when its look changed
  function paintLyricWord(wEl, w, time) {
    const dur = Math.max(0.05, w.end - w.start);
    const prog = (time - w.start) / dur;
    let cls = "lyric-word";
    let sweepStart = "";
    let sweepEnd = "";
    let rise = "0px";
    if (prog <= 0) {
      cls = "lyric-word unsung";
    } else if (prog >= 1) {
      cls = "lyric-word sung";
      rise = "-1.5px";
    } else {
      sweepStart = `${Math.max(0, prog * 100 - 10).toFixed(1)}%`;
      sweepEnd = `${Math.min(100, prog * 100 + 10).toFixed(1)}%`;
      rise = `${(-2.2 * Math.sin(prog * Math.PI)).toFixed(2)}px`;
      const isHeldNote = state.settings.lyricsGlow && dur >= 0.65 && (w.text || "").trim().length >= 2;
      if (isHeldNote) cls = "lyric-word bloom";
    }
    const key = cls + sweepStart + sweepEnd + rise;
    if (wEl._look === key) return;
    wEl._look = key;
    wEl.className = cls;
    wEl.style.setProperty("--rise", rise);
    if (sweepStart) {
      wEl.style.setProperty("--sweep-start", sweepStart);
      wEl.style.setProperty("--sweep-end", sweepEnd);
    } else {
      wEl.style.removeProperty("--sweep-start");
      wEl.style.removeProperty("--sweep-end");
    }
  }

  // a line that isn't being sung: dimmer and softer the further it is, its words all sung or all waiting
  function paintIdleLyricLine(el, line, dist, sung) {
    const blurPx = state.settings.lyricsBlur ? Math.min(dist * 1.1, 4.5) : 0;
    el.style.filter = `blur(${blurPx.toFixed(1)}px)`;
    el.style.opacity = Math.max(0.22, 0.72 - dist * 0.12).toFixed(2);
    if (!line.words?.length) return;
    const cls = sung ? "lyric-word sung" : "lyric-word unsung";
    el.querySelectorAll(".lyric-word").forEach((wEl) => {
      wEl._look = null;
      wEl.className = cls;
      wEl.style.removeProperty("--sweep-start");
      wEl.style.removeProperty("--sweep-end");
      wEl.style.removeProperty("--rise");
    });
  }

  // the lyric views write styles only when something changed: every line when the sung line moves, just its words each frame
  function updateSyncedLyricsDOM(time) {
    const lines = state.currentLyrics.lines;
    if (!state.currentLyrics.isSynced) return;

    let activeIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (time >= lines[i].time) activeIdx = i;
      else break;
    }

    document.querySelectorAll(".synced-lyrics-scroll").forEach((container) => {
      // a different song, or the blur and glow switches, mean every line is painted again
      const look = `${!!state.settings.lyricsBlur}${!!state.settings.lyricsGlow}`;
      if (container._lyrLines !== lines || container._lyrLook !== look) {
        container._lyrLines = lines;
        container._lyrLook = look;
        container._lyrEls = container.querySelectorAll(".lyric-line");
        container._lyrActive = -2;
      }
      const lineEls = container._lyrEls;
      const moved = container._lyrActive !== activeIdx;

      if (moved) {
        lineEls.forEach((el, idx) => {
          const line = lines[idx];
          if (!line) return;
          const isCurrent = idx === activeIdx;
          el.classList.toggle("active", isCurrent);
          if (isCurrent) {
            el.style.filter = "blur(0px)";
            el.style.opacity = "1";
          } else {
            paintIdleLyricLine(el, line, Math.abs(idx - activeIdx), idx < activeIdx);
          }
        });
      }

      const activeEl = lineEls[activeIdx];
      const words = lines[activeIdx]?.words;
      if (activeEl && words?.length) {
        const wordEls = activeEl.querySelectorAll(".lyric-word");
        for (let i = 0; i < wordEls.length; i++) {
          if (words[i]) paintLyricWord(wordEls[i], words[i], time);
        }
      }

      if (moved && activeIdx >= 0 && activeEl) {
        const targetTop = activeEl.offsetTop - container.clientHeight * 0.32;
        container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
      container._lyrActive = activeIdx;
    });
  }

  // --------------------------------------------------------------------------
  // Responsive Shell Layout & Sidebar Toggle
  // --------------------------------------------------------------------------
  function syncShellLayout() {
    const w = window.innerWidth;
    const app = $("app");
    if (!app) return;

    state.autoSidebarCollapsed = w < 560;

    const minimized = isSidebarMinimized();
    app.classList.toggle("sidebar-minimized", minimized);
    app.classList.toggle("right-pane-open", state.rightPaneOpen);
    const toggle = $("sidebar-toggle-btn");
    if (toggle) {
      toggle.innerHTML = minimized ? ICONS.sidebarExpand : ICONS.sidebar;
      toggle.title = minimized ? "Show sidebar (⌘⌥B)" : "Hide sidebar (⌘⌥B)";
    }
    if (!state.rightPaneOpen) $("right-pane")._shownTab = null;

    updateVisiblePage();
  }

  // what lines up on the content column, so what the rail pushes over when it opens
  const CONTENT_COLUMN =
    ".hero-text, .shelf-head, .shelf-row, .shelf-grid, .search-page-wrap, .library-page-wrap, .detail-header > :not(.detail-header-backdrop), .detail-body";

  // opening the rail pushes the content column over to make room and closing it lets it back; css slides the rail itself
  function toggleSidebar(force) {
    const collapse = typeof force === "boolean" ? force : !isSidebarMinimized();
    const columnFrom = contentColumnX();
    const backFrom = $("back-button").getBoundingClientRect().left;
    state.userSidebarCollapsed = collapse;
    if (!collapse) state.autoSidebarCollapsed = false;
    try {
      localStorage.setItem("mochy.sidebarCollapsed", collapse ? "1" : "0");
    } catch (_) {}
    syncShellLayout();
    glideContentColumn(columnFrom - contentColumnX(), backFrom);
  }

  function contentColumnX() {
    return parseFloat(getComputedStyle($("app")).getPropertyValue("--content-x")) || 0;
  }

  // the column has already snapped to its new spot; what's on screen glides over from the old one, so nothing lays out per frame
  function glideContentColumn(dx, backFrom) {
    if (Math.abs(dx) < 0.5 || reducedMotion()) return;
    const route = $("route-container");
    const page = route.classList.contains("hidden") ? document.querySelector(".tab-page.active") : route;
    const h = window.innerHeight;
    // a piece inside another piece already rides along with it
    const pieces = [...(page?.querySelectorAll(CONTENT_COLUMN) || [])].filter((el) => !el.parentElement.closest(CONTENT_COLUMN));
    const onScreen = pieces.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < h;
    });
    const back = $("back-button");
    const backDx = back.classList.contains("hidden") ? 0 : backFrom - back.getBoundingClientRect().left;
    onScreen.forEach((el) => glide(el, dx));
    glide(back, backDx);
  }

  // where things sit before the right pane moves: the centred pill, the hero's dots and the hero picture
  function shellAnchors() {
    const heroShown = !state.routeStack.length && state.tab === "home" && !heroSwitching;
    return {
      pill: $("top-overlay").querySelector(".top-player-pill")?.getBoundingClientRect() || null,
      dots: heroShown ? $("hero-dots")?.getBoundingClientRect() || null : null,
      media: heroShown ? $("hero-stage")?.querySelector(".hero-media-wrap")?.getBoundingClientRect() || null : null
    };
  }

  // the page has already snapped to its new width; the centred bits glide there from where they were, so nothing lays out per frame
  function glideShellFrom(before) {
    if (reducedMotion()) return;
    const after = shellAnchors();
    if (before.pill && after.pill) glide($("top-overlay"), centre(before.pill) - centre(after.pill));
    if (before.dots && after.dots) glide($("hero-dots"), before.dots.left - after.dots.left);
    // the hero picture is cropped to fit, so it also starts at its old size and settles into the new one
    if (before.media && after.media && after.media.width > 0) {
      const media = $("hero-stage").querySelector(".hero-media-wrap");
      glide(media, centre(before.media) - centre(after.media), before.media.width / after.media.width);
    }
  }

  function centre(rect) {
    return rect.left + rect.width / 2;
  }

  function glide(el, dx, scale = 1) {
    if (!el || (Math.abs(dx) < 0.5 && Math.abs(scale - 1) < 0.002)) return;
    el.animate(
      [{ transform: `translate3d(${dx.toFixed(1)}px, 0, 0) scale(${scale.toFixed(4)})` }, { transform: "translate3d(0, 0, 0) scale(1)" }],
      { duration: 520, easing: IOS_EASE }
    );
  }

  function closeRightPane() {
    const before = shellAnchors();
    state.rightPaneOpen = false;
    syncShellLayout();
    renderTopBar();
    glideShellFrom(before);
  }

  // --------------------------------------------------------------------------
  // Navigation & Page Transitions (Slide + Fade)
  // --------------------------------------------------------------------------
  function animateIn(el, kind) {
    if (!el) return;
    el.classList.remove("enter-push", "enter-pop", "enter-tab");
    void el.offsetWidth;
    el.classList.add(`enter-${kind}`);
    clearTimeout(el._enterTimer);
    el._enterTimer = setTimeout(() => el.classList.remove(`enter-${kind}`), 600);
  }

  function switchTab(tab) {
    const changed = state.tab !== tab || state.routeStack.length > 0;
    state.tab = tab;
    state.routeStack = [];
    updateVisiblePage();
    renderSidebar();
    if (tab === "search") {
      renderSearchTab();
    } else if (tab === "library") {
      renderLibraryTab();
    } else if (tab === "home") {
      scheduleHeroAutoAdvance();
    }
    if (changed) animateIn($(`tab-${tab}`), "tab");
  }

  function pushRoute(route) {
    state.routeStack.push(route);
    updateVisiblePage();
    renderRouteView(route);
    renderSidebar();
    const rc = $("route-container");
    rc.scrollTop = 0;
    animateIn(rc, "push");
  }

  function popRoute() {
    if (!state.routeStack.length) return;
    const rc = $("route-container");
    const ghost = rc.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    ghost.classList.add("route-leaving");
    rc.parentNode.insertBefore(ghost, rc.nextSibling);
    setTimeout(() => ghost.remove(), 400);

    state.routeStack.pop();
    updateVisiblePage();
    if (state.routeStack.length) {
      renderRouteView(state.routeStack[state.routeStack.length - 1]);
      animateIn(rc, "pop");
    } else {
      animateIn($(`tab-${state.tab}`), "pop");
    }
    renderSidebar();
  }

  function updateVisiblePage() {
    const hasRoute = state.routeStack.length > 0;
    $("app")?.classList.toggle("has-route", hasRoute);
    $("tab-home").classList.toggle("active", !hasRoute && state.tab === "home");
    $("tab-library").classList.toggle("active", !hasRoute && state.tab === "library");
    $("tab-search").classList.toggle("active", !hasRoute && state.tab === "search");
    $("route-container").classList.toggle("hidden", !hasRoute);

    $("back-button").classList.toggle("hidden", !hasRoute);
  }

  // --------------------------------------------------------------------------
  // Sidebar (Home/Library/Search -> Divider -> User Playlists -> Divider -> Profile), under the corner's logo and toggle
  // --------------------------------------------------------------------------
  function renderSidebar() {
    const sidebar = $("sidebar");
    if (!sidebar) return;

    const activeRoute = state.routeStack[state.routeStack.length - 1];
    const isHome = !activeRoute && state.tab === "home";
    const isLibrary = !activeRoute && state.tab === "library";
    const isSearch = !activeRoute && state.tab === "search";
    const isLikedRoute = activeRoute?.type === "liked";

    const sortedPlaylists = [...(state.library.playlists || [])].sort((a, b) => {
      if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
      return 0;
    });

    sidebar.innerHTML = `
      <div class="sidebar-inner">
        <nav class="sidebar-nav">
          <button class="sidebar-row ${isHome ? "selected" : ""}" data-nav="home" title="Home (⌘1)">
            <span class="sidebar-icon">${isHome ? ICONS.homeFilled : ICONS.home}</span>
          </button>
          <button class="sidebar-row ${isLibrary ? "selected" : ""}" data-nav="library" title="Library (⌘3)">
            <span class="sidebar-icon">${isLibrary ? ICONS.libraryFilled : ICONS.library}</span>
          </button>
          <button class="sidebar-row ${isSearch ? "selected" : ""}" data-nav="search" title="Search (⌘F)">
            <span class="sidebar-icon">${isSearch ? ICONS.searchFilled : ICONS.search}</span>
          </button>
        </nav>

        <div class="sidebar-divider"></div>

        <div class="sidebar-scroll">
          <button class="sidebar-pl-btn liked ${isLikedRoute ? "selected" : ""}" data-route="liked" title="Liked Songs (${(state.library.likedSongs || []).length})">
            ${ICONS.heartFilled}
          </button>
          ${sortedPlaylists
            .map((pl) => {
              const isSelected = activeRoute?.type === "localPlaylist" && activeRoute?.id === pl.id;
              const thumb = pl.covers?.[0];
              return `
                <button class="sidebar-pl-btn ${isSelected ? "selected" : ""}" data-local-playlist="${esc(pl.id)}" title="${esc(pl.name)}">
                  ${thumb ? `<img src="${esc(proxyImg(thumb))}" alt="" />` : ICONS.music}
                </button>
              `;
            })
            .join("")}
          <button class="sidebar-new-rail-btn" id="sidebar-new-rail-btn" title="New Playlist (⌘N)">${ICONS.plus}</button>
        </div>

        <div class="sidebar-divider"></div>

        <div class="sidebar-footer">
          <button class="sidebar-row" id="sidebar-profile-btn" title="Settings">
            <span class="sidebar-profile-avatar">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="12" cy="8.5" r="3.6"/><path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>
            </span>
          </button>
        </div>
      </div>
    `;

    sidebar.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.onclick = () => switchTab(btn.dataset.nav);
    });
    sidebar.querySelectorAll("[data-route]").forEach((btn) => {
      btn.onclick = () => pushRoute({ type: btn.dataset.route });
    });
    sidebar.querySelectorAll("[data-local-playlist]").forEach((btn) => {
      const pid = btn.dataset.localPlaylist;
      btn.onclick = () => pushRoute({ type: "localPlaylist", id: pid });
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        const pl = (state.library.playlists || []).find((p) => p.id === pid);
        if (pl) openLocalPlaylistContextMenu(e.clientX, e.clientY, pl);
      };
    });

    const newPlBtn = $("sidebar-new-playlist-btn");
    if (newPlBtn) newPlBtn.onclick = () => promptNewPlaylist();
    const newRailBtn = $("sidebar-new-rail-btn");
    if (newRailBtn) newRailBtn.onclick = () => promptNewPlaylist();

    $("sidebar-profile-btn").onclick = (e) => openProfileMenu(e.currentTarget.getBoundingClientRect());
  }

  // the three transport buttons move the same everywhere, and their glyphs outlive a re-render of the bar
  function mountTransport(key, prevBtn, playBtn, nextBtn) {
    const T = window.MochyTransport;
    if (T) {
      prevBtn.replaceChildren(T.skipGlyph(`${key}-prev`, true));
      playBtn.replaceChildren(T.playGlyph(`${key}-play`, state.isPlaying, ICONS.play, ICONS.pause));
      nextBtn.replaceChildren(T.skipGlyph(`${key}-next`, false));
    } else {
      prevBtn.innerHTML = ICONS.prev;
      playBtn.innerHTML = state.isPlaying ? ICONS.pause : ICONS.play;
      nextBtn.innerHTML = ICONS.next;
    }
    prevBtn.onclick = () => {
      T?.skipStep(`${key}-prev`);
      playPrevious();
    };
    playBtn.onclick = () => togglePlayPause();
    nextBtn.onclick = () => {
      T?.skipStep(`${key}-next`);
      playNext();
    };
  }

  // --------------------------------------------------------------------------
  // Top Floating Player Pill (Cover+Title | Prev Play Next | Shuffle Repeat Queue Lyrics)
  // --------------------------------------------------------------------------
  function renderTopBar() {
    const bar = $("top-player-bar");
    if (!bar) return;

    const song = state.currentSong;
    const thumb = songThumb(song);
    const pct = state.duration > 0 ? clamp01(state.currentTime / state.duration) : 0;
    const repeatIcon = state.repeatMode === "one" ? ICONS.repeatOne : ICONS.repeat;

    const rpActive = (tab) => (state.rightPaneOpen && state.rightPaneTab === tab ? "pane-active" : "");

    bar.innerHTML = `
      <div class="top-player-pill glass-pill">
        <button class="top-np-chip" id="top-open-full" title="${song ? "Open Full Player (⇧⌘P)" : "Pick a song to play"}">
          <span class="top-np-art ${state.isLoadingStream ? "buffering" : ""}">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 120)))}" alt="" />` : ICONS.music}
            <span class="top-np-spin"></span>
          </span>
          <span class="top-np-text">
            <span class="top-np-title ${song ? "" : "dim"}">${esc(song?.title || "Nothing playing")}</span>
            <span class="top-np-artist">${esc(song ? artistNames(song) : "Pick a song")}</span>
          </span>
        </button>

        <div class="top-pill-group">
          <button class="top-icon-btn" id="top-prev-btn" title="Backward (⌘←)"></button>
          <button class="top-play-btn" id="top-play-btn" title="${state.isPlaying ? "Pause" : "Play"} (Space)"></button>
          <button class="top-icon-btn" id="top-next-btn" title="Forward (⌘→)"></button>
        </div>

        <div class="top-pill-sep"></div>

        <div class="top-pill-group">
          <button class="top-icon-btn ${state.shuffleEnabled ? "mode-on" : ""}" id="top-randomize-btn" title="Shuffle (⌘⌥S)">
            ${ICONS.shuffle}
          </button>
          <button class="top-icon-btn ${state.repeatMode !== "off" ? "mode-on" : ""}" id="top-repeat-btn" title="Repeat (⌘R)">
            ${repeatIcon}
          </button>
          <button class="top-icon-btn ${rpActive("queue")}" id="top-queue-btn" title="Queue">
            ${ICONS.queue}
          </button>
          <button class="top-icon-btn ${rpActive("lyrics")}" id="top-lyrics-btn" title="Lyrics (⌘L)">
            ${ICONS.lyrics}
          </button>
        </div>

        <div class="pill-edge-progress" id="top-seek-track" title="Seek">
          <div class="pill-edge-progress-rail">
            <div class="pill-edge-progress-fill" id="top-seek-fill" style="transform:scaleX(${pct.toFixed(4)})"></div>
          </div>
        </div>
      </div>
    `;

    $("top-open-full").onclick = () => {
      if (state.currentSong) toggleFullPlayer();
      else togglePlayPause();
    };
    mountTransport("top", $("top-prev-btn"), $("top-play-btn"), $("top-next-btn"));

    // shuffle and repeat just switch the mode; queue and lyrics open their page in the pane
    $("top-randomize-btn").onclick = () => toggleShuffleMode();
    $("top-repeat-btn").onclick = () => cycleRepeatMode();
    $("top-queue-btn").onclick = () => onRightPaneButtonTap("queue");
    $("top-lyrics-btn").onclick = () => onRightPaneButtonTap("lyrics");

    bindSliderDrag($("top-seek-track"), (frac) => seekToFraction(frac));
  }

  function toggleShuffleMode() {
    applyShuffleState(!state.shuffleEnabled, true);
    renderAllPlayerSurfaces();
  }

  function cycleRepeatMode() {
    state.repeatMode = state.repeatMode === "off" ? "all" : state.repeatMode === "all" ? "one" : "off";
    renderAllPlayerSurfaces();
  }

  // the pill's queue and lyrics buttons open their page in the pane, or close it when it's already showing
  function onRightPaneButtonTap(tab) {
    const before = shellAnchors();
    if (state.rightPaneOpen && state.rightPaneTab === tab) {
      state.rightPaneOpen = false;
    } else {
      state.rightPaneTab = tab;
      state.rightPaneOpen = true;
    }
    state.settings.lyricsOpen = state.rightPaneOpen && state.rightPaneTab === "lyrics";
    invoke("settings_update", { settings: state.settings }).catch(() => {});

    syncShellLayout();
    renderTopBar();
    renderRightPane();
    glideShellFrom(before);
    if (state.showFullPlayer) renderFullPlayer();
  }

  // --------------------------------------------------------------------------
  // Unified Right Pane (Queue | Lyrics)
  // --------------------------------------------------------------------------
  function renderRightPane() {
    const pane = $("right-pane");
    if (!pane) return;
    if (!state.rightPaneOpen) return;

    const tab = state.rightPaneTab === "queue" ? "queue" : "lyrics";
    // the body slides in when the pane opens or changes page, not on every refresh like play and pause
    const entering = pane._shownTab !== tab;
    pane._shownTab = tab;

    pane.innerHTML = `
      <div class="right-pane-inner">
        <div class="right-pane-header">
          <div class="right-pane-tabs">
            <button class="rp-tab-btn ${tab === "queue" ? "active" : ""}" data-rp-tab="queue" title="Queue">${ICONS.queue}</button>
            <button class="rp-tab-btn ${tab === "lyrics" ? "active" : ""}" data-rp-tab="lyrics" title="Lyrics">${ICONS.lyrics}</button>
          </div>
          <div class="right-pane-actions">
            ${
              state.currentSong
                ? `<button class="rp-icon-btn" id="rp-expand-player" title="Open Full Player">${ICONS.expand}</button>`
                : ""
            }
            <button class="rp-icon-btn" id="rp-close-btn" title="Close Pane">${ICONS.close}</button>
          </div>
        </div>

        <div class="right-pane-subbar">
          <span class="right-pane-heading">${tab === "queue" ? "Up Next" : "Lyrics"}</span>
          ${tab === "queue" && state.queue.length > 1 ? `<button class="lyrics-source-pill" id="rp-clear-queue-btn">Clear</button>` : ""}
        </div>

        <div class="right-pane-body ${entering ? "entering" : ""}" id="rp-body">
          ${tab === "lyrics" ? buildSyncedLyricsBodyHtml(false) : buildQueueBodyHtml()}
        </div>
      </div>
    `;

    pane.querySelectorAll("[data-rp-tab]").forEach((btn) => {
      btn.onclick = () => {
        state.rightPaneTab = btn.dataset.rpTab;
        renderTopBar();
        renderRightPane();
      };
    });

    $("rp-close-btn").onclick = () => closeRightPane();

    const exp = $("rp-expand-player");
    if (exp) exp.onclick = () => toggleFullPlayer();

    const clrQ = $("rp-clear-queue-btn");
    if (clrQ) {
      clrQ.onclick = () => {
        state.queue = state.currentSong ? [state.currentSong] : [];
        state.unshuffledQueue = state.queue.slice();
        state.currentIndex = 0;
        renderRightPane();
      };
    }

    if (tab === "lyrics") bindLyricsSeekEvents(pane);
    else bindQueueBodyEvents(pane);
  }

  function buildQueueBodyHtml() {
    const song = state.currentSong;
    const upNext = state.queue
      .map((s, idx) => ({ song: s, idx }))
      .filter((it) => it.idx > state.currentIndex);

    return `
      <div class="rp-scroll">
        ${
          song
            ? `
          <div class="rp-card rp-now-card">
            <div class="rp-now-art">${songThumb(song) ? `<img src="${esc(proxyImg(sizedCover(songThumb(song), 120)))}" alt="" />` : ""}</div>
            <div class="rp-now-meta">
              <div class="rp-now-kicker">Now Playing</div>
              <div class="rp-now-title">${esc(song.title)}</div>
              <div class="rp-now-artist">${esc(artistNames(song))}</div>
            </div>
            <button class="top-icon-btn" id="rp-now-like" style="color:${isLiked(song.id) ? "#fff" : "var(--text-secondary)"}" title="Like">
              ${isLiked(song.id) ? ICONS.heartFilled : ICONS.heart}
            </button>
          </div>`
            : `<div style="padding:28px 10px;color:var(--text-tertiary);text-align:center;">Nothing playing yet.</div>`
        }

        <div class="rp-list-label">
          <span>Up Next</span>
          <span>${upNext.length ? `${upNext.length} tracks` : ""}</span>
        </div>
        ${
          upNext.length
            ? upNext
                .map(({ song: s, idx }) => renderSongRowHtml(s, { index: idx, listId: "rpQueue", removable: true }))
                .join("")
            : `<div style="padding:24px 8px;color:var(--text-tertiary);text-align:center;">No upcoming tracks in queue.</div>`
        }
      </div>
    `;
  }

  function bindQueueBodyEvents(pane) {
    const nowLike = $("rp-now-like");
    if (nowLike && state.currentSong) {
      nowLike.onclick = async () => {
        state.library = await invoke("lib_toggle_like", { song: state.currentSong });
        renderSidebar();
        renderAllPlayerSurfaces();
      };
    }

    pane.querySelectorAll("[data-remove-qidx]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.removeQidx);
        if (idx > state.currentIndex && idx < state.queue.length) {
          const removed = state.queue.splice(idx, 1)[0];
          state.unshuffledQueue = state.unshuffledQueue.filter((s) => s.id !== removed?.id);
          renderRightPane();
          window.MochyRemote?.reportPlayer();
        }
      };
    });

    bindItemAndSongCards(pane, { rpQueue: state.queue });
    pane.querySelectorAll(".song-row[data-list-id='rpQueue']").forEach((row) => {
      row.onclick = () => {
        const idx = Number(row.dataset.songIdx);
        if (idx >= 0 && idx < state.queue.length) {
          state.currentIndex = idx;
          loadAndPlayCurrent(true);
        }
      };
    });
  }

  // --------------------------------------------------------------------------
  // Home Hero Deck Builder (1:1 parity with HeroCards.swift / HeroCarousel.kt)
  // --------------------------------------------------------------------------
  function extractHeroPool() {
    const pool = [];
    const seen = new Set();
    const add = (s) => {
      if (s && s.id && songThumb(s) && !seen.has(s.id)) {
        seen.add(s.id);
        pool.push(s);
      }
    };
    (state.library.gachaPool || []).forEach(add);
    (state.library.recentSongs || []).forEach(add);
    (state.library.likedSongs || []).forEach(add);
    (state.discoverPicks || []).forEach((p) => add(p.recommendation));
    state.quickPicks.forEach(add);
    for (const sec of state.homePage?.sections || []) {
      for (const item of sec.items || []) {
        if (item.kind === "song" && item.data) add(item.data);
      }
    }
    return pool;
  }

  function sharedArtistName(pick) {
    const rec = pick.recommendation;
    const seed = pick.seed;
    if (!rec?.artists || !seed?.artists) return null;
    for (const a of rec.artists) {
      for (const sa of seed.artists) {
        if ((a.id && a.id === sa.id) || (a.name && sa.name && a.name.toLowerCase() === sa.name.toLowerCase())) {
          return a.name;
        }
      }
    }
    return null;
  }

  function discoverReasons(picks) {
    const picked = [];
    picks.forEach((pick, index) => {
      const options = [];
      if (index === 0) options.push("youMayAlsoLike");
      if (sharedArtistName(pick)) options.push("moreFrom");
      if (pick.seedLiked) options.push("becauseYouLike");
      options.push("becauseYouPlayed", "inspiredBy", "youMayAlsoLike");
      const chosen =
        options.find((opt) => opt !== picked[picked.length - 1] && picked.filter((x) => x === opt).length < 2) ||
        "youMayAlsoLike";
      picked.push(chosen);
    });
    return picked;
  }

  function sentenceCase(text) {
    if (!text) return "";
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function buildHeroCardForItem(ytItem, label) {
    if (!ytItem) return null;
    const kind = ytItem.kind;
    const data = ytItem.data || ytItem.value;
    if (!data) return null;
    if (kind === "song") {
      return {
        id: `song-${data.id}`,
        kind: "song",
        label,
        title: artistNames(data) ? `${data.title} - ${artistNames(data)}` : data.title,
        thumbnail: songThumb(data),
        mediaId: data.id,
        opensPage: false,
        song: data
      };
    }
    return {
      id: `${kind}-${data.browseId || data.id}`,
      kind,
      label,
      title: data.title,
      thumbnail: songThumb(data),
      mediaId: null,
      opensPage: true,
      route:
        kind === "album"
          ? { type: "album", id: data.browseId || data.id }
          : kind === "artist"
          ? { type: "artist", id: data.id }
          : { type: "playlist", id: data.id }
    };
  }

  function buildHeroCards() {
    const cards = [];
    const shown = new Set();
    const gachaPool = extractHeroPool();
    const recent = state.library.recentSongs || [];
    const lastPlayed = state.currentSong || recent[0] || null;

    if (lastPlayed) {
      shown.add(lastPlayed.id);
      // the first card says hello, with the song to pick back up on the line under it
      cards.push({
        id: `song-${lastPlayed.id}`,
        kind: "nowPlaying",
        greeting: true,
        label: { text: "Continue", subject: lastPlayed.title },
        title: heroGreeting(),
        thumbnail: songThumb(lastPlayed),
        mediaId: lastPlayed.id,
        opensPage: false,
        song: lastPlayed
      });
    }

    if (gachaPool.length >= 4) {
      cards.push({
        id: "gacha",
        kind: "gacha",
        isGacha: true,
        label: { text: "Gacha here!" },
        title: "Random plays",
        thumbnail: null,
        mediaId: null,
        opensPage: false
      });
    }

    // Interleave Discover picks + Home related/onRepeat/forgotten favorites
    const discover = (state.discoverPicks || []).slice(0, 4);
    const reasons = discoverReasons(discover);
    const discoverCards = discover.map((pick, idx) => {
      const s = pick.recommendation;
      const seed = pick.seed;
      const r = reasons[idx];
      let label;
      if (r === "youMayAlsoLike") label = { text: "You may also like" };
      else if (r === "becauseYouLike") label = { text: "Because you like", cover: songThumb(seed), subject: seed.title };
      else if (r === "moreFrom") {
        label = {
          text: "More from",
          cover: songThumb(seed),
          subject: sharedArtistName(pick) || seed.artists?.[0]?.name || seed.title
        };
      } else if (r === "becauseYouPlayed") label = { text: "Because you played", cover: songThumb(seed), subject: seed.title };
      else label = { text: "Inspired by", cover: songThumb(seed), subject: seed.title };

      return {
        id: `song-${s.id}`,
        kind: "song",
        label,
        title: artistNames(s) ? `${s.title} - ${artistNames(s)}` : s.title,
        thumbnail: songThumb(s),
        mediaId: s.id,
        opensPage: false,
        song: s
      };
    });

    const extras = [];
    const sections = state.homePage?.sections || [];
    for (const sec of sections.filter((s) => s.label && s.thumbnail).slice(0, 4)) {
      const pick =
        (sec.items || []).find((i) => i.kind === "song" && songThumb(i.data)) ||
        (sec.items || []).find((i) => songThumb(i.data));
      if (!pick) continue;
      const card = buildHeroCardForItem(pick, {
        text: sentenceCase(sec.label),
        cover: sec.thumbnail,
        subject: sec.title
      });
      if (card) extras.push(card);
    }
    if (state.library.onRepeat) {
      const s = state.library.onRepeat;
      extras.push({
        id: `song-${s.id}`,
        kind: "song",
        label: { text: "On repeat" },
        title: artistNames(s) ? `${s.title} - ${artistNames(s)}` : s.title,
        thumbnail: songThumb(s),
        mediaId: s.id,
        opensPage: false,
        song: s
      });
    }
    if (state.library.forgottenFavorites?.length) {
      const s = state.library.forgottenFavorites[0];
      extras.push({
        id: `song-${s.id}`,
        kind: "song",
        label: { text: "Back in rotation" },
        title: artistNames(s) ? `${s.title} - ${artistNames(s)}` : s.title,
        thumbnail: songThumb(s),
        mediaId: s.id,
        opensPage: false,
        song: s
      });
    }

    const maxLen = Math.max(discoverCards.length, extras.length);
    for (let i = 0; i < maxLen; i++) {
      for (const list of [discoverCards, extras]) {
        const c = list[i];
        if (!c) continue;
        if (c.mediaId) {
          if (shown.has(c.mediaId)) continue;
          shown.add(c.mediaId);
        }
        cards.push(c);
      }
    }

    // User's own playlists
    const playlistsWithCovers = (state.library.playlists || []).filter((p) => p.songIds?.length && p.covers?.[0]);
    for (const pl of playlistsWithCovers.slice(0, 2)) {
      cards.push({
        id: `local-playlist-${pl.id}`,
        kind: "localPlaylist",
        label: { text: "From your playlists" },
        title: pl.name,
        thumbnail: pl.covers[0],
        mediaId: null,
        opensPage: false,
        playlistId: pl.id
      });
    }

    // Fill up to 5 regular cards from recently played
    const regularCount = cards.filter((c) => !c.isGacha).length;
    if (regularCount < 5) {
      for (const s of recent.filter((x) => !shown.has(x.id) && songThumb(x)).slice(0, 5 - regularCount)) {
        shown.add(s.id);
        cards.push({
          id: `song-${s.id}`,
          kind: "song",
          label: { text: "Recently played" },
          title: artistNames(s) ? `${s.title} - ${artistNames(s)}` : s.title,
          thumbnail: songThumb(s),
          mediaId: s.id,
          opensPage: false,
          song: s
        });
      }
    }

    // Fresh install fallback: first feed items
    if (!cards.some((c) => !c.isGacha)) {
      for (const sec of sections) {
        const item = (sec.items || []).find((i) => songThumb(i.data));
        if (!item) continue;
        const card = buildHeroCardForItem(item, { text: sec.title });
        if (card) cards.push(card);
        if (cards.length >= 5) break;
      }
    }

    return cards;
  }

  // --------------------------------------------------------------------------
  // Hero Carousel Transition Engine (Feathered Wipe + Soft Cover + Zoom + Parallax Drift)
  // --------------------------------------------------------------------------
  const HERO_SLIDE_MS = 1150;
  const HERO_SLIDE_EASING = "cubic-bezier(0.32, 0, 0.15, 1)";
  const HERO_FEATHER = 0.55;
  const SOFT_COVER_PX = 40;
  const SOFT_COVER_TAPS = [[0, 0], [1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]];
  const SOFT_COVER_CACHE_MAX = 40;
  const HERO_READY_WAIT_MS = 450;
  const softCovers = new Map();
  let heroAutoTimer = null;
  let heroSwitching = false;
  let heroSlide = null;
  let heroSlideTicket = 0;

  function syncHeroCards() {
    const nextCards = buildHeroCards();
    const stage = $("hero-stage");
    const prevIds = state.heroCards.map((c) => c.id).join("|");
    const nextIds = nextCards.map((c) => c.id).join("|");

    state.heroCards = nextCards;

    if (state.heroShownId) {
      const idx = nextCards.findIndex((c) => c.id === state.heroShownId);
      state.heroIndex = idx >= 0 ? idx : Math.min(state.heroIndex, Math.max(0, nextCards.length - 1));
    } else {
      state.heroIndex = Math.min(state.heroIndex, Math.max(0, nextCards.length - 1));
    }
    state.heroShownId = nextCards[state.heroIndex]?.id || null;

    if (!stage) return;
    if (heroSwitching) return;

    if (prevIds !== nextIds || !stage.children.length) {
      renderSettledHeroPage();
      renderHeroDots();
      preloadHeroCovers();
      scheduleHeroAutoAdvance();
    } else {
      updateSettledHeroTextAndState();
    }
  }

  // warms what a slide may need next: every card's soft copy (tiny) and the sharp covers either side, decoded
  function preloadHeroCovers() {
    const cards = state.heroCards;
    cards.forEach((c) => c.thumbnail && softCover(proxyImg(sizedCover(c.thumbnail, 120))));
    if (cards.length <= 1) return;
    [1, -1].forEach((step) => {
      const card = cards[(state.heroIndex + step + cards.length) % cards.length];
      if (!card?.thumbnail) return;
      const img = new Image();
      img.src = proxyImg(sizedCover(card.thumbnail, 1200));
      img.decode().catch(() => {});
    });
  }

  function isCardPlaying(card) {
    return !!(state.isPlaying && card?.mediaId && state.currentSong?.id === card.mediaId);
  }

  function buildHeroPageElement(card) {
    const page = document.createElement("div");
    page.className = "hero-page";

    if (!card) {
      page.innerHTML = `
        <div class="hero-page-body">
          <div class="quiet-hero"></div>
          <div class="hero-scrim"></div>
          <div class="hero-text-layer">
            <div class="hero-text">
              <div class="hero-label-line"><span class="hero-label-reason">Nothing here yet</span></div>
              <h1 class="hero-title">Play something and it shows up here</h1>
            </div>
          </div>
        </div>
      `;
      return page;
    }

    if (card.isGacha) {
      ensureGachaCandidates();
      const rolling = state.gacha.phase === "rolling";
      const result = state.gacha.result;
      const resultPlaying = state.isPlaying && result && state.currentSong?.id === result.id;
      const lbl = !result || rolling ? "Gacha here!" : resultPlaying ? "Now playing" : "You got";
      const title =
        !result || rolling
          ? "Random plays"
          : artistNames(result)
          ? `${result.title} - ${artistNames(result)}`
          : result.title;

      page.innerHTML = `
        <div class="hero-page-body">
          <div class="hero-media-wrap gacha-media-wrap">
            <canvas class="gacha-field-canvas"></canvas>
            <div class="gacha-reel-wrap"></div>
            <div class="gacha-blur-band"></div>
            <div class="gacha-shading"></div>
            <div class="gacha-pointer">${ICONS.pointer}</div>
          </div>
          <div class="hero-text-layer">
            <div class="hero-text">
              <div class="hero-label-line">
                <span class="hero-label-reason">${esc(lbl)}</span>
              </div>
              <h1 class="hero-title">${esc(title)}</h1>
              <div class="hero-cta-row">
                <button class="hero-pill-btn" data-hero-action="1" ${rolling ? "disabled" : ""}>
                  ${ICONS.gachaDie(rolling)}
                  <span>${rolling ? "rolling!!" : "roll!!"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      page.querySelector("[data-hero-action]").onclick = () => startGachaRoll();
      layoutGachaReelInPage(page);
      drawGachaFieldOnCanvas(page.querySelector(".gacha-field-canvas"), performance.now() * 0.001);
      return page;
    }

    const playing = isCardPlaying(card);
    const coverUrl = card.thumbnail ? proxyImg(sizedCover(card.thumbnail, 1200)) : "";
    const labelLine = `<div class="hero-label-line ${card.greeting ? "hero-subline" : ""}">${heroLabelHtml(card, playing)}</div>`;
    const titleLine = `<h1 class="hero-title">${esc(card.title)}</h1>`;
    const pillIcon = card.opensPage ? "" : playing ? ICONS.pause : ICONS.play;
    const pillWord = card.opensPage ? "View" : playing ? "Pause" : "Play";
    const pillAfter = card.opensPage ? ICONS.arrowRight : "";

    const smallUrl = card.thumbnail ? proxyImg(sizedCover(card.thumbnail, 120)) : "";
    page.innerHTML = `
      <div class="hero-page-body">
        <div class="hero-media-wrap">
          ${
            coverUrl
              ? `<canvas class="hero-soft hero-cover-veil"></canvas>
                 <img class="hero-cover-img" src="${esc(coverUrl)}" alt="" />
                 <canvas class="hero-soft hero-cover-blur-edges"></canvas>`
              : `<div class="quiet-hero"></div>`
          }
        </div>
        <div class="hero-scrim"></div>
        <div class="hero-text-layer">
          <div class="hero-text">
            ${card.greeting ? titleLine + labelLine : labelLine + titleLine}
            <div class="hero-cta-row">
              <button class="hero-pill-btn" data-hero-action="1">
                ${pillIcon}
                <span>${pillWord}</span>
                ${pillAfter}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    page.querySelector("[data-hero-action]").onclick = () => activateHeroCard(card);
    page._softReady = paintSoftCover(page.querySelectorAll(".hero-soft"), smallUrl);
    return page;
  }

  // the line beside the title: why this card is here, or what's playing; the hello card keeps its song name while playing
  function heroLabelHtml(card, playing) {
    const subject = card.label.subject && (card.greeting || !playing) ? card.label.subject : "";
    return `
      <span class="hero-label-reason">
        ${playing ? playingBarsHtml(true) : ""}
        <span>${esc(playing ? "Now playing" : card.label.text)}</span>
      </span>
      ${
        !playing && card.label.cover
          ? `<img class="hero-label-cover ${card.label.roundCover ? "round" : ""}" src="${esc(proxyImg(sizedCover(card.label.cover, 80)))}" alt="" />`
          : ""
      }
      ${subject ? `<span class="hero-label-subject">${esc(subject)}</span>` : ""}
    `;
  }

  // "Hello, Roo" from the profile name or this computer's account, or a plain welcome when neither has one
  function heroGreeting() {
    const name = (state.settings.profileName || state.userName || "").trim();
    return name ? `Hello, ${name}` : "Welcome back";
  }

  // the cover's blurred copy, made once per cover: a tiny image drawn a few times nudged around, which css then stretches
  function softCover(url) {
    let made = softCovers.get(url);
    if (made) return made;
    made = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = SOFT_COVER_PX;
        // the cover keeps its own shape, so a wide video frame crops the same way as the sharp picture over it
        const h = Math.max(1, Math.round((SOFT_COVER_PX * img.naturalHeight) / Math.max(1, img.naturalWidth)));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        // each nudged copy is blended in at 1/n, so together they average out into a soft blur
        SOFT_COVER_TAPS.forEach(([dx, dy], i) => {
          ctx.globalAlpha = 1 / (i + 1);
          ctx.drawImage(img, dx - 2, dy - 2, w + 4, h + 4);
        });
        resolve(canvas);
      };
      img.onerror = () => {
        softCovers.delete(url);
        resolve(null);
      };
      img.src = url;
    });
    softCovers.set(url, made);
    if (softCovers.size > SOFT_COVER_CACHE_MAX) softCovers.delete(softCovers.keys().next().value);
    return made;
  }

  // copies the cached soft cover into a page's canvases; the promise settles once they're painted
  function paintSoftCover(canvases, url) {
    if (!url || !canvases.length) return Promise.resolve();
    return softCover(url).then((src) => {
      if (!src) return;
      canvases.forEach((canvas) => {
        canvas.width = src.width;
        canvas.height = src.height;
        canvas.getContext("2d").drawImage(src, 0, 0);
      });
    });
  }

  // waits a moment for a new page's covers, so a slide never wipes in an empty page whose scrim only darkens the old one
  function heroPageReady(page) {
    const sharp = page.querySelector(".hero-cover-img");
    const ready = Promise.all([page._softReady, sharp?.decode().catch(() => {})]);
    return Promise.race([ready, new Promise((resolve) => setTimeout(resolve, HERO_READY_WAIT_MS))]);
  }

  function renderSettledHeroPage() {
    const stage = $("hero-stage");
    if (!stage) return;
    finishHeroSlide();
    // a slide still waiting on its covers is dropped, this page replaces it
    heroSlideTicket++;
    heroSwitching = false;
    stage.innerHTML = "";
    const card = state.heroCards[state.heroIndex] || null;
    stage.appendChild(buildHeroPageElement(card));
  }

  function updateSettledHeroTextAndState() {
    const stage = $("hero-stage");
    if (!stage || heroSwitching) return;
    const card = state.heroCards[state.heroIndex];
    if (!card) return;
    const page = stage.querySelector(".hero-page");
    if (!page) return renderSettledHeroPage();

    if (card.isGacha) {
      const rolling = state.gacha.phase === "rolling";
      const result = state.gacha.result;
      const resultPlaying = state.isPlaying && result && state.currentSong?.id === result.id;
      const lblEl = page.querySelector(".hero-label-reason");
      const titleEl = page.querySelector(".hero-title");
      const btnEl = page.querySelector("[data-hero-action]");
      if (lblEl) lblEl.textContent = !result || rolling ? "Gacha here!" : resultPlaying ? "Now playing" : "You got";
      if (titleEl) {
        titleEl.textContent =
          !result || rolling
            ? "Random plays"
            : artistNames(result)
            ? `${result.title} - ${artistNames(result)}`
            : result.title;
      }
      if (btnEl) {
        btnEl.disabled = rolling;
        btnEl.innerHTML = `${ICONS.gachaDie(rolling)}<span>${rolling ? "rolling!!" : "roll!!"}</span>`;
      }
      return;
    }

    const playing = isCardPlaying(card);
    const labelLine = page.querySelector(".hero-label-line");
    const btnEl = page.querySelector("[data-hero-action]");
    if (labelLine) labelLine.innerHTML = heroLabelHtml(card, playing);
    if (btnEl) {
      const pillIcon = card.opensPage ? "" : playing ? ICONS.pause : ICONS.play;
      const pillWord = card.opensPage ? "View" : playing ? "Pause" : "Play";
      const pillAfter = card.opensPage ? ICONS.arrowRight : "";
      btnEl.innerHTML = `${pillIcon}<span>${pillWord}</span>${pillAfter}`;
    }
  }

  function renderHeroDots() {
    const dots = $("hero-dots");
    if (!dots) return;
    const count = state.heroCards.length;
    if (count <= 1) {
      dots.innerHTML = "";
      return;
    }
    dots.innerHTML = state.heroCards
      .map(
        (c, i) =>
          `<button class="hero-dot ${i === state.heroIndex ? "active" : ""}" data-hero-dot="${i}" title="${esc(c.title)}"></button>`
      )
      .join("");
    dots.querySelectorAll("[data-hero-dot]").forEach((btn) => {
      btn.onclick = () => goToHeroCard(Number(btn.dataset.heroDot));
    });
  }

  function stepHeroCard(delta) {
    const count = state.heroCards.length;
    if (count <= 1) return;
    if (state.gacha.phase === "rolling" && state.heroCards[state.heroIndex]?.isGacha) return;
    const to = (state.heroIndex + delta + count) % count;
    transitionHeroPage(state.heroIndex, to, delta > 0);
  }

  function goToHeroCard(toIndex) {
    const count = state.heroCards.length;
    if (count <= 1 || toIndex === state.heroIndex) return;
    if (state.gacha.phase === "rolling" && state.heroCards[state.heroIndex]?.isGacha) return;
    transitionHeroPage(state.heroIndex, toIndex, toIndex > state.heroIndex);
  }

  // the slide between pages, after PageWipe.kt. the new page is built and its covers decoded first, then it moves
  function transitionHeroPage(fromIdx, toIdx, forward) {
    if (!$("hero-stage")) return;
    finishHeroSlide();
    clearTimeout(heroAutoTimer);

    const toCard = state.heroCards[toIdx];
    if (!toCard) return;
    state.heroIndex = toIdx;
    state.heroShownId = toCard.id;
    renderHeroDots();
    preloadHeroCovers();

    const inPage = buildHeroPageElement(toCard);
    const ticket = ++heroSlideTicket;
    heroSwitching = true;
    heroPageReady(inPage).then(() => {
      if (ticket === heroSlideTicket) startHeroSlide(fromIdx, inPage, toCard, forward);
    });
  }

  // only transforms and opacity move, so webkit hands it all to the compositor
  function startHeroSlide(fromIdx, inPage, toCard, forward) {
    const stage = $("hero-stage");
    if (!stage) {
      heroSwitching = false;
      return;
    }
    const outPage = stage.querySelector(".hero-page") || buildHeroPageElement(state.heroCards[fromIdx]);
    stage.replaceChildren(outPage, inPage);
    if (toCard.isGacha) drawGachaFieldOnCanvas(inPage.querySelector(".gacha-field-canvas"), performance.now() * 0.001);

    if (reducedMotion()) {
      outPage.remove();
      heroSwitching = false;
      scheduleHeroAutoAdvance();
      return;
    }

    const dir = forward ? 1 : -1;
    const w = stage.clientWidth;
    const outWords = liftHeroWords(stage, outPage);
    const inWords = liftHeroWords(stage, inPage);
    const anims = [
      ...wipeHeroPageIn(inPage, dir, w),
      ...driftHeroPage(outPage, dir, w, false),
      ...driftHeroPage(inPage, dir, w, true),
      ...pushHeroWords(outWords, 0, -dir * w),
      ...pushHeroWords(inWords, dir * w, 0)
    ];
    heroSwitching = true;
    heroSlide = { outPage, inPage, outWords, inWords, anims };
    anims[0].finished.then(() => heroSlide?.inPage === inPage && finishHeroSlide(), () => {});
  }

  // the new page is widened by the feather and masked once; sliding it moves the soft edge across,
  // while its body slides back the same amount so the picture itself stays where it lands
  function wipeHeroPageIn(page, dir, w) {
    const body = page.querySelector(".hero-page-body");
    const feather = Math.round(w * HERO_FEATHER);
    const travel = w + feather;
    const mask = `linear-gradient(${dir > 0 ? 90 : 270}deg, transparent 0px, #000 ${feather}px)`;
    page.style.left = dir > 0 ? `${-feather}px` : "0px";
    page.style.width = `${travel}px`;
    page.style.webkitMaskImage = mask;
    page.style.maskImage = mask;
    body.style.left = dir > 0 ? `${feather}px` : "0px";
    body.style.width = `${w}px`;
    return [
      heroAnimate(page, [{ transform: `translate3d(${dir * travel}px, 0, 0)` }, { transform: "translate3d(0, 0, 0)" }]),
      heroAnimate(body, [{ transform: `translate3d(${-dir * travel}px, 0, 0)` }, { transform: "translate3d(0, 0, 0)" }])
    ];
  }

  // the picture drifts and zooms as it softens; the words are lifted out and pushed separately
  function driftHeroPage(page, dir, w, incoming) {
    const side = incoming ? dir : -dir;
    const between = (moved, rest) => (incoming ? [moved, rest] : [rest, moved]);
    const anims = [];

    const media = page.querySelector(".hero-media-wrap");
    if (media) {
      const moved = { transform: `translate3d(${(side * w * 0.18).toFixed(1)}px, 0, 0) scale(1.36)` };
      anims.push(heroAnimate(media, between(moved, { transform: "translate3d(0, 0, 0) scale(1)" })));
    }
    const sharp = page.querySelector(".hero-cover-img");
    if (sharp) {
      anims.push(heroAnimate(sharp, incoming
        ? [{ opacity: 0 }, { opacity: 0, offset: 0.13 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0, offset: 0.87 }, { opacity: 0 }]));
    }
    return anims;
  }

  // a page's words leave the masked page for the slide, so the wipe's soft edge never dims them
  function liftHeroWords(stage, page) {
    const words = page.querySelector(".hero-text-layer");
    if (words) stage.appendChild(words);
    return words;
  }

  // the two titles push each other a whole width at full brightness, so they never fade and never meet
  function pushHeroWords(words, fromX, toX) {
    if (!words) return [];
    return [heroAnimate(words, [{ transform: `translate3d(${fromX}px, 0, 0)` }, { transform: `translate3d(${toX}px, 0, 0)` }])];
  }

  function heroAnimate(el, frames) {
    return el.animate(frames, { duration: HERO_SLIDE_MS, easing: HERO_SLIDE_EASING, fill: "both" });
  }

  // lands a slide right away: the old page goes and the new one drops its wipe styles to become the settled page
  function finishHeroSlide() {
    const slide = heroSlide;
    if (!slide) return;
    heroSlide = null;
    heroSwitching = false;
    slide.outPage.remove();
    slide.outWords?.remove();
    const page = slide.inPage;
    const body = page.querySelector(".hero-page-body");
    if (slide.inWords) body.appendChild(slide.inWords);
    page.style.left = "";
    page.style.width = "";
    page.style.webkitMaskImage = "";
    page.style.maskImage = "";
    body.style.left = "";
    body.style.width = "";
    slide.anims.forEach((a) => a.cancel());
    scheduleHeroAutoAdvance();
  }

  function scheduleHeroAutoAdvance() {
    clearTimeout(heroAutoTimer);
    if (
      state.settings.heroAutoTurn === false ||
      state.heroCards.length <= 1 ||
      state.heroHovered ||
      state.showFullPlayer ||
      state.tab !== "home" ||
      state.routeStack.length > 0 ||
      state.heroScrollProgress > 0.08
    ) {
      return;
    }
    const cur = state.heroCards[state.heroIndex];
    if (cur?.isGacha && state.gacha.phase !== "idle") return;
    const delayMs = cur?.isGacha ? 11000 : 5500;
    heroAutoTimer = setTimeout(() => {
      if (state.tab === "home" && !state.routeStack.length && !state.heroHovered && !state.showFullPlayer) {
        stepHeroCard(1);
      }
    }, delayMs);
  }

  async function activateHeroCard(card) {
    if (!card) return;
    if (card.isGacha) return startGachaRoll();
    if (card.opensPage && card.route) return pushRoute(card.route);
    if (card.kind === "localPlaylist" && card.playlistId) {
      const pl = (state.library.playlists || []).find((p) => p.id === card.playlistId);
      if (pl?.songIds?.length) {
        const songs = await invoke("lib_songs_by_ids", { ids: pl.songIds });
        if (songs.length) playSong(songs[0], songs, 0);
      }
      return;
    }
    if (card.song) {
      if (state.currentSong?.id === card.song.id) {
        togglePlayPause();
      } else {
        playSong(card.song);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Gacha Color Field & Vertical 3D Drum Reel (1:1 with Gacha.swift / HeroCarousel.kt)
  // --------------------------------------------------------------------------
  function ensureGachaCandidates() {
    const pool = extractHeroPool();
    const g = state.gacha;
    if (g.phase === "rolling") return;
    if (!g.candidates.length || (g.candidates.length < 10 && pool.length > g.candidates.length)) {
      const copy = pool.slice();
      shuffleInPlace(copy);
      g.candidates = copy.slice(0, 10);
      loadGachaTints();
    }
  }

  function loadGachaTints() {
    for (const song of state.gacha.candidates) {
      if (state.gacha.tints[song.id] || !songThumb(song)) continue;
      fetchCoverPalette(songThumb(song)).then((pal) => {
        if (pal?.stops) state.gacha.tints[song.id] = shiftTintFromPalette(pal.stops);
      });
    }
  }

  function currentGachaTint() {
    const g = state.gacha;
    if (!g.candidates.length) return DEFAULT_GACHA_TINT;
    const n = g.candidates.length;
    const base = Math.floor(g.reel);
    const between = g.reel - base;
    const idxA = ((base % n) + n) % n;
    const idxB = (((base + 1) % n) + n) % n;
    const a = g.tints[g.candidates[idxA].id] || DEFAULT_GACHA_TINT;
    const b = g.tints[g.candidates[idxB].id] || DEFAULT_GACHA_TINT;
    const mix3 = (x, y) => [0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * between));
    return { light: mix3(a.light, b.light), deep: mix3(a.deep, b.deep) };
  }

  function reelDistance(index, reel, count) {
    let d = (reel - index) % count;
    if (d < -count / 2) d += count;
    if (d >= count / 2) d -= count;
    return d;
  }

  function layoutGachaReelInPage(page) {
    const wrap = page.querySelector(".gacha-reel-wrap");
    const ptr = page.querySelector(".gacha-pointer");
    if (!wrap) return;

    const hero = $("home-hero");
    const w = hero?.clientWidth || 1000;
    const h = hero?.clientHeight || 480;
    const unit = h / 527;
    const focus = 221 * unit;
    const focusRight = Math.min(w + 28 * unit, w * 0.8 + focus / 2);
    const centerX = focusRight - focus / 2;
    const centerY = 230.5 * unit;
    const count = state.gacha.candidates.length;
    if (!count) return;

    if (wrap.children.length !== count) {
      wrap.innerHTML = state.gacha.candidates
        .map(
          (s, i) => `
          <div class="gacha-reel-card" data-gacha-idx="${i}" style="width:${focus.toFixed(1)}px;height:${focus.toFixed(1)}px;border-radius:${(25 * unit).toFixed(1)}px;">
            <img src="${esc(proxyImg(sizedCover(songThumb(s), 420)))}" alt="" />
          </div>`
        )
        .join("");
      wrap.querySelectorAll(".gacha-reel-card").forEach((el) => {
        el.onclick = () => {
          if (state.gacha.phase !== "rolling") startGachaRoll();
        };
      });
    }

    const stretch = 1 + Math.min(state.gacha.speed / 120, 0.1);
    const cards = wrap.children;
    for (let i = 0; i < count; i++) {
      const el = cards[i];
      if (!el) continue;
      const d = reelDistance(i, state.gacha.reel, count);
      if (Math.abs(d) >= 3) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "block";
      const near = clamp01(1 - Math.abs(d));
      const landed = near > 0.5 ? state.gacha.pop : 1;
      const scale = ((187 + (221 - 187) * near) / 221) * landed;
      const slots = d * 207 + 17 * Math.max(-1, Math.min(1, d));
      const rotX = Math.max(-50, Math.min(50, -d * 18));
      const op = clamp01(2.7 - Math.abs(d));

      el.style.width = `${focus.toFixed(1)}px`;
      el.style.height = `${focus.toFixed(1)}px`;
      el.style.left = `${(centerX - focus / 2).toFixed(1)}px`;
      el.style.top = `${(centerY - focus / 2).toFixed(1)}px`;
      el.style.opacity = op.toFixed(3);
      el.style.zIndex = String(Math.round(50 - Math.abs(d) * 10));
      el.style.transform = `translate3d(0, ${(slots * unit).toFixed(1)}px, 0) perspective(900px) rotateX(${rotX.toFixed(1)}deg) scale(${scale.toFixed(3)}, ${(scale * stretch).toFixed(3)})`;
    }

    if (ptr) {
      const win = state.gacha.burst;
      const pop = win > 0 ? 1 + 0.18 * Math.sin(win * Math.PI) : 1;
      const px = centerX - focus / 2 - 89 * unit;
      const py = centerY + 5 * unit - 22;
      ptr.style.left = `${px.toFixed(1)}px`;
      ptr.style.top = `${py.toFixed(1)}px`;
      ptr.style.transform = `translate3d(${(-state.gacha.kick * 7).toFixed(1)}px, 0, 0) rotate(${(-state.gacha.kick * 9).toFixed(1)}deg) scale(${pop.toFixed(3)})`;
    }
  }

  function drawVisibleGachaFields(t) {
    const stage = $("hero-stage");
    if (!stage) return;
    stage.querySelectorAll(".gacha-field-canvas").forEach((canvas) => drawGachaFieldOnCanvas(canvas, t));
  }

  function drawGachaFieldOnCanvas(canvas, t) {
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 4 || h < 4) return;
    const scale = 0.35;
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tint = currentGachaTint();
    const lit = tint.light;
    const deep = tint.deep;
    const mixRgb = (a, b, k, alpha = 1) => {
      const r = Math.round(a[0] + (b[0] - a[0]) * k);
      const g = Math.round(a[1] + (b[1] - a[1]) * k);
      const bl = Math.round(a[2] + (b[2] - a[2]) * k);
      return `rgba(${r},${g},${bl},${alpha})`;
    };

    const sway = Math.sin(t * 0.35) * cw * 0.12;
    const wash = ctx.createLinearGradient(cw * 0.85 + sway, 0, cw * 0.15 - sway, ch);
    wash.addColorStop(0, mixRgb(deep, lit, 0.55));
    wash.addColorStop(0.5, mixRgb(deep, lit, 0.22));
    wash.addColorStop(1, `rgb(${deep[0]},${deep[1]},${deep[2]})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, cw, ch);

    // Wandering warm glow under left text
    const wx = cw * (0.18 + 0.08 * Math.sin(t * 0.23));
    const wy = ch * (0.55 + 0.1 * Math.sin(t * 0.31 + 1.3));
    const wander = ctx.createRadialGradient(wx, wy, 0, wx, wy, cw * 0.68);
    wander.addColorStop(0, `rgba(${lit[0]},${lit[1]},${lit[2]},0.32)`);
    wander.addColorStop(0.5, `rgba(${lit[0]},${lit[1]},${lit[2]},0.1)`);
    wander.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wander;
    ctx.fillRect(0, 0, cw, ch);

    // Breathing / flaring glow behind focused reel cover
    const unit = ch / 527;
    const focus = 221 * unit;
    const focusRight = Math.min(cw + 28 * unit, cw * 0.8 + focus / 2);
    const gx = focusRight - focus / 2;
    const gy = 230.5 * unit + Math.sin(t * 0.8) * focus * 0.04;
    const rush = Math.min(state.gacha.speed / 30, 1);
    const win = state.gacha.burst;
    const flare = win > 0 ? Math.sin(win * Math.PI) * 0.55 : 0;
    const gr = focus * (1.1 + 0.05 * Math.sin(t * 1.4) + rush * 0.35 + flare);
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(1, gr));
    glow.addColorStop(0, `rgba(${lit[0]},${lit[1]},${lit[2]},${Math.min(0.75 + rush * 0.2, 1).toFixed(2)})`);
    glow.addColorStop(0.45, `rgba(${lit[0]},${lit[1]},${lit[2]},0.32)`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cw, ch);

    // Win expanding burst ring
    if (win > 0 && win < 1) {
      const ringR = focus * (0.55 + win * 1.1);
      ctx.beginPath();
      ctx.arc(gx, 230.5 * unit, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = mixRgb(lit, [255, 255, 255], 0.5, (1 - win) * 0.9);
      ctx.lineWidth = Math.max(1, (1 - win) * 10 * scale + 1);
      ctx.stroke();
    }
  }

  let gachaRaf = null;
  function startGachaRoll() {
    const g = state.gacha;
    if (g.phase === "rolling") return;
    ensureAudioContext();
    ensureGachaCandidates();
    const pool = extractHeroPool();
    if (g.candidates.length < 2) {
      if (pool.length) playSong(pool[0]);
      return;
    }

    // Refresh off-screen candidates with fresh pool songs
    const spare = pool.filter((s) => !g.candidates.some((c) => c.id === s.id));
    shuffleInPlace(spare);
    g.candidates = g.candidates.map((s, idx) =>
      Math.abs(reelDistance(idx, g.reel, g.candidates.length)) > 2.5 && spare.length ? spare.pop() : s
    );
    loadGachaTints();

    const count = g.candidates.length;
    const winner = Math.floor(Math.random() * count);
    const duration = 3500 + Math.random() * 4000;
    const start = Math.round(g.reel);
    const spins = count * (2 + Math.floor(duration / 2500));
    const mod = (a, n) => ((a % n) + n) % n;
    const landing = start + spins + mod(winner - (start + spins), count);

    g.phase = "rolling";
    clearTimeout(heroAutoTimer);
    updateSettledHeroTextAndState();

    const stage = $("hero-stage");
    const page = stage?.querySelector(".hero-page");
    if (page) {
      const wrap = page.querySelector(".gacha-reel-wrap");
      if (wrap) wrap.innerHTML = "";
      layoutGachaReelInPage(page);
    }

    let lastSlot = start;
    let lastReel = start;
    let lastTime = performance.now();
    const began = lastTime;

    cancelAnimationFrame(gachaRaf);
    function step(now) {
      const t = clamp01((now - began) / duration);
      g.reel = start + (landing - start) * GACHA_EASE(t);
      const dt = Math.max(0.004, (now - lastTime) / 1000);
      g.speed += (Math.abs(g.reel - lastReel) / dt - g.speed) * (1 - Math.exp(-dt / 0.12));
      lastReel = g.reel;
      lastTime = now;

      const slot = Math.round(g.reel);
      if (slot !== lastSlot) {
        lastSlot = slot;
        playGachaTick();
        g.kick = 1;
      } else {
        g.kick *= Math.exp(-dt / 0.08);
      }

      const curPage = $("hero-stage")?.querySelector(".hero-page");
      if (curPage) layoutGachaReelInPage(curPage);

      if (t < 1) {
        gachaRaf = requestAnimationFrame(step);
      } else {
        g.speed = 0;
        g.kick = 0;
        const won = g.candidates[winner];
        g.result = won;
        g.phase = "landed";
        playGachaWin();
        updateSettledHeroTextAndState();
        playSong(won);

        const burstStart = performance.now();
        function winAnim(wNow) {
          const bt = clamp01((wNow - burstStart) / 1100);
          g.burst = bt;
          g.pop = bt < 0.14 ? 1 + (bt / 0.14) * 0.1 : 1 + 0.1 * Math.exp(-(bt - 0.14) * 6) * Math.cos((bt - 0.14) * 18);
          const p = $("hero-stage")?.querySelector(".hero-page");
          if (p) layoutGachaReelInPage(p);
          if (bt < 1) {
            requestAnimationFrame(winAnim);
          } else {
            g.burst = 0;
            g.pop = 1;
          }
        }
        requestAnimationFrame(winAnim);
      }
    }
    gachaRaf = requestAnimationFrame(step);
  }

  // --------------------------------------------------------------------------
  // Home Tab (Hero + Tucked Recently Played + Shelves + Scroll-Away Soften/Zoom)
  // --------------------------------------------------------------------------
  let homeRevealObserver = null;
  // the song lists the home shelves play from, by section key; the rows and the play-all dots read them
  let homeLists = {};

  function renderHomeTab() {
    const container = $("tab-home");
    if (!container) return;

    if (state.homeLoading && !state.homePage && !state.library.recentSongs?.length) {
      container.innerHTML = `
        <div class="home-hero">
          <div class="skeleton" style="width:100%;height:100%;border-radius:0;"></div>
        </div>
        <div class="shelf home-tucked-section">
          <div class="skeleton" style="width:150px;height:18px;margin:0 0 14px var(--content-x);"></div>
          <div style="display:flex;gap:16px;overflow:hidden;padding-left:var(--content-x);">
            ${[0, 1, 2, 3, 4].map(() => `<div class="skeleton" style="width:156px;height:156px;border-radius:14px;flex-shrink:0;"></div>`).join("")}
          </div>
        </div>
      `;
      return;
    }

    state.heroCards = buildHeroCards();
    if (state.heroShownId) {
      const idx = state.heroCards.findIndex((c) => c.id === state.heroShownId);
      state.heroIndex = idx >= 0 ? idx : 0;
    } else {
      state.heroIndex = 0;
    }
    state.heroShownId = state.heroCards[state.heroIndex]?.id || null;

    const filterExplicit = (list) =>
      state.settings.hideExplicit ? (list || []).filter((x) => !(x?.explicit || x?.data?.explicit)) : list || [];

    const shelves = window.MochyShelves;
    const recent = filterExplicit(state.library.recentSongs || []).slice(0, 20);
    const quickPicks = filterExplicit(state.quickPicks).slice(0, 20);
    const topSongs = filterExplicit((state.library.recap?.topSongs || []).map((e) => e.song)).slice(0, 12);
    const sections = (state.homePage?.sections || []).map((sec) =>
      state.settings.hideExplicit ? { ...sec, items: filterExplicit(sec.items) } : sec
    );
    homeLists = { quickPicks, mostPlayed: topSongs };

    // recently played tucks into the hero's foot; without it the first feed section takes its place
    const hasRecent = recent.length > 0;
    const feedHtml = sections.map((sec, i) => shelves.feedSectionHtml(sec, `feed-${i}`, homeLists, { tucked: !hasRecent && i === 0 }));
    const tuckedHtml = hasRecent
      ? shelves.coverSectionHtml("recent", { title: "Recently played" }, recent.map((s) => ({ kind: "song", data: s })), { tucked: true })
      : feedHtml.shift() || "";
    const quickPicksHtml = quickPicks.length
      ? shelves.trackSectionHtml("quickPicks", { title: "Quick picks", label: "Start radio from a song", playAll: true }, quickPicks, { listId: "quickPicks" })
      : "";
    const mostPlayedHtml =
      topSongs.length >= 3
        ? shelves.trackSectionHtml(
            "mostPlayed",
            { title: "Most played", label: state.library.recap?.monthLabel || "This month", more: { route: "recap" }, playAll: true },
            topSongs,
            { listId: "mostPlayed", ranked: true }
          )
        : "";

    container.innerHTML = `
      <div class="home-hero" id="home-hero">
        <div class="hero-scroll-shell" id="hero-scroll-shell">
          <div class="hero-stage" id="hero-stage"></div>
          <div class="hero-dim" id="hero-dim"></div>
          <div class="hero-dots" id="hero-dots"></div>
        </div>
        <div class="hero-fade"></div>
      </div>

      <div class="home-body">
        ${tuckedHtml}
        ${quickPicksHtml}
        ${mostPlayedHtml}
        <div id="home-shelves-wrap">${feedHtml.join("")}</div>
      </div>
    `;

    renderSettledHeroPage();
    renderHeroDots();
    preloadHeroCovers();
    scheduleHeroAutoAdvance();
    bindHomeEvents(container);
    setupHomeScrollAndReveal(container);
  }

  // the shelves' own taps: a header opens its full section, its dots play all of it, a missing video still falls back to the cover
  function bindShelves(root, lists = homeLists) {
    root.querySelectorAll("[data-more-browse]").forEach((head) => {
      head.onclick = () => {
        pushRoute({
          type: "section",
          browseId: head.dataset.moreBrowse,
          params: head.dataset.moreParams || null,
          title: head.dataset.moreTitle || "More"
        });
      };
    });
    root.querySelectorAll("[data-more-route]").forEach((head) => {
      head.onclick = () => pushRoute({ type: head.dataset.moreRoute });
    });
    root.querySelectorAll("[data-play-list]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const songs = lists[btn.dataset.playList];
        if (songs?.length) playSong(songs[0], songs, 0);
      };
    });
    root.querySelectorAll("img[data-fallback]").forEach((img) => {
      img.onerror = () => {
        img.onerror = null;
        img.src = img.dataset.fallback;
      };
    });
    bindItemAndSongCards(root, lists);
  }

  function bindHomeEvents(container) {
    const hero = $("home-hero");
    if (hero) {
      hero.onmouseenter = () => {
        state.heroHovered = true;
        clearTimeout(heroAutoTimer);
      };
      hero.onmouseleave = () => {
        state.heroHovered = false;
        scheduleHeroAutoAdvance();
      };

      // Two-finger horizontal swipe on trackpad turns hero cards cleanly (same as HeroSwipeMonitor)
      let swipeTravel = 0;
      let lastFire = 0;
      let resetTimer = null;
      hero.addEventListener(
        "wheel",
        (e) => {
          if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return;
          e.preventDefault();
          swipeTravel += e.deltaX;
          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            swipeTravel = 0;
          }, 180);

          const now = performance.now();
          if (Math.abs(swipeTravel) > 42 && now - lastFire > 620) {
            lastFire = now;
            const dir = swipeTravel > 0 ? 1 : -1;
            swipeTravel = 0;
            stepHeroCard(dir);
          }
        },
        { passive: false }
      );
    }

    bindShelves(container);
  }

  function setupHomeScrollAndReveal(container) {
    if (homeRevealObserver) homeRevealObserver.disconnect();
    homeRevealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            homeRevealObserver.unobserve(entry.target);
          }
        });
      },
      { root: container, threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );
    container.querySelectorAll(".reveal-section").forEach((sec) => homeRevealObserver.observe(sec));

    let scrollRaf = null;
    const applyHeroScroll = () => {
      scrollRaf = null;
      const hero = $("home-hero");
      const shell = $("hero-scroll-shell");
      if (!hero || !shell) return;
      const heroH = Math.max(1, hero.clientHeight);
      const p = clamp01(container.scrollTop / heroH);
      state.heroScrollProgress = p;
      const dim = $("hero-dim");

      // while scrolled, the dim and the sharp cover get their own layers, so fading them never repaints the hero
      const scrolled = p > 0.001;
      hero.classList.toggle("is-scrolled", scrolled);
      if (!scrolled) {
        shell.style.transform = "";
        shell.style.opacity = "";
        if (dim) dim.style.opacity = "0";
        setHeroSharpness("");
        return;
      }
      const zoom = 1 + p * 0.22;
      const ty = p * heroH * 0.18;
      const soft = smoothstep(0.08, 0.55, p);
      const op = 1 - smoothstep(0.22, 0.88, p);
      shell.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(${zoom.toFixed(4)})`;
      shell.style.opacity = op.toFixed(3);
      if (dim) dim.style.opacity = (0.28 * p).toFixed(3);
      // the blur is the page's own soft copy under the cover, shown by fading the sharp cover out
      setHeroSharpness(soft > 0 ? (1 - soft).toFixed(3) : "");
    };

    container.onscroll = async () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(applyHeroScroll);

      if (
        state.homePage?.continuation &&
        !state.homeLoading &&
        container.scrollTop + container.clientHeight >= container.scrollHeight - 320
      ) {
        state.homeLoading = true;
        const token = state.homePage.continuation;
        state.homePage.continuation = null;
        try {
          const more = await invoke("yt_home_continuation", { token });
          if (more?.sections?.length) {
            const startIdx = state.homePage.sections.length;
            state.homePage.sections.push(...more.sections);
            state.homePage.continuation = more.continuation;
            const wrap = $("home-shelves-wrap");
            if (wrap) {
              const fragHtml = more.sections
                .map((sec, i) => window.MochyShelves.feedSectionHtml(sec, `feed-${startIdx + i}`, homeLists))
                .join("");
              wrap.insertAdjacentHTML("beforeend", fragHtml);
              bindShelves(wrap);
              wrap.querySelectorAll(".reveal-section:not(.revealed)").forEach((s) => homeRevealObserver.observe(s));
            }
          }
        } catch (_) {}
        state.homeLoading = false;
      }
    };
  }

  // --------------------------------------------------------------------------
  // Reusable Cards & Song Rows
  // --------------------------------------------------------------------------
  // writes the sharp cover's opacity only when it changed, since this runs on every scroll frame
  function setHeroSharpness(value) {
    $("hero-stage")?.querySelectorAll(".hero-cover-img").forEach((img) => {
      if (img.style.opacity !== value) img.style.opacity = value;
    });
  }

  function renderSongRowHtml(song, opts = {}) {
    if (!song) return "";
    const isCurrent = state.currentSong?.id === song.id;
    const liked = isLiked(song.id);
    const dataSong = esc(JSON.stringify(song));
    const thumb = songThumb(song);

    return `
      <div class="song-row ${isCurrent ? "active" : ""}" data-song-json="${dataSong}" data-list-id="${esc(opts.listId || "")}" data-song-idx="${opts.index ?? 0}">
        ${
          opts.showTrackNumber
            ? `<div class="song-row-index">${isCurrent ? playingBarsHtml(state.isPlaying) : (opts.index ?? 0) + 1}</div>`
            : ""
        }
        ${
          !opts.hideCover
            ? `
          <div class="song-row-art">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 120)))}" loading="lazy" alt="" />` : ""}
            <div class="song-row-art-overlay">
              ${isCurrent ? playingBarsHtml(state.isPlaying) : ICONS.play}
            </div>
          </div>`
            : ""
        }
        <div class="song-row-meta">
          <div class="song-row-title-line">
            <span class="song-row-title">${esc(song.title)}</span>
            ${song.explicit ? `<span class="explicit-badge">E</span>` : ""}
          </div>
          <div class="song-row-sub">${esc(artistNames(song))}${song.album?.name ? ` · ${esc(song.album.name)}` : ""}</div>
        </div>
        <div class="song-row-actions">
          <button class="song-row-like ${liked ? "liked" : ""}" data-like-song="${dataSong}" title="Like">
            ${liked ? ICONS.heartFilled : ICONS.heart}
          </button>
          ${song.duration ? `<span class="song-row-duration">${formatTime(song.duration)}</span>` : ""}
          ${
            opts.removable
              ? `<button class="song-row-remove" data-remove-qidx="${opts.index}" title="Remove">${ICONS.close}</button>`
              : `<button class="song-row-more" data-more-song="${dataSong}" title="More">${ICONS.more}</button>`
          }
        </div>
      </div>
    `;
  }

  function renderItemCardHtml(item) {
    if (!item) return "";
    const v = item.data || item.value;
    if (!v) return "";
    const thumb = songThumb(v);

    if (item.kind === "song") {
      const isCurrent = state.currentSong?.id === v.id;
      const dataSong = esc(JSON.stringify(v));
      return `
        <div class="cover-card" data-song-json="${dataSong}">
          <div class="cover-card-art">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 320)))}" loading="lazy" alt="" />` : ""}
            ${isCurrent ? `<div class="cover-card-active-scrim">${playingBarsHtml(state.isPlaying)}</div>` : ""}
            <button class="cover-card-play">${ICONS.play}</button>
          </div>
          <div class="cover-card-title">${esc(v.title)}</div>
          <div class="cover-card-sub">${esc(artistNames(v))}</div>
        </div>
      `;
    }
    if (item.kind === "album") {
      return `
        <div class="cover-card" data-album-id="${esc(v.browseId || v.id)}">
          <div class="cover-card-art">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 320)))}" loading="lazy" alt="" />` : ""}
            <button class="cover-card-play">${ICONS.play}</button>
          </div>
          <div class="cover-card-title">${esc(v.title)}</div>
          <div class="cover-card-sub">${esc((v.artists || []).map((a) => a.name).join(", ") || v.year || "Album")}</div>
        </div>
      `;
    }
    if (item.kind === "artist") {
      return `
        <div class="cover-card circle" data-artist-id="${esc(v.id)}">
          <div class="cover-card-art circle">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 320)))}" loading="lazy" alt="" />` : ""}
          </div>
          <div class="cover-card-title">${esc(v.title || v.name)}</div>
          <div class="cover-card-sub">${esc(v.subtitle || "Artist")}</div>
        </div>
      `;
    }
    if (item.kind === "playlist") {
      return `
        <div class="cover-card" data-playlist-id="${esc(v.id)}">
          <div class="cover-card-art">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 320)))}" loading="lazy" alt="" />` : ""}
            <button class="cover-card-play">${ICONS.play}</button>
          </div>
          <div class="cover-card-title">${esc(v.title)}</div>
          <div class="cover-card-sub">${esc(v.author || v.songCountText || "Playlist")}</div>
        </div>
      `;
    }
    return "";
  }

  function bindItemAndSongCards(root, listMap = {}) {
    root.querySelectorAll("[data-like-song]").forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const song = JSON.parse(btn.dataset.likeSong);
        state.library = await invoke("lib_toggle_like", { song });
        btn.classList.toggle("liked", isLiked(song.id));
        btn.innerHTML = isLiked(song.id) ? ICONS.heartFilled : ICONS.heart;
        renderSidebar();
        renderAllPlayerSurfaces();
      };
    });

    root.querySelectorAll("[data-more-song]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const song = JSON.parse(btn.dataset.moreSong);
        openSongContextMenu(e.clientX, e.clientY, song);
      };
    });

    root.querySelectorAll("[data-song-json]").forEach((row) => {
      if (row.dataset.listId === "rpQueue") return;
      row.onclick = () => {
        const song = JSON.parse(row.dataset.songJson);
        const listId = row.dataset.listId;
        const idx = Number(row.dataset.songIdx || 0);
        const list = listId && listMap[listId] ? listMap[listId] : null;
        playSong(song, list, idx);
      };
      row.oncontextmenu = (e) => {
        e.preventDefault();
        const song = JSON.parse(row.dataset.songJson);
        openSongContextMenu(e.clientX, e.clientY, song);
      };
    });

    root.querySelectorAll("[data-album-id]").forEach((card) => {
      card.onclick = () => pushRoute({ type: "album", id: card.dataset.albumId });
    });

    root.querySelectorAll("[data-artist-id]").forEach((card) => {
      card.onclick = () => pushRoute({ type: "artist", id: card.dataset.artistId });
    });

    root.querySelectorAll("[data-playlist-id]").forEach((card) => {
      card.onclick = () => pushRoute({ type: "playlist", id: card.dataset.playlistId });
    });
  }

  // --------------------------------------------------------------------------
  // Search Tab (the phone's: big title, pill field, moods & genres until you start typing)
  // --------------------------------------------------------------------------
  const SEARCH_FILTERS = [
    { label: "All", value: null },
    { label: "Songs", value: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D" },
    { label: "Videos", value: "EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D" },
    { label: "Albums", value: "EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D" },
    { label: "Artists", value: "EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D" },
    { label: "Playlists", value: "EgeKAQQoADgBagwQDhAKEAMQBRAJEAQ%3D" }
  ];
  const SEARCH_HISTORY_MAX = 20;
  const SUGGEST_DELAY_MS = 140;
  const MOOD_TILE_RGB = [18, 18, 20];
  const moodCovers = new Map();
  const moodCoverQueue = [];
  let moodCoversLoading = 0;
  let moodObserver = null;
  let suggestTimer = null;
  let suggestSeq = 0;

  // the field stays put while the page under it changes, so typing never loses focus
  function renderSearchTab() {
    const container = $("tab-search");
    container.innerHTML = `
      <div class="search-page-wrap">
        ${pageHeadHtml("Search")}
        ${pillFieldHtml("search-input", "Songs, artists, albums, playlists", state.searchQuery)}
        <div id="search-body" class="search-body"></div>
      </div>
    `;
    bindPillField("search-input", {
      onInput: onSearchInput,
      onFocus: () => setSearchMode("typing"),
      onBlur: () => {
        if (state.searchMode === "typing" && !state.searchQuery.trim()) setSearchMode("browse");
      },
      onSubmit: () => submitSearch(state.searchQuery),
      onBack: leaveSearch,
      onClear: () => {
        state.searchQuery = "";
        setSearchMode("typing");
      }
    });
    syncSearchFieldLook();
    renderSearchBody();
  }

  // browse shows moods and genres, typing shows history and suggestions, results shows what came back
  function setSearchMode(mode) {
    if (state.searchMode === mode && mode !== "typing") return;
    state.searchMode = mode;
    syncSearchFieldLook();
    renderSearchBody();
  }

  function syncSearchFieldLook() {
    setPillFieldState("search-input", state.searchMode !== "browse", !!state.searchQuery);
  }

  function leaveSearch() {
    state.searchQuery = "";
    state.searchSubmitted = "";
    state.searchSummary = null;
    state.searchPage = null;
    const input = $("search-input");
    if (input) {
      input.value = "";
      input.blur();
    }
    setSearchMode("browse");
  }

  function onSearchInput(value) {
    state.searchQuery = value;
    state.searchMode = "typing";
    syncSearchFieldLook();
    clearTimeout(suggestTimer);
    const q = value.trim();
    if (!q) {
      state.searchSuggest = null;
      renderSearchBody();
      return;
    }
    renderSearchBody();
    const seq = ++suggestSeq;
    suggestTimer = setTimeout(async () => {
      try {
        const sugg = await invoke("yt_search_suggestions", { input: q });
        if (seq !== suggestSeq) return;
        state.searchSuggest = { query: q, queries: sugg?.queries || [], items: sugg?.items || [] };
        if (state.searchMode === "typing") renderSearchBody();
      } catch (_) {}
    }, SUGGEST_DELAY_MS);
  }

  async function submitSearch(query) {
    const q = (query || "").trim();
    if (!q) return;
    state.searchQuery = q;
    state.searchSubmitted = q;
    rememberSearch(q);
    const input = $("search-input");
    if (input) {
      input.value = q;
      input.blur();
    }
    state.searchMode = "results";
    syncSearchFieldLook();
    await executeSearch();
  }

  async function executeSearch() {
    const q = state.searchSubmitted;
    if (!q) return;
    state.searchLoading = true;
    renderSearchBody();
    try {
      if (!state.searchFilter) {
        state.searchSummary = await invoke("yt_search_summary", { query: q });
        state.searchPage = null;
      } else {
        state.searchPage = await invoke("yt_search", { query: q, filter: state.searchFilter });
        state.searchSummary = null;
      }
    } catch (err) {
      showError("Search didn't go through. Check your connection and try again.");
    }
    state.searchLoading = false;
    if (state.searchMode === "results") renderSearchBody();
  }

  function rememberSearch(q) {
    const rest = (state.settings.recentSearches || []).filter((x) => x.toLowerCase() !== q.toLowerCase());
    state.settings.recentSearches = [q, ...rest].slice(0, SEARCH_HISTORY_MAX);
    invoke("settings_update", { settings: state.settings }).catch(() => {});
  }

  function forgetSearch(q) {
    state.settings.recentSearches = (state.settings.recentSearches || []).filter((x) => x !== q);
    invoke("settings_update", { settings: state.settings }).catch(() => {});
  }

  function renderSearchBody() {
    const body = $("search-body");
    if (!body) return;
    if (moodObserver) moodObserver.disconnect();
    if (state.searchMode === "results") {
      body.innerHTML = searchResultsHtml();
      bindSearchResults(body);
    } else if (state.searchMode === "typing") {
      body.innerHTML = searchTypingHtml();
      bindSearchTyping(body);
    } else {
      body.innerHTML = searchBrowseHtml();
      bindSearchBrowse(body);
    }
  }

  // --- browse: youtube music's moods & genres as the phone's tinted tiles ---

  function searchBrowseHtml() {
    if (!state.moods) {
      loadMoods();
      return `<div class="search-loading"><span></span><span></span><span></span></div>`;
    }
    if (!state.moods.length) {
      return `<div class="a-empty">Moods and genres didn't load. Check your connection and open Search again.</div>`;
    }
    return state.moods
      .map(
        (sec) => `
        <section class="mood-section">
          ${sectionHeadHtml(sec.title, { ruleBelow: true })}
          <div class="mood-grid">${sec.items.map(moodTileHtml).join("")}</div>
        </section>`
      )
      .join("");
  }

  async function loadMoods() {
    if (state.moodsLoading) return;
    state.moodsLoading = true;
    try {
      state.moods = await invoke("yt_moods");
    } catch (_) {
      state.moods = [];
    }
    state.moodsLoading = false;
    if (state.searchMode === "browse") renderSearchBody();
  }

  function moodTileHtml(mood) {
    const tint = moodTint(mood.stripeColor);
    const from = mixRgb(MOOD_TILE_RGB, tint, 0.55);
    const to = mixRgb(MOOD_TILE_RGB, tint, 0.16);
    const key = moodKey(mood.browseId, mood.params);
    return `
      <button class="mood-tile" style="background:linear-gradient(135deg, rgb(${from}), rgb(${to}))"
        data-mood-key="${esc(key)}" data-mood-browse="${esc(mood.browseId)}" data-mood-params="${esc(mood.params || "")}" data-mood-title="${esc(mood.title)}">
        <span class="mood-covers">${moodCoversHtml(moodCovers.get(key))}</span>
        <span class="mood-title">${esc(mood.title)}</span>
      </button>`;
  }

  function moodCoversHtml(covers) {
    if (!covers?.length) return "";
    return [covers[1], covers[0]]
      .map((url, i) => (url ? `<img class="mood-cover ${i ? "front" : "back"}" src="${esc(proxyImg(sizedCover(url, 128)))}" alt="" />` : ""))
      .join("");
  }

  // the phone lifts youtube's stripe colour toward a soft middle grey, so every tile reads on black
  function moodTint(stripe) {
    const argb = Number(stripe) >>> 0;
    const rgb = [(argb >> 16) & 255, (argb >> 8) & 255, argb & 255];
    if (!rgb[0] && !rgb[1] && !rgb[2]) return [58, 58, 68];
    return rgb.map((c) => Math.max(40, Math.min(220, Math.round(c + (170 - c) * 0.45))));
  }

  function mixRgb(base, tint, amount) {
    return base.map((c, i) => Math.round(c + (tint[i] - c) * amount)).join(", ");
  }

  function moodKey(browseId, params) {
    return `${browseId}|${params || ""}`;
  }

  function bindSearchBrowse(body) {
    body.querySelectorAll("[data-mood-browse]").forEach((tile) => {
      tile.onclick = () =>
        pushRoute({
          type: "section",
          browseId: tile.dataset.moodBrowse,
          params: tile.dataset.moodParams || null,
          title: tile.dataset.moodTitle
        });
    });
    // each tile's two covers come from its own page, fetched only once the tile is on screen
    moodObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          moodObserver.unobserve(entry.target);
          queueMoodCovers(entry.target.dataset.moodKey);
        });
      },
      { root: $("tab-search"), rootMargin: "200px 0px" }
    );
    body.querySelectorAll("[data-mood-key]").forEach((tile) => {
      if (!moodCovers.has(tile.dataset.moodKey)) moodObserver.observe(tile);
    });
  }

  function queueMoodCovers(key) {
    if (moodCovers.has(key) || moodCoverQueue.includes(key)) return;
    moodCoverQueue.push(key);
    pumpMoodCovers();
  }

  // two at a time, so a screenful of tiles doesn't fire thirty requests at once
  async function pumpMoodCovers() {
    while (moodCoversLoading < 2 && moodCoverQueue.length) {
      const key = moodCoverQueue.shift();
      const [browseId, params] = key.split("|");
      moodCoversLoading++;
      invoke("yt_browse_section", { browseId, params: params || null })
        .then((items) => {
          const covers = (items || [])
            .map((it) => songThumb(it.data))
            .filter(Boolean)
            .slice(0, 2);
          moodCovers.set(key, covers);
          const holder = document.querySelector(`[data-mood-key="${CSS.escape(key)}"] .mood-covers`);
          if (holder) holder.innerHTML = moodCoversHtml(covers);
        })
        .catch(() => moodCovers.set(key, []))
        .finally(() => {
          moodCoversLoading--;
          pumpMoodCovers();
        });
    }
  }

  // --- typing: what you searched before, then youtube's suggestions ---

  function searchTypingHtml() {
    const q = state.searchQuery.trim().toLowerCase();
    const history = (state.settings.recentSearches || []).filter((h) => !q || h.toLowerCase().includes(q)).slice(0, q ? 4 : 12);
    const sugg = state.searchSuggest && state.searchSuggest.query === state.searchQuery.trim() ? state.searchSuggest : null;
    const parts = [];
    if (history.length) {
      parts.push(sectionHeadHtml("Recent searches", { ruleAbove: false, small: true }));
      parts.push(
        history
          .map(
            (h) => `
          <div class="a-simple-row" data-fill-search="${esc(h)}">
            <span class="a-simple-icon">${ICONS.clock}</span>
            <span class="a-simple-text">${esc(h)}</span>
            <button class="a-simple-trail" data-forget-search="${esc(h)}" title="Remove">${ICONS.close}</button>
          </div>`
          )
          .join("")
      );
    }
    if (sugg?.queries?.length) {
      parts.push(sectionHeadHtml("Suggestions", { ruleAbove: !!history.length, small: true }));
      parts.push(
        sugg.queries
          .map(
            (sq) => `
          <div class="a-simple-row" data-fill-search="${esc(sq)}">
            <span class="a-simple-icon">${ICONS.search}</span>
            <span class="a-simple-text">${esc(sq)}</span>
          </div>`
          )
          .join("")
      );
    }
    if (sugg?.items?.length) {
      let songIdx = 0;
      parts.push(sectionHeadHtml("Top results", { small: true }));
      parts.push(sugg.items.map((it) => searchItemRowHtml(it, it.kind === "song" ? songIdx++ : 0)).join(""));
    }
    if (!parts.length) {
      return q
        ? `<div class="search-loading"><span></span><span></span><span></span></div>`
        : `<div class="a-empty">Search for songs, artists, albums and playlists.</div>`;
    }
    return parts.join("");
  }

  // one result as a list row: songs as the usual song row, the rest with their kind under the title
  function searchItemRowHtml(item, idx) {
    const v = item.data;
    if (!v) return "";
    if (item.kind === "song") return renderSongRowHtml(v, { index: idx, listId: "searchSongs" });
    const target =
      item.kind === "album" ? `data-album-id="${esc(v.browseId)}"` : item.kind === "artist" ? `data-artist-id="${esc(v.id)}"` : `data-playlist-id="${esc(v.id)}"`;
    const thumb = songThumb(v);
    return `
      <div class="song-row" ${target}>
        <div class="song-row-art ${item.kind === "artist" ? "round" : ""}">
          ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 120)))}" loading="lazy" alt="" />` : ""}
        </div>
        <div class="song-row-meta">
          <div class="song-row-title-line"><span class="song-row-title">${esc(v.title)}</span></div>
          <div class="song-row-sub">${esc(itemDetail(item))}</div>
        </div>
      </div>`;
  }

  // "Album  •  by Someone  •  2021", the line the phone puts under a result
  function itemDetail(item) {
    const v = item.data;
    const by = (names) => (names ? `by ${names}` : null);
    const parts =
      item.kind === "song"
        ? [v.musicVideoType ? "Video" : "Song", by(artistNames(v)), v.duration ? formatTime(v.duration) : null]
        : item.kind === "album"
        ? ["Album", by((v.artists || []).map((a) => a.name).join(", ")), v.year]
        : item.kind === "artist"
        ? ["Artist"]
        : ["Playlist", by(v.author), v.songCountText];
    return parts.filter(Boolean).join("  •  ");
  }

  function bindSearchTyping(body) {
    body.querySelectorAll("[data-fill-search]").forEach((row) => {
      row.onclick = () => submitSearch(row.dataset.fillSearch);
    });
    body.querySelectorAll("[data-forget-search]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        forgetSearch(btn.dataset.forgetSearch);
        renderSearchBody();
      };
    });
    const songs = (state.searchSuggest?.items || []).filter((i) => i.kind === "song").map((i) => i.data);
    bindItemAndSongCards(body, { searchSongs: songs });
  }

  // --- results: category pills, the top result card, then each section ---

  function searchResultsHtml() {
    const pills = `
      <div class="cat-pills">
        ${SEARCH_FILTERS.map(
          (f) => `<button class="cat-pill ${state.searchFilter === f.value ? "selected" : ""}" data-sfilter="${esc(f.value ?? "")}">${esc(f.label)}</button>`
        ).join("")}
      </div>`;
    if (state.searchLoading) return `${pills}<div class="search-loading"><span></span><span></span><span></span></div>`;

    if (state.searchSummary) {
      const top = state.searchSummary.top;
      const sections = state.searchSummary.sections || [];
      return `
        ${pills}
        ${top ? `${sectionHeadHtml("Top result", { ruleAbove: false })}${topResultHtml(top)}` : ""}
        ${sections
          .map((sec) => {
            const songs = (sec.items || []).filter((i) => i.kind === "song");
            const others = (sec.items || []).filter((i) => i.kind !== "song");
            return `
              <section class="search-section">
                ${sectionHeadHtml(sec.title)}
                ${songs.map((it, idx) => renderSongRowHtml(it.data, { index: idx, listId: `sec-${esc(sec.title)}` })).join("")}
                ${others.length ? `<div class="shelf-scroller">${others.map((it) => renderItemCardHtml(it)).join("")}</div>` : ""}
              </section>`;
          })
          .join("")}
      `;
    }

    const items = state.searchPage?.items || [];
    if (!items.length) return `${pills}<div class="a-empty">Nothing found for "${esc(state.searchSubmitted)}".</div>`;
    const songs = items.filter((i) => i.kind === "song");
    const others = items.filter((i) => i.kind !== "song");
    return `
      ${pills}
      ${songs.map((it, idx) => renderSongRowHtml(it.data, { index: idx, listId: "searchPage" })).join("")}
      ${others.length ? `<div class="library-grid">${others.map((it) => renderItemCardHtml(it)).join("")}</div>` : ""}
    `;
  }

  // the phone's top result: the art over a soft wash of itself, with a big white play button
  function topResultHtml(item) {
    const v = item.data;
    if (!v) return "";
    const thumb = songThumb(v);
    const target =
      item.kind === "song"
        ? `data-song-json="${esc(JSON.stringify(v))}"`
        : item.kind === "album"
        ? `data-album-id="${esc(v.browseId)}"`
        : item.kind === "artist"
        ? `data-artist-id="${esc(v.id)}"`
        : `data-playlist-id="${esc(v.id)}"`;
    const playing = item.kind === "song" && state.currentSong?.id === v.id && state.isPlaying;
    return `
      <div class="top-result" ${target}>
        ${thumb ? `<img class="top-result-wash" src="${esc(proxyImg(sizedCover(thumb, 120)))}" alt="" />` : ""}
        <div class="top-result-shade"></div>
        <div class="top-result-body">
          <div class="top-result-art ${item.kind === "artist" ? "round" : ""}">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 320)))}" alt="" />` : ""}
          </div>
          <div class="top-result-row">
            <div class="top-result-text">
              <div class="top-result-title">${esc(v.title)}</div>
              <div class="top-result-detail">${esc(itemDetail(item))}</div>
            </div>
            ${item.kind === "artist" ? "" : `<span class="top-result-play">${playing ? ICONS.pause : ICONS.play}</span>`}
          </div>
        </div>
      </div>`;
  }

  function bindSearchResults(body) {
    body.querySelectorAll("[data-sfilter]").forEach((btn) => {
      btn.onclick = () => {
        state.searchFilter = btn.dataset.sfilter || null;
        executeSearch();
      };
    });
    const lists = {};
    (state.searchSummary?.sections || []).forEach((sec) => {
      lists[`sec-${esc(sec.title)}`] = (sec.items || []).filter((i) => i.kind === "song").map((i) => i.data);
    });
    lists.searchPage = (state.searchPage?.items || []).filter((i) => i.kind === "song").map((i) => i.data);
    bindItemAndSongCards(body, lists);
  }

  // --------------------------------------------------------------------------
  // Shared page pieces (the phone's title, pill field and section headers)
  // --------------------------------------------------------------------------
  function pageHeadHtml(title) {
    return `<div class="page-head"><h1 class="page-title">${esc(title)}</h1></div>`;
  }

  function pillFieldHtml(id, placeholder, value) {
    return `
      <div class="pill-field" id="${id}-field">
        <button class="pill-field-lead" id="${id}-lead" tabindex="-1">${ICONS.search}</button>
        <input id="${id}" type="text" placeholder="${esc(placeholder)}" value="${esc(value || "")}" autocomplete="off" spellcheck="false" />
        <button class="pill-field-clear hidden" id="${id}-clear" title="Clear">${ICONS.close}</button>
      </div>`;
  }

  // the leading icon turns into a back arrow while the field is in use, and the cross shows once there's text
  function setPillFieldState(id, active, hasText) {
    const lead = $(`${id}-lead`);
    if (lead && lead._active !== active) {
      lead._active = active;
      lead.innerHTML = active ? ICONS.arrowLeft : ICONS.search;
      lead.classList.toggle("is-back", active);
    }
    $(`${id}-clear`)?.classList.toggle("hidden", !hasText);
  }

  function bindPillField(id, { onInput, onFocus, onBlur, onSubmit, onBack, onClear }) {
    const input = $(id);
    if (!input) return;
    input.oninput = () => onInput?.(input.value);
    input.onfocus = () => onFocus?.();
    // a beat later, so a click on a row under the field lands before the page changes
    input.onblur = () => setTimeout(() => document.activeElement !== input && onBlur?.(), 150);
    input.onkeydown = (e) => {
      if (e.key === "Enter") onSubmit?.();
      else if (e.key === "Escape") {
        e.stopPropagation();
        onBack?.();
      }
    };
    const lead = $(`${id}-lead`);
    if (lead) lead.onclick = () => (lead._active ? onBack?.() : input.focus());
    const clear = $(`${id}-clear`);
    if (clear) {
      clear.onclick = () => {
        input.value = "";
        onClear?.();
        input.focus();
      };
    }
  }

  function sectionHeadHtml(title, { ruleAbove = true, ruleBelow = false, small = false } = {}) {
    return `
      <div class="a-section-head ${ruleAbove ? "rule-above" : ""} ${ruleBelow ? "rule-below" : ""} ${small ? "small" : ""}">
        <h2>${esc(title)}</h2>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // Library Tab (the phone's: title and search, a grey tab track, then pinned, counts and liked)
  // --------------------------------------------------------------------------
  const LIBRARY_TABS = [
    ["all", "All"],
    ["songs", "Songs"],
    ["playlists", "Playlists"],
    ["albums", "Albums"],
    ["artists", "Artists"]
  ];
  const LIBRARY_PINNED_MAX = 9;

  function renderLibraryTab() {
    const container = $("tab-library");
    if (!container) return;
    loadLibraryPlaylistSongs();
    // the header stays once it's drawn, so a library change while you type in its search keeps your place
    if ($("library-body")) return renderLibraryBody();
    container.innerHTML = `
      <div class="library-page-wrap">
        ${pageHeadHtml("Library")}
        ${pillFieldHtml("library-input", "Search your library", state.libraryQuery)}
        <div class="seg-track" id="library-tabs">
          ${LIBRARY_TABS.map(([k, label]) => `<button class="seg-chip ${state.libraryTab === k ? "selected" : ""}" data-lib-tab="${k}">${label}</button>`).join("")}
        </div>
        <div id="library-body" class="library-body"></div>
      </div>
    `;
    bindPillField("library-input", {
      onInput: (value) => {
        state.libraryQuery = value;
        setPillFieldState("library-input", !!value, !!value);
        renderLibraryBody();
      },
      onBack: () => clearLibrarySearch(),
      onClear: () => clearLibrarySearch()
    });
    setPillFieldState("library-input", !!state.libraryQuery, !!state.libraryQuery);
    container.querySelectorAll("[data-lib-tab]").forEach((btn) => {
      btn.onclick = () => showLibraryTab(btn.dataset.libTab);
    });
    renderLibraryBody();
  }

  function showLibraryTab(tab) {
    state.libraryTab = tab;
    $("library-tabs")?.querySelectorAll("[data-lib-tab]").forEach((b) => b.classList.toggle("selected", b.dataset.libTab === tab));
    renderLibraryBody();
  }

  function clearLibrarySearch() {
    state.libraryQuery = "";
    const input = $("library-input");
    if (input) input.value = "";
    setPillFieldState("library-input", false, false);
    renderLibraryBody();
  }

  function renderLibraryBody() {
    const body = $("library-body");
    if (!body) return;
    const q = state.libraryQuery.trim().toLowerCase();
    const tab = state.libraryTab;
    body.innerHTML = q
      ? librarySearchHtml(q)
      : tab === "songs"
      ? librarySongsHtml(librarySongs())
      : tab === "playlists"
      ? libraryPlaylistsHtml()
      : tab === "albums"
      ? libraryGridHtml(libraryAlbums(), "No albums yet. Like a song and its album shows up here.")
      : tab === "artists"
      ? libraryGridHtml(libraryArtists(), "No artists yet. Like a song and its artists show up here.")
      : libraryAllHtml();
    bindLibraryBody(body);
  }

  // --- what's in the library: liked songs plus every song saved in a playlist ---

  // playlists only keep song ids, so their songs are fetched once per change and kept beside the liked ones
  async function loadLibraryPlaylistSongs() {
    const liked = new Set(state.library.likedIds || []);
    const ids = [...new Set((state.library.playlists || []).flatMap((pl) => pl.songIds || []))].filter((id) => !liked.has(id));
    const key = ids.join(",");
    if (state.libraryExtraKey === key) return;
    state.libraryExtraKey = key;
    if (!ids.length) {
      state.libraryExtraSongs = [];
      return;
    }
    try {
      const songs = await invoke("lib_songs_by_ids", { ids });
      if (state.libraryExtraKey !== key) return;
      state.libraryExtraSongs = songs || [];
      if (state.tab === "library" && !state.routeStack.length) renderLibraryBody();
    } catch (_) {}
  }

  function librarySongs() {
    const seen = new Set();
    return [...(state.library.likedSongs || []), ...(state.libraryExtraSongs || [])].filter((s) => s && !seen.has(s.id) && seen.add(s.id));
  }

  function libraryAlbums() {
    const byId = new Map();
    librarySongs().forEach((s) => {
      if (!s.album?.id || byId.has(s.album.id)) return;
      byId.set(s.album.id, { kind: "album", data: { browseId: s.album.id, title: s.album.name, artists: s.artists || [], thumbnail: songThumb(s) } });
    });
    return [...byId.values()];
  }

  function libraryArtists() {
    const byId = new Map();
    librarySongs().forEach((s) =>
      (s.artists || []).forEach((a) => {
        if (a.id && !byId.has(a.id)) byId.set(a.id, { kind: "artist", data: { id: a.id, title: a.name, thumbnail: null } });
      })
    );
    return [...byId.values()];
  }

  // --- All: pinned tiles, the four count cards, then liked ---

  function libraryAllHtml() {
    const songs = librarySongs();
    const playlists = state.library.playlists || [];
    const albums = libraryAlbums();
    const artists = libraryArtists();
    const liked = state.library.likedSongs || [];
    if (!songs.length && !playlists.length) {
      return `<div class="a-empty">Your library is empty. Like songs or make a playlist and they show up here.</div>`;
    }

    const pinned = playlists.filter((pl) => pl.isPinned).slice(0, LIBRARY_PINNED_MAX);
    const pinnedHtml = pinned.length
      ? `
        <h2 class="lib-section-title">Pinned</h2>
        <div class="lib-rule"></div>
        <div class="lib-pinned-grid">
          ${pinned
            .map(
              (pl) => `
            <button class="lib-pinned-tile" data-local-pl-card="${esc(pl.id)}" title="${esc(pl.name)}">
              ${pl.covers?.[0] ? `<img src="${esc(proxyImg(sizedCover(pl.covers[0], 300)))}" alt="" />` : ICONS.music}
            </button>`
            )
            .join("")}
        </div>
        <div class="lib-rule"></div>`
      : "";

    const cards = [
      ["songs", "Songs", songs.length, songs.slice(0, 2).map(songThumb), false],
      ["playlists", "Playlists", playlists.length, playlists.flatMap((pl) => pl.covers || []).slice(0, 2), false],
      ["albums", "Albums", albums.length, albums.slice(0, 2).map((a) => a.data.thumbnail), false],
      ["artists", "Artists", artists.length, [], true]
    ];
    return `
      ${pinnedHtml}
      <div class="lib-card-grid">
        ${cards
          .map(
            ([tab, title, count, covers, round]) => `
          <button class="lib-card" data-lib-jump="${tab}">
            <span class="lib-card-text">
              <span class="lib-card-label">${title}</span>
              <span class="lib-card-count">${count}</span>
            </span>
            ${coverStackHtml(covers, round)}
          </button>`
          )
          .join("")}
      </div>
      ${
        liked.length
          ? `
        <button class="lib-wide-card" data-lib-route="liked">
          <span class="lib-card-text">
            <span class="lib-card-label">Liked</span>
            <span class="lib-card-count">${liked.length}</span>
          </span>
          ${coverStackHtml(liked.slice(0, 1).map(songThumb), false, `<span class="lib-liked-art">${ICONS.heartFilled}</span>`)}
        </button>`
          : ""
      }
    `;
  }

  // two real covers fanned into the card's corner, the back one dimmed and turned the other way
  function coverStackHtml(covers, round, front = "") {
    const shown = covers.filter(Boolean);
    if (!shown.length && !front) return "";
    const back = front ? shown[0] : shown[1];
    const tile = (url, cls) =>
      url ? `<span class="lib-stack-tile ${cls} ${round ? "round" : ""}"><img src="${esc(proxyImg(sizedCover(url, 160)))}" alt="" /></span>` : "";
    return `
      <span class="lib-stack">
        ${tile(back, "back")}
        ${front ? `<span class="lib-stack-tile front">${front}</span>` : tile(shown[0], "front")}
      </span>`;
  }

  // --- the other tabs ---

  function librarySongsHtml(songs) {
    if (!songs.length) return `<div class="a-empty">No songs yet. Like a song or add it to a playlist.</div>`;
    return `<div class="lib-list">${songs.map((s, idx) => renderSongRowHtml(s, { index: idx, listId: "librarySongs" })).join("")}</div>`;
  }

  function libraryPlaylistsHtml() {
    const playlists = state.library.playlists || [];
    return `
      <div class="library-grid">
        <button class="cover-card lib-new-card" id="lib-new-pl-btn">
          <div class="cover-card-art"><span class="lib-new-plus">${ICONS.plus}</span></div>
          <div class="cover-card-title">New playlist</div>
        </button>
        ${playlists.map((pl) => renderLocalPlaylistCardHtml(pl)).join("")}
      </div>`;
  }

  function libraryGridHtml(items, emptyText) {
    if (!items.length) return `<div class="a-empty">${esc(emptyText)}</div>`;
    return `<div class="library-grid">${items.map((it) => renderItemCardHtml(it)).join("")}</div>`;
  }

  function librarySearchSongs(q) {
    const has = (text) => (text || "").toLowerCase().includes(q);
    return librarySongs().filter((s) => has(s.title) || has(artistNames(s)) || has(s.album?.name));
  }

  function librarySearchHtml(q) {
    const has = (text) => (text || "").toLowerCase().includes(q);
    const songs = librarySearchSongs(q);
    const playlists = (state.library.playlists || []).filter((pl) => has(pl.name));
    const albums = libraryAlbums().filter((a) => has(a.data.title));
    const artists = libraryArtists().filter((a) => has(a.data.title));
    if (!songs.length && !playlists.length && !albums.length && !artists.length) {
      return `<div class="a-empty">Nothing in your library matches "${esc(state.libraryQuery.trim())}".</div>`;
    }
    return `
      ${songs.length ? `${sectionHeadHtml("Songs", { ruleAbove: false, small: true })}<div class="lib-list">${songs.map((s, idx) => renderSongRowHtml(s, { index: idx, listId: "librarySearch" })).join("")}</div>` : ""}
      ${playlists.length ? `${sectionHeadHtml("Playlists", { small: true })}<div class="library-grid">${playlists.map((pl) => renderLocalPlaylistCardHtml(pl)).join("")}</div>` : ""}
      ${albums.length ? `${sectionHeadHtml("Albums", { small: true })}<div class="library-grid">${albums.map((it) => renderItemCardHtml(it)).join("")}</div>` : ""}
      ${artists.length ? `${sectionHeadHtml("Artists", { small: true })}<div class="library-grid">${artists.map((it) => renderItemCardHtml(it)).join("")}</div>` : ""}
    `;
  }

  function bindLibraryBody(body) {
    body.querySelectorAll("[data-lib-jump]").forEach((card) => {
      card.onclick = () => showLibraryTab(card.dataset.libJump);
    });
    body.querySelectorAll("[data-lib-route]").forEach((card) => {
      card.onclick = () => pushRoute({ type: card.dataset.libRoute });
    });
    body.querySelectorAll("[data-local-pl-card]").forEach((card) => {
      const pid = card.dataset.localPlCard;
      card.onclick = () => pushRoute({ type: "localPlaylist", id: pid });
      card.oncontextmenu = (e) => {
        e.preventDefault();
        const pl = (state.library.playlists || []).find((p) => p.id === pid);
        if (pl) openLocalPlaylistContextMenu(e.clientX, e.clientY, pl);
      };
    });
    const newBtn = $("lib-new-pl-btn");
    if (newBtn) newBtn.onclick = () => promptNewPlaylist();
    const q = state.libraryQuery.trim().toLowerCase();
    bindItemAndSongCards(body, { librarySongs: librarySongs(), librarySearch: q ? librarySearchSongs(q) : [] });
  }

  function renderLocalPlaylistCardHtml(pl) {
    const thumbs = (pl.covers || []).slice(0, 4);
    let artInner = "";
    if (thumbs.length >= 4) {
      artInner = `<div class="collage-2x2">${thumbs.map((u) => `<img src="${esc(proxyImg(u))}" alt=""/>`).join("")}</div>`;
    } else if (thumbs.length > 0) {
      artInner = `<img src="${esc(proxyImg(thumbs[0]))}" alt=""/>`;
    }
    return `
      <div class="cover-card" data-local-pl-card="${esc(pl.id)}">
        <div class="cover-card-art">${artInner}</div>
        <div class="cover-card-title">${esc(pl.name)}</div>
        <div class="cover-card-sub">${(pl.songIds || []).length} songs</div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Detail Route Views (Album, Artist, Playlist, LocalPlaylist, Liked, Section, Recap)
  // --------------------------------------------------------------------------
  async function renderRouteView(route) {
    const container = $("route-container");
    // the css shows playlist pages bare, so it needs to know which kind of page this is
    container.dataset.route = route.type;
    container.innerHTML = `<div style="padding:84px var(--gutter);"><div class="skeleton" style="width:100%;height:200px;"></div></div>`;

    try {
      if (route.type === "liked") {
        const songs = state.library.likedSongs || [];
        renderSongCollectionDetail(container, {
          kicker: "PLAYLIST",
          title: "Liked Songs",
          subtitle: `${songs.length} songs`,
          coverUrl: songThumb(songs[0]),
          songs
        });
      } else if (route.type === "localPlaylist") {
        const pl = (state.library.playlists || []).find((p) => p.id === route.id);
        if (!pl) return popRoute();
        const songs = await invoke("lib_songs_by_ids", { ids: pl.songIds || [] });
        renderSongCollectionDetail(container, {
          kicker: "LOCAL PLAYLIST",
          title: pl.name,
          subtitle: `${songs.length} songs`,
          coverUrl: pl.covers?.[0] || songThumb(songs[0]),
          songs
        });
      } else if (route.type === "album") {
        const page = await invoke("yt_album", { browseId: route.id });
        renderSongCollectionDetail(container, {
          kicker: "ALBUM",
          title: page.album.title,
          subtitle: `${(page.album.artists || []).map((a) => a.name).join(", ")}${page.album.year ? ` · ${page.album.year}` : ""}`,
          coverUrl: songThumb(page.album),
          songs: page.songs,
          showTrackNumbers: true,
          otherVersions: page.otherVersions
        });
      } else if (route.type === "playlist") {
        const page = await invoke("yt_playlist", { playlistId: route.id });
        renderSongCollectionDetail(container, {
          kicker: "PLAYLIST",
          title: page.playlist.title,
          subtitle: page.playlist.author || `${page.songs.length} songs`,
          coverUrl: songThumb(page.playlist),
          songs: page.songs
        });
      } else if (route.type === "artist") {
        const page = await invoke("yt_artist", { browseId: route.id });
        renderArtistDetail(container, page);
      } else if (route.type === "section") {
        const items = await invoke("yt_browse_section", {
          browseId: route.browseId,
          params: route.params || null
        });
        container.innerHTML = `
          <div style="padding:90px var(--gutter) 36px;">
            <h1 class="detail-title" style="margin-bottom:20px;">${esc(route.title || "Browse")}</h1>
            <div class="library-grid">${(items || []).map((it) => renderItemCardHtml(it)).join("")}</div>
          </div>
        `;
        bindItemAndSongCards(container);
      } else if (route.type === "recap") {
        renderRecapDetail(container);
      }
    } catch (err) {
      showError(`Failed to load page: ${err}`);
    }
  }

  function renderSongCollectionDetail(container, cfg) {
    const songs = cfg.songs || [];
    container.innerHTML = `
      <div class="detail-header">
        <div class="detail-header-backdrop" style="background-image:url('${esc(proxyImg(cfg.coverUrl || ""))}')"></div>
        <div class="detail-cover">
          ${cfg.coverUrl ? `<img src="${esc(proxyImg(sizedCover(cfg.coverUrl, 600)))}" alt="" />` : ""}
        </div>
        <div class="detail-info">
          <span class="detail-type">${esc(cfg.kicker)}</span>
          <h1 class="detail-title">${esc(cfg.title)}</h1>
          <div class="detail-sub">${esc(cfg.subtitle)}</div>
          <div class="hero-buttons" style="margin-top:10px;">
            <button class="pill-action-btn primary" id="detail-play-all">${ICONS.play} <span>Play</span></button>
            <button class="pill-action-btn secondary" id="detail-shuffle-all">${ICONS.shuffle} <span>Shuffle</span></button>
            ${cfg.extraActionHtml || ""}
          </div>
        </div>
      </div>
      <div class="detail-body">
        ${songs
          .map((s, idx) =>
            renderSongRowHtml(s, {
              index: idx,
              listId: "detailSongs",
              showTrackNumber: cfg.showTrackNumbers
            })
          )
          .join("")}
        ${
          cfg.otherVersions?.length
            ? `
          <div style="margin-top:28px;">
            <h3 class="section-title" style="margin-bottom:12px;">Other Versions</h3>
            <div class="shelf-scroller">
              ${cfg.otherVersions.map((it) => renderItemCardHtml(it)).join("")}
            </div>
          </div>`
            : ""
        }
      </div>
    `;

    const playBtn = $("detail-play-all");
    if (playBtn && songs.length) playBtn.onclick = () => playSong(songs[0], songs, 0);

    const shufBtn = $("detail-shuffle-all");
    if (shufBtn && songs.length) {
      shufBtn.onclick = () => {
        state.shuffleEnabled = true;
        const idx = Math.floor(Math.random() * songs.length);
        playSong(songs[idx], songs, idx);
      };
    }

    bindItemAndSongCards(container, { detailSongs: songs });
  }

  function renderArtistDetail(container, page) {
    const thumb = page.banner || songThumb(page.artist);
    const lists = {};
    container.innerHTML = `
      <div class="detail-header">
        <div class="detail-header-backdrop" style="background-image:url('${esc(proxyImg(thumb || ""))}')"></div>
        <div class="detail-cover circle">
          ${songThumb(page.artist) ? `<img src="${esc(proxyImg(sizedCover(songThumb(page.artist), 600)))}" alt="" />` : ""}
        </div>
        <div class="detail-info">
          <span class="detail-type">ARTIST</span>
          <h1 class="detail-title">${esc(page.artist.title)}</h1>
          <div class="detail-sub">${esc(page.subscribers || page.monthlyListeners || "")}</div>
          ${
            page.description
              ? `<div style="font-size:12px;color:var(--text-secondary);max-width:620px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(page.description)}</div>`
              : ""
          }
        </div>
      </div>
      <div class="shelves-body">
        ${(page.sections || []).map((sec, idx) => window.MochyShelves.feedSectionHtml(sec, `artist-${idx}`, lists)).join("")}
      </div>
    `;
    container.querySelectorAll(".reveal-section").forEach((s) => s.classList.add("revealed"));
    bindShelves(container, lists);
  }

  function renderRecapDetail(container) {
    const recap = state.library.recap || {
      monthLabel: "THIS MONTH",
      plays: 0,
      minutes: 0,
      topSongs: [],
      topArtists: []
    };

    container.innerHTML = `
      <div style="padding:90px var(--gutter) 36px;">
        <span class="detail-type">${esc(recap.monthLabel)}</span>
        <h1 class="detail-title" style="margin:4px 0 18px;">Your Listening Recap</h1>
        <div style="display:flex;gap:16px;margin-bottom:26px;flex-wrap:wrap;">
          <div style="background:var(--surface);padding:16px 22px;border-radius:12px;">
            <div style="font-size:24px;font-weight:800;">${recap.plays}</div>
            <div style="font-size:12px;color:var(--text-secondary);">Total Plays</div>
          </div>
          <div style="background:var(--surface);padding:16px 22px;border-radius:12px;">
            <div style="font-size:24px;font-weight:800;">${recap.minutes}</div>
            <div style="font-size:12px;color:var(--text-secondary);">Minutes Listened</div>
          </div>
        </div>
        <h3 class="section-title" style="margin-bottom:10px;">Top Tracks</h3>
        ${
          recap.topSongs?.length
            ? recap.topSongs.map((entry, i) => renderSongRowHtml(entry.song, { index: i, showTrackNumber: true })).join("")
            : `<div style="color:var(--text-tertiary);">Play some songs to build your listening recap!</div>`
        }
      </div>
    `;

    bindItemAndSongCards(container);
  }

  // --------------------------------------------------------------------------
  // Slider Drag & Player Surface Sync
  // --------------------------------------------------------------------------
  function bindSliderDrag(trackEl, onValue) {
    if (!trackEl) return;
    const calc = (clientX) => {
      const rect = trackEl.getBoundingClientRect();
      return clamp01((clientX - rect.left) / Math.max(1, rect.width));
    };
    trackEl.onpointerdown = (e) => {
      e.preventDefault();
      onValue(calc(e.clientX));
      const move = (ev) => onValue(calc(ev.clientX));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
  }

  function updateSeekBarsOnly() {
    const frac = state.duration > 0 ? clamp01(state.currentTime / state.duration) : 0;
    const topFill = $("top-seek-fill");
    if (topFill) topFill.style.transform = `scaleX(${frac.toFixed(4)})`;

    const fpFill = $("fp-seek-fill");
    if (fpFill) fpFill.style.width = `${(frac * 100).toFixed(2)}%`;
    const fpCur = $("fp-time-cur");
    if (fpCur) fpCur.textContent = formatTime(state.currentTime);
    const fpDur = $("fp-time-dur");
    if (fpDur) fpDur.textContent = formatTime(state.duration);
  }

  function renderPlayerStateChange() {
    window.MochyRemote?.reportPlayer();
    renderTopBar();
    updateSettledHeroTextAndState();
    if (state.rightPaneOpen && state.rightPaneTab === "queue") {
      renderRightPane();
    }
    if (state.showFullPlayer) patchFullPlayerPlayState();
  }

  function renderAllPlayerSurfaces() {
    window.MochyRemote?.reportPlayer();
    renderTopBar();
    if (state.rightPaneOpen) renderRightPane();
    if (state.showFullPlayer) renderFullPlayer();
  }

  // --------------------------------------------------------------------------
  // Synced Lyrics HTML & Full Player View
  // --------------------------------------------------------------------------
  function buildSyncedLyricsBodyHtml(fullSize = false) {
    if (!state.currentSong) {
      return `<div style="padding:48px 20px;color:var(--text-tertiary);text-align:center;">Play a song to view synced lyrics.</div>`;
    }
    if (state.lyricsLoading) {
      return `<div style="padding:48px 20px;color:var(--text-tertiary);text-align:center;">Loading synced lyrics...</div>`;
    }
    const lyr = state.currentLyrics;
    if (!lyr || !lyr.lines || !lyr.lines.length) {
      return `
        <div class="lyrics-empty">
          <span>No lyrics found for this song.</span>
          ${lyricsSwitchButtonHtml("Try another source")}
        </div>`;
    }

    return `
      <div class="synced-lyrics-scroll">
        ${lyr.lines
          .map((line, idx) => {
            const alignClass = line.isOppositeVoice ? "align-right" : line.isGroupVoice ? "align-center" : "";
            const wordsHtml =
              line.words && line.words.length
                ? `<div class="lyric-words-wrap">${line.words
                    .map((w) => `<span class="lyric-word unsung">${esc(w.text)}${w.spaceAfter ? " " : ""}</span>`)
                    .join("")}</div>`
                : `<div>${esc(line.text)}</div>`;

            return `
              <div class="lyric-line ${fullSize ? "full-size" : ""} ${alignClass}" data-lyric-seek="${line.time}" data-lyric-idx="${idx}">
                ${wordsHtml}
                ${line.subLine ? `<div class="lyric-translation">${esc(line.subLine)}</div>` : ""}
                ${line.backing?.text ? `<div class="lyric-bg-vocal">(${esc(line.backing.text)})</div>` : ""}
              </div>
            `;
          })
          .join("")}
        ${lyricsSourceFooterHtml(lyr)}
      </div>
    `;
  }

  // where the lyrics came from, after the last line, like the phone's lyrics page
  function lyricsSourceFooterHtml(lyr) {
    const name = (lyr.providerName || "").trim();
    if (!name || name === "Unknown") return "";
    return `
      <div class="lyrics-source-footer">
        <span class="lyrics-source-text"><b>Source</b> ${esc(name)}</span>
        ${lyricsSwitchButtonHtml("Switch")}
      </div>`;
  }

  function lyricsSwitchButtonHtml(label) {
    return `<button class="lyrics-switch-btn" data-lyrics-switch>${ICONS.swap}<span>${esc(label)}</span></button>`;
  }

  function bindLyricsSeekEvents(root) {
    root.querySelectorAll("[data-lyrics-switch]").forEach((btn) => {
      btn.onclick = (e) => openLyricsPickerPopover(e.currentTarget.getBoundingClientRect());
    });
    root.querySelectorAll("[data-lyric-seek]").forEach((el) => {
      el.onclick = () => {
        const t = parseFloat(el.dataset.lyricSeek || "0");
        if (isFinite(t)) {
          audio.currentTime = t;
          state.currentTime = t;
          if (audio.paused) audio.play().catch(() => {});
        }
      };
    });
  }

  // while the player grows out of the pill the shader rests, so the gpu only does the motion
  let fpMotionLive = false;
  let fpMotion = [];

  function reducedMotion() {
    return !!document.querySelector(".app-root.no-anim") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // where the player grows from: the pill on the top bar, or a pill-sized spot where it would be
  function pillRect() {
    const r = document.querySelector(".top-player-pill")?.getBoundingClientRect();
    if (r && r.width > 0) return r;
    const w = Math.min(520, window.innerWidth - 48);
    const left = (window.innerWidth - w) / 2;
    return { left, top: 14, width: w, height: 46, right: left + w, bottom: 60 };
  }

  function stopFullPlayerMotion() {
    fpMotion.forEach((a) => a.cancel());
    fpMotion = [];
    fpMotionLive = false;
  }

  // the pill's cover grows into the big one; the cover's transform is measured, never guessed
  function coverFlip(fp, opening, ms, easing) {
    const deck = fp.querySelector(".fp-cover-deck");
    const art = document.querySelector(".top-np-art");
    if (!deck || !art || !deck.offsetWidth) return null;
    const a = art.getBoundingClientRect();
    const end = deck.getBoundingClientRect();
    const rest = getComputedStyle(deck);
    const scale = a.width / deck.offsetWidth;
    const small = `translate(${a.left + a.width / 2 - (end.left + end.width / 2)}px, ${a.top + a.height / 2 - (end.top + end.height / 2)}px) scale(${scale})`;
    const big = rest.transform === "none" ? "none" : rest.transform;
    const frames = [
      { transform: small, borderRadius: `${9 / scale}px` },
      { transform: big, borderRadius: rest.borderRadius }
    ];
    return deck.animate(opening ? frames : frames.slice().reverse(), { duration: ms, easing, fill: opening ? "backwards" : "forwards" });
  }

  // the whole player is clipped to the pill's box and opens out to the window, like the phone's mini player does
  function playFullPlayerMotion(opening, done) {
    const fp = $("full-player");
    stopFullPlayerMotion();
    if (reducedMotion()) {
      done?.();
      return;
    }
    const pill = pillRect();
    const closed = `inset(${pill.top}px ${window.innerWidth - pill.right}px ${window.innerHeight - pill.bottom}px ${pill.left}px round ${pill.height / 2}px)`;
    const open = "inset(0px 0px 0px 0px round 0px)";
    const ms = opening ? 600 : 360;
    const easing = opening ? IOS_EASE : "cubic-bezier(0.4, 0, 0.2, 1)";
    const fill = opening ? "backwards" : "forwards";
    const run = (el, frames, opts) => {
      if (!el) return null;
      const list = opening ? frames : frames.slice().reverse();
      return el.animate(list, { fill, easing, ...opts });
    };

    fpMotionLive = true;
    const main = run(fp, [{ clipPath: closed }, { clipPath: open }], { duration: ms });
    const parts = [main, coverFlip(fp, opening, ms, easing)];

    // the rest fades in a beat behind the growing box (and out ahead of it)
    const rise = [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }];
    const lift = opening ? { duration: 460, easing: IOS_EASE } : { duration: 160, easing: "ease-in" };
    parts.push(run(fp.querySelector("#ambient-canvas"), [{ opacity: 0 }, { opacity: 1 }], { duration: opening ? 480 : 200, delay: opening ? 60 : 0 }));
    parts.push(run(fp.querySelector(".full-player-topbar"), rise, { ...lift, delay: opening ? 180 : 0 }));
    const items = fp.querySelectorAll(".fp-left-column > :not(.fp-cover-deck), .fp-right-column");
    items.forEach((el, i) => parts.push(run(el, rise, { ...lift, delay: opening ? 150 + i * 45 : 0 })));

    fpMotion = parts.filter(Boolean);
    main.onfinish = () => {
      fpMotionLive = false;
      if (opening) {
        stopFullPlayerMotion();
        ambientInst?.render(performance.now(), true);
      }
      done?.();
    };
  }

  function closeFullPlayerNow() {
    const fp = $("full-player");
    stopFullPlayerMotion();
    fp.classList.add("hidden");
    fp.innerHTML = "";
    if (ambientInst) {
      ambientInst.dispose();
      ambientInst = null;
    }
  }

  function toggleFullPlayer() {
    const fp = $("full-player");
    state.showFullPlayer = !state.showFullPlayer;
    if (state.showFullPlayer) {
      clearTimeout(heroAutoTimer);
      stopFullPlayerMotion();
      fp.classList.remove("hidden");
      renderFullPlayer();
      playFullPlayerMotion(true);
    } else {
      playFullPlayerMotion(false, closeFullPlayerNow);
      scheduleHeroAutoAdvance();
    }
  }

  // play and pause only change a glyph and the cover's size, so the player doesn't need to be built again
  function patchFullPlayerPlayState() {
    const fp = $("full-player");
    fp.querySelector(".fp-cover-deck")?.classList.toggle("paused", !state.isPlaying);
    const playBtn = $("fp-play-btn");
    if (playBtn && window.MochyTransport) {
      playBtn.replaceChildren(window.MochyTransport.playGlyph("fp-play", state.isPlaying, ICONS.play, ICONS.pause));
    }
  }

  function renderFullPlayer() {
    const fp = $("full-player");
    if (!state.showFullPlayer) return;

    const song = state.currentSong;
    const thumb = songThumb(song);
    const liked = song ? isLiked(song.id) : false;
    const pct = state.duration > 0 ? Math.min(100, (state.currentTime / state.duration) * 100) : 0;
    const repeatIcon = state.repeatMode === "one" ? ICONS.repeatOne : ICONS.repeat;

    // a rebuild keeps the same canvas, since a new one would open a new gpu context every time
    const keptCanvas = ambientInst ? fp.querySelector("#ambient-canvas") : null;
    keptCanvas?.remove();

    fp.innerHTML = `
      <canvas id="ambient-canvas"></canvas>
      <div class="full-player-topbar">
        <button class="icon-btn ${state.fullPlayerMode === "lyrics" ? "active" : ""}" id="fp-mode-lyrics" title="Lyrics">${ICONS.lyrics}</button>
        <button class="icon-btn ${state.fullPlayerMode === "queue" ? "active" : ""}" id="fp-mode-queue" title="Queue">${ICONS.queue}</button>
        <button class="icon-btn" id="fp-close-btn" title="Close (Esc)">${ICONS.close}</button>
      </div>

      <div class="full-player-body">
        <div class="fp-left-column">
          <div class="fp-cover-deck ${state.isPlaying ? "" : "paused"}">
            ${thumb ? `<img src="${esc(proxyImg(sizedCover(thumb, 900)))}" alt="" />` : ""}
          </div>
          <div class="fp-song-info">
            <div style="min-width:0;flex:1;">
              <div class="fp-song-title">${esc(song?.title || "Not Playing")}</div>
              <div class="fp-song-artist">${esc(song ? artistNames(song) : "")}</div>
            </div>
            ${
              song
                ? `<button class="icon-btn" id="fp-like-btn" style="color:${liked ? "#fff" : "var(--text-secondary)"}">${liked ? ICONS.heartFilled : ICONS.heart}</button>`
                : ""
            }
          </div>

          <div class="fp-controls-stack">
            <div class="seek-row">
              <span class="seek-time" id="fp-time-cur">${formatTime(state.currentTime)}</span>
              <div class="slider-track" id="fp-seek-track">
                <div class="slider-rail">
                  <div class="slider-fill" id="fp-seek-fill" style="width:${pct.toFixed(2)}%"></div>
                </div>
              </div>
              <span class="seek-time right" id="fp-time-dur">${formatTime(state.duration)}</span>
            </div>

            <div class="fp-transport">
              <button class="icon-btn ${state.shuffleEnabled ? "active" : ""}" id="fp-shuffle-btn">${ICONS.shuffle}</button>
              <button class="icon-btn" id="fp-prev-btn"></button>
              <button class="play-circle-btn" id="fp-play-btn"></button>
              <button class="icon-btn" id="fp-next-btn"></button>
              <button class="icon-btn ${state.repeatMode !== "off" ? "active" : ""}" id="fp-repeat-btn">${repeatIcon}</button>
            </div>

            <div class="seek-row">
              <button class="icon-btn" id="fp-mute-btn">${state.isMuted ? ICONS.mute : ICONS.volume}</button>
              <div class="slider-track" id="fp-vol-track">
                <div class="slider-rail">
                  <div class="slider-fill" style="width:${((state.isMuted ? 0 : state.volume) * 100).toFixed(0)}%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="fp-right-column">
          ${
            state.fullPlayerMode === "queue"
              ? `<div style="flex:1;overflow-y:auto;">
                   <h3 style="margin-bottom:10px;">Up Next</h3>
                   ${state.queue.map((s, idx) => renderSongRowHtml(s, { index: idx, listId: "fpQueue" })).join("")}
                 </div>`
              : buildSyncedLyricsBodyHtml(true)
          }
        </div>
      </div>
    `;

    if (keptCanvas) $("ambient-canvas").replaceWith(keptCanvas);
    else initAmbient($("ambient-canvas"));

    $("fp-close-btn").onclick = () => toggleFullPlayer();
    $("fp-mode-lyrics").onclick = () => {
      state.fullPlayerMode = "lyrics";
      renderFullPlayer();
    };
    $("fp-mode-queue").onclick = () => {
      state.fullPlayerMode = "queue";
      renderFullPlayer();
    };
    mountTransport("fp", $("fp-prev-btn"), $("fp-play-btn"), $("fp-next-btn"));
    $("fp-shuffle-btn").onclick = () => {
      applyShuffleState(!state.shuffleEnabled, true);
      renderAllPlayerSurfaces();
    };
    $("fp-repeat-btn").onclick = () => {
      state.repeatMode = state.repeatMode === "off" ? "all" : state.repeatMode === "all" ? "one" : "off";
      renderAllPlayerSurfaces();
    };
    $("fp-mute-btn").onclick = () => toggleMute();

    const fpLike = $("fp-like-btn");
    if (fpLike && song) {
      fpLike.onclick = async () => {
        state.library = await invoke("lib_toggle_like", { song });
        renderSidebar();
        renderAllPlayerSurfaces();
      };
    }

    bindSliderDrag($("fp-seek-track"), (frac) => seekToFraction(frac));
    bindSliderDrag($("fp-vol-track"), (frac) => setVolume(frac));
    bindLyricsSeekEvents(fp);
    bindItemAndSongCards(fp, { fpQueue: state.queue });
  }

  // --------------------------------------------------------------------------
  // Popovers, Profile Menu, Context Menus & Modals
  // --------------------------------------------------------------------------
  function closeAllOverlays() {
    $("popover-layer").classList.add("hidden");
    $("context-menu-layer").classList.add("hidden");
    $("modal-layer").classList.add("hidden");
  }

  function openProfileMenu(anchorRect) {
    const layer = $("popover-layer");
    layer.classList.remove("hidden");
    const left = Math.min(window.innerWidth - 272, Math.max(12, anchorRect.right + 10));
    const top = Math.min(window.innerHeight - 220, Math.max(48, anchorRect.bottom - 170));

    layer.innerHTML = `
      <div class="popover-card" style="left:${left}px;top:${top}px;width:240px;" id="popover-card-inner">
        <div class="pop-rows">
          <button data-pr="recap">${ICONS.sparkles}<span>Your month in music</span></button>
          <button data-pr="liked">${ICONS.heart}<span>Liked songs</span></button>
          <div class="ctx-sep"></div>
          <button data-pr="audiolab">${ICONS.sparkles}<span>Audio Lab & FX…</span></button>
          <button data-pr="settings">${ICONS.settings}<span>Settings…</span></button>
        </div>
      </div>
    `;

    layer.onclick = (e) => {
      if (!e.target.closest("#popover-card-inner")) layer.classList.add("hidden");
    };

    layer.querySelectorAll("[data-pr]").forEach((btn) => {
      btn.onclick = () => {
        const what = btn.dataset.pr;
        layer.classList.add("hidden");
        if (what === "recap" || what === "liked") pushRoute({ type: what });
        else if (what === "audiolab") openSettings("audio_lab", null);
        else if (what === "settings") openSettings();
      };
    });
  }

  async function openLyricsPickerPopover(anchorRect) {
    if (!state.currentSong) return;
    const layer = $("popover-layer");
    layer.classList.remove("hidden");
    const left = Math.min(window.innerWidth - 356, Math.max(12, anchorRect.left - 180));
    const top = Math.min(window.innerHeight - 450, Math.max(48, anchorRect.bottom + 8));

    layer.innerHTML = `
      <div class="popover-card" style="left:${left}px;top:${top}px;width:330px;" id="popover-card-inner">
        <div class="popover-header">
          <span>Lyrics Providers (12)</span>
          <button id="reset-lyrics-choice-btn" style="font-size:11.5px;color:var(--text-secondary);">Auto</button>
        </div>
        <div class="popover-body" id="lyrics-candidates-body">
          <div style="padding:18px;color:var(--text-tertiary);">Fetching all 12 providers...</div>
        </div>
      </div>
    `;

    layer.onclick = (e) => {
      if (!e.target.closest("#popover-card-inner")) layer.classList.add("hidden");
    };

    const resetBtn = $("reset-lyrics-choice-btn");
    if (resetBtn) {
      resetBtn.onclick = async () => {
        await invoke("lyrics_forget", { videoId: state.currentSong.id });
        layer.classList.add("hidden");
        loadLyricsForSong(state.currentSong);
      };
    }

    try {
      const candidates = await invoke("lyrics_all_candidates", {
        song: state.currentSong,
        duration: state.currentSong.duration || null,
        lyricsBrowseId: state.lyricsBrowseId || null
      });
      const body = $("lyrics-candidates-body");
      if (!body) return;
      if (!candidates?.length) {
        body.innerHTML = `<div style="padding:18px;color:var(--text-tertiary);">No candidates returned.</div>`;
        return;
      }
      body.innerHTML = candidates
        .map(
          (c, i) => `
          <div class="song-row" data-choose-lyr="${i}">
            <div class="song-row-meta">
              <div class="song-row-title">${esc(c.providerName)} <span style="font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.12);">${esc(c.lyrics?.syncLabel || "")}</span></div>
              <div class="song-row-sub">${esc(c.lyrics?.lines?.[0]?.text || "")}</div>
            </div>
          </div>`
        )
        .join("");

      body.querySelectorAll("[data-choose-lyr]").forEach((row) => {
        row.onclick = async () => {
          const chosen = candidates[Number(row.dataset.chooseLyr)];
          if (chosen?.lyrics) {
            await invoke("lyrics_choose", { videoId: state.currentSong.id, lyrics: chosen.lyrics });
            state.currentLyrics = chosen.lyrics;
          }
          layer.classList.add("hidden");
          if (state.rightPaneOpen && state.rightPaneTab === "lyrics") renderRightPane();
          if (state.showFullPlayer) renderFullPlayer();
        };
      });
    } catch (_) {}
  }

  function openSongContextMenu(x, y, song) {
    const layer = $("context-menu-layer");
    layer.classList.remove("hidden");
    const left = Math.min(window.innerWidth - 220, x);
    const top = Math.min(window.innerHeight - 280, y);
    const liked = isLiked(song.id);

    layer.innerHTML = `
      <div class="context-menu" style="left:${left}px;top:${top}px;" id="ctx-inner">
        <button class="ctx-item" id="ctx-play-now">Play Now</button>
        <button class="ctx-item" id="ctx-play-next">Play Next</button>
        <button class="ctx-item" id="ctx-add-queue">Add to Queue</button>
        <div class="ctx-sep"></div>
        <button class="ctx-item" id="ctx-toggle-like">${liked ? "Remove from Liked Songs" : "Save to Liked Songs"}</button>
        ${(state.library.playlists || [])
          .map((pl) => `<button class="ctx-item" data-ctx-add-pl="${esc(pl.id)}">Add to "${esc(pl.name)}"</button>`)
          .join("")}
        ${song.artists?.[0]?.id ? `<div class="ctx-sep"></div><button class="ctx-item" id="ctx-goto-artist">Go to Artist</button>` : ""}
        ${song.album?.id ? `<button class="ctx-item" id="ctx-goto-album">Go to Album</button>` : ""}
      </div>
    `;

    layer.onclick = () => layer.classList.add("hidden");

    $("ctx-play-now").onclick = () => playSong(song);
    $("ctx-play-next").onclick = () => {
      state.queue.splice(state.currentIndex + 1, 0, song);
      if (state.rightPaneOpen && state.rightPaneTab === "queue") renderRightPane();
    };
    $("ctx-add-queue").onclick = () => {
      state.queue.push(song);
      if (state.rightPaneOpen && state.rightPaneTab === "queue") renderRightPane();
    };
    $("ctx-toggle-like").onclick = async () => {
      state.library = await invoke("lib_toggle_like", { song });
      renderSidebar();
      renderAllPlayerSurfaces();
    };
    layer.querySelectorAll("[data-ctx-add-pl]").forEach((btn) => {
      btn.onclick = async () => {
        state.library = await invoke("lib_add_to_playlist", { playlistId: btn.dataset.ctxAddPl, song });
        renderSidebar();
      };
    });
    const goArtist = $("ctx-goto-artist");
    if (goArtist) goArtist.onclick = () => pushRoute({ type: "artist", id: song.artists[0].id });
    const goAlbum = $("ctx-goto-album");
    if (goAlbum) goAlbum.onclick = () => pushRoute({ type: "album", id: song.album.id });
  }

  function openLocalPlaylistContextMenu(x, y, pl) {
    const layer = $("context-menu-layer");
    layer.classList.remove("hidden");
    const left = Math.min(window.innerWidth - 200, x);
    const top = Math.min(window.innerHeight - 180, y);

    layer.innerHTML = `
      <div class="context-menu" style="left:${left}px;top:${top}px;">
        <button class="ctx-item" id="ctx-pl-pin">${pl.isPinned ? "Unpin Playlist" : "Pin Playlist"}</button>
        <button class="ctx-item" id="ctx-pl-rename">Rename Playlist</button>
        <div class="ctx-sep"></div>
        <button class="ctx-item danger" id="ctx-pl-delete">Delete Playlist</button>
      </div>
    `;

    layer.onclick = () => layer.classList.add("hidden");

    $("ctx-pl-pin").onclick = async () => {
      state.library = await invoke("lib_toggle_pin", { id: pl.id });
      renderSidebar();
    };
    $("ctx-pl-rename").onclick = () => {
      const name = prompt("Rename playlist:", pl.name);
      if (name && name.trim()) {
        invoke("lib_rename_playlist", { id: pl.id, name: name.trim() }).then((snap) => {
          state.library = snap;
          renderSidebar();
          if (state.tab === "library") renderLibraryTab();
        });
      }
    };
    $("ctx-pl-delete").onclick = async () => {
      state.library = await invoke("lib_delete_playlist", { id: pl.id });
      renderSidebar();
      if (state.tab === "library") renderLibraryTab();
    };
  }

  function promptNewPlaylist() {
    const layer = $("modal-layer");
    layer.classList.remove("hidden");
    layer.innerHTML = `
      <div class="settings-modal" style="width:360px;" id="modal-inner">
        <div class="settings-header">
          <h2>New Playlist</h2>
          <button id="modal-close">✕</button>
        </div>
        <div class="settings-body">
          <div class="search-input-box">
            <input id="new-pl-name-input" type="text" placeholder="Playlist name..." />
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="pill-action-btn primary" id="create-pl-confirm">Create</button>
          </div>
        </div>
      </div>
    `;
    layer.onclick = (e) => {
      if (!e.target.closest("#modal-inner")) layer.classList.add("hidden");
    };
    $("modal-close").onclick = () => layer.classList.add("hidden");
    const input = $("new-pl-name-input");
    input?.focus();
    const confirmFn = async () => {
      const val = input.value.trim();
      if (!val) return;
      const res = await invoke("lib_create_playlist", { name: val });
      if (Array.isArray(res) && res[1]) state.library = res[1];
      layer.classList.add("hidden");
      renderSidebar();
      if (state.tab === "library") renderLibraryTab();
    };
    $("create-pl-confirm").onclick = confirmFn;
    input.onkeydown = (e) => {
      if (e.key === "Enter") confirmFn();
    };
  }

  // --------------------------------------------------------------------------
  // Settings Application, Audio Lab Effects & the Settings Page
  // --------------------------------------------------------------------------
  function applyAllSettingsEffects() {
    const prefs = window.MochySettingsUI?.ensurePrefsOnSettings(state.settings);
    if (!prefs) return;

    window.MochyAppSettings = prefs.playback;
    audio.updateLabState(prefs.audioLab, { normalize: !!state.settings.normalizeVolume });

    const cu = prefs.customisation || {};
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--card-radius", `${cu.coverRoundingPx ?? 14}px`);
    rootStyle.setProperty("--lyrics-scale", `${state.settings.lyricsSize || 1.0}`);

    const appEl = $("app");
    if (appEl) {
      appEl.classList.toggle("no-blur", cu.blurEnabled === false);
      appEl.classList.toggle("no-element-blur", cu.elementBlur === false);
      appEl.classList.toggle("no-anim", cu.animationEnabled === false);
    }

    if (ambientInst) {
      ambientInst.animated = state.settings.animatedBackgrounds !== false;
    }
    if (state.showFullPlayer) renderFullPlayer();
    if (state.rightPaneOpen) renderRightPane();
  }

  // settings floats over whatever is showing, so closing it lands you right back where you were
  function openSettings(initialCat = null, initialSub = null) {
    window.MochySettingsUI?.open(settingsContext(), initialCat, initialSub);
  }

  function settingsContext() {
    return {
      invoke,
      showError,
      getSettings: () => state.settings,
      getProviders: () => state.providers,
      getDeviceName: () => state.deviceName,
      applyAllEffects: applyAllSettingsEffects,
      saveSettings: async () => {
        const res = await invoke("settings_update", { settings: state.settings });
        if (Array.isArray(res)) {
          state.settings = res[0];
          state.providers = res[1];
        }
      },
      onHomeRefresh: () => renderHomeTab(),
      onHeroAutoChange: () => scheduleHeroAutoAdvance(),
      onImportedBackup: async (newSettings, newSnap) => {
        state.settings = { ...state.settings, ...(newSettings || {}) };
        state.library = newSnap || state.library;
        applyAllSettingsEffects();
        renderSidebar();
        renderHomeTab();
      },
      getDiagnosticsText: () => {
        const cur = state.currentSong;
        const m = state.currentStreamMeta;
        const eq = state.settings.prefs?.audioLab?.eq;
        return [
          `Track: ${cur ? `${cur.title} (${cur.id})` : "None"}`,
          `Source: ${cur?.source || "youtube"} | Codec: ${m?.formatLabel || m?.codec || "N/A"}`,
          `Bitrate: ${m?.bitrate ? `${Math.round(m.bitrate / 1000)} kbps` : "N/A"} | Loudness: ${m?.loudnessDb ?? "N/A"} dB`,
          `Quality tier: ${state.settings.audioQuality || "auto"} | Even out songs: ${!!state.settings.normalizeVolume}`,
          `EQ enabled: ${!!eq?.enabled} (${eq?.presetId || "custom"})`
        ].join("\n");
      }
    };
  }

  // --------------------------------------------------------------------------
  // The player as a paired phone steers it, and as remote.js hands a queue over
  // --------------------------------------------------------------------------
  function linkPlayer() {
    return {
      snapshot: () => ({
        song: state.currentSong || null,
        playing: !!state.isPlaying,
        position: state.currentTime || 0,
        duration: state.duration || 0,
        index: state.currentIndex || 0,
        upNext: state.queue.slice(state.currentIndex + 1, state.currentIndex + 26),
        liked: !!state.currentSong && isLiked(state.currentSong.id)
      }),
      isPlaying: () => !!state.isPlaying,
      handOverQueue: () => ({ songs: state.queue.slice(), index: state.currentIndex, position: state.currentTime || 0 }),
      playQueue: async (songs, index, position) => {
        const at = Math.max(0, Math.min(index, songs.length - 1));
        await playSong(songs[at], songs, at, { here: true });
        if (position > 1 && state.currentSong?.id === songs[at].id) {
          audio.currentTime = position;
          state.currentTime = position;
          updateSeekBarsOnly();
        }
      },
      playNext: (songs) => insertIntoQueue(songs, state.currentIndex + 1),
      addToQueue: (songs) => insertIntoQueue(songs, state.queue.length),
      jump: (index) => {
        if (index < 0 || index >= state.queue.length) return;
        state.currentIndex = index;
        loadAndPlayCurrent(true);
      },
      remove: (index) => {
        if (index <= state.currentIndex || index >= state.queue.length) return;
        const removed = state.queue.splice(index, 1)[0];
        state.unshuffledQueue = state.unshuffledQueue.filter((s) => s.id !== removed?.id);
        if (state.rightPaneOpen && state.rightPaneTab === "queue") renderRightPane();
      },
      toggle: () => togglePlayPause(),
      pause: () => {
        if (!audio.paused) audio.pause();
      },
      next: () => playNext(),
      previous: () => playPrevious(),
      seek: (secs) => {
        const dur = state.duration || audio.duration || 0;
        if (dur) seekToFraction(secs / dur);
      },
      like: async () => {
        if (!state.currentSong) return;
        state.library = await invoke("lib_toggle_like", { song: state.currentSong });
        renderSidebar();
        renderAllPlayerSurfaces();
      }
    };
  }

  // songs a phone lined up go in after the current one or at the end; with nothing queued they just play
  function insertIntoQueue(songs, at) {
    if (!songs.length) return;
    if (!state.queue.length) {
      playSong(songs[0], songs, 0, { here: true });
      return;
    }
    state.queue.splice(at, 0, ...songs);
    state.unshuffledQueue.push(...songs);
    if (state.rightPaneOpen && state.rightPaneTab === "queue") renderRightPane();
    saveSessionQuiet();
  }

  // --------------------------------------------------------------------------
  // Menu Bar Actions & Global Keyboard Shortcuts
  // --------------------------------------------------------------------------
  function onMenuAction(id) {
    switch (id) {
      case "settings":
        return openSettings();
      case "new-playlist":
        return promptNewPlaylist();
      case "play-pause":
        return togglePlayPause();
      case "next":
        return playNext();
      case "previous":
        return playPrevious();
      case "volume-up":
        return setVolume(state.volume + 0.08);
      case "volume-down":
        return setVolume(state.volume - 0.08);
      case "shuffle":
        return toggleShuffleMode();
      case "repeat":
        return cycleRepeatMode();
      case "lyrics":
        return onRightPaneButtonTap("lyrics");
      case "player":
        return state.currentSong && toggleFullPlayer();
      case "sidebar":
        return toggleSidebar();
      case "home":
        if (state.showFullPlayer) toggleFullPlayer();
        return switchTab("home");
      case "search":
        if (state.showFullPlayer) toggleFullPlayer();
        switchTab("search");
        return $("search-input")?.focus();
      case "library":
        if (state.showFullPlayer) toggleFullPlayer();
        return switchTab("library");
      case "back":
        return popRoute();
    }
  }

  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isTyping = tag === "input" || tag === "textarea";

    if (e.key === "Escape") {
      closeAllOverlays();
      if (window.MochySettingsUI?.close()) return;
      if (state.showFullPlayer) return toggleFullPlayer();
      if (state.routeStack.length) return popRoute();
      return;
    }

    if (!isTyping && e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
      return;
    }

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    const k = e.key.toLowerCase();
    if (k === "f") {
      e.preventDefault();
      switchTab("search");
      $("search-input")?.focus();
    } else if (e.key === "1") {
      e.preventDefault();
      switchTab("home");
    } else if (e.key === "3") {
      e.preventDefault();
      switchTab("library");
    } else if (e.key === "[") {
      e.preventDefault();
      popRoute();
    } else if (k === "l") {
      e.preventDefault();
      onRightPaneButtonTap("lyrics");
    } else if (e.shiftKey && k === "p") {
      e.preventDefault();
      if (state.currentSong) toggleFullPlayer();
    } else if (k === "n") {
      e.preventDefault();
      promptNewPlaylist();
    } else if (e.altKey && k === "b") {
      e.preventDefault();
      toggleSidebar();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      playNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      playPrevious();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setVolume(state.volume + 0.08);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setVolume(state.volume - 0.08);
    } else if (e.key === ",") {
      e.preventDefault();
      openSettings();
    } else if (k === "r") {
      e.preventDefault();
      cycleRepeatMode();
    } else if (e.altKey && k === "s") {
      e.preventDefault();
      toggleShuffleMode();
    }
  });

  // --------------------------------------------------------------------------
  // App Initialization
  // --------------------------------------------------------------------------
  async function bootstrap() {
    window.MochyShelves.init({
      esc,
      proxyImg,
      sizedCover,
      songThumb,
      artistNames,
      playingBarsHtml,
      itemCardHtml: renderItemCardHtml,
      icons: ICONS,
      nowPlaying: () => ({ id: state.currentSong?.id, playing: state.isPlaying })
    });
    try {
      state.userSidebarCollapsed = localStorage.getItem("mochy.sidebarCollapsed") !== "0";
    } catch (_) {}

    $("back-button").innerHTML = ICONS.arrowLeft;
    $("back-button").onclick = () => popRoute();
    $("corner-home-btn").innerHTML = ICONS.mochy;
    $("corner-home-btn").onclick = () => switchTab("home");
    $("sidebar-toggle-btn").onclick = () => toggleSidebar();
    syncShellLayout();
    $("error-toast-close").onclick = () => $("error-toast").classList.add("hidden");
    $("right-pane-scrim").onclick = () => closeRightPane();

    try {
      const init = await invoke("app_init");
      state.proxyPort = init.proxyPort;
      state.platform = init.platform || "macos";
      state.userName = init.userName || "";
      state.deviceName = init.deviceName || "";
      state.library = init.library || state.library;
      state.settings = { ...state.settings, ...(init.settings || {}) };
      window.MochySettingsUI?.ensurePrefsOnSettings(state.settings);
      state.providers = init.providers || [];
      state.volume = state.settings.playerVolume ?? 0.85;
      audio.setVolume(state.volume, false);
      applyAllSettingsEffects();
      if (state.settings.lyricsOpen) {
        state.rightPaneOpen = true;
        state.rightPaneTab = "lyrics";
      }

      $("app").classList.add(`platform-${state.platform}`);

      if (state.platform !== "macos") {
        const winControls = $("win-linux-controls");
        winControls?.classList.remove("hidden");
        const appWin = window.__TAURI__?.window?.getCurrentWindow?.();
        if (appWin) {
          $("win-min").onclick = () => appWin.minimize();
          $("win-max").onclick = () => appWin.toggleMaximize();
          $("win-close").onclick = () => appWin.close();
        }
      }

      if (init.session?.queue?.length) {
        const sess = init.session;
        state.queue = sess.queue;
        state.unshuffledQueue = sess.queue.slice();
        state.currentIndex = Math.min(sess.index || 0, state.queue.length - 1);
        state.currentSong = state.queue[state.currentIndex];
        const th = songThumb(state.currentSong);
        if (th) {
          fetchCoverPalette(th).then((pal) => {
            if (pal?.stops) state.palette = pal.stops;
          });
        }
        if (state.currentSong) loadLyricsForSong(state.currentSong);
      }
    } catch (err) {
      showError(`Init error: ${err}`);
    }

    syncShellLayout();
    renderSidebar();
    renderTopBar();
    renderRightPane();
    renderHomeTab();
    requestAnimationFrame(tickFrame);

    tauriListen("menu", onMenuAction);

    // paired devices: the settings page, the remote both ways, and what a sync or a phone changes here
    window.MochyDevices?.init({ invoke, listen: tauriListen, showError });
    window.MochyRemote?.init({
      invoke,
      listen: tauriListen,
      showError,
      cover: (url, size) => proxyImg(sizedCover(url, size)),
      player: linkPlayer()
    });
    tauriListen("library://changed", async () => {
      try {
        state.library = await invoke("lib_snapshot");
      } catch (_) {
        return;
      }
      renderSidebar();
      if (state.tab === "library" && !state.routeStack.length) renderLibraryTab();
    });
    tauriListen("settings://changed", (saved) => {
      if (!saved) return;
      state.settings = { ...state.settings, ...saved };
      window.MochySettingsUI?.ensurePrefsOnSettings(state.settings);
      applyAllSettingsEffects();
      renderAllPlayerSurfaces();
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        syncShellLayout();
        const curPage = $("hero-stage")?.querySelector(".hero-page");
        if (curPage && state.heroCards[state.heroIndex]?.isGacha) {
          layoutGachaReelInPage(curPage);
        }
      }, 45);
    });

    // Fetch Home feed + Discover hero picks
    try {
      const home = await invoke("yt_home", { params: null });
      state.homeLoading = false;
      state.homePage = home;

      // Seeds: top songs from recap, liked songs, recent songs (non-local)
      const seedCandidates = [
        ...(state.library.recap?.topSongs || []).slice(0, 2).map((e) => e.song),
        ...(state.library.likedSongs || []).slice(0, 2),
        ...(state.library.recentSongs || []).slice(0, 4)
      ];
      const seenSeeds = new Set();
      const seeds = seedCandidates.filter((s) => s && !s.source && !seenSeeds.has(s.id) && seenSeeds.add(s.id));

      if (seeds.length) {
        invoke("yt_discover", {
          seeds,
          likedIds: state.library.likedIds || [],
          knownIds: (state.library.recentSongs || []).slice(0, 300).map((s) => s.id)
        })
          .then((picks) => {
            if (picks?.length) {
              state.discoverPicks = picks;
              state.quickPicks = picks.map((p) => p.recommendation);
              renderHomeTab();
            }
          })
          .catch(() => {});
      }
      renderHomeTab();
    } catch (_) {
      state.homeLoading = false;
      renderHomeTab();
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
