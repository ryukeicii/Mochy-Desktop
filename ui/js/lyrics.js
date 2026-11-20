/* ==========================================================================
   Mochy lyrics engine
   - the lyrics are laid out once per song; after that a frame only touches what changed
   - lines get their look (brightness, blur, size) from a data attribute and CSS transitions
   - the line being sung is drawn by one WebGL2 pass: the sweep, the letters rising into place
     and the bloom on held notes, ported from the mac app's lyricRise and lyricBloom shaders
   ========================================================================== */

(() => {
  "use strict";

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (v) => {
    const t = clamp01(v);
    return t * t * (3 - 2 * t);
  };
  const MAX_WORDS = 254;

  // ------------------------------------------------------------------------
  // the karaoke shader
  // ------------------------------------------------------------------------
  const VS = `#version 300 es
in vec2 a_pos;
uniform vec2 u_size;
out vec2 v_px;
void main() {
  v_px = vec2((a_pos.x * 0.5 + 0.5) * u_size.x, (0.5 - a_pos.y * 0.5) * u_size.y);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
in vec2 v_px;
out vec4 o;
uniform sampler2D u_text;          // the line's glyphs, white on clear
uniform sampler2D u_index;         // which word owns a pixel: red = index + 1
uniform highp sampler2D u_words;   // per word, row 0 box, row 1 progress/glow/head/swell, row 2 dimmed/font/soft/unsung
uniform vec2 u_size;
uniform float u_activation;

float coverage(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > u_size.x || p.y > u_size.y) return 0.0;
  return texture(u_text, p / u_size).a;
}

// smooth 0 to 1 bell, the same curve the android and mac lyrics use
float bellCurve(float d, float span) {
  float w = 1.0 - min(1.0, abs(d) / max(span, 1.0));
  return w * w * (3.0 - 2.0 * w);
}

void main() {
  float id = floor(texture(u_index, v_px / u_size).r * 255.0 + 0.5) - 1.0;
  if (id < 0.0) { o = vec4(0.0); return; }
  int i = int(id);
  vec4 box = texelFetch(u_words, ivec2(i, 0), 0);
  vec4 anim = texelFetch(u_words, ivec2(i, 1), 0);
  vec4 meta = texelFetch(u_words, ivec2(i, 2), 0);
  float progress = anim.x;
  float glow = anim.y;
  float head = anim.z;
  float swell = anim.w;
  float font = meta.y;
  float width = max(box.z - box.x, 1.0);

  // a held note swells a little from the word's foot
  vec2 foot = vec2(box.x, box.w);
  vec2 p = foot + (v_px - foot) / (1.0 + 0.06 * swell);
  p.y += font * 0.05 * swell;

  // letters still to come wait a little below their place and climb in as the sweep reaches them
  float drop = font * 0.035 * u_activation;
  float span = font * 1.1;
  if (progress <= 0.0) {
    p.y -= drop;
  } else if (progress < 1.0) {
    float headX = box.x - span + (width + span) * progress;
    float passed = clamp((headX - p.x) / max(span, 1.0) + 1.0, 0.0, 1.0);
    p.y -= drop * (1.0 - passed * passed * (3.0 - 2.0 * passed));
  }

  float a = coverage(p);

  // solid light up to the sweep, a soft edge, then the waiting brightness
  float soft = meta.z;
  float centre = -soft + (1.0 + soft * 2.0) * progress;
  float lo = clamp(centre - soft, 0.0, 1.0);
  float hi = clamp(centre + soft, lo + 0.0001, 1.0001);
  float lit = 1.0 - smoothstep(lo, hi, (p.x - box.x) / width);
  float bright = meta.x > 0.5 ? 0.8 : 1.0;
  float alpha = a * mix(meta.w, bright, lit);

  // a soft light trailing the sweep, strongest on a held note; it only ever adds
  if (glow > 0.003) {
    float hx = box.x + width * head;
    float b = bellCurve(p.x - hx + font * 0.7, font * 2.2);
    if (b > 0.0) {
      float r = font * 0.1;
      float sum = 0.0;
      for (int ring = 1; ring <= 2; ring++) {
        float rr = r * float(ring) * 0.85;
        for (int k = 0; k < 8; k++) {
          float ang = float(k) * 0.785398 + float(ring) * 0.392699;
          sum += coverage(p + vec2(cos(ang), sin(ang)) * rr);
        }
      }
      alpha += sum / 16.0 * glow * b;
    }
  }
  alpha = clamp(alpha, 0.0, 1.0);
  o = vec4(alpha);
}`;

  class Karaoke {
    static create() {
      const canvas = document.createElement("canvas");
      canvas.className = "lyr-gl";
      const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
      if (!gl) return null;
      const k = new Karaoke(canvas, gl);
      return k.ok ? k : null;
    }

    constructor(canvas, gl) {
      this.canvas = canvas;
      this.gl = gl;
      this.ok = false;
      this.text = document.createElement("canvas");
      this.index = document.createElement("canvas");
      this.words = [];
      this.anim = null;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn("[lyrics] shader:", gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VS);
      const fs = compile(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      this.prog = prog;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {
        size: gl.getUniformLocation(prog, "u_size"),
        activation: gl.getUniformLocation(prog, "u_activation"),
        text: gl.getUniformLocation(prog, "u_text"),
        index: gl.getUniformLocation(prog, "u_index"),
        words: gl.getUniformLocation(prog, "u_words")
      };
      const tex = (unit, filter) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      this.tText = tex(0, gl.LINEAR);
      this.tIndex = tex(1, gl.NEAREST);
      this.tWords = tex(2, gl.NEAREST);
      gl.uniform1i(this.u.text, 0);
      gl.uniform1i(this.u.index, 1);
      gl.uniform1i(this.u.words, 2);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.ok = false;
      });
      this.ok = true;
    }

    // lays the row's words out on a texture, exactly where the page put them
    attach(row) {
      const gl = this.gl;
      const inner = row.inner;
      const words = row.words.filter((w) => w.el.isConnected);
      if (!words.length || words.length > MAX_WORDS) return false;
      const font = parseFloat(getComputedStyle(row.words[0].el).fontSize) || 30;
      const pad = Math.ceil(font * 0.45);
      const W = inner.offsetWidth + pad * 2;
      const H = inner.offsetHeight + pad * 2;
      if (W < 4 || H < 4) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.pad = pad;
      this.W = W;
      this.H = H;

      this.text.width = Math.ceil(W * dpr);
      this.text.height = Math.ceil(H * dpr);
      const ctx = this.text.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "alphabetic";

      this.index.width = Math.ceil(W);
      this.index.height = Math.ceil(H);
      const ix = this.index.getContext("2d");
      ix.clearRect(0, 0, W, H);
      ix.imageSmoothingEnabled = false;

      const boxes = new Float32Array(words.length * 4);
      const meta = new Float32Array(words.length * 4);
      words.forEach((w, i) => {
        const el = w.el;
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize) || font;
        const lineHeight = parseFloat(cs.lineHeight) || size * 1.2;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
        const m = ctx.measureText("Hg");
        const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? size * 0.8;
        const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? size * 0.2;
        const x = pad + w.left;
        const y = pad + w.top;
        const baseline = y + (lineHeight - (ascent + descent)) / 2 + ascent;
        ctx.fillText(w.w.text, x, baseline);
        boxes.set([x, y, x + w.width, y + w.height], i * 4);
        meta.set([w.dimmed ? 1 : 0, size, Math.min(0.45, 1.1 / Math.max(w.w.text.length, 1)), w.dimmed ? 0.32 : 0.42], i * 4);
        // the word's own patch, wide enough for its glow and its rise, never a pixel of anti-aliasing between two of them
        const gx = Math.round(x - size * 0.12);
        const gy = Math.round(y - pad * 0.9);
        ix.fillStyle = `rgb(${i + 1},0,0)`;
        ix.fillRect(gx, gy, Math.round(w.width + size * 0.24), Math.round(w.height + pad * 1.8));
      });
      this.count = words.length;
      this.rowWords = words;
      this.anim = new Float32Array(words.length * 4);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tText);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.text);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tIndex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.index);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.tWords);
      const table = new Float32Array(words.length * 4 * 3);
      table.set(boxes, 0);
      table.set(meta, words.length * 8);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, words.length, 3, 0, gl.RGBA, gl.FLOAT, table);

      this.canvas.width = Math.ceil(W * dpr);
      this.canvas.height = Math.ceil(H * dpr);
      this.canvas.style.width = `${W}px`;
      this.canvas.style.height = `${H}px`;
      this.canvas.style.left = `${-pad}px`;
      this.canvas.style.top = `${-pad}px`;
      inner.appendChild(this.canvas);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.prog);
      gl.uniform2f(this.u.size, W, H);
      this.row = row;
      return true;
    }

    detach() {
      if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.row = null;
    }

    // one frame: four numbers per word go up, one quad comes down
    draw(time, glowOn) {
      const gl = this.gl;
      const row = this.row;
      if (!row || !this.ok) return;
      const a = this.anim;
      this.rowWords.forEach((w, i) => {
        const s = wordState(w.w, time, glowOn, w.dimmed);
        a[i * 4] = s.progress;
        a[i * 4 + 1] = s.glow;
        a[i * 4 + 2] = s.head;
        a[i * 4 + 3] = s.swell;
      });
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.tWords);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, this.count, 1, gl.RGBA, gl.FLOAT, a);
      gl.uniform1f(this.u.activation, smooth((time - row.start + 0.4) / 0.4));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  // how far a word is sung, how much it glows and swells, the same numbers the mac app works out
  function wordState(w, time, glowOn, dimmed) {
    const duration = Math.max(w.end - w.start, 0.05);
    const progress = clamp01((time - w.start) / duration);
    const held = clamp01((duration - 0.85) / 1.3);
    const glowIn = smooth((time - w.start + 0.05) / 0.25);
    const glowOut = 1 - smooth((time - w.end) / 0.7);
    const glow = glowOn ? glowIn * glowOut * (0.5 + 0.95 * held) * (dimmed ? 0.6 : 1) : 0;
    const swell = held * glowIn * (1 - smooth((time - w.end + 0.05) / 0.45));
    // the glow keeps travelling past the word's end, so it slides off instead of switching off
    const head = time < w.end ? progress : 1 + (time - w.end) / Math.max(duration, 0.3);
    return { progress, glow, head, swell };
  }

  // ------------------------------------------------------------------------
  // a lyrics view: the panel's or the full player's
  // ------------------------------------------------------------------------
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  class LyricsView {
    constructor(host, lyrics, opts = {}) {
      this.host = host;
      this.lyrics = lyrics;
      this.opts = opts;
      this.rows = [];
      this.active = -2;
      this.scrollPos = 0;
      this.userUntil = 0;
      this.lastTime = -1;
      this.karaoke = null;
      this.fallbackRow = null;
      this.build();
    }

    build() {
      const { lyrics, host, opts } = this;
      host.classList.add("lyr-host");
      host.classList.toggle("lyr-full", !!opts.full);
      host.classList.toggle("lyr-blur", opts.blur !== false);
      host.dataset.align = opts.align || "left";
      const track = document.createElement("div");
      track.className = "lyr-track";
      const synced = !!lyrics.isSynced;
      const lines = lyrics.lines || [];
      const rows = [];
      const gap = (start, end) => rows.push({ kind: "gap", start, end });
      if (synced && lines.length && lines[0].time > 6) gap(0.6, lines[0].time);
      lines.forEach((line, i) => {
        rows.push({ kind: "line", line, start: line.time });
        const next = lines[i + 1];
        const lastWord = line.words?.length ? line.words[line.words.length - 1].end : null;
        const end = line.end ?? lastWord;
        if (synced && next && end != null && next.time - end > 4.5) gap(end + 0.3, next.time);
      });

      const html = rows
        .map((r, i) => {
          if (r.kind === "gap") {
            return `<div class="lyr-row lyr-gap" data-i="${i}"><div class="lyr-dots"><i></i><i></i><i></i></div></div>`;
          }
          const line = r.line;
          const side = line.isOppositeVoice ? "end" : line.isGroupVoice ? "center" : "";
          const words = line.words?.length
            ? line.words.map((w, wi) => `<span class="w" data-w="${wi}">${esc(w.text)}</span>${w.spaceAfter ? " " : ""}`).join("")
            : esc(line.text);
          const back = line.backing?.text
            ? `<div class="lyr-back">${
                line.backing.words?.length
                  ? line.backing.words.map((w, wi) => `<span class="w" data-b="${wi}">${esc(w.text)}</span>${w.spaceAfter ? " " : ""}`).join("")
                  : esc(line.backing.text)
              }</div>`
            : "";
          const sub = line.subLine ? `<div class="lyr-sub">${esc(line.subLine)}</div>` : "";
          return `<div class="lyr-row lyr-line ${line.words?.length ? "worded" : ""}" data-i="${i}" ${side ? `data-side="${side}"` : ""}><div class="lyr-inner"><div class="lyr-main">${words}</div>${sub}${back}</div></div>`;
        })
        .join("");
      track.innerHTML = `<div class="lyr-pad top"></div>${html}<div class="lyr-pad bottom"></div>`;
      host.innerHTML = "";
      host.appendChild(track);
      this.track = track;

      const els = track.querySelectorAll(".lyr-row");
      rows.forEach((r, i) => {
        r.el = els[i];
        if (r.kind === "line") {
          r.inner = r.el.firstElementChild;
          r.words = [];
          r.el.querySelectorAll(".lyr-main .w").forEach((el) => {
            const w = r.line.words[Number(el.dataset.w)];
            if (w) r.words.push({ el, w, dimmed: false });
          });
          r.el.querySelectorAll(".lyr-back .w").forEach((el) => {
            const w = r.line.backing.words[Number(el.dataset.b)];
            if (w) r.words.push({ el, w, dimmed: true });
          });
        } else {
          r.dots = Array.from(r.el.querySelectorAll("i"));
          r.dotsBox = r.el.firstElementChild;
        }
      });
      this.rows = rows;
      this.starts = rows.map((r) => r.start);
      this.synced = synced;

      this.onWheel = () => {
        this.userUntil = performance.now() + 2600;
        host.classList.add("lyr-scrolling");
      };
      host.addEventListener("wheel", this.onWheel, { passive: true });
      host.addEventListener("touchmove", this.onWheel, { passive: true });
      this.onClick = (e) => {
        const rowEl = e.target.closest(".lyr-row");
        if (!rowEl || !this.synced) return;
        const row = this.rows[Number(rowEl.dataset.i)];
        if (row && opts.onSeek) opts.onSeek(row.kind === "gap" ? row.end - 0.6 : row.start);
      };
      host.addEventListener("click", this.onClick);
      this.resize = new ResizeObserver(() => this.relayout());
      this.resize.observe(host);

      if (synced) {
        if (opts.useShader !== false) this.karaoke = LyricsView.sharedKaraoke(opts.full ? "full" : "panel");
        this.measure();
      } else {
        host.classList.add("lyr-plain");
      }
    }

    // where each row sits in the track; read once, and again only when the box changes size
    measure() {
      this.offsets = this.rows.map((r) => r.el.offsetTop + r.el.offsetHeight / 2);
      for (const r of this.rows) {
        if (!r.words) continue;
        // the inner box is the words' positioned parent, the same box the karaoke canvas sits in
        for (const w of r.words) {
          w.left = w.el.offsetLeft;
          w.top = w.el.offsetTop;
          w.width = w.el.offsetWidth;
          w.height = w.el.offsetHeight;
        }
      }
    }

    relayout() {
      if (!this.synced) return;
      this.measure();
      const row = this.rows[this.active];
      if (row && this.karaoke && this.karaoke.row === row) {
        this.karaoke.detach();
        this.attachKaraoke(row);
        this.lastTime = -1;
      }
    }

    static sharedKaraoke(slot) {
      LyricsView._k = LyricsView._k || {};
      if (!(slot in LyricsView._k)) LyricsView._k[slot] = Karaoke.create();
      return LyricsView._k[slot];
    }

    attachKaraoke(row) {
      if (!row.words?.length) return;
      if (this.karaoke && this.karaoke.ok && this.karaoke.attach(row)) {
        row.el.classList.add("gl");
        return;
      }
      // without webgl2 the words sweep with a gradient, set on this line's words alone
      row.el.classList.add("css-sweep");
      this.fallbackRow = row;
    }

    detachKaraoke(row) {
      if (!row) return;
      row.el.classList.remove("gl", "css-sweep");
      if (this.karaoke && this.karaoke.row === row) this.karaoke.detach();
      if (this.fallbackRow === row) {
        row.words.forEach((w) => w.el.style.removeProperty("--p"));
        this.fallbackRow = null;
      }
    }

    findActive(time) {
      const s = this.starts;
      let lo = 0;
      let hi = s.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (s[mid] <= time) {
          found = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      // a gap only holds the stage until the singing comes back
      if (found >= 0 && this.rows[found].kind === "gap" && time >= this.rows[found].end) found = Math.min(found + 1, s.length - 1);
      return found;
    }

    setActive(index) {
      const prev = this.active;
      this.active = index;
      const rows = this.rows;
      // only rows near either end of the move change; far ones already wear their furthest look
      const from = Math.max(0, Math.min(prev < 0 ? 0 : prev, index < 0 ? 0 : index) - 9);
      const to = Math.min(rows.length - 1, Math.max(prev, index) + 9);
      for (let i = from; i <= to; i++) {
        const d = index < 0 ? i + 1 : i - index;
        const clampD = d > 6 ? 6 : d < -6 ? -6 : d;
        const el = rows[i].el;
        if (el.dataset.d !== String(clampD)) el.dataset.d = String(clampD);
      }
      if (prev >= 0 && prev !== index) this.detachKaraoke(rows[prev]);
      if (index >= 0 && rows[index].kind === "line") this.attachKaraoke(rows[index]);
    }

    // first paint: every row gets its distance once
    initDistances(index) {
      this.rows.forEach((r, i) => {
        const d = index < 0 ? i + 1 : i - index;
        r.el.dataset.d = String(d > 6 ? 6 : d < -6 ? -6 : d);
      });
    }

    frame(time, now, dt) {
      if (!this.synced || !this.rows.length) return;
      const index = this.findActive(time);
      if (this.active === -2) {
        this.initDistances(index);
        this.active = -1;
      }
      if (index !== this.active) this.setActive(index);

      // the follow: a soft spring toward the active line, unless someone is reading ahead
      const host = this.host;
      if (performance.now() > this.userUntil) {
        if (host.classList.contains("lyr-scrolling")) {
          host.classList.remove("lyr-scrolling");
          this.scrollPos = host.scrollTop;
        }
        const anchor = host.clientHeight * (this.opts.full ? 0.4 : 0.33);
        const centre = index >= 0 ? this.offsets[index] : 0;
        const target = Math.max(0, centre - anchor);
        const k = 1 - Math.exp(-(dt || 16) / 110);
        const next = this.scrollPos + (target - this.scrollPos) * k;
        this.scrollPos = Math.abs(target - next) < 0.4 ? target : next;
        if (Math.abs(host.scrollTop - this.scrollPos) >= 0.5) host.scrollTop = this.scrollPos;
      } else {
        this.scrollPos = host.scrollTop;
      }

      const row = this.rows[index];
      if (!row) return;
      if (row.kind === "gap") {
        this.drawGap(row, time);
      } else if (row.words?.length && Math.abs(time - this.lastTime) > 0.001) {
        if (this.karaoke && this.karaoke.row === row) {
          this.karaoke.draw(time, this.opts.glow !== false);
        } else if (this.fallbackRow === row) {
          for (const w of row.words) {
            const p = clamp01((time - w.w.start) / Math.max(w.w.end - w.w.start, 0.05));
            const v = p.toFixed(3);
            if (w.el.style.getPropertyValue("--p") !== v) w.el.style.setProperty("--p", v);
          }
        }
      }
      this.lastTime = time;
    }

    // three dots that fill one by one across an instrumental gap, breathing, then shrink away just before the singing
    drawGap(row, time) {
      const progress = clamp01((time - row.start) / Math.max(row.end - row.start, 0.1));
      const breath = 1 + 0.07 * Math.sin(time * 2.8);
      const outro = 1 - smooth((time - (row.end - 0.5)) / 0.5);
      row.dots.forEach((d, i) => {
        d.style.opacity = (0.22 + 0.78 * clamp01(progress * 3 - i)).toFixed(3);
      });
      row.dotsBox.style.transform = `scale(${(breath * outro).toFixed(4)})`;
      row.dotsBox.style.opacity = outro.toFixed(3);
    }

    setOptions(opts) {
      Object.assign(this.opts, opts);
      this.host.classList.toggle("lyr-blur", this.opts.blur !== false);
      this.lastTime = -1;
    }

    destroy() {
      if (this.active >= 0) this.detachKaraoke(this.rows[this.active]);
      this.resize?.disconnect();
      this.host.removeEventListener("wheel", this.onWheel);
      this.host.removeEventListener("touchmove", this.onWheel);
      this.host.removeEventListener("click", this.onClick);
      this.host.classList.remove("lyr-host", "lyr-full", "lyr-plain", "lyr-scrolling", "lyr-blur");
    }
  }

  window.MochyLyrics = { LyricsView, wordState };
})();
