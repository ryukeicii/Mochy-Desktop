/* ==========================================================================
   The player's backdrop: four soft colour pools from the cover drifting on slow loops,
   blended by closeness into one smooth field (the mac app's `ambient` shader).
   It's a smooth field, so it renders at half size and 30 frames a second, and rests when hidden.
   ========================================================================== */

(() => {
  "use strict";

  const VS = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FS = `
precision highp float;
uniform vec2 u_size;
uniform float u_time;
uniform vec3 u_deep;
uniform vec3 u_left;
uniform vec3 u_right;
uniform vec3 u_accent;
uniform float u_scale;

void main() {
  vec2 position = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y);
  vec2 uv = position / u_size;
  float aspect = u_size.y / max(u_size.x, 1.0);
  vec2 p = vec2(uv.x, uv.y * aspect);
  float w = 6.2831853 / 50.0;
  float t = u_time;

  vec2 a = vec2(0.22 + 0.16 * sin(t * w + 0.4), (0.38 + 0.10 * cos(t * w * 2.0)) * aspect);
  vec2 b = vec2(0.80 + 0.14 * cos(t * w + 1.3), (0.42 + 0.12 * sin(t * w * 2.0 + 0.7)) * aspect);
  vec2 c = vec2(0.48 + 0.24 * cos(t * w * 3.0 + 2.1), (0.92 + 0.06 * sin(t * w + 1.9)) * aspect);
  vec2 d = vec2(0.62 + 0.22 * sin(t * w * 2.0 + 3.4), (0.70 + 0.12 * cos(t * w * 3.0 + 0.4)) * aspect);

  vec2 da = p - a; vec2 db = p - b; vec2 dc = p - c; vec2 dd = p - d;
  float wa = exp(-dot(da, da) * 3.2);
  float wb = exp(-dot(db, db) * 3.2);
  float wc = exp(-dot(dc, dc) * 2.4);
  float wd = exp(-dot(dd, dd) * 4.0) * 0.8;
  float sum = wa + wb + wc + wd + 0.0001;
  vec3 col = (u_left * wa + u_right * wb + u_deep * wc + u_accent * wd) / sum;

  col *= 1.0 - 0.16 * smoothstep(0.6, 1.0, uv.y);
  // grain at screen scale, so banding never shows in the dark blues
  float grain = fract(sin(dot(position * u_scale, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

  const SCALE = 0.5;
  const FRAME_MS = 1000 / 30;

  class Ambient {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
      this.current = [
        [0.16, 0.14, 0.28],
        [0.28, 0.12, 0.24],
        [0.09, 0.18, 0.3],
        [0.12, 0.1, 0.2]
      ];
      this.target = this.current.map((c) => c.slice());
      this.last = 0;
      this.animated = true;
      if (!this.gl) return;
      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        this.gl = null;
        return;
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = (n) => gl.getUniformLocation(prog, n);
      this.u = { size: u("u_size"), time: u("u_time"), deep: u("u_deep"), left: u("u_left"), right: u("u_right"), accent: u("u_accent"), scale: u("u_scale") };
      this.started = performance.now();
    }

    // the cover's four quadrants: the top two drift on each side, the bottom left sinks deep, the bottom right is the accent
    setPalette(stops) {
      if (!stops || stops.length < 4) return;
      this.target = [
        stops[2].map((c) => c * 0.72),
        stops[0],
        stops[1],
        stops[3]
      ];
    }

    render(now, force) {
      const gl = this.gl;
      if (!gl) return;
      if (!force && (document.hidden || now - this.last < FRAME_MS)) return;
      const dt = Math.min(200, now - (this.last || now));
      this.last = now;
      const canvas = this.canvas;
      const w = Math.max(1, Math.round(canvas.clientWidth * SCALE));
      const h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
      const resized = canvas.width !== w || canvas.height !== h;
      if (resized) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      // the colours ease over about a second when the song changes
      const k = 1 - Math.exp(-dt / 380);
      let drift = 0;
      for (let i = 0; i < 4; i++) {
        for (let c = 0; c < 3; c++) {
          const gap = this.target[i][c] - this.current[i][c];
          this.current[i][c] += gap * k;
          drift = Math.max(drift, Math.abs(gap));
        }
      }
      // a still backdrop with settled colours looks the same next frame, so the gpu rests
      if (!force && !this.animated && !resized && drift < 0.0006) return;
      const t = this.animated ? (now - this.started) / 1000 : 8;
      gl.uniform2f(this.u.size, w, h);
      gl.uniform1f(this.u.time, t);
      gl.uniform1f(this.u.scale, 1 / SCALE);
      gl.uniform3fv(this.u.deep, this.current[0]);
      gl.uniform3fv(this.u.left, this.current[1]);
      gl.uniform3fv(this.u.right, this.current[2]);
      gl.uniform3fv(this.u.accent, this.current[3]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // hands the gpu context back right away, since a closed player would otherwise keep it until a garbage sweep
    dispose() {
      const gl = this.gl;
      this.gl = null;
      if (gl) gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }

  window.MochyAmbient = Ambient;
})();
