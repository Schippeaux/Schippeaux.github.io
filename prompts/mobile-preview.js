/* ============================================================
   Prompts — Mobile preview.
   A centered overlay that renders the current page inside a
   phone-shaped frame, sized to a chosen device's logical viewport
   (so layout/media queries behave as they would on that phone).
   The device itself is a persisted setting (settings.previewDevice,
   also editable from the Settings panel's "Preview" group) — this
   modal's own dropdown is just a shortcut that writes to the same
   setting.

   Opening this closes the Settings/Claude side panels (and vice
   versa) via the shared prompts:panel-opening event, so only one
   of the three is ever showing. Close with the × button, the
   backdrop, the mobile icon again, or Esc.

   Include this script (after theme.js) on every page that has a
   <button id="mobileIconBtn"> in its header.
   ============================================================ */
(function () {
  const T = window.PromptsTheme;
  const PANEL_NAME = "mobile";

  function h(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function injectStyles() {
    const css = `
      .mp-overlay{
        position:fixed; inset:0; background:rgba(0,0,0,0.45);
        display:flex; align-items:center; justify-content:center;
        opacity:0; pointer-events:none; transition:opacity .18s ease; z-index:70;
      }
      .mp-overlay.open{ opacity:1; pointer-events:auto; }
      .mp-shell{ display:flex; flex-direction:column; align-items:center; gap:12px; max-height:94vh; }
      .mp-bar{
        display:flex; align-items:center; gap:10px;
        background:var(--card); color:var(--fg); border:1px solid var(--border);
        border-radius:999px; padding:6px 8px 6px 14px; font-family:var(--f-ui); font-size:12px;
      }
      .mp-bar select{ font-size:12px; padding:4px 6px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--fg); }
      .mp-close{ background:none; border:none; font-size:18px; color:var(--fg-faint); cursor:pointer; line-height:1; padding:2px 6px; }
      .mp-frame{
        background:#111; border-radius:38px; padding:14px 10px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        position:relative;
      }
      .mp-frame .notch{
        position:absolute; top:14px; left:50%; transform:translateX(-50%);
        width:40%; height:18px; background:#111; border-radius:0 0 14px 14px; z-index:2;
      }
      .mp-frame iframe{ display:block; background:#fff; border:none; border-radius:22px; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function build() {
    injectStyles();

    const overlay = h(`
      <div class="mp-overlay" role="dialog" aria-label="Mobile preview">
        <div class="mp-shell">
          <div class="mp-bar">
            <span class="ui-label">Preview on</span>
            <select id="mpDeviceSelect"></select>
            <button class="mp-close" aria-label="Close">×</button>
          </div>
          <div class="mp-frame">
            <div class="notch"></div>
            <iframe id="mpFrame" title="Mobile preview"></iframe>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    const select = overlay.querySelector("#mpDeviceSelect");
    const iframe = overlay.querySelector("#mpFrame");
    select.innerHTML = T.DEVICES.map((d) => `<option value="${d.id}">${escapeHtml(d.label)} (${d.width}×${d.height})</option>`).join("");

    function sizeFrame() {
      const settings = T.load();
      const device = T.DEVICES.find((d) => d.id === settings.previewDevice) || T.DEVICES[0];
      select.value = device.id;
      // Scale the whole frame down if the device is taller than the viewport allows.
      const maxH = window.innerHeight * 0.82;
      const scale = Math.min(1, maxH / (device.height + 48));
      iframe.width = device.width;
      iframe.height = device.height;
      overlay.querySelector(".mp-frame").style.transform = `scale(${scale})`;
    }

    select.addEventListener("change", () => {
      const settings = T.load();
      settings.previewDevice = select.value;
      T.save(settings);
      window.dispatchEvent(new CustomEvent("prompts:preview-device-changed", { detail: settings.previewDevice }));
      sizeFrame();
    });
    window.addEventListener("prompts:preview-device-changed", sizeFrame);

    let loaded = false;
    function open() {
      window.dispatchEvent(new CustomEvent("prompts:panel-opening", { detail: { name: PANEL_NAME } }));
      sizeFrame();
      if (!loaded) { iframe.src = "index.html"; loaded = true; } // fresh load at this viewport size
      overlay.classList.add("open");
    }
    function close() { overlay.classList.remove("open"); }
    function toggle() { overlay.classList.contains("open") ? close() : open(); }

    window.addEventListener("prompts:panel-opening", (e) => {
      if (e.detail.name !== PANEL_NAME && overlay.classList.contains("open")) close();
    });
    window.addEventListener("resize", () => { if (overlay.classList.contains("open")) sizeFrame(); });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(".mp-close").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });

    const btn = document.getElementById("mobileIconBtn");
    if (btn) btn.addEventListener("click", toggle);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
