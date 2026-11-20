// ============================================================================
// Mochy Audio Lab DSP Engine + Dual-Deck CrossMix & Transport Fade Engine
// Exact presets, curves, biquad response math, and FX pipeline matching Mochy Android
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

  const REVERB_PRESETS = [
    { id: "room", name: "Room", mix: 0.5, roomSize: 0.55, damping: 0.45, wet: 0.6, dry: 1.0, width: 1.0, preDelayMs: 12, lowCutHz: 180 },
    { id: "studio", name: "Studio", mix: 0.4, roomSize: 0.3, damping: 0.65, wet: 0.45, dry: 1.0, width: 0.8, preDelayMs: 5, lowCutHz: 250 },
    { id: "bathroom", name: "Bathroom", mix: 0.5, roomSize: 0.42, damping: 0.05, wet: 0.7, dry: 1.0, width: 0.6, preDelayMs: 2, lowCutHz: 120 },
    { id: "plate", name: "Plate", mix: 0.45, roomSize: 0.65, damping: 0.1, wet: 0.55, dry: 1.0, width: 1.0, preDelayMs: 0, lowCutHz: 300 },
    { id: "hall", name: "Hall", mix: 0.5, roomSize: 0.78, damping: 0.35, wet: 0.6, dry: 1.0, width: 1.0, preDelayMs: 25, lowCutHz: 150 },
    { id: "cathedral", name: "Cathedral", mix: 0.55, roomSize: 0.95, damping: 0.2, wet: 0.7, dry: 1.0, width: 1.0, preDelayMs: 40, lowCutHz: 120 },
    { id: "stadium", name: "Stadium", mix: 0.6, roomSize: 0.9, damping: 0.5, wet: 0.65, dry: 1.0, width: 1.0, preDelayMs: 60, lowCutHz: 200 },
    { id: "dream", name: "Dreamy", mix: 0.7, roomSize: 0.93, damping: 0.6, wet: 0.85, dry: 1.0, width: 1.0, preDelayMs: 30, lowCutHz: 300 }
  ];

  const LOUDNESS_PRESETS = [
    { id: "gentle", name: "Gentle", boostDb: 2.0, compression: 0.15 },
    { id: "punchy", name: "Punchy", boostDb: 4.0, compression: 0.3 },
    { id: "night", name: "Night mode", boostDb: 3.0, compression: 0.85 },
    { id: "max", name: "Max", boostDb: 9.0, compression: 0.5 }
  ];

  const SPATIAL_PRESETS = [
    { id: "light", name: "Light", cutoffHz: 700, feedDb: 4.5 },
    { id: "natural", name: "Natural", cutoffHz: 700, feedDb: 6.0 },
    { id: "strong", name: "Strong", cutoffHz: 650, feedDb: 9.5 }
  ];

  const SPEED_PRESETS = [
    { id: "normal", name: "Normal", speed: 1.0, preservePitch: true },
    { id: "slowed", name: "Slowed", speed: 0.85, preservePitch: false, disableReverb: true },
    { id: "slowed_reverb", name: "Slowed + reverb", speed: 0.85, preservePitch: false, reverbPreset: "hall" },
    { id: "nightcore", name: "Nightcore", speed: 1.25, preservePitch: false },
    { id: "0.75", name: "0.75x", speed: 0.75, preservePitch: true },
    { id: "1.25", name: "1.25x", speed: 1.25, preservePitch: true },
    { id: "1.5", name: "1.5x", speed: 1.5, preservePitch: true },
    { id: "2.0", name: "2x", speed: 2.0, preservePitch: true }
  ];

  const VOLUME_PRESETS = [
    { id: "gentle", name: "Gentle", exponent: 1.6 },
    { id: "exponential", name: "Exponential", exponent: 2.2 },
    { id: "steep", name: "Steep", exponent: 3.2 }
  ];

  const CROSSMIX_STYLES = [
    { id: "AUTO", name: "Let Mochy choose", group: "Auto" },
    { id: "SILK_BLEND", name: "Silk blend", group: "Everyday" },
    { id: "BASS_SWAP", name: "Bass swap", group: "Everyday" },
    { id: "FILTER_SWEEP", name: "Filter sweep", group: "Everyday" },
    { id: "ECHO_OUT", name: "Echo out", group: "Everyday" },
    { id: "VOCAL_HANDOFF", name: "Vocal hand-off", group: "Everyday" },
    { id: "DROP_CUT", name: "Drop cut", group: "Everyday" },
    { id: "HARMONIC_GLIDE", name: "Harmonic glide", group: "Everyday" },
    { id: "FADE_TO_FAR", name: "Fade to far", group: "Everyday" },
    { id: "DAMPEN", name: "Dampen", group: "Everyday" },
    { id: "HIGH_PASS_LIFT", name: "High-pass lift", group: "Lift" },
    { id: "BACKSPIN", name: "Backspin", group: "Lift" },
    { id: "LOOP_ROLL", name: "Loop roll", group: "Lift" },
    { id: "RISER_BUILD", name: "Riser build", group: "Lift" },
    { id: "THUNDER_DROP", name: "Thunder drop", group: "Lift" },
    { id: "TAPE_STOP", name: "Tape stop", group: "Fall" },
    { id: "POWER_DOWN", name: "Power down", group: "Fall" },
    { id: "DOWNLIFTER", name: "Downlifter", group: "Fall" },
    { id: "DUB_THROW", name: "Dub throw", group: "Fall" },
    { id: "REVERB_WASH", name: "Reverb wash", group: "Fall" },
    { id: "REWIND_WASH", name: "Rewind wash", group: "Fall" },
    { id: "STUTTER_GATE", name: "Stutter gate", group: "Flavour" },
    { id: "PHASER_GLIDE", name: "Phaser glide", group: "Flavour" },
    { id: "LO_FI_MELT", name: "Lo-fi melt", group: "Flavour" },
    { id: "SPATIAL_ORBIT", name: "Spatial orbit", group: "Flavour" },
    { id: "DOPPLER_PASS", name: "Doppler pass", group: "Flavour" },
    { id: "GATE_FADE", name: "Gate fade", group: "Flavour" },
    { id: "BREAKDOWN_BRIDGE", name: "Breakdown bridge", group: "Flavour" }
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
      reverb: {
        enabled: false,
        mix: 0.5,
        roomSize: 0.55,
        damping: 0.45,
        wet: 0.6,
        dry: 1.0,
        width: 1.0,
        preDelayMs: 12,
        lowCutHz: 180,
        presetId: "room"
      },
      loudness: {
        enabled: false,
        boostDb: 4.0,
        compression: 0.3
      },
      normalize: {
        replayGainMode: "Track",
        preampDb: 3.0
      },
      spatial: {
        enabled: false,
        mode: "Crossfeed",
        cutoffHz: 700,
        feedDb: 4.5,
        speakerAngle: 30,
        amount: 1.0,
        surround: false,
        mono: false
      },
      playback: {
        speed: 1.0,
        preservePitch: true,
        pitchSemitones: 0
      },
      volume: {
        enabled: false,
        exponent: 2.0,
        limit: 1.0
      },
      quality: {
        stream: "auto",
        download: "high",
        youtubeEnabled: true,
        monochromeServer: "https://tracks.monochrome.st",
        appleMusicStream: "aac256",
        jiosaavnStream: "320"
      },
      pass: {
        preferUsbDac: false,
        hiResOutput: true,
        hiFiResampler: true,
        usbPassthrough: false,
        mode: "SONG_RATE",
        dacVolume: 1.0,
        fixedVolume: false
      },
      crossmix: {
        mode: "CROSSMIX", // "OFF" | "AUTO_CROSSFADE" | "MANUAL_CROSSFADE" | "CROSSMIX"
        crossfadeDuration: 5.0,
        style: "AUTO",
        length: "MEDIUM", // "SHORT" | "MEDIUM" | "LONG"
        tempoMatch: "FULL", // "OFF" | "GENTLE" | "FULL"
        alwaysMix: true,
        stunts: true,
        gapless: true,
        transportFadeEnabled: true,
        skipBlend: false,
        skipBlendAhead: 1,
        transportFadeSeconds: 0.6,
        transportEffect: "OFF", // "OFF" | "ECHO" | "REWIND" | "TAPE_STOP" | "FAR_AWAY" | "REVERB" | "FILTER"
        testTools: false
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

  // Synthesize stereo Freeverb-style exponential decay impulse response buffer
  function buildReverbImpulse(ctx, reverbCfg) {
    const sr = ctx.sampleRate || 48000;
    const room = Math.max(0.05, Math.min(1, reverbCfg.roomSize ?? 0.55));
    const damp = Math.max(0, Math.min(1, reverbCfg.damping ?? 0.45));
    const width = Math.max(0, Math.min(1, reverbCfg.width ?? 1.0));
    const preDelaySec = Math.max(0, Math.min(0.12, (reverbCfg.preDelayMs || 0) / 1000));
    const rt60 = 0.25 + room * 2.85; // 0.25s .. 3.1s decay
    const totalSamples = Math.min(sr * 4, Math.max(Math.round((rt60 + preDelaySec) * sr), sr * 0.2));
    const buf = ctx.createBuffer(2, totalSamples, sr);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    const startIdx = Math.round(preDelaySec * sr);

    // One-pole lowpass damping per channel to simulate wall absorption
    const alpha = Math.max(0.08, 1.0 - damp * 0.88);
    let lpL = 0;
    let lpR = 0;
    const kDecay = 6.9078 / (rt60 * sr);

    for (let i = startIdx; i < totalSamples; i++) {
      const t = i - startIdx;
      const env = Math.exp(-kDecay * t);
      const nL = (Math.random() * 2 - 1) * env;
      const nR = (Math.random() * 2 - 1) * env;
      lpL += alpha * (nL - lpL);
      lpR += alpha * (nR - lpR);
      const mid = (lpL + lpR) * 0.5;
      const side = (lpL - lpR) * 0.5 * width;
      L[i] = (mid + side) * 0.55;
      R[i] = (mid - side) * 0.55;
    }
    return buf;
  }

  // Dual-Deck Web Audio Playback + FX + Crossfade Controller
  function createAudioEngine() {
    const deckA = new Audio();
    const deckB = new Audio();
    [deckA, deckB].forEach((d) => {
      d.crossOrigin = "anonymous";
      d.preload = "auto";
    });

    let activeSlot = "A";
    let activeDeck = deckA;
    let standbyDeck = deckB;

    let ctx = null;
    let srcA = null;
    let srcB = null;
    let deckGainA = null;
    let deckGainB = null;

    // Shared FX nodes
    let monoSumNode = null;
    let eqInputNode = null;
    let eqFilters = [];
    let eqPreampGain = null;
    let eqBypassGain = null;
    let spatialSplitter = null;
    let spatialMerger = null;
    let spatialDirectL = null;
    let spatialDirectR = null;
    let spatialCrossFilterL = null;
    let spatialCrossFilterR = null;
    let spatialCrossDelayL = null;
    let spatialCrossDelayR = null;
    let spatialCrossGainL = null;
    let spatialCrossGainR = null;
    let reverbDryGain = null;
    let reverbWetGain = null;
    let reverbLowCut = null;
    let reverbConvolver = null;
    let loudnessCompressor = null;
    let loudnessBoostGain = null;
    let normGain = null;
    let sweepFilter = null;
    let masterGain = null;
    let analyser = null;

    let listeners = new Map();
    let volumeScalar = 0.85;
    let mutedState = false;
    let trackLoudnessDb = null;
    let labState = defaultAudioLabState();
    let normalizeEnabled = true;
    let lastReverbSignature = "";
    let isCrossfading = false;
    let crossfadeTriggeredForSrc = "";
    let autoAdvanceCb = null;
    let crossmixPrepareCb = null;
    let silenceGapMs = 0;

    function emit(name, detail) {
      const set = listeners.get(name);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(detail);
        } catch (_) {}
      }
    }

    function ensureGraph() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();

        deckGainA = ctx.createGain();
        deckGainB = ctx.createGain();
        deckGainA.gain.value = 1;
        deckGainB.gain.value = 0;

        monoSumNode = ctx.createGain();
        monoSumNode.channelInterpretation = "speakers";

        eqPreampGain = ctx.createGain();
        eqInputNode = eqPreampGain;

        // Spatial matrix
        spatialSplitter = ctx.createChannelSplitter(2);
        spatialMerger = ctx.createChannelMerger(2);
        spatialDirectL = ctx.createGain();
        spatialDirectR = ctx.createGain();
        spatialCrossFilterL = ctx.createBiquadFilter();
        spatialCrossFilterR = ctx.createBiquadFilter();
        spatialCrossFilterL.type = "lowpass";
        spatialCrossFilterR.type = "lowpass";
        spatialCrossDelayL = ctx.createDelay(0.05);
        spatialCrossDelayR = ctx.createDelay(0.05);
        spatialCrossGainL = ctx.createGain();
        spatialCrossGainR = ctx.createGain();

        spatialSplitter.connect(spatialDirectL, 0);
        spatialSplitter.connect(spatialDirectR, 1);
        spatialDirectL.connect(spatialMerger, 0, 0);
        spatialDirectR.connect(spatialMerger, 0, 1);

        // Crossfeed L -> R and R -> L
        spatialSplitter.connect(spatialCrossDelayL, 0);
        spatialCrossDelayL.connect(spatialCrossFilterL);
        spatialCrossFilterL.connect(spatialCrossGainL);
        spatialCrossGainL.connect(spatialMerger, 0, 1);

        spatialSplitter.connect(spatialCrossDelayR, 1);
        spatialCrossDelayR.connect(spatialCrossFilterR);
        spatialCrossFilterR.connect(spatialCrossGainR);
        spatialCrossGainR.connect(spatialMerger, 0, 0);

        // Reverb wet/dry parallel
        reverbDryGain = ctx.createGain();
        reverbWetGain = ctx.createGain();
        reverbLowCut = ctx.createBiquadFilter();
        reverbLowCut.type = "highpass";
        reverbLowCut.frequency.value = 180;
        reverbConvolver = ctx.createConvolver();

        spatialMerger.connect(reverbDryGain);
        spatialMerger.connect(reverbLowCut);
        reverbLowCut.connect(reverbConvolver);
        reverbConvolver.connect(reverbWetGain);

        loudnessCompressor = ctx.createDynamicsCompressor();
        loudnessBoostGain = ctx.createGain();
        normGain = ctx.createGain();

        sweepFilter = ctx.createBiquadFilter();
        sweepFilter.type = "allpass";
        sweepFilter.frequency.value = 20000;

        masterGain = ctx.createGain();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;

        reverbDryGain.connect(loudnessCompressor);
        reverbWetGain.connect(loudnessCompressor);
        loudnessCompressor.connect(loudnessBoostGain);
        loudnessBoostGain.connect(normGain);
        normGain.connect(sweepFilter);
        sweepFilter.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(ctx.destination);

        srcA = ctx.createMediaElementSource(deckA);
        srcB = ctx.createMediaElementSource(deckB);
        srcA.connect(deckGainA);
        srcB.connect(deckGainB);
        deckGainA.connect(monoSumNode);
        deckGainB.connect(monoSumNode);

        rebuildEqChain();
        syncGraphParams();
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      return true;
    }

    function rebuildEqChain() {
      if (!ctx || !monoSumNode || !spatialSplitter) return;
      try {
        monoSumNode.disconnect();
      } catch (_) {}
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

      monoSumNode.connect(eqPreampGain);
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
      tail.connect(spatialSplitter);
    }

    function syncGraphParams() {
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Mono
      const mono = !!labState.spatial?.mono;
      monoSumNode.channelCount = mono ? 1 : 2;
      monoSumNode.channelCountMode = mono ? "explicit" : "max";

      // 2. EQ Preamp + AutoPreamp
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

      // 3. Spatial & Dolby Atmos binaural width
      const sp = labState.spatial || {};
      if (!mono && (sp.enabled || sp.surround)) {
        const amt = sp.enabled ? Math.max(0, Math.min(1, sp.amount ?? 1)) : 0.45;
        const mode = sp.mode || "Crossfeed";
        const cutoff = mode === "Speakers" ? 1100 : sp.cutoffHz || 700;
        const angle = sp.speakerAngle || 30;
        const feedDb = mode === "Speakers" ? Math.max(3, 12 - angle * 0.1) : sp.feedDb || 4.5;
        const delaySec = mode === "Speakers" ? (0.22 + (angle / 90) * 0.42) / 1000 : 0.00026;
        const crossAmp = Math.pow(10, -feedDb / 20) * amt * (sp.surround ? 1.15 : 1);
        const directAmp = 1.0 - crossAmp * 0.35;

        spatialDirectL.gain.setTargetAtTime(directAmp, now, 0.04);
        spatialDirectR.gain.setTargetAtTime(directAmp, now, 0.04);
        spatialCrossFilterL.frequency.setTargetAtTime(cutoff, now, 0.04);
        spatialCrossFilterR.frequency.setTargetAtTime(cutoff, now, 0.04);
        spatialCrossDelayL.delayTime.setTargetAtTime(delaySec, now, 0.04);
        spatialCrossDelayR.delayTime.setTargetAtTime(delaySec, now, 0.04);
        spatialCrossGainL.gain.setTargetAtTime(crossAmp, now, 0.04);
        spatialCrossGainR.gain.setTargetAtTime(crossAmp, now, 0.04);
      } else {
        spatialDirectL.gain.setTargetAtTime(1.0, now, 0.04);
        spatialDirectR.gain.setTargetAtTime(1.0, now, 0.04);
        spatialCrossGainL.gain.setTargetAtTime(0, now, 0.04);
        spatialCrossGainR.gain.setTargetAtTime(0, now, 0.04);
      }

      // 4. Reverb (synthesized stereo IR)
      const rv = labState.reverb || {};
      if (rv.enabled) {
        const sig = `${rv.roomSize}|${rv.damping}|${rv.width}|${rv.preDelayMs}`;
        if (sig !== lastReverbSignature) {
          reverbConvolver.buffer = buildReverbImpulse(ctx, rv);
          lastReverbSignature = sig;
        }
        reverbLowCut.frequency.setTargetAtTime(Math.max(20, Math.min(1000, rv.lowCutHz || 180)), now, 0.04);
        reverbDryGain.gain.setTargetAtTime((rv.dry ?? 1.0) * (1 - (rv.mix ?? 0.5) * 0.35), now, 0.06);
        reverbWetGain.gain.setTargetAtTime((rv.wet ?? 0.6) * (rv.mix ?? 0.5) * 1.15, now, 0.06);
      } else {
        reverbDryGain.gain.setTargetAtTime(1.0, now, 0.06);
        reverbWetGain.gain.setTargetAtTime(0.0, now, 0.06);
      }

      // 5. Loudness Enhancer & ReplayGain Normalization
      const ld = labState.loudness || {};
      if (ld.enabled) {
        const comp = Math.max(0, Math.min(1, ld.compression ?? 0.3));
        loudnessCompressor.threshold.setTargetAtTime(-8 - comp * 24, now, 0.04);
        loudnessCompressor.knee.setTargetAtTime(16, now, 0.04);
        loudnessCompressor.ratio.setTargetAtTime(1.5 + comp * 8.5, now, 0.04);
        loudnessCompressor.attack.setTargetAtTime(0.008, now, 0.04);
        loudnessCompressor.release.setTargetAtTime(0.18, now, 0.04);
        const boost = Math.pow(10, Math.max(0, Math.min(12, ld.boostDb || 0)) / 20);
        loudnessBoostGain.gain.setTargetAtTime(boost, now, 0.04);
      } else {
        loudnessCompressor.threshold.setTargetAtTime(-1, now, 0.04);
        loudnessCompressor.ratio.setTargetAtTime(1.5, now, 0.04);
        loudnessBoostGain.gain.setTargetAtTime(1.0, now, 0.04);
      }

      // Normalization
      let normLinear = 1.0;
      if (normalizeEnabled && trackLoudnessDb != null) {
        const preampOffset = (labState.normalize?.preampDb ?? 3.0) - 3.0;
        normLinear = Math.min(1.4, Math.max(0.18, Math.pow(10, (-trackLoudnessDb + preampOffset) / 20)));
      }
      normGain.gain.setTargetAtTime(normLinear, now, 0.05);

      // 6. Playback speed & preserve pitch
      syncPlaybackRateOnDecks();

      // 7. Exponential Volume Curve + DAC Volume
      syncMasterVolumeGain();
    }

    function computeEffectiveVolumeScalar() {
      if (mutedState) return 0;
      const vCfg = labState.volume || {};
      const x = Math.max(0, Math.min(1, volumeScalar));
      let out = vCfg.enabled ? Math.pow(x, Math.max(1, vCfg.exponent || 2)) * Math.max(0.2, Math.min(1, vCfg.limit ?? 1)) : x;
      if (labState.pass?.usbPassthrough && labState.pass?.mode === "DIRECT_USB" && !labState.pass?.fixedVolume) {
        out *= Math.max(0.05, Math.min(1, labState.pass.dacVolume ?? 1));
      }
      return Math.max(0, Math.min(1, out));
    }

    function syncMasterVolumeGain() {
      const eff = computeEffectiveVolumeScalar();
      if (masterGain && ctx) {
        masterGain.gain.setTargetAtTime(eff, ctx.currentTime, 0.025);
        deckA.volume = 1;
        deckB.volume = 1;
      } else {
        deckA.volume = eff;
        deckB.volume = eff;
      }
    }

    function syncPlaybackRateOnDecks() {
      const pb = labState.playback || {};
      let rate = Math.max(0.1, Math.min(8.0, Number(pb.speed) || 1.0));
      const preserve = pb.preservePitch !== false;
      const semitones = Number(pb.pitchSemitones) || 0;
      // HTMLAudioElement supports playbackRate & preservesPitch; if preservesPitch is off, pitch shifts naturally with rate
      // When semitones is shifted while preservePitch is on, nudge rate only when non-zero
      if (preserve && Math.abs(semitones) > 0.01) {
        rate = Math.max(0.25, Math.min(4.0, rate * Math.pow(2, semitones / 12)));
      }
      [deckA, deckB].forEach((d) => {
        try {
          if ("preservesPitch" in d) d.preservesPitch = preserve;
          else if ("webkitPreservesPitch" in d) d.webkitPreservesPitch = preserve;
          d.playbackRate = rate;
        } catch (_) {}
      });
    }

    function getTransitionDurationSec(isManualSkip = false) {
      const cm = labState.crossmix || {};
      if (isManualSkip) {
        if (!cm.skipBlend) return 0;
        return Math.max(0.5, Math.min(10, Number(cm.transportFadeSeconds) || 2.0));
      }
      const mode = cm.mode || "CROSSMIX";
      if (mode === "OFF") return 0;
      if (mode === "AUTO_CROSSFADE") return 5.0;
      if (mode === "MANUAL_CROSSFADE") return Math.max(1, Math.min(20, Number(cm.crossfadeDuration) || 5.0));
      const scale = cm.length === "SHORT" ? 0.6 : cm.length === "LONG" ? 1.5 : 1.0;
      return 6.5 * scale;
    }

    function applyCrossmixEffectEnvelope(style, sec, outGain, inGain) {
      if (!ctx || !sweepFilter) return;
      const now = ctx.currentTime;
      const s = style === "AUTO" ? "SILK_BLEND" : style || "SILK_BLEND";
      sweepFilter.type = "allpass";
      sweepFilter.frequency.cancelScheduledValues(now);

      if (s === "FILTER_SWEEP" || s === "HIGH_PASS_LIFT" || s === "LO_FI_MELT") {
        sweepFilter.type = s === "HIGH_PASS_LIFT" ? "highpass" : "lowpass";
        sweepFilter.Q.setValueAtTime(1.4, now);
        if (s === "HIGH_PASS_LIFT") {
          sweepFilter.frequency.setValueAtTime(40, now);
          sweepFilter.frequency.exponentialRampToValueAtTime(2800, now + sec * 0.55);
          sweepFilter.frequency.exponentialRampToValueAtTime(40, now + sec);
        } else {
          sweepFilter.frequency.setValueAtTime(18000, now);
          sweepFilter.frequency.exponentialRampToValueAtTime(420, now + sec * 0.55);
          sweepFilter.frequency.exponentialRampToValueAtTime(18000, now + sec);
        }
      } else if (s === "TAPE_STOP" || s === "POWER_DOWN") {
        const outEl = outGain === deckGainA ? deckA : deckB;
        try {
          if ("preservesPitch" in outEl) outEl.preservesPitch = false;
          else if ("webkitPreservesPitch" in outEl) outEl.webkitPreservesPitch = false;
          const base = outEl.playbackRate || 1;
          const start = performance.now();
          const drop = () => {
            const p = Math.min(1, (performance.now() - start) / (sec * 500));
            outEl.playbackRate = Math.max(0.25, base * (1 - p * 0.7));
            if (p < 1 && !outEl.paused) requestAnimationFrame(drop);
          };
          requestAnimationFrame(drop);
        } catch (_) {}
      }

      // Equal power vs silk curve
      outGain.gain.cancelScheduledValues(now);
      inGain.gain.cancelScheduledValues(now);
      outGain.gain.setValueAtTime(1, now);
      inGain.gain.setValueAtTime(0, now);
      const steps = 16;
      const outCurve = new Float32Array(steps);
      const inCurve = new Float32Array(steps);
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        outCurve[i] = Math.cos(t * Math.PI * 0.5);
        inCurve[i] = Math.sin(t * Math.PI * 0.5);
      }
      outGain.gain.setValueCurveAtTime(outCurve, now, sec);
      inGain.gain.setValueCurveAtTime(inCurve, now, sec);
    }

    function wireDeckEvents(deck, slot) {
      deck.addEventListener("timeupdate", () => {
        if (deck !== activeDeck) return;
        emit("timeupdate", { currentTime: deck.currentTime || 0, duration: isFinite(deck.duration) ? deck.duration : 0 });

        // Skip Silence check (soft threshold)
        if (window.MochyAppSettings?.skipSilence && analyser && !deck.paused) {
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

        // Auto CrossMix / Crossfade trigger before track ends
        const dur = deck.duration;
        const rem = isFinite(dur) ? dur - deck.currentTime : Infinity;
        const fadeSec = getTransitionDurationSec(false);
        if (
          fadeSec > 0.5 &&
          !isCrossfading &&
          isFinite(dur) &&
          dur > fadeSec * 2 + 3 &&
          rem <= fadeSec &&
          rem > 0.35 &&
          crossfadeTriggeredForSrc !== deck.src &&
          crossmixPrepareCb
        ) {
          crossfadeTriggeredForSrc = deck.src;
          crossmixPrepareCb(fadeSec);
        }
      });

      deck.addEventListener("play", () => {
        if (deck === activeDeck) emit("play");
      });
      deck.addEventListener("pause", () => {
        if (deck === activeDeck && !isCrossfading) emit("pause");
      });
      deck.addEventListener("ended", () => {
        if (deck === activeDeck && autoAdvanceCb) autoAdvanceCb();
      });
      deck.addEventListener("error", () => {
        if (deck === activeDeck) emit("error", deck.error);
      });
    }
    wireDeckEvents(deckA, "A");
    wireDeckEvents(deckB, "B");

    async function loadUrl(url, { autoPlay = true, isSkip = false, loudnessDb = null } = {}) {
      ensureGraph();
      trackLoudnessDb = loudnessDb;
      syncGraphParams();

      const blendSec = getTransitionDurationSec(isSkip);
      const shouldBlend = isSkip && blendSec > 0.25 && activeDeck.src && !activeDeck.paused;

      if (shouldBlend && ctx && deckGainA && deckGainB) {
        isCrossfading = true;
        const outDeck = activeDeck;
        const inDeck = standbyDeck;
        const outGain = activeSlot === "A" ? deckGainA : deckGainB;
        const inGain = activeSlot === "A" ? deckGainB : deckGainA;

        inDeck.src = url;
        syncPlaybackRateOnDecks();
        applyCrossmixEffectEnvelope(labState.crossmix?.style, blendSec, outGain, inGain);

        try {
          if (autoPlay) await inDeck.play();
        } catch (err) {
          isCrossfading = false;
          throw err;
        }

        activeDeck = inDeck;
        standbyDeck = outDeck;
        activeSlot = activeSlot === "A" ? "B" : "A";
        crossfadeTriggeredForSrc = "";

        setTimeout(() => {
          outDeck.pause();
          outDeck.currentTime = 0;
          syncPlaybackRateOnDecks();
          if (sweepFilter && ctx) {
            sweepFilter.type = "allpass";
          }
          isCrossfading = false;
        }, blendSec * 1000 + 80);
      } else {
        crossfadeTriggeredForSrc = "";
        isCrossfading = false;
        standbyDeck.pause();
        if (deckGainA && deckGainB && ctx) {
          const gActive = activeSlot === "A" ? deckGainA : deckGainB;
          const gIdle = activeSlot === "A" ? deckGainB : deckGainA;
          gActive.gain.setValueAtTime(1, ctx.currentTime);
          gIdle.gain.setValueAtTime(0, ctx.currentTime);
        }
        activeDeck.src = url;
        syncPlaybackRateOnDecks();
        if (autoPlay) {
          await activeDeck.play();
        }
      }
    }

    async function crossfadeIntoNext(url, durationSec, loudnessDb = null) {
      ensureGraph();
      trackLoudnessDb = loudnessDb;
      syncGraphParams();
      if (!ctx || !deckGainA || !deckGainB) {
        return loadUrl(url, { autoPlay: true, isSkip: false, loudnessDb });
      }
      isCrossfading = true;
      const outDeck = activeDeck;
      const inDeck = standbyDeck;
      const outGain = activeSlot === "A" ? deckGainA : deckGainB;
      const inGain = activeSlot === "A" ? deckGainB : deckGainA;

      inDeck.src = url;
      syncPlaybackRateOnDecks();
      applyCrossmixEffectEnvelope(labState.crossmix?.style, durationSec, outGain, inGain);
      await inDeck.play().catch(() => {});

      activeDeck = inDeck;
      standbyDeck = outDeck;
      activeSlot = activeSlot === "A" ? "B" : "A";

      setTimeout(() => {
        outDeck.pause();
        outDeck.currentTime = 0;
        syncPlaybackRateOnDecks();
        if (sweepFilter && ctx) sweepFilter.type = "allpass";
        isCrossfading = false;
      }, durationSec * 1000 + 80);
    }

    function play() {
      ensureGraph();
      const cm = labState.crossmix || {};
      const activeGain = activeSlot === "A" ? deckGainA : deckGainB;
      if (cm.transportFadeEnabled && ctx && activeGain) {
        const fade = Math.max(0.08, Math.min(3.5, Number(cm.transportFadeSeconds) || 0.45));
        activeGain.gain.cancelScheduledValues(ctx.currentTime);
        activeGain.gain.setValueAtTime(0.01, ctx.currentTime);
        activeGain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + Math.min(fade, 1.4));
      }
      return activeDeck.play();
    }

    function pause() {
      const cm = labState.crossmix || {};
      const activeGain = activeSlot === "A" ? deckGainA : deckGainB;
      if (cm.transportFadeEnabled && ctx && activeGain && !activeDeck.paused) {
        const fade = Math.max(0.08, Math.min(2.5, (Number(cm.transportFadeSeconds) || 0.6) * 0.45));
        const now = ctx.currentTime;
        const fx = cm.transportEffect || "OFF";
        if ((fx === "FILTER" || fx === "FAR_AWAY") && sweepFilter) {
          sweepFilter.type = "lowpass";
          sweepFilter.frequency.setValueAtTime(16000, now);
          sweepFilter.frequency.exponentialRampToValueAtTime(340, now + fade);
        }
        activeGain.gain.cancelScheduledValues(now);
        activeGain.gain.setValueAtTime(activeGain.gain.value || 1, now);
        activeGain.gain.linearRampToValueAtTime(0.001, now + fade);
        const target = activeDeck;
        setTimeout(() => {
          target.pause();
          if (activeGain && ctx) activeGain.gain.setValueAtTime(1, ctx.currentTime);
          if (sweepFilter) sweepFilter.type = "allpass";
        }, fade * 1000 + 20);
      } else {
        activeDeck.pause();
      }
    }

    return {
      EQ_FREQUENCIES,
      EQ_PRESETS,
      REVERB_PRESETS,
      LOUDNESS_PRESETS,
      SPATIAL_PRESETS,
      SPEED_PRESETS,
      VOLUME_PRESETS,
      CROSSMIX_STYLES,
      BUILTIN_AUTOEQ_MODELS,
      flatNodes,
      defaultAudioLabState,
      biquadResponseDb,
      combinedEqResponseDb,
      computeAutoHeadroomDb,

      addEventListener(name, fn) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(fn);
      },
      onAutoAdvance(fn) {
        autoAdvanceCb = fn;
      },
      onCrossmixPrepare(fn) {
        crossmixPrepareCb = fn;
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
      loadUrl,
      crossfadeIntoNext,
      play,
      pause,
      previewFilterSweep() {
        ensureGraph();
        if (!ctx || !sweepFilter) return;
        const sec = Math.min(5, Math.max(1.5, getTransitionDurationSec(false) || 3));
        const g = activeSlot === "A" ? deckGainA : deckGainB;
        if (!g) return;
        const now = ctx.currentTime;
        sweepFilter.type = "lowpass";
        sweepFilter.frequency.setValueAtTime(16000, now);
        sweepFilter.frequency.exponentialRampToValueAtTime(520, now + sec * 0.45);
        sweepFilter.frequency.exponentialRampToValueAtTime(16000, now + sec);
        setTimeout(() => {
          if (sweepFilter) sweepFilter.type = "allpass";
        }, sec * 1000 + 50);
      },
      get currentTime() {
        return activeDeck.currentTime || 0;
      },
      set currentTime(val) {
        try {
          activeDeck.currentTime = val;
        } catch (_) {}
      },
      get duration() {
        return isFinite(activeDeck.duration) ? activeDeck.duration : 0;
      },
      get paused() {
        return activeDeck.paused;
      },
      get src() {
        return activeDeck.src;
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
    REVERB_PRESETS,
    LOUDNESS_PRESETS,
    SPATIAL_PRESETS,
    SPEED_PRESETS,
    VOLUME_PRESETS,
    CROSSMIX_STYLES,
    BUILTIN_AUTOEQ_MODELS,
    flatNodes,
    defaultAudioLabState,
    biquadResponseDb,
    combinedEqResponseDb,
    computeAutoHeadroomDb,
    createAudioEngine
  };
})();
