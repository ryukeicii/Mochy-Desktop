// ============================================================================
// Remote control over the link, both ways: this computer steering a paired phone ("Controlling Pixel" pill
// and its remote), and a paired phone steering this computer (its commands, and what's playing told back).
// Ported from the phone's RemoteControl, ControllingPill and RemoteControlSheet.
// ============================================================================
(function () {
  "use strict";

  // while something plays, what's on is told again this often, so a phone's seek bar never drifts far
  const REPORT_EVERY_MS = 5000;
  const QUEUE_ROWS = 8;
  // a phone asks what's on every few seconds while it steers; one note when it starts is enough
  const CONTROLLER_NOTE_GAP_MS = 60000;

  const ICONS = {
    play: '<svg viewBox="-1 -2 30 35" width="16" height="18" fill="currentColor"><path d="M25.2291 20.3919c3.6945-2.1078 3.6945-7.676 0-9.7838L7.83413 .683455C4.30091-1.33253.000003 1.35322.000002 5.57537L0 25.4247c0 4.2221 4.30091 6.9078 7.83413 4.8919l17.39497-9.9247z"/></svg>',
    pause: '<svg viewBox="0 0 28 33" width="16" height="18" fill="currentColor"><path d="M28 5.5C28 2.46243 25.4928 0 22.4 0c-3.0927 0-5.6 2.46243-5.6 5.5v22c0 3.0376 2.5073 5.5 5.6 5.5 3.0928 0 5.6-2.4624 5.6-5.5v-22zM11.2 5.5C11.2 2.46243 8.69279 0 5.6 0 2.50721 0 0 2.46243 0 5.5v22C0 30.5376 2.50721 33 5.6 33c3.09279 0 5.6-2.4624 5.6-5.5v-22z"/></svg>',
    prev: '<svg viewBox="0 -1 50 34" width="22" height="15" fill="currentColor"><path d="M3.90516 21.838c-3.667105-2.0192-3.667104-7.3532 0-9.3723L21.1712 2.95838c3.507-1.9312 7.7761.6416 7.7761 4.68618V26.6591c0 4.0446-4.2691 6.6173-7.7761 4.6862L3.90516 21.838z"/><path d="M24.9579 21.8381c-3.6671-2.0192-3.6671-7.3532 0-9.3724L42.224 2.95844C45.731 1.02724 50 3.60004 50 7.64463V26.6592c0 4.0445-4.269 6.6172-7.7761 4.6861l-17.266-9.5072z"/></svg>',
    next: '<svg viewBox="0 -1 50 34" width="22" height="15" fill="currentColor"><path d="M46.0948 10.162c3.6671 2.0192 3.6671 7.3532 0 9.3723l-17.266 9.5073c-3.507 1.9312-7.7761-.6416-7.7761-4.6862V5.34091c0-4.04458 4.2691-6.61727 7.7761-4.686182L46.0948 10.162z"/><path d="M25.0421 10.1619c3.6671 2.0192 3.6671 7.3532 0 9.3724L7.77605 29.0416C4.26903 30.9728 0 28.4 0 24.3554V5.34085C.000002 1.29627 4.26903-1.27642 7.77605.654667L25.0421 10.1619z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    heartFilled: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    remove: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>'
  };

  let ctx = null;
  // what rust last said about the device being steered, null while nothing is
  let remote = null;
  let panelOpen = false;
  let frame = 0;
  let shownSecond = -1;
  let reportTimer = null;
  let reportLoop = null;
  let lastController = { name: "", at: 0 };

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(secs) {
    if (!secs || !isFinite(secs) || secs < 0) return "0:00";
    const total = Math.floor(secs);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function artists(song) {
    return (song?.artists || []).map((a) => a.name).join(", ");
  }

  function devices() {
    return window.MochyDevices;
  }

  // rust wants a title, artists and a cover on every song; a few built in the window carry thumbnailURL instead
  function wireSong(song) {
    return { ...song, title: song.title || "", artists: song.artists || [], thumbnail: song.thumbnail || song.thumbnailURL || "" };
  }

  // --------------------------------------------------------------------------
  // steering a paired device from here
  // --------------------------------------------------------------------------
  async function start(device) {
    try {
      remote = await ctx.invoke("link_remote_start", { id: device.id });
    } catch (e) {
      ctx.showError(e);
      return;
    }
    renderPill();
    devices()?.toast(`Controlling ${device.name}`);
    // control from a computer that's playing hands its queue over and goes quiet, the way the phone does
    if (ctx.player.isPlaying()) handOver();
  }

  async function stop() {
    await ctx.invoke("link_remote_stop").catch(() => {});
    remote = null;
    closePanel();
    renderPill();
    devices()?.updatePage();
  }

  function onRemote(view) {
    remote = view || null;
    if (!remote) closePanel();
    renderPill();
    if (panelOpen) renderPanel();
    devices()?.updatePage();
  }

  // a queue picked here plays on the steered device instead; false when nothing is steered, so it plays here
  function playOnRemote(songs, index) {
    if (!remote) return false;
    const picked = songs[index];
    // songs that only live on this computer can't play over there
    const playable = songs.filter((s) => s && s.source !== "local");
    if (!playable.length) return false;
    const at = Math.max(0, playable.indexOf(picked));
    ctx.invoke("link_remote_play", { songs: playable.map(wireSong), index: at, position: 0, mode: "play", title: null })
      .then(() => devices()?.toast(`Playing on ${remote?.name || "your device"}`))
      .catch((e) => ctx.showError(e));
    return true;
  }

  function handOver() {
    const queue = ctx.player.handOverQueue();
    if (!remote || !queue.songs.length) return;
    const playable = queue.songs.filter((s) => s && s.source !== "local");
    const at = Math.max(0, playable.indexOf(queue.songs[queue.index]));
    if (!playable.length) return;
    ctx.invoke("link_remote_play", { songs: playable.map(wireSong), index: at, position: queue.position || 0, mode: "play", title: null })
      .then(() => {
        ctx.player.pause();
        devices()?.toast(`Playing on ${remote?.name || "your device"}`);
      })
      .catch((e) => ctx.showError(e));
  }

  function command(action, position = null) {
    ctx.invoke("link_remote_command", { action, position }).catch((e) => ctx.showError(e));
  }

  // --------------------------------------------------------------------------
  // the pill at the bottom left, and the remote it opens
  // --------------------------------------------------------------------------
  function host() {
    return document.getElementById("main-area") || document.body;
  }

  function renderPill() {
    let pill = document.getElementById("dev-remote-pill");
    if (!remote) {
      pill?.classList.remove("show");
      return;
    }
    if (!pill) {
      pill = document.createElement("button");
      pill.id = "dev-remote-pill";
      pill.className = "dev-remote-pill glass-pill";
      pill.onclick = () => (panelOpen ? closePanel() : openPanel());
      host().appendChild(pill);
    }
    // green while it plays, red when it can't be reached
    const dot = !remote.reachable ? "away" : remote.playing ? "live" : "";
    const html = `<i class="dev-dot ${dot}"></i><span>Controlling ${esc(remote.name)}</span>`;
    if (pill._html !== html) {
      pill.innerHTML = html;
      pill._html = html;
    }
    requestAnimationFrame(() => pill.classList.add("show"));
  }

  function openPanel() {
    if (!remote) return;
    panelOpen = true;
    ctx.invoke("link_remote_watch", { open: true }).catch(() => {});
    let panel = document.getElementById("dev-remote");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "dev-remote";
      panel.className = "dev-remote glass-pill";
      panel.onclick = onPanelClick;
      host().appendChild(panel);
    }
    renderPanel();
    requestAnimationFrame(() => panel.classList.add("show"));
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onEscape, true);
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    ctx.invoke("link_remote_watch", { open: false }).catch(() => {});
    document.getElementById("dev-remote")?.classList.remove("show");
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onEscape, true);
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function onOutside(e) {
    if (e.target.closest("#dev-remote, #dev-remote-pill")) return;
    closePanel();
  }

  function onEscape(e) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    closePanel();
  }

  function statusText() {
    if (!remote.reachable) return "Can't reach it right now. Is Mochy open on it?";
    if (!remote.song) return "Asking what's on…";
    return remote.playing ? "Playing" : "Paused";
  }

  function renderPanel() {
    const panel = document.getElementById("dev-remote");
    if (!panel || !remote) return;
    const song = remote.song;
    const cover = song?.thumbnail ? ctx.cover(song.thumbnail, 160) : "";
    const queue = (remote.upNext || []).slice(0, QUEUE_ROWS);
    const html = `
      <div class="dev-remote-head">
        <span class="dev-remote-kind">${devices()?.kindIcon(remote.kind, 18) || ""}</span>
        <div class="dev-remote-head-text">
          <div class="dev-remote-name">${esc(remote.name)}</div>
          <div class="dev-remote-status">${esc(statusText())}</div>
        </div>
        <button class="dev-remote-icon" data-rc="close" title="Close">${ICONS.close}</button>
      </div>
      <div class="dev-remote-now">
        <div class="dev-remote-cover">${cover ? `<img src="${esc(cover)}" alt="" />` : ""}</div>
        <div class="dev-remote-song">
          <div class="dev-remote-title">${esc(song?.title || "Nothing playing")}</div>
          <div class="dev-remote-artist">${esc(artists(song))}</div>
        </div>
        <button class="dev-remote-icon ${remote.liked ? "on" : ""}" data-rc="like" title="Like" ${song ? "" : "disabled"}>${remote.liked ? ICONS.heartFilled : ICONS.heart}</button>
      </div>
      <div class="dev-remote-seek" data-rc="seek"><div class="dev-remote-track"><div class="dev-remote-fill" id="dev-remote-fill"></div></div></div>
      <div class="dev-remote-times"><span id="dev-remote-cur">0:00</span><span>${formatTime(remote.duration)}</span></div>
      <div class="dev-remote-transport">
        <button data-rc="previous" title="Previous">${ICONS.prev}</button>
        <button class="big" data-rc="toggle" title="Play or pause">${remote.playing ? ICONS.pause : ICONS.play}</button>
        <button data-rc="next" title="Next">${ICONS.next}</button>
      </div>
      ${
        queue.length
          ? `<div class="dev-remote-label">Up next</div>
             <div class="dev-remote-queue">
               ${queue
                 .map(
                   ([index, s]) => `
                 <div class="dev-remote-row" data-rc="jump" data-index="${index}">
                   <div class="dev-remote-row-text"><div class="dev-remote-row-title">${esc(s.title)}</div><div class="dev-remote-row-artist">${esc(artists(s))}</div></div>
                   <button class="dev-remote-icon small" data-rc="remove" data-index="${index}" title="Remove from the queue">${ICONS.remove}</button>
                 </div>`
                 )
                 .join("")}
             </div>`
          : ""
      }
      <button class="dev-remote-wide" data-rc="handover">Play this computer's queue on ${esc(remote.name)}</button>
      <button class="dev-remote-wide stop" data-rc="stop">Stop controlling</button>`;
    if (panel._html !== html) {
      panel.innerHTML = html;
      panel._html = html;
      shownSecond = -1;
    }
    paintSeek();
    if (remote.playing && remote.reachable && !frame) frame = requestAnimationFrame(tickSeek);
  }

  // where the song is now: the last answer, run on locally since it was read
  function livePosition() {
    if (!remote) return 0;
    const moved = remote.playing && remote.reachable ? (Date.now() - remote.readAt) / 1000 : 0;
    return Math.min(remote.duration || Infinity, remote.position + moved);
  }

  function paintSeek() {
    const position = livePosition();
    const fill = document.getElementById("dev-remote-fill");
    if (fill) fill.style.transform = `scaleX(${remote.duration > 0 ? Math.min(1, position / remote.duration).toFixed(4) : 0})`;
    const second = Math.floor(position);
    if (second !== shownSecond) {
      shownSecond = second;
      const cur = document.getElementById("dev-remote-cur");
      if (cur) cur.textContent = formatTime(position);
    }
  }

  // runs only while the remote is open and the song moves
  function tickSeek() {
    frame = 0;
    if (!panelOpen || !remote?.playing || !remote.reachable || document.hidden) return;
    paintSeek();
    frame = requestAnimationFrame(tickSeek);
  }

  function onPanelClick(e) {
    const target = e.target.closest("[data-rc]");
    if (!target || target.disabled || !remote) return;
    const action = target.dataset.rc;
    switch (action) {
      case "close":
        return closePanel();
      case "stop":
        return stop();
      case "handover":
        return handOver();
      case "seek": {
        const rect = target.getBoundingClientRect();
        const at = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * (remote.duration || 0);
        remote.position = at;
        remote.readAt = Date.now();
        paintSeek();
        return command("seek", at);
      }
      case "jump":
        return ctx.invoke("link_remote_queue", { action: "jump", index: Number(target.dataset.index) }).catch((err) => ctx.showError(err));
      case "remove":
        e.stopPropagation();
        return ctx.invoke("link_remote_queue", { action: "remove", index: Number(target.dataset.index) }).catch((err) => ctx.showError(err));
      default:
        return command(action);
    }
  }

  // --------------------------------------------------------------------------
  // a paired phone steering this computer
  // --------------------------------------------------------------------------
  function onCommand(cmd) {
    const player = ctx.player;
    switch (cmd?.type) {
      case "play":
        if (!cmd.songs?.length) return;
        player.playQueue(cmd.songs, cmd.index || 0, cmd.position || 0);
        if (cmd.from) devices()?.toast(`${cmd.from} is playing on this computer`);
        break;
      case "next":
        player.playNext(cmd.songs || []);
        break;
      case "queue":
        player.addToQueue(cmd.songs || []);
        break;
      case "jump":
        player.jump(cmd.index);
        break;
      case "remove":
        player.remove(cmd.index);
        break;
      case "control":
        onControl(cmd.action, cmd.position);
        break;
    }
    reportPlayer();
  }

  function onControl(action, position) {
    const player = ctx.player;
    switch (action) {
      case "toggle":
        return player.toggle();
      case "play":
        return player.isPlaying() || player.toggle();
      case "pause":
        return player.pause();
      case "next":
        return player.next();
      case "previous":
        return player.previous();
      case "seek":
        return typeof position === "number" && player.seek(position);
      case "like":
        return player.like();
    }
  }

  function onController(payload) {
    const name = payload?.name;
    if (!name) return;
    const now = Date.now();
    if (lastController.name === name && now - lastController.at < CONTROLLER_NOTE_GAP_MS) {
      lastController.at = now;
      return;
    }
    lastController = { name, at: now };
    devices()?.toast(`${name} is controlling this computer`);
  }

  // what's on, told to rust so a phone steering this computer sees it; only with something paired, and at most a few times a second
  function reportPlayer() {
    if (!ctx || !devices()?.pairedCount()) return;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(sendReport, 250);
  }

  function sendReport() {
    const mirror = ctx.player.snapshot();
    mirror.song = mirror.song ? wireSong(mirror.song) : null;
    mirror.upNext = mirror.upNext.map(wireSong);
    ctx.invoke("link_player_update", { mirror }).catch(() => {});
    // the position runs on in rust while it plays; this only keeps a long song from drifting
    if (mirror.playing && !reportLoop) {
      reportLoop = setInterval(reportPlayer, REPORT_EVERY_MS);
    } else if (!mirror.playing && reportLoop) {
      clearInterval(reportLoop);
      reportLoop = null;
    }
  }

  window.MochyRemote = {
    init(appCtx) {
      ctx = appCtx;
      ctx.listen("link://remote", onRemote);
      ctx.listen("link://command", onCommand);
      ctx.listen("link://controller", onController);
      // a reload keeps rust's remote, so the pill comes back with it
      ctx.invoke("link_state")
        .then((s) => {
          if (s?.remote) onRemote(s.remote);
          if (s?.devices?.length) sendReport();
        })
        .catch(() => {});
    },
    start,
    stop,
    playOnRemote,
    reportPlayer,
    steeringId: () => remote?.id || null
  };
})();
