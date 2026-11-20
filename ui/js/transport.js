/* ==========================================================================
   The transport buttons' motion, ported from the phone's TransportIcons.kt: play and pause squash
   small, swap while tiny and bounce back; a skip runs one cycle per press on a single spring, so
   quick presses run together. Only transforms change, and the loops rest as soon as they settle.
   ========================================================================== */

(() => {
  "use strict";

  // how small play and pause get before they swap and spring back
  const SQUASH_LOW = 0.5;
  const SQUASH_MS = 110;
  // the skip triangle in the icon's own units (the same shape as the next icon's back triangle)
  const TRI_PATH =
    "M25.0421 10.1619c3.6671 2.0192 3.6671 7.3532 0 9.3724L7.77605 29.0416C4.26903 30.9728 0 28.4 0 24.3554V5.34085C.000002 1.29627 4.26903-1.27642 7.77605.654667L25.0421 10.1619z";
  const TRI_CX = 14.35;
  const TRI_CY = 14.5;
  const SKIP_STEP = 21.05;
  const SKIP_WIDTH = 50;
  const SUB_STEP = 1 / 240;

  const playGlyphs = new Map();
  const skipGlyphs = new Map();

  // motion is skipped when the system or the app asks for less of it
  function reduced() {
    return !!document.querySelector(".app-root.no-anim") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // a damped spring, mass one, stepped in small slices so a slow frame can't blow it up
  function stepSpring(s, target, stiffness, damping, dt) {
    let left = dt;
    while (left > 0) {
      const h = Math.min(SUB_STEP, left);
      s.v += (-stiffness * (s.x - target) - damping * s.v) * h;
      s.x += s.v * h;
      left -= h;
    }
  }

  function dampingFor(ratio, stiffness) {
    return 2 * ratio * Math.sqrt(stiffness);
  }

  // the tween's curve (FastOutLinearIn): slow start, then straight in
  const squashCurve = (t) => {
    const x = Math.min(1, Math.max(0, t));
    // close to cubic-bezier(0.4, 0, 1, 1) without solving for t
    return x * x * (1.2 - 0.2 * x);
  };

  // ---------------------------------------------------------------- play and pause

  function createPlayGlyph(playing, playSvg, pauseSvg) {
    const el = document.createElement("span");
    el.className = "tp-glyph";
    el.innerHTML = `<span class="tp-play">${playSvg}</span><span class="tp-pause">${pauseSvg}</span>`;
    const playEl = el.firstChild;
    const pauseEl = el.lastChild;

    const g = { el, showsPause: playing, target: playing, raf: 0, spring: { x: 1, v: 0 } };

    const show = () => {
      playEl.hidden = g.showsPause;
      pauseEl.hidden = !g.showsPause;
    };
    const scale = (s) => {
      el.style.transform = s === 1 ? "" : `scale(${s.toFixed(4)})`;
    };

    g.set = (next) => {
      // a re-render that lands mid-swap asks for the same thing, so let the running one finish
      if (next === g.target && g.raf) return;
      g.target = next;
      if (next === g.showsPause && g.spring.x === 1 && !g.raf) return;
      if (reduced()) {
        cancelAnimationFrame(g.raf);
        g.raf = 0;
        g.showsPause = next;
        g.spring = { x: 1, v: 0 };
        show();
        scale(1);
        return;
      }
      cancelAnimationFrame(g.raf);
      const from = g.spring.x;
      const started = performance.now();
      let last = started;
      let squashing = true;
      const frame = (now) => {
        if (squashing) {
          const t = (now - started) / SQUASH_MS;
          const x = from + (SQUASH_LOW - from) * squashCurve(t);
          scale(x);
          g.spring.x = x;
          if (t >= 1) {
            squashing = false;
            g.showsPause = g.target;
            g.spring = { x: SQUASH_LOW, v: 0 };
            show();
          }
        } else {
          const dt = Math.min(0.05, (now - last) / 1000);
          stepSpring(g.spring, 1, 420, dampingFor(0.34, 420), dt);
          scale(g.spring.x);
          if (Math.abs(g.spring.x - 1) < 0.0008 && Math.abs(g.spring.v) < 0.01) {
            g.spring = { x: 1, v: 0 };
            scale(1);
            g.raf = 0;
            return;
          }
        }
        last = now;
        g.raf = requestAnimationFrame(frame);
      };
      g.raf = requestAnimationFrame(frame);
    };

    show();
    return g;
  }

  // one persistent element per button, so a re-render of the bar carries the running animation along
  function playGlyph(key, playing, playSvg, pauseSvg) {
    let g = playGlyphs.get(key);
    if (!g) {
      g = createPlayGlyph(playing, playSvg, pauseSvg);
      playGlyphs.set(key, g);
    } else {
      g.set(playing);
    }
    return g.el;
  }

  // ---------------------------------------------------------------- skip

  const NS = "http://www.w3.org/2000/svg";

  function createSkipGlyph(backwards) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 -1 50 34");
    svg.setAttribute("width", "17");
    svg.setAttribute("height", "12");
    svg.setAttribute("fill", "currentColor");
    svg.classList.add("tp-skip");
    const root = document.createElementNS(NS, "g");
    if (backwards) root.setAttribute("transform", `translate(${SKIP_WIDTH} 0) scale(-1 1)`);
    const tris = [0, 1, 2].map(() => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", TRI_PATH);
      root.appendChild(p);
      return p;
    });
    svg.appendChild(root);

    const g = { el: svg, raf: 0, target: 0, spring: { x: 0, v: 0 } };
    const [fresh, back, front] = tris;

    const place = (p, x, scale, alpha) => {
      if (scale <= 0.001 || alpha <= 0.001) {
        p.setAttribute("opacity", "0");
        return;
      }
      p.setAttribute("opacity", alpha.toFixed(3));
      p.setAttribute(
        "transform",
        `translate(${x.toFixed(3)} 0) translate(${TRI_CX} ${TRI_CY}) scale(${scale.toFixed(4)}) translate(${-TRI_CX} ${-TRI_CY})`
      );
    };

    // how far into the newest step it is; far behind it just plays the steps it is catching up on
    const phase = () => {
      const f = g.spring.x - (g.target - 1);
      return f >= 0 ? f : g.spring.x - Math.floor(g.spring.x);
    };

    // the front one runs off and shrinks away, the back one takes its place, a new one grows in behind
    g.draw = () => {
      const f = Math.max(0, phase());
      const gone = Math.min(1, f);
      place(fresh, 0, f, Math.min(1, f * 2.5));
      place(back, SKIP_STEP * f, 1, 1);
      if (gone < 1) place(front, SKIP_STEP + SKIP_STEP * 0.8 * gone, 1 - gone, 1 - gone);
      else place(front, 0, 0, 0);
    };

    g.step = () => {
      g.target += 1;
      if (reduced()) {
        g.spring = { x: g.target, v: 0 };
        g.draw();
        return;
      }
      if (g.raf) return;
      let last = performance.now();
      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        stepSpring(g.spring, g.target, 320, dampingFor(0.6, 320), dt);
        if (Math.abs(g.spring.x - g.target) < 0.0008 && Math.abs(g.spring.v) < 0.01) {
          g.spring = { x: g.target, v: 0 };
          g.draw();
          g.raf = 0;
          return;
        }
        g.draw();
        g.raf = requestAnimationFrame(frame);
      };
      g.raf = requestAnimationFrame(frame);
    };

    g.draw();
    return g;
  }

  function skipGlyph(key, backwards) {
    let g = skipGlyphs.get(key);
    if (!g) {
      g = createSkipGlyph(backwards);
      skipGlyphs.set(key, g);
    }
    return g.el;
  }

  // call this when the button is pressed, before or after the song changes
  function skipStep(key) {
    skipGlyphs.get(key)?.step();
  }

  window.MochyTransport = { playGlyph, skipGlyph, skipStep };
})();
