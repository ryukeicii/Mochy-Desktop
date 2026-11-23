// ============================================================================
// The audio lab's sound: eq presets and curve math, autoeq profiles, and the player's web audio chain
// ============================================================================
(function () {
  "use strict";

  const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const OCTAVE_Q = 1.41;

  const EQ_PRESETS = [
    { id: "flat", name: "Flat", gains: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] },
    { id: "acoustic", name: "Acoustic", gains: [4.5, 4.5, 3.5, 1.0, 1.5, 1.5, 3.0, 3.5, 3.0, 1.5] },
    { id: "bass_boost", name: "Bass Booster", gains: [5.5, 4.5, 3.5, 2.5, 1.2, 0.0, 0.0, 0.0, 0.0, 0.0] },
    { id: "bass_cut", name: "Bass Reducer", gains: [-5.5, -4.5, -3.5, -2.5, -1.2, 0.0, 0.0, 0.0, 0.0, 0.0] },
    { id: "classical", name: "Classical", gains: [4.5, 3.5, 3.0, 2.5, -1.5, -1.5, 0.0, 2.0, 3.0, 3.5] },
    { id: "dance", name: "Dance", gains: [3.5, 6.5, 5.0, 0.0, 2.0, 3.5, 5.0, 4.5, 3.5, 0.0] },
    { id: "deep", name: "Deep", gains: [5.0, 3.5, 1.5, 1.0, 3.0, 2.5, 1.5, -2.0, -3.5, -4.5] },
    { id: "electronic", name: "Electronic", gains: [4.5, 4.0, 1.5, 0.0, -2.0, 2.0, 1.0, 1.5, 4.5, 5.0] },
    { id: "hiphop", name: "Hip-Hop", gains: [5.0, 4.0, 1.5, 3.0, -1.0, -1.0, 1.5, -0.5, 2.0, 3.0] },
    { id: "jazz", name: "Jazz", gains: [4.0, 3.0, 1.5, 2.0, -1.5, -1.5, 0.0, 1.5, 3.0, 3.5] },
    { id: "loudness", name: "Loudness", gains: [6.0, 4.0, 0.0, 0.0, -2.0, 0.0, -1.0, -5.0, 5.0, 1.0] },
    { id: "lounge", name: "Lounge", gains: [-3.0, -1.5, -0.5, 1.5, 4.0, 2.5, 0.0, -1.5, 2.0, 1.0] },
    { id: "piano", name: "Piano", gains: [3.0, 2.0, 0.0, 2.5, 3.0, 1.5, 3.5, 4.5, 3.0, 3.5] },
    { id: "pop", name: "Pop", gains: [-1.5, -1.0, 0.0, 2.0, 4.0, 4.0, 2.0, 0.0, -1.0, -1.5] },
    { id: "rnb", name: "R&B", gains: [2.5, 7.0, 5.5, 1.5, -2.5, -1.5, 2.5, 3.0, 3.0, 3.5] },
    { id: "rock", name: "Rock", gains: [5.0, 4.0, 3.0, 1.5, -0.5, -1.0, 0.5, 2.5, 3.5, 4.5] },
    { id: "small_speakers", name: "Small Speakers", gains: [5.5, 4.0, 3.5, 2.5, 1.0, 0.0, -1.0, -2.0, -3.5, -4.0] },
    { id: "spoken", name: "Spoken Word", gains: [-3.5, -0.5, 0.0, 0.5, 3.5, 4.5, 5.0, 4.0, 2.5, 0.0] },
    { id: "treble_boost", name: "Treble Booster", gains: [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 2.5, 3.5, 4.5, 5.5] },
    { id: "treble_cut", name: "Treble Reducer", gains: [0.0, 0.0, 0.0, 0.0, 0.0, -1.0, -2.5, -3.5, -4.5, -5.5] },
    { id: "vocal", name: "Vocal Booster", gains: [-1.5, -3.0, -3.0, 1.5, 3.5, 3.5, 3.0, 1.5, 0.0, -1.5] }
  ];

  // Offline flagship AutoEQ profiles (Harman Over-Ear / In-Ear targets) + live GitHub AutoEQ search support
  const BUILTIN_AUTOEQ_MODELS = [
    {
      model: "Apple AirPods Pro (2nd generation)",
      source: "crinacle",
      rig: "GRAS 43AG-7",
      path: "crinacle/GRAS 43AG-7 in-ear/Apple AirPods Pro 2",
      form: "InEar",
      preamp: -1.8,
      filters: [
        { freq: 31, gain: -2.5, q: 0.7, type: "LSC", enabled: true },
        { freq: 125, gain: -1.4, q: 1.2, type: "PK", enabled: true },
        { freq: 420, gain: 1.2, q: 1.4, type: "PK", enabled: true },
        { freq: 1850, gain: 1.6, q: 1.6, type: "PK", enabled: true },
        { freq: 3400, gain: -1.8, q: 2.2, type: "PK", enabled: true },
        { freq: 7200, gain: 1.8, q: 1.8, type: "PK", enabled: true },
        { freq: 12000, gain: -2.0, q: 0.7, type: "HSC", enabled: true }
      ]
    },
    {
      model: "Apple AirPods Max",
      source: "oratory1990",
      rig: "Harman Over-Ear",
      path: "oratory1990/Harman over-ear/Apple AirPods Max",
      form: "OverEar",
      preamp: -5.4,
      filters: [
        { freq: 52, gain: -2.1, q: 1.1, type: "PK", enabled: true },
        { freq: 180, gain: -1.8, q: 1.2, type: "PK", enabled: true },
        { freq: 620, gain: 1.5, q: 1.6, type: "PK", enabled: true },
        { freq: 2700, gain: 5.2, q: 1.9, type: "PK", enabled: true },
        { freq: 5800, gain: -2.4, q: 2.3, type: "PK", enabled: true },
        { freq: 9200, gain: 3.1, q: 1.4, type: "PK", enabled: true }
      ]
    },
    {
      model: "Sony WH-1000XM5",
      source: "oratory1990",
      rig: "Harman Over-Ear",
      path: "oratory1990/Harman over-ear/Sony WH-1000XM5",
      form: "OverEar",
      preamp: -4.8,
      filters: [
        { freq: 85, gain: -4.2, q: 0.7, type: "LSC", enabled: true },
        { freq: 210, gain: -3.5, q: 1.1, type: "PK", enabled: true },
        { freq: 950, gain: 1.8, q: 1.4, type: "PK", enabled: true },
        { freq: 2800, gain: 4.5, q: 1.7, type: "PK", enabled: true },
        { freq: 5200, gain: 2.2, q: 2.0, type: "PK", enabled: true },
        { freq: 8400, gain: -2.6, q: 2.4, type: "PK", enabled: true }
      ]
    },
    {
      model: "Sony WH-1000XM4",
      source: "oratory1990",
      rig: "Harman Over-Ear",
      path: "oratory1990/Harman over-ear/Sony WH-1000XM4",
      form: "OverEar",
      preamp: -5.2,
      filters: [
        { freq: 105, gain: -5.4, q: 0.7, type: "LSC", enabled: true },
        { freq: 240, gain: -2.8, q: 1.2, type: "PK", enabled: true },
        { freq: 1200, gain: 2.2, q: 1.5, type: "PK", enabled: true },
        { freq: 3100, gain: 4.9, q: 1.8, type: "PK", enabled: true },
        { freq: 6400, gain: -2.0, q: 2.2, type: "PK", enabled: true },
        { freq: 10500, gain: 2.5, q: 0.7, type: "HSC", enabled: true }
      ]
    },
    {
      model: "Sennheiser HD 600",
      source: "oratory1990",
      rig: "Harman Over-Ear",
      path: "oratory1990/Harman over-ear/Sennheiser HD 600",
      form: "OverEar",
      preamp: -5.6,
      filters: [
        { freq: 105, gain: 5.5, q: 0.7, type: "LSC", enabled: true },
        { freq: 215, gain: -1.3, q: 1.3, type: "PK", enabled: true },
        { freq: 1450, gain: -1.4, q: 1.6, type: "PK", enabled: true },
        { freq: 3300, gain: -2.2, q: 2.4, type: "PK", enabled: true },
        { freq: 5600, gain: 1.8, q: 2.0, type: "PK", enabled: true },
        { freq: 10000, gain: 2.2, q: 0.7, type: "HSC", enabled: true }
      ]
    },
    {
      model: "Sennheiser HD 650",
      source: "oratory1990",
      rig: "Harman Over-Ear",
      path: "oratory1990/Harman over-ear/Sennheiser HD 650",
      form: "OverEar",
      preamp: -5.9,
      filters: [
        { freq: 105, gain: 5.8, q: 0.7, type: "LSC", enabled: true },
        { freq: 240, gain: -2.1, q: 1.2, type: "PK", enabled: true },
        { freq: 1350, gain: -1.2, q: 1.8, type: "PK", enabled: true },
        { freq: 3200, gain: 1.8, q: 2.0, type: "PK", enabled: true },
        { freq: 8200, gain: 3.0, q: 1.6, type: "PK", enabled: true }
      ]
    },
    {
      model: "Audio-Technica ATH-M50x",
      source: "oratory1990",
      rig: "Harman Over-Ear",
      path: "oratory1990/Harman over-ear/Audio-Technica ATH-M50x",
      form: "OverEar",
      preamp: -4.2,
      filters: [
        { freq: 110, gain: -3.2, q: 0.7, type: "LSC", enabled: true },
        { freq: 275, gain: 2.4, q: 1.4, type: "PK", enabled: true },
        { freq: 1150, gain: -1.6, q: 1.6, type: "PK", enabled: true },
        { freq: 4400, gain: -3.4, q: 2.3, type: "PK", enabled: true },
        { freq: 6900, gain: 3.1, q: 1.9, type: "PK", enabled: true }
      ]
    },
    {
      model: "Beyerdynamic DT 770 Pro (250 Ohm)",
      source: "oratory1990",
      rig: "Harman Over-Ear",
      path: "oratory1990/Harman over-ear/Beyerdynamic DT 770 Pro 250 Ohm",
      form: "OverEar",
      preamp: -4.6,
      filters: [
        { freq: 105, gain: 2.5, q: 0.7, type: "LSC", enabled: true },
        { freq: 215, gain: 3.2, q: 1.4, type: "PK", enabled: true },
        { freq: 3750, gain: 3.8, q: 1.8, type: "PK", enabled: true },
        { freq: 6100, gain: -4.2, q: 3.2, type: "PK", enabled: true },
        { freq: 8500, gain: -5.4, q: 3.5, type: "PK", enabled: true }
      ]
    },
    {
      model: "Moondrop Blessing 3",
      source: "crinacle",
      rig: "5128 In-Ear",
      path: "crinacle/5128 in-ear/Moondrop Blessing 3",
      form: "InEar",
      preamp: -3.5,
      filters: [
        { freq: 95, gain: 3.4, q: 0.7, type: "LSC", enabled: true },
        { freq: 640, gain: -0.9, q: 1.3, type: "PK", enabled: true },
        { freq: 3100, gain: -2.1, q: 2.2, type: "PK", enabled: true },
        { freq: 6800, gain: -1.8, q: 2.4, type: "PK", enabled: true },
        { freq: 11500, gain: 1.5, q: 0.7, type: "HSC", enabled: true }
      ]
    },
    {
      model: "Bose QuietComfort Ultra Headphones",
      source: "Rtings",
      rig: "Harman Over-Ear",
      path: "Rtings/Harman over-ear/Bose QuietComfort Ultra",
      form: "OverEar",
      preamp: -4.1,
      filters: [
        { freq: 90, gain: -3.1, q: 0.7, type: "LSC", enabled: true },
        { freq: 320, gain: 1.5, q: 1.2, type: "PK", enabled: true },
        { freq: 2600, gain: 3.9, q: 1.7, type: "PK", enabled: true },
        { freq: 5900, gain: -2.3, q: 2.1, type: "PK", enabled: true }
      ]
    }
  ];

  function flatNodes() {
    return EQ_FREQUENCIES.map((freq) => ({
      freq,
      gain: 0.0,
      q: OCTAVE_Q,
      type: "PK",
      enabled: true
    }));
  }

  function defaultAudioLabState() {
    return {
      eq: {
        enabled: false,
        nodes: flatNodes(),
        preamp: 0.0,
        autoPreamp: true,
        presetId: "flat",
        correction: null,
        correctionEnabled: true
      },
      presets: [],
      quality: {
        stream: "auto"
      }
    };
  }

  // Exact RBJ Audio EQ Cookbook magnitude response (in dB) at freq f (Hz), Fs = 48000 Hz
  function biquadResponseDb(band, f, fs = 48000) {
    if (!band || band.enabled === false || Math.abs(band.gain) < 0.01) return 0;
    const f0 = Math.max(20, Math.min(fs * 0.45, Number(band.freq) || 1000));
    const q = Math.max(0.1, Math.min(20, Number(band.q) || OCTAVE_Q));
    const dbGain = Math.max(-24, Math.min(24, Number(band.gain) || 0));
    const A = Math.pow(10, dbGain / 40);
    const w0 = (2 * Math.PI * f0) / fs;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * q);

    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
    if (band.type === "LSC") {
      const sq = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cosW0 + sq);
      b1 = 2 * A * (A - 1 - (A + 1) * cosW0);
      b2 = A * (A + 1 - (A - 1) * cosW0 - sq);
      a0 = A + 1 + (A - 1) * cosW0 + sq;
      a1 = -2 * (A - 1 + (A + 1) * cosW0);
      a2 = A + 1 + (A - 1) * cosW0 - sq;
    } else if (band.type === "HSC") {
      const sq = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cosW0 + sq);
      b1 = -2 * A * (A - 1 + (A + 1) * cosW0);
      b2 = A * (A + 1 + (A - 1) * cosW0 - sq);
      a0 = A + 1 - (A - 1) * cosW0 + sq;
      a1 = 2 * (A - 1 - (A + 1) * cosW0);
      a2 = A + 1 - (A - 1) * cosW0 - sq;
    } else {
      b0 = 1 + alpha * A;
      b1 = -2 * cosW0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosW0;
      a2 = 1 - alpha / A;
    }

    const w = (2 * Math.PI * f) / fs;
    const cw = Math.cos(w);
    const c2w = Math.cos(2 * w);
    const sw = Math.sin(w);
    const s2w = Math.sin(2 * w);

    const nr = (b0 + b1 * cw + b2 * c2w) / a0;
    const ni = (-b1 * sw - b2 * s2w) / a0;
    const dr = 1 + (a1 * cw + a2 * c2w) / a0;
    const di = (-a1 * sw - a2 * s2w) / a0;
    const magSq = Math.max(1e-12, (nr * nr + ni * ni) / Math.max(1e-12, dr * dr + di * di));
    return 10 * Math.log10(magSq);
  }

  function combinedEqResponseDb(eqState, f) {
    if (!eqState) return 0;
    let total = 0;
    for (const b of eqState.nodes || []) total += biquadResponseDb(b, f);
    if (eqState.correctionEnabled && eqState.correction?.filters?.length) {
      for (const b of eqState.correction.filters) total += biquadResponseDb(b, f);
    }
    return total;
  }

  function boostRoomDb(f) {
    return f <= 1000 ? 4.0 : 4.0 + 3.0 * Math.log2(f / 1000);
  }

  function computeAutoHeadroomDb(eqState) {
    if (!eqState) return 0;
    let over = 0;
    const steps = 80;
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    for (let i = 0; i <= steps; i++) {
      const f = Math.pow(10, minLog + ((maxLog - minLog) * i) / steps);
      const gain = combinedEqResponseDb(eqState, f);
      over = Math.max(over, gain - boostRoomDb(f));
    }
    return -over;
  }

  // one audio element run through a short web audio chain: eq, then evening songs out, then volume
  function createAudioEngine() {
    const deck = new Audio();
    deck.crossOrigin = "anonymous";
    deck.preload = "auto";

    let ctx = null;
    let eqPreampGain = null;
    let eqFilters = [];
    let normGain = null;
    let masterGain = null;
    let analyser = null;

    const listeners = new Map();
    let volumeScalar = 0.85;
    let mutedState = false;
    let trackLoudnessDb = null;
    let labState = defaultAudioLabState();
    let normalizeEnabled = true;
    let autoAdvanceCb = null;
    let silenceGapMs = 0;
    let pendingLoad = false;

    function emit(name, detail) {
      const set = listeners.get(name);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(detail);
        } catch (_) {}
      }
    }

    // built on the first play, because an audio context only starts after a click
    function ensureGraph() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();

        eqPreampGain = ctx.createGain();
        normGain = ctx.createGain();
        masterGain = ctx.createGain();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;

        normGain.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(ctx.destination);
        ctx.createMediaElementSource(deck).connect(eqPreampGain);

        rebuildEqChain();
        syncGraphParams();
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      return true;
    }

    // one filter per band that actually moves, so a flat eq costs nothing
    function rebuildEqChain() {
      if (!ctx) return;
      try {
        eqPreampGain.disconnect();
      } catch (_) {}
      for (const f of eqFilters) {
        try {
          f.disconnect();
        } catch (_) {}
      }
      eqFilters = [];

      const eqCfg = labState.eq || {};
      const activeBands = [];
      if (eqCfg.enabled) {
        for (const n of eqCfg.nodes || []) {
          if (n && n.enabled !== false && Math.abs(n.gain || 0) >= 0.01) activeBands.push(n);
        }
        if (eqCfg.correctionEnabled && eqCfg.correction?.filters?.length) {
          for (const n of eqCfg.correction.filters) {
            if (n && n.enabled !== false && Math.abs(n.gain || 0) >= 0.01) activeBands.push(n);
          }
        }
      }

      let tail = eqPreampGain;
      for (const b of activeBands) {
        const node = ctx.createBiquadFilter();
        node.type = b.type === "LSC" ? "lowshelf" : b.type === "HSC" ? "highshelf" : "peaking";
        node.frequency.value = Math.max(20, Math.min(20000, b.freq || 1000));
        node.Q.value = Math.max(0.1, Math.min(18, b.q || OCTAVE_Q));
        node.gain.value = Math.max(-18, Math.min(18, b.gain || 0));
        tail.connect(node);
        eqFilters.push(node);
        tail = node;
      }
      tail.connect(normGain);
    }

    function syncGraphParams() {
      if (!ctx) return;
      const now = ctx.currentTime;

      // the eq preamp, backed off by the auto headroom so big boosts don't clip
      const eqCfg = labState.eq || {};
      let preampDb = 0;
      if (eqCfg.enabled) {
        const headroom = eqCfg.autoPreamp
          ? computeAutoHeadroomDb(eqCfg)
          : eqCfg.correctionEnabled && eqCfg.correction
          ? eqCfg.correction.preamp || 0
          : 0;
        preampDb = (eqCfg.preamp || 0) + headroom;
      }
      eqPreampGain.gain.setTargetAtTime(Math.pow(10, Math.max(-24, Math.min(12, preampDb)) / 20), now, 0.03);

      // even songs out using the loudness youtube reports for each one
      let normLinear = 1.0;
      if (normalizeEnabled && trackLoudnessDb != null) {
        normLinear = Math.min(1.4, Math.max(0.18, Math.pow(10, -trackLoudnessDb / 20)));
      }
      normGain.gain.setTargetAtTime(normLinear, now, 0.05);

      syncMasterVolumeGain();
    }

    function effectiveVolume() {
      if (mutedState) return 0;
      return Math.max(0, Math.min(1, volumeScalar));
    }

    // once the graph exists the volume lives on its master gain, before that on the element
    function syncMasterVolumeGain() {
      const vol = effectiveVolume();
      if (masterGain && ctx) {
        masterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.025);
        deck.volume = 1;
      } else {
        deck.volume = vol;
      }
    }

    // hop forward through a quiet stretch once it has lasted about a second
    function skipSilentStretch() {
      if (!analyser || deck.paused) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      if (peak < 0.008 && deck.currentTime > 1.5 && deck.duration - deck.currentTime > 2.5) {
        silenceGapMs += 250;
        if (silenceGapMs > 900) {
          deck.currentTime = Math.min(deck.duration - 0.5, deck.currentTime + 0.65);
        }
      } else {
        silenceGapMs = 0;
      }
    }

    function emitProgress() {
      if (pendingLoad) return;
      emit("timeupdate", { currentTime: deck.currentTime || 0, duration: isFinite(deck.duration) ? deck.duration : 0 });
    }

    deck.addEventListener("timeupdate", () => {
      if (pendingLoad) return;
      emitProgress();
      if (window.MochyAppSettings?.skipSilence) skipSilentStretch();
    });
    deck.addEventListener("loadedmetadata", emitProgress);
    deck.addEventListener("durationchange", emitProgress);
    deck.addEventListener("play", () => {
      if (!pendingLoad) emit("play");
    });
    deck.addEventListener("pause", () => emit("pause"));
    deck.addEventListener("ended", () => {
      if (!pendingLoad) autoAdvanceCb?.();
    });
    deck.addEventListener("error", () => {
      if (!pendingLoad) emit("error", deck.error);
    });

    function prepareLoad() {
      pendingLoad = true;
      silenceGapMs = 0;
      deck.pause();
    }

    async function loadUrl(url, { autoPlay = true, loudnessDb = null } = {}) {
      ensureGraph();
      trackLoudnessDb = loudnessDb;
      syncGraphParams();
      silenceGapMs = 0;
      pendingLoad = false;
      deck.src = url;
      if (autoPlay) await deck.play();
    }

    function play() {
      ensureGraph();
      pendingLoad = false;
      return deck.play();
    }

    function pause() {
      deck.pause();
    }

    return {
      addEventListener(name, fn) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(fn);
      },
      onAutoAdvance(fn) {
        autoAdvanceCb = fn;
      },
      ensureContext() {
        ensureGraph();
        return ctx;
      },
      updateLabState(nextLab, { normalize = true, loudnessDb } = {}) {
        labState = nextLab || defaultAudioLabState();
        normalizeEnabled = !!normalize;
        if (loudnessDb !== undefined) trackLoudnessDb = loudnessDb;
        if (ctx) {
          rebuildEqChain();
          syncGraphParams();
        }
      },
      setLoudnessDb(db) {
        trackLoudnessDb = db;
        syncGraphParams();
      },
      setVolume(v, muted) {
        volumeScalar = v;
        if (typeof muted === "boolean") mutedState = muted;
        syncMasterVolumeGain();
      },
      prepareLoad,
      loadUrl,
      play,
      pause,
      get currentTime() {
        return pendingLoad ? 0 : deck.currentTime || 0;
      },
      set currentTime(val) {
        try {
          deck.currentTime = val;
        } catch (_) {}
      },
      get duration() {
        return !pendingLoad && isFinite(deck.duration) ? deck.duration : 0;
      },
      get paused() {
        return deck.paused;
      },
      get src() {
        return pendingLoad ? "" : deck.src;
      },
      get volume() {
        return volumeScalar;
      },
      set volume(v) {
        volumeScalar = v;
        syncMasterVolumeGain();
      }
    };
  }

  window.MochyAudioFX = {
    EQ_FREQUENCIES,
    EQ_PRESETS,
    BUILTIN_AUTOEQ_MODELS,
    flatNodes,
    defaultAudioLabState,
    biquadResponseDb,
    combinedEqResponseDb,
    computeAutoHeadroomDb,
    createAudioEngine
  };
})();
