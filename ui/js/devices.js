// ============================================================================
// Device integration: the settings page that pairs this computer with your phone, tablet or another computer,
// lists them, and holds each one's switches. Ported from the phone's Settings > Device integration sheets.
// ============================================================================
(function () {
  "use strict";

  const MAX_DEVICES = 10;
  // a device drops to "not around" on its own, so an open page looks at the clock now and then
  const PAGE_TICK_MS = 15000;

  const KIND_ICONS = {
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.2h2"/>',
    tablet: '<rect x="4" y="3" width="16" height="18" rx="2.6"/><path d="M11 18h2"/>',
    tv: '<rect x="2.5" y="4" width="19" height="13" rx="2.2"/><path d="M8 21h8"/>',
    car: '<path d="M5 17h14M6.5 17v2.2M17.5 17v2.2M4 17v-4.5l2-5.2A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.3l2 5.2V17"/><path d="M4 12.5h16"/>',
    desktop: '<rect x="3" y="3.5" width="18" height="12.5" rx="2.2"/><path d="M9 20.5h6M12 16v4.5"/>'
  };
  const KIND_LABELS = { phone: "Phone", tablet: "Tablet", tv: "TV", car: "Car", desktop: "Computer" };

  const ICONS = {
    plus: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>'
  };

  // the small dark glyphs in the settings rows' light badges, the same look as the rest of settings
  const ROW_GLYPHS = {
    remote: '<rect x="7" y="2.5" width="10" height="19" rx="3"/><circle cx="12" cy="8" r="1.6"/><path d="M10 13h4M10 16h4"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    library: '<path d="M4 4v16M8 4v16"/><rect x="11" y="4" width="9" height="16" rx="2"/>',
    wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10.5 10.5 0 0 1 14 0M8.5 15.5a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>'
  };

  let ctx = null;
  let link = null;
  // "list", "add", or the id of the device whose own page is open
  let view = "list";
  let pairing = null;
  let pairNote = null;
  let pairWorking = false;
  // the detected device whose code box is open, and whether the by-address form shows
  let codeFor = null;
  let byAddress = false;
  let syncNote = null;
  let confirmUnlink = false;
  let settingsCtx = null;
  let refreshTimer = null;
  let pageTimer = null;
  let toastTimer = null;

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kindIcon(kind, size = 24) {
    const glyph = KIND_ICONS[kind] || KIND_ICONS.phone;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
  }

  function kindLabel(kind) {
    return KIND_LABELS[kind] || "Device";
  }

  function rowIcon(name) {
    return `<span class="ms-row-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ROW_GLYPHS[name]}</svg></span>`;
  }

  function ago(ms) {
    const gone = Math.max(0, Date.now() - ms);
    const min = Math.round(gone / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? "yesterday" : `${days} days ago`;
  }

  function devices() {
    return link?.devices || [];
  }

  function deviceById(id) {
    return devices().find((d) => d.id === id) || null;
  }

  // what's in pairing mode nearby and not paired yet; a tv pairs with a phone, so it isn't offered here
  function detected() {
    return (link?.nearby || []).filter((p) => p.kind !== "tv");
  }

  function steeringId() {
    return window.MochyRemote?.steeringId() || null;
  }

  // --------------------------------------------------------------------------
  // the link's state, kept fresh for the page and for the remote
  // --------------------------------------------------------------------------
  async function refresh() {
    try {
      link = await ctx.invoke("link_state");
    } catch (_) {
      return;
    }
    if (link?.pairing) pairing = link.pairing;
    updatePage();
  }

  // a burst of changes (a device and its sync turning up together) is read once
  function refreshSoon() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 150);
  }

  function page() {
    return document.getElementById("dev-page");
  }

  // only the parts that change are written, so a code being typed keeps its field and focus
  function updatePage() {
    const root = page();
    if (!root) return;
    if (view !== "list" && view !== "add" && !deviceById(view)) {
      // unlinked, here or from the other side: nothing left to show
      showView("list");
      return;
    }
    root.querySelectorAll("[data-dev-region]").forEach((region) => {
      const html = regionHtml(region.dataset.devRegion);
      if (region._html !== html) {
        region.innerHTML = html;
        region._html = html;
      }
    });
  }

  function regionHtml(name) {
    switch (name) {
      case "devices":
        return deviceListHtml();
      case "code":
        return pairingCodeHtml();
      case "detected":
        return detectedHtml();
      case "note":
        return pairNote ? `<div class="dev-note ${pairNote.problem ? "problem" : ""}">${esc(pairNote.text)}</div>` : "";
      case "device":
        return deviceBodyHtml(deviceById(view));
      default:
        return "";
    }
  }

  function showView(next) {
    const leavingAdd = view === "add" && next !== "add";
    view = next;
    pairNote = null;
    codeFor = null;
    byAddress = false;
    syncNote = null;
    confirmUnlink = false;
    if (leavingAdd) closePairing();
    if (next === "add") openPairing();
    const root = page();
    if (!root) return;
    root.dataset.view = next === "list" || next === "add" ? next : "device";
    root.innerHTML = viewHtml();
    const pane = document.getElementById("ms-right-pane");
    if (pane) pane.scrollTop = 0;
    updatePage();
  }

  // --------------------------------------------------------------------------
  // pairing mode: this computer shows a code while the add page is open
  // --------------------------------------------------------------------------
  async function openPairing() {
    try {
      pairing = await ctx.invoke("link_pairing_open");
    } catch (e) {
      pairNote = { text: String(e), problem: true };
    }
    updatePage();
    // the page can go away without a back tap (another settings page, another tab), and pairing mode goes with it
    clearInterval(openPairing._watch);
    openPairing._watch = setInterval(() => {
      if (page()?.dataset.view === "add" && view === "add") return;
      if (view === "add") view = "list";
      closePairing();
    }, 2000);
  }

  function closePairing() {
    clearInterval(openPairing._watch);
    pairing = null;
    ctx.invoke("link_pairing_close").catch(() => {});
  }

  // a code tried on each device in pairing mode, since only the right one takes it; or on one device, or one address
  async function pair({ peers = null, address = null, code }) {
    code = String(code || "").replace(/\D/g, "");
    if (code.length !== 6) return;
    const targets = peers || (address ? [null] : detected());
    if (!targets.length) {
      pairNote = { text: "Nothing's in pairing mode on this Wi-Fi yet. Open it on the other device first.", problem: true };
      updatePage();
      return;
    }
    pairWorking = true;
    pairNote = { text: "Linking…", problem: false };
    updatePage();
    const problems = [];
    for (const peer of targets) {
      try {
        const device = await ctx.invoke("link_pair", { peerId: peer?.id || null, address: peer ? null : address, code });
        pairWorking = false;
        toast(`Paired with ${device.name}`);
        await refresh();
        showView("list");
        return;
      } catch (e) {
        problems.push(String(e));
      }
    }
    pairWorking = false;
    // the most useful reason wins: a full device, then a wrong code, then an old app
    const pick = (re) => problems.find((p) => re.test(p));
    const text = pick(/all the devices/) || pick(/didn't match/) || pick(/older Mochy/) || problems[0];
    pairNote = { text, problem: true };
    updatePage();
  }

  // --------------------------------------------------------------------------
  // the page
  // --------------------------------------------------------------------------
  function viewHtml() {
    if (view === "list") return listViewHtml();
    if (view === "add") return addViewHtml();
    return deviceViewHtml();
  }

  function backHtml() {
    return `<button class="ms-back-pill" data-dev="back">${ICONS.back}<span>Device integration</span></button>`;
  }

  function listViewHtml() {
    const settings = settingsCtx?.getSettings() || {};
    const full = devices().length >= MAX_DEVICES;
    return `
      <div class="ms-pane-head"><h3 class="ms-pane-title">Device integration</h3></div>
      <div class="dev-hero">
        ${linkPictureSvg(112, 40)}
        <div class="dev-hero-text">Connect up to 10 devices on your Wi-Fi: your phone, tablet, another computer and more. Play on them from here, let them play on this computer, and keep your likes and playlists in step.</div>
      </div>
      <div data-dev-region="devices"></div>
      <button class="dev-add-box ${full ? "full" : ""}" data-dev="add" ${full ? "disabled" : ""}>
        ${ICONS.plus}
        <span>${full ? "That's 10 devices, the most this computer keeps. Unlink one to add another." : "Add more devices here"}</span>
      </button>

      <div class="ms-section-title dev-gap">Options</div>
      <div class="ms-card-group">
        <div class="ms-row dev-static">
          ${rowIcon("laptop")}
          <div class="ms-row-text">
            <div class="ms-row-title">This computer's name</div>
            <div class="ms-row-desc">What your devices call it</div>
          </div>
          <input class="settings-input-boxed" id="dev-name-input" value="${esc(settings.deviceName || "")}" placeholder="${esc(link?.name || "This computer")}" spellcheck="false" />
        </div>
        ${toggleHtml("share-local", "share", "Let your devices play songs from here", "The songs in your local music folders stream to them straight from this computer", settings.shareLocalFiles !== false)}
      </div>`;
  }

  function deviceListHtml() {
    const list = devices();
    if (!list.length) return "";
    return `
      <div class="ms-section-title dev-gap">My devices</div>
      ${list.map(deviceRowHtml).join("")}`;
  }

  // one paired device: what it is, whether it's around, a button to steer it and one for its own page
  function deviceRowHtml(d) {
    const steering = steeringId() === d.id;
    const canControl = d.remoteControl && d.kind !== "tv";
    return `
      <div class="dev-row" data-dev="open" data-id="${esc(d.id)}">
        <span class="dev-row-icon">${kindIcon(d.kind)}</span>
        <div class="dev-row-text">
          <div class="dev-row-name">${esc(d.name)}</div>
          <div class="dev-row-status"><i class="dev-dot ${d.live ? "live" : ""}"></i><span>${esc(statusOf(d, steering))}</span></div>
        </div>
        ${
          canControl
            ? `<button class="dev-pill ${steering ? "bright" : ""}" data-dev="control" data-id="${esc(d.id)}" ${steering || d.live ? "" : "disabled"}>${steering ? "Controlling" : "Control"}</button>`
            : ""
        }
        <button class="dev-round" data-dev="open" data-id="${esc(d.id)}" title="Device settings">${ICONS.more}</button>
      </div>`;
  }

  function statusOf(d, steering) {
    if (d.sync?.phase === "syncing") return "Syncing…";
    if (steering && d.live) return "Controlling it from here";
    const synced = d.lastSyncAt > 0 && d.mirrorLibrary ? ago(d.lastSyncAt) : null;
    if (d.live && synced) return `Open now · synced ${synced}`;
    if (d.live) return "Open now";
    if (d.lastSeenAt > 0) return `Last open ${ago(d.lastSeenAt)}`;
    return "Waiting for Mochy to open on it";
  }

  function addViewHtml() {
    return `
      <div class="ms-pane-head sub"><div class="ms-sub-left">${backHtml()}<h3 class="ms-pane-title">Add device</h3></div></div>
      <div class="dev-picture-card">${linkPictureSvg(176, 62)}</div>

      <div class="ms-section-title dev-gap">Pairing mode code</div>
      <div class="dev-code" data-dev-region="code"></div>

      <div class="ms-section-title dev-gap">Detected</div>
      <div data-dev-region="detected"></div>

      <div class="ms-section-title dev-gap">Or</div>
      <input class="dev-code-field" id="dev-any-code" inputmode="numeric" maxlength="7" placeholder="Enter code" autocomplete="off" spellcheck="false" />
      <div data-dev-region="note"></div>
      ${
        byAddress
          ? `<div class="dev-address">
               <input class="dev-code-field small" id="dev-addr" placeholder="Address, like 192.168.1.20:47802" autocomplete="off" spellcheck="false" />
               <input class="dev-code-field small" id="dev-addr-code" inputmode="numeric" maxlength="7" placeholder="Code" autocomplete="off" />
               <button class="dev-pill" data-dev="pair-address">Link</button>
             </div>`
          : `<button class="dev-text-btn" data-dev="by-address">Link by address</button>`
      }`;
  }

  // this computer's code in big type, a strip of bars made from it, and what the other side will see
  function pairingCodeHtml() {
    const digits = pairing?.code || "––––––";
    const caption = [
      `${digits.slice(0, 3)} ${digits.slice(3)}`,
      platformName(),
      (pairing?.name || link?.name || "").toUpperCase(),
      pairing?.address ? `${pairing.address}:${pairing.port}` : null
    ]
      .filter(Boolean)
      .join("  ·  ");
    return `
      <div class="dev-code-digits">${esc(digits.slice(0, 3))}<span></span>${esc(digits.slice(3))}</div>
      ${barsSvg(digits + (pairing?.name || ""))}
      <div class="dev-code-caption">${esc(caption)}</div>
      <div class="dev-code-hint">Type this on your phone: Settings, Device integration, Add device.</div>`;
  }

  function platformName() {
    const p = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
    if (p.includes("mac")) return "MACOS";
    if (p.includes("win")) return "WINDOWS";
    return "LINUX";
  }

  function detectedHtml() {
    const list = detected();
    if (!list.length) {
      return `
        <div class="dev-looking">
          <div class="dev-looking-text">
            <div class="dev-row-name">Looking for devices…</div>
            <div class="dev-looking-detail">Open Add device in Mochy on your phone or tablet, or Device integration on another computer</div>
          </div>
          <span class="dev-dots"><i></i><i></i><i></i></span>
        </div>`;
    }
    return list
      .map(
        (p) => `
        <div class="dev-row" data-dev="peer" data-id="${esc(p.id)}">
          <span class="dev-row-icon">${kindIcon(p.kind)}</span>
          <div class="dev-row-text">
            <div class="dev-row-name">${esc(p.name)}</div>
            <div class="dev-row-status">${esc(kindLabel(p.kind))}</div>
          </div>
          ${
            codeFor === p.id
              ? `<input class="dev-code-field inline" data-peer-code="${esc(p.id)}" inputmode="numeric" maxlength="7" placeholder="Its code" autocomplete="off" ${pairWorking ? "disabled" : ""} />`
              : `<button class="dev-pill" data-dev="peer" data-id="${esc(p.id)}">Connect</button>`
          }
        </div>`
      )
      .join("");
  }

  function deviceViewHtml() {
    return `
      <div class="ms-pane-head sub"><div class="ms-sub-left">${backHtml()}</div></div>
      <div data-dev-region="device"></div>`;
  }

  // one paired device up close: what it is, whether it's around, and what this computer does with it
  function deviceBodyHtml(d) {
    if (!d) return "";
    const steering = steeringId() === d.id;
    const phoneLike = d.kind !== "tv";
    const syncLine = syncNote || syncStatusText(d);
    return `
      <div class="dev-device-top">
        ${devicePictureSvg(d.kind)}
        <div class="dev-device-name">${esc(d.name)}</div>
        <div class="dev-device-sub">${esc(kindLabel(d.kind))} · ${esc(statusOf(d, steering))}</div>
      </div>
      <div class="ms-card-group">
        ${toggleHtml("remote", "remote", "Enable remote control", "Play, skip and change settings on each other from either side", d.remoteControl, true, d.id)}
        ${toggleHtml("auto", "bolt", "Take control when it connects", "As soon as Mochy opens on it, this computer becomes its remote", d.autoControl && d.remoteControl, d.remoteControl, d.id)}
        ${toggleHtml("mirror", "library", "Keep our libraries in step", "Its likes and playlists show up here, and what you like here goes over to it", d.mirrorLibrary, true, d.id)}
        ${toggleHtml("stream", "wifi", "Let it play songs from here", "Your local music folders stream to it straight from this computer", d.streamLocal, true, d.id)}
      </div>
      <div class="ms-card-group">
        ${
          phoneLike && d.remoteControl
            ? `<button class="ms-link-row dev-action" data-dev="control" data-id="${esc(d.id)}" ${steering || d.live ? "" : "disabled"}>${steering ? "Stop controlling" : `Control ${esc(d.name)}`}</button>`
            : ""
        }
        ${
          d.mirrorLibrary
            ? `<button class="ms-link-row dev-action" data-dev="sync" data-id="${esc(d.id)}" ${d.live && d.sync?.phase !== "syncing" ? "" : "disabled"}>${d.sync?.phase === "syncing" ? "Syncing…" : "Sync now"}</button>`
            : ""
        }
        ${syncLine ? `<div class="dev-sync-line ${syncLine.problem ? "problem" : ""}">${esc(syncLine.text)}</div>` : ""}
        ${
          confirmUnlink
            ? `<div class="dev-confirm">
                 <span>Unlink ${esc(d.name)}? It keeps what it already has.</span>
                 <button class="dev-pill" data-dev="unlink-cancel">Cancel</button>
                 <button class="dev-pill danger" data-dev="unlink-yes" data-id="${esc(d.id)}">Unlink</button>
               </div>`
            : `<button class="ms-link-row dev-action danger" data-dev="unlink">Unlink</button>`
        }
      </div>`;
  }

  function syncStatusText(d) {
    if (d.sync?.phase === "failed") return { text: d.sync.message || "That sync didn't go through.", problem: true };
    if (d.sync?.phase === "synced") return { text: d.sync.message ? `Synced ${ago(d.sync.at)}: ${d.sync.message}` : `Synced ${ago(d.sync.at)}` };
    if (d.lastSyncAt > 0 && d.mirrorLibrary) return { text: `Last synced ${ago(d.lastSyncAt)}` };
    return null;
  }

  function toggleHtml(key, glyph, title, desc, on, enabled = true, id = "") {
    const hideDesc = !!settingsCtx?.getSettings()?.prefs?.behaviour?.disableSettingDescriptions;
    return `
      <div class="ms-row ${enabled ? "" : "dev-off"}" data-dev="toggle" data-key="${key}" data-id="${esc(id)}">
        ${rowIcon(glyph)}
        <div class="ms-row-text">
          <div class="ms-row-title">${esc(title)}</div>
          ${hideDesc ? "" : `<div class="ms-row-desc" title="${esc(desc)}">${esc(desc)}</div>`}
        </div>
        <button class="toggle-switch ${on ? "on" : ""}" aria-pressed="${on ? "true" : "false"}" ${enabled ? "" : "disabled"}></button>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // pictures: this computer handing over to a phone, one device drawn large, the code's bars
  // --------------------------------------------------------------------------
  function linkPictureSvg(width, height) {
    return `
      <svg class="dev-link-picture" viewBox="0 0 112 40" width="${width}" height="${height}" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="6" width="36" height="24" rx="4" fill="#3a3a3d" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>
        <path d="M13 37h12M19 30v7" stroke="rgba(255,255,255,0.55)" stroke-width="1.6"/>
        <path d="M45 20h28" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" stroke-dasharray="4 3.2"/>
        <path d="M68 16l5 4-5 4" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/>
        <rect x="84" y="3" width="20" height="34" rx="4.5" fill="#3a3a3d" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>
      </svg>`;
  }

  function devicePictureSvg(kind) {
    const body = 'fill="#3a3a3d" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"';
    let shape;
    if (kind === "tv" || kind === "desktop") {
      shape = `<path d="M56 92h28M70 78v14" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-linecap="round"/><rect x="14" y="4" width="112" height="74" rx="10" ${body}/>`;
    } else if (kind === "phone") {
      shape = `<rect x="45" y="2" width="50" height="92" rx="10" ${body}/>`;
    } else {
      shape = `<rect x="21" y="6" width="98" height="84" rx="12" ${body}/>`;
    }
    return `<svg class="dev-device-picture" viewBox="0 0 140 96" width="140" height="96">${shape}</svg>`;
  }

  // bar and gap widths, one to three units each, worked out from the characters so every code draws its own strip
  function barsSvg(seed) {
    const widths = [];
    for (const ch of seed) {
      const bits = ch.charCodeAt(0);
      widths.push(1 + (bits & 1) + ((bits >> 3) & 1), 1 + ((bits >> 1) & 1), 1 + ((bits >> 2) & 1));
    }
    const total = widths.reduce((a, b) => a + b, 0) || 1;
    let x = 0;
    const rects = widths
      .map((w, i) => {
        const rect = i % 2 === 0 ? `<rect x="${((x / total) * 220).toFixed(2)}" y="0" width="${((w / total) * 220).toFixed(2)}" height="20"/>` : "";
        x += w;
        return rect;
      })
      .join("");
    return `<svg class="dev-bars" viewBox="0 0 220 20" width="220" height="20" fill="rgba(255,255,255,0.85)">${rects}</svg>`;
  }

  // --------------------------------------------------------------------------
  // taps and typing, caught once on the page so a region written again needs nothing bound
  // --------------------------------------------------------------------------
  function bindPage(root) {
    root.onclick = (e) => {
      const target = e.target.closest("[data-dev]");
      if (!target || target.disabled) return;
      const id = target.dataset.id;
      switch (target.dataset.dev) {
        case "back":
          return showView("list");
        case "add":
          return showView("add");
        case "open":
          return showView(id);
        case "control":
          e.stopPropagation();
          return onControl(id);
        case "toggle":
          return onToggle(target);
        case "peer":
          if (e.target.closest("input")) return;
          codeFor = codeFor === id ? null : id;
          pairNote = null;
          updatePage();
          root.querySelector(`[data-peer-code="${CSS.escape(id)}"]`)?.focus();
          return;
        case "by-address":
          byAddress = true;
          root.innerHTML = viewHtml();
          updatePage();
          root.querySelector("#dev-addr")?.focus();
          return;
        case "pair-address":
          return pair({ address: root.querySelector("#dev-addr")?.value.trim(), code: root.querySelector("#dev-addr-code")?.value });
        case "sync":
          return onSync(id);
        case "unlink":
          confirmUnlink = true;
          return updatePage();
        case "unlink-cancel":
          confirmUnlink = false;
          return updatePage();
        case "unlink-yes":
          return onUnlink(id);
      }
    };
    // a six digit code goes as soon as it's all there, the same as on the phone
    root.oninput = (e) => {
      const field = e.target;
      if (!field.classList.contains("dev-code-field") || field.id === "dev-addr") return;
      const digits = field.value.replace(/\D/g, "").slice(0, 6);
      field.value = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
      if (digits.length !== 6 || field.id === "dev-addr-code") return;
      const peer = field.dataset.peerCode ? detected().find((p) => p.id === field.dataset.peerCode) : null;
      pair({ peers: peer ? [peer] : null, code: digits });
    };
    root.onkeydown = (e) => {
      if (e.key === "Enter" && (e.target.id === "dev-addr" || e.target.id === "dev-addr-code")) {
        pair({ address: root.querySelector("#dev-addr")?.value.trim(), code: root.querySelector("#dev-addr-code")?.value });
      }
    };
    const nameInput = root.querySelector("#dev-name-input");
    if (nameInput) {
      nameInput.onchange = async () => {
        const settings = settingsCtx.getSettings();
        settings.deviceName = nameInput.value.trim();
        await settingsCtx.saveSettings(false);
        refresh();
      };
    }
  }

  async function onToggle(row) {
    const key = row.dataset.key;
    if (row.classList.contains("dev-off")) return;
    if (key === "share-local") {
      const settings = settingsCtx.getSettings();
      settings.shareLocalFiles = settings.shareLocalFiles === false;
      row.querySelector(".toggle-switch")?.classList.toggle("on", settings.shareLocalFiles);
      await settingsCtx.saveSettings(false);
      return;
    }
    const d = deviceById(row.dataset.id);
    if (!d) return;
    const field = { remote: "remoteControl", auto: "autoControl", mirror: "mirrorLibrary", stream: "streamLocal" }[key];
    const on = key === "auto" ? !(d.autoControl && d.remoteControl) : !d[field];
    await ctx.invoke("link_update_device", { id: d.id, patch: { [field]: on } }).catch((e) => ctx.showError(e));
    await refresh();
  }

  async function onControl(id) {
    const d = deviceById(id);
    if (!d || !window.MochyRemote) return;
    if (steeringId() === id) await window.MochyRemote.stop();
    else await window.MochyRemote.start(d);
    updatePage();
  }

  async function onSync(id) {
    syncNote = { text: "Syncing…" };
    updatePage();
    try {
      const summary = await ctx.invoke("link_sync", { id });
      syncNote = { text: summary ? `Synced just now: ${summary}` : "Synced just now" };
    } catch (e) {
      syncNote = { text: String(e), problem: true };
    }
    await refresh();
  }

  async function onUnlink(id) {
    if (steeringId() === id) await window.MochyRemote?.stop();
    await ctx.invoke("link_unlink", { id }).catch((e) => ctx.showError(e));
    await refresh();
    showView("list");
  }

  // --------------------------------------------------------------------------
  // a short note at the top of the window: paired, controlling, playing there
  // --------------------------------------------------------------------------
  function toast(message) {
    let el = document.getElementById("dev-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "dev-toast";
      el.className = "dev-toast glass-pill";
      (document.getElementById("main-area") || document.body).appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  window.MochyDevices = {
    // listens for the link from the start, so pairings, syncs and the remote work before settings is ever opened
    init(appCtx) {
      ctx = appCtx;
      ctx.listen("link://changed", refreshSoon);
      ctx.listen("link://toast", (p) => p?.message && toast(p.message));
      ctx.listen("link://paired", (p) => {
        toast(`Paired with ${p?.name || "a device"}`);
        refreshSoon();
      });
      refresh();
    },
    // the settings page's right side; the settings list draws it and hands its context over
    pageHtml(sCtx) {
      settingsCtx = sCtx;
      const kind = view === "list" || view === "add" ? view : "device";
      return `<div id="dev-page" class="dev-page" data-view="${kind}">${viewHtml()}</div>`;
    },
    bindPage(sCtx) {
      settingsCtx = sCtx;
      const root = page();
      if (!root) return;
      bindPage(root);
      updatePage();
      if (view === "add" && !pairing) openPairing();
      refresh();
      clearInterval(pageTimer);
      pageTimer = setInterval(() => {
        if (!page()) {
          clearInterval(pageTimer);
          return;
        }
        refresh();
      }, PAGE_TICK_MS);
    },
    // straight to the list, from the remote's "device settings" or a menu
    reset() {
      if (view === "add") closePairing();
      view = "list";
    },
    toast,
    kindIcon,
    deviceById,
    pairedCount: () => devices().length,
    refresh: refreshSoon,
    updatePage
  };
})();
