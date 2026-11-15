/* ============================================================
   Prompts — Settings panel.
   A slide-out pane (not a page) of global design controls, driven
   by window.PromptsTheme. Slides in from the RIGHT (same side as
   the Claude dev panel). No dimming backdrop and nothing blocks
   clicks on the rest of the page — the site stays fully interactive
   and every change applies live, so you can tune it while watching
   the result. Close via the × button, the gear icon again, or Esc.

   Only one of the Settings / Claude panels is ever open at a time —
   opening this one closes the other (see the prompts:panel-opening
   event below, also listened for in claude-panel.js).

   Include this script (after theme.js) on every page that has a
   <button id="gearIconBtn"> in its header.
   ============================================================ */
(function () {
  const T = window.PromptsTheme;
  const PANEL_NAME = "settings";

  function h(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const ACCENTS = [
    { id: "default", label: "Orange (default)", hex: "#c25a1e" },
    { id: "teal", label: "Teal", hex: "#0f766e" },
    { id: "indigo", label: "Indigo", hex: "#4338ca" },
    { id: "rose", label: "Rose", hex: "#be123c" },
    { id: "olive", label: "Olive", hex: "#65731a" },
  ];

  function injectStyles() {
    const css = `
      .sp-pane{
        position:fixed; top:0; right:0; height:100%; width:min(360px, 92vw);
        background:var(--card); color:var(--fg); border-left:1px solid var(--border);
        box-shadow: -8px 0 24px rgba(0,0,0,0.12);
        transform:translateX(100%); transition:transform .22s ease; z-index:61;
        display:flex; flex-direction:column; font-family:var(--f-body);
        pointer-events:none;
      }
      .sp-pane.open{ transform:translateX(0); pointer-events:auto; }
      .sp-head{ padding:16px 18px 10px; border-bottom:1px solid var(--border); position:relative; }
      .sp-head h2{ margin:0 0 4px; font-family:var(--f-head); font-weight:var(--w-head); font-size:16px; }
      .sp-body{ padding:14px 18px 24px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px; }
      .sp-close{ position:absolute; top:12px; right:14px; background:none; border:none; font-size:18px; color:var(--fg-faint); cursor:pointer; line-height:1; }
      .sp-group{ border:1px solid var(--border); border-radius:var(--radius); padding:12px 14px 4px; }
      .sp-group h3{ font-family:var(--f-ui); font-size:12px; margin:0 0 10px; color:var(--fg-dim); text-transform:uppercase; letter-spacing:.06em; }
      .sp-field{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:8px 0; border-top:1px solid var(--border); font-size:12.5px; }
      .sp-field:first-of-type{ border-top:none; }
      .sp-field .sp-label small{ display:block; font-size:10.5px; color:var(--fg-faint); margin-top:2px; max-width:150px; }
      .sp-field .sp-ctl{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
      .sp-pane select{ font-size:12px; padding:4px 6px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--fg); }
      .sp-pane input[type="range"]{ width:92px; }
      .sp-rangeval{ font-family:var(--f-mono); font-size:10.5px; color:var(--fg-faint); min-width:32px; text-align:right; }
      .sp-seg{ display:flex; border:1px solid var(--border); border-radius:7px; overflow:hidden; }
      .sp-seg button{ font-family:var(--f-ui); font-size:11px; padding:5px 8px; border:none; background:var(--bg); color:var(--fg-dim); cursor:pointer; }
      .sp-seg button[aria-pressed="true"]{ background:var(--accent); color:#fff; }
      .sp-swatches{ display:flex; gap:5px; }
      .sp-swatch{ width:18px; height:18px; border-radius:50%; border:2px solid var(--border); cursor:pointer; padding:0; }
      .sp-swatch[aria-pressed="true"]{ border-color:var(--fg); }
      .sp-btn{ font-family:var(--f-ui); font-size:11.5px; padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--fg); cursor:pointer; }
      .sp-btn:hover{ border-color:var(--accent); color:var(--accent); }
      .sp-btn.primary{ background:var(--accent); border-color:var(--accent); color:#fff; }
      .sp-toggle-row{ display:flex; align-items:center; gap:7px; padding:7px 0; border-top:1px solid var(--border); font-size:12.5px; }
      .sp-toggle-row:first-of-type{ border-top:none; }
      #spCopyOut{ width:100%; min-height:90px; font-family:var(--f-mono); font-size:10.5px; border:1px solid var(--border); border-radius:8px; background:var(--bg); color:var(--fg); padding:8px; margin-top:8px; }
      .sp-specimen .sd{ font-family:var(--f-display); font-weight:var(--w-display); font-size: calc(20px * var(--k-all) * var(--k-display)); margin:0 0 6px; }
      .sp-specimen .sh{ font-family:var(--f-head); font-weight:var(--w-head); font-size: calc(14px * var(--k-all) * var(--k-head)); margin:0 0 6px; }
      .sp-specimen .sb{ font-family:var(--f-body); font-size: calc(12px * var(--k-all) * var(--k-body)); line-height:var(--lh); margin:0 0 8px; color:var(--fg-dim); }
      .sp-build-note{ font-size:11px; color:var(--fg-dim); padding: 2px 0 6px; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function panelMarkup() {
    return `
      <aside class="sp-pane" role="dialog" aria-label="Settings panel">
        <div class="sp-head">
          <button class="sp-close" aria-label="Close">×</button>
          <span class="draft-label ui-label">Not part of the public site</span>
          <h2>Settings</h2>
          <span class="version-badge" id="spVersionBadge">Draft build — loading…</span>
        </div>
        <div class="sp-body">

          <div class="sp-group">
            <h3>Typography</h3>
            <div class="sp-field"><div class="sp-label">Display<small>Hero, big numbers, quotes</small></div><div class="sp-ctl"><select id="spFontDisplay"></select></div></div>
            <div class="sp-field"><div class="sp-label">Heading</div><div class="sp-ctl"><select id="spFontHead"></select></div></div>
            <div class="sp-field"><div class="sp-label">Body</div><div class="sp-ctl"><select id="spFontBody"></select></div></div>
            <div class="sp-field"><div class="sp-label">Labels / nav / buttons</div><div class="sp-ctl"><select id="spFontUi"></select></div></div>
            <div class="sp-field"><div class="sp-label">Display weight</div><div class="sp-ctl sp-seg" id="spWeightDisplaySeg"></div></div>
            <div class="sp-field"><div class="sp-label">Heading weight</div><div class="sp-ctl sp-seg" id="spWeightHeadSeg"></div></div>
          </div>

          <div class="sp-group">
            <h3>Size &amp; spacing</h3>
            <div class="sp-field"><div class="sp-label">Overall size</div><div class="sp-ctl"><input type="range" id="spKAll" min="0.85" max="1.25" step="0.01"><span class="sp-rangeval" id="spKAllVal"></span></div></div>
            <div class="sp-field"><div class="sp-label">Body size</div><div class="sp-ctl"><input type="range" id="spKBody" min="0.85" max="1.3" step="0.01"><span class="sp-rangeval" id="spKBodyVal"></span></div></div>
            <div class="sp-field"><div class="sp-label">Heading size</div><div class="sp-ctl"><input type="range" id="spKHead" min="0.85" max="1.3" step="0.01"><span class="sp-rangeval" id="spKHeadVal"></span></div></div>
            <div class="sp-field"><div class="sp-label">Display size</div><div class="sp-ctl"><input type="range" id="spKDisplay" min="0.85" max="1.4" step="0.01"><span class="sp-rangeval" id="spKDisplayVal"></span></div></div>
            <div class="sp-field"><div class="sp-label">Line spacing</div><div class="sp-ctl"><input type="range" id="spLh" min="1.2" max="1.8" step="0.01"><span class="sp-rangeval" id="spLhVal"></span></div></div>
            <div class="sp-field"><div class="sp-label">Section spacing</div><div class="sp-ctl"><input type="range" id="spKSpace" min="0.7" max="1.6" step="0.01"><span class="sp-rangeval" id="spKSpaceVal"></span></div></div>
            <div class="sp-field"><div class="sp-label">Content width</div><div class="sp-ctl sp-seg" id="spWrapWSeg">
              <button data-v="narrow">Narrow</button><button data-v="standard">Std</button><button data-v="wide">Wide</button>
            </div></div>
          </div>

          <div class="sp-group">
            <h3>Look &amp; feel</h3>
            <div class="sp-field"><div class="sp-label">Appearance</div><div class="sp-ctl sp-seg" id="spAppearanceSeg">
              <button data-v="light">Light</button><button data-v="dark">Dark</button><button data-v="match">Device</button>
            </div></div>
            <div class="sp-field"><div class="sp-label">Accent</div><div class="sp-ctl sp-swatches" id="spAccentSwatches"></div></div>
            <div class="sp-field"><div class="sp-label">Labels</div><div class="sp-ctl sp-seg" id="spLabelsSeg">
              <button data-v="upper">UPPER</button><button data-v="sentence">Sentence</button>
            </div></div>
            <div class="sp-field"><div class="sp-label">Animation</div><div class="sp-ctl sp-seg" id="spAnimSeg">
              <button data-v="full">Full</button><button data-v="reduced">Reduced</button>
            </div></div>
          </div>

          <div class="sp-group">
            <h3>Preview</h3>
            <div class="sp-field"><div class="sp-label">Mobile device<small>Used by the phone-preview button in the header</small></div><div class="sp-ctl"><select id="spPreviewDevice"></select></div></div>
          </div>

          <div class="sp-group">
            <h3>Presets</h3>
            <div class="sp-field"><div class="sp-label">Apply</div><div class="sp-ctl">
              <select id="spPresetSelect"></select>
            </div></div>
            <div class="sp-field"><div class="sp-label">&nbsp;</div><div class="sp-ctl">
              <button class="sp-btn" id="spResetBtn">Reset to defaults</button>
            </div></div>
            <div class="sp-field"><div class="sp-label">Copy settings<small>Paste back into a chat with Claude</small></div><div class="sp-ctl"><button class="sp-btn" id="spCopyBtn">Copy</button></div></div>
            <textarea id="spCopyOut" readonly hidden></textarea>
          </div>

          <div class="sp-group sp-specimen">
            <h3>Type specimen</h3>
            <p class="sd">Display, 0123</p>
            <p class="sh">A heading looks like this</p>
            <p class="sb">Body copy — enough to judge line length and spacing in whatever font and size you've chosen above.</p>
            <button class="sp-btn primary ui-label">Button label</button>
          </div>

          <div class="sp-group">
            <h3>Other draft toggles</h3>
            <div class="sp-toggle-row"><input type="checkbox" id="spToggleShowIds"><label for="spToggleShowIds">Show prompt IDs on cards</label></div>
            <div class="sp-toggle-row"><input type="checkbox" id="spToggleCompact"><label for="spToggleCompact">Compact list (collapse snippets by default)</label></div>
          </div>

          <div class="sp-group">
            <h3>Build</h3>
            <p class="sp-build-note" id="spBuildNote">Loading build info…</p>
          </div>

        </div>
      </aside>
    `;
  }

  function build() {
    injectStyles();
    const pane = h(panelMarkup());
    document.body.appendChild(pane);

    let settings = T.load();
    const q = (sel) => pane.querySelector(sel);
    const qa = (sel) => pane.querySelectorAll(sel);

    function persist() {
      T.save(settings);
      T.apply(settings);
      renderAll();
    }

    function fillFontSelect(sel, current) {
      sel.innerHTML = T.FONTS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
      sel.value = current;
    }
    const fontDisplay = q("#spFontDisplay"), fontHead = q("#spFontHead"), fontBody = q("#spFontBody"), fontUi = q("#spFontUi");

    function fillWeightSeg(container, key) {
      container.innerHTML = Object.keys(T.WEIGHTS).map((w) => `<button data-v="${w}">${w}</button>`).join("");
      container.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        settings[key] = b.dataset.v;
        persist();
      });
    }
    fillWeightSeg(q("#spWeightDisplaySeg"), "weightDisplay");
    fillWeightSeg(q("#spWeightHeadSeg"), "weightHead");

    [["fontDisplay", fontDisplay], ["fontHead", fontHead], ["fontBody", fontBody], ["fontUi", fontUi]].forEach(([key, el]) => {
      el.addEventListener("change", () => { settings[key] = el.value; persist(); });
    });

    function wireRange(id, valId, key, fmt) {
      const el = q(id); const val = q(valId);
      el.addEventListener("input", () => {
        settings[key] = parseFloat(el.value);
        val.textContent = fmt(settings[key]);
        T.apply(settings);
      });
      el.addEventListener("change", () => { T.save(settings); });
    }
    wireRange("#spKAll", "#spKAllVal", "kAll", (v) => Math.round(v * 100) + "%");
    wireRange("#spKBody", "#spKBodyVal", "kBody", (v) => Math.round(v * 100) + "%");
    wireRange("#spKHead", "#spKHeadVal", "kHead", (v) => Math.round(v * 100) + "%");
    wireRange("#spKDisplay", "#spKDisplayVal", "kDisplay", (v) => Math.round(v * 100) + "%");
    wireRange("#spLh", "#spLhVal", "lh", (v) => v.toFixed(2));
    wireRange("#spKSpace", "#spKSpaceVal", "kSpace", (v) => Math.round(v * 100) + "%");

    function wireSeg(id, key) {
      const el = q(id);
      el.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        settings[key] = b.dataset.v;
        persist();
      });
    }
    wireSeg("#spWrapWSeg", "wrapW");
    wireSeg("#spAppearanceSeg", "appearance");
    wireSeg("#spLabelsSeg", "labels");
    wireSeg("#spAnimSeg", "anim");

    const previewDeviceSel = q("#spPreviewDevice");
    previewDeviceSel.innerHTML = T.DEVICES.map((d) => `<option value="${d.id}">${escapeHtml(d.label)} (${d.width}×${d.height})</option>`).join("");
    previewDeviceSel.addEventListener("change", () => {
      settings.previewDevice = previewDeviceSel.value;
      T.save(settings);
      window.dispatchEvent(new CustomEvent("prompts:preview-device-changed", { detail: settings.previewDevice }));
    });

    const swatchesEl = q("#spAccentSwatches");
    swatchesEl.innerHTML = ACCENTS.map((a) => `<button class="sp-swatch" data-v="${a.id}" style="background:${a.hex}" aria-label="${a.label}" title="${a.label}"></button>`).join("");
    swatchesEl.addEventListener("click", (e) => {
      const b = e.target.closest(".sp-swatch");
      if (!b) return;
      settings.accent = b.dataset.v;
      persist();
    });

    const presetSelect = q("#spPresetSelect");
    presetSelect.innerHTML = Object.keys(T.PRESETS).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    presetSelect.addEventListener("change", () => {
      const preset = T.PRESETS[presetSelect.value] || {};
      settings = { ...T.DEFAULTS, ...preset, toggles: { ...settings.toggles } };
      persist();
    });

    q("#spResetBtn").addEventListener("click", () => {
      settings = { ...T.DEFAULTS, toggles: { ...T.DEFAULTS.toggles } };
      presetSelect.value = "Default";
      persist();
    });

    q("#spCopyBtn").addEventListener("click", () => {
      const out = q("#spCopyOut");
      const lines = Object.entries(settings)
        .filter(([k]) => k !== "toggles")
        .map(([k, v]) => `${k}: ${v}`)
        .concat(Object.entries(settings.toggles).map(([k, v]) => `toggle.${k}: ${v}`));
      out.value = lines.join("\n");
      out.hidden = false;
      navigator.clipboard?.writeText(out.value).catch(() => {});
    });

    const toggleShowIds = q("#spToggleShowIds"), toggleCompact = q("#spToggleCompact");
    toggleShowIds.addEventListener("change", () => { settings.toggles.showIds = toggleShowIds.checked; T.save(settings); applyTogglesLive(); });
    toggleCompact.addEventListener("change", () => { settings.toggles.compact = toggleCompact.checked; T.save(settings); applyTogglesLive(); });

    function applyTogglesLive() {
      // Let the current page react immediately (e.g. index.html's list re-render).
      window.dispatchEvent(new CustomEvent("prompts:toggles-changed", { detail: settings.toggles }));
    }

    function loadBuildInfo() {
      fetch("version.json", { cache: "no-store" }).then((r) => r.json()).then((v) => {
        q("#spVersionBadge").textContent = `Draft build v${v.version} · ${v.date}`;
      }).catch(() => {});
      fetch("builds.json", { cache: "no-store" }).then((r) => r.json()).then((builds) => {
        const latest = builds[builds.length - 1];
        q("#spBuildNote").textContent = `This is the current build (v${latest.version}, ${latest.date}). Earlier builds are archived in /prompts/Build History/.`;
      }).catch(() => { q("#spBuildNote").textContent = "Couldn't load build info."; });
    }

    function renderAll() {
      fillFontSelect(fontDisplay, settings.fontDisplay);
      fillFontSelect(fontHead, settings.fontHead);
      fillFontSelect(fontBody, settings.fontBody);
      fillFontSelect(fontUi, settings.fontUi);

      qa("#spWeightDisplaySeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.weightDisplay)));
      qa("#spWeightHeadSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.weightHead)));
      qa("#spWrapWSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.wrapW)));
      qa("#spAppearanceSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.appearance)));
      qa("#spLabelsSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.labels)));
      qa("#spAnimSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.anim)));
      qa(".sp-swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.accent)));

      q("#spKAll").value = settings.kAll; q("#spKAllVal").textContent = Math.round(settings.kAll * 100) + "%";
      q("#spKBody").value = settings.kBody; q("#spKBodyVal").textContent = Math.round(settings.kBody * 100) + "%";
      q("#spKHead").value = settings.kHead; q("#spKHeadVal").textContent = Math.round(settings.kHead * 100) + "%";
      q("#spKDisplay").value = settings.kDisplay; q("#spKDisplayVal").textContent = Math.round(settings.kDisplay * 100) + "%";
      q("#spLh").value = settings.lh; q("#spLhVal").textContent = settings.lh.toFixed(2);
      q("#spKSpace").value = settings.kSpace; q("#spKSpaceVal").textContent = Math.round(settings.kSpace * 100) + "%";

      toggleShowIds.checked = !!settings.toggles.showIds;
      toggleCompact.checked = !!settings.toggles.compact;
      previewDeviceSel.value = settings.previewDevice;
    }

    renderAll();
    loadBuildInfo();

    function open() {
      window.dispatchEvent(new CustomEvent("prompts:panel-opening", { detail: { name: PANEL_NAME } }));
      pane.classList.add("open");
    }
    function close() { pane.classList.remove("open"); }
    function toggle() { pane.classList.contains("open") ? close() : open(); }

    // Only one of Settings / Claude is ever open — close this one if another is opening.
    window.addEventListener("prompts:panel-opening", (e) => {
      if (e.detail.name !== PANEL_NAME && pane.classList.contains("open")) close();
    });

    pane.querySelector(".sp-close").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && pane.classList.contains("open")) close();
    });

    const btn = document.getElementById("gearIconBtn");
    if (btn) btn.addEventListener("click", toggle);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
