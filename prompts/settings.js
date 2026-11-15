/* Wires up the Settings page controls to window.PromptsTheme. */
(function () {
  const T = window.PromptsTheme;
  let settings = T.load();

  function persist() {
    T.save(settings);
    T.apply(settings);
    renderAll(); // keep every control's displayed value in sync (e.g. after a preset)
  }

  // ---- Typography selects ----
  function fillFontSelect(sel, current) {
    sel.innerHTML = T.FONTS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
    sel.value = current;
  }
  const fontDisplay = document.getElementById("fontDisplay");
  const fontHead = document.getElementById("fontHead");
  const fontBody = document.getElementById("fontBody");
  const fontUi = document.getElementById("fontUi");

  function fillWeightSeg(container, key) {
    container.innerHTML = Object.keys(T.WEIGHTS).map((w) => `<button data-v="${w}">${w}</button>`).join("");
    container.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      settings[key] = b.dataset.v;
      persist();
    });
  }
  fillWeightSeg(document.getElementById("weightDisplaySeg"), "weightDisplay");
  fillWeightSeg(document.getElementById("weightHeadSeg"), "weightHead");

  [["fontDisplay", fontDisplay], ["fontHead", fontHead], ["fontBody", fontBody], ["fontUi", fontUi]].forEach(([key, el]) => {
    el.addEventListener("change", () => { settings[key] = el.value; persist(); });
  });

  // ---- Sliders ----
  function wireRange(id, valId, key, fmt) {
    const el = document.getElementById(id);
    const val = document.getElementById(valId);
    el.addEventListener("input", () => {
      settings[key] = parseFloat(el.value);
      val.textContent = fmt(settings[key]);
      T.apply(settings);
    });
    el.addEventListener("change", () => { T.save(settings); });
  }
  wireRange("kAll", "kAllVal", "kAll", (v) => Math.round(v * 100) + "%");
  wireRange("kBody", "kBodyVal", "kBody", (v) => Math.round(v * 100) + "%");
  wireRange("kHead", "kHeadVal", "kHead", (v) => Math.round(v * 100) + "%");
  wireRange("kDisplay", "kDisplayVal", "kDisplay", (v) => Math.round(v * 100) + "%");
  wireRange("lh", "lhVal", "lh", (v) => v.toFixed(2));
  wireRange("kSpace", "kSpaceVal", "kSpace", (v) => Math.round(v * 100) + "%");

  // ---- Segmented controls (generic) ----
  function wireSeg(containerId, key) {
    const el = document.getElementById(containerId);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      settings[key] = b.dataset.v;
      persist();
    });
  }
  wireSeg("wrapWSeg", "wrapW");
  wireSeg("appearanceSeg", "appearance");
  wireSeg("labelsSeg", "labels");
  wireSeg("animSeg", "anim");

  // ---- Accent swatches ----
  const ACCENTS = [
    { id: "default", label: "Orange (default)", hex: "#c25a1e" },
    { id: "teal", label: "Teal", hex: "#0f766e" },
    { id: "indigo", label: "Indigo", hex: "#4338ca" },
    { id: "rose", label: "Rose", hex: "#be123c" },
    { id: "olive", label: "Olive", hex: "#65731a" },
  ];
  const swatchesEl = document.getElementById("accentSwatches");
  swatchesEl.innerHTML = ACCENTS.map((a) => `<button class="swatch" data-v="${a.id}" style="background:${a.hex}" aria-label="${a.label}" title="${a.label}"></button>`).join("");
  swatchesEl.addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b) return;
    settings.accent = b.dataset.v;
    persist();
  });

  // ---- Presets ----
  const presetSelect = document.getElementById("presetSelect");
  presetSelect.innerHTML = Object.keys(T.PRESETS).map((name) => `<option value="${name}">${name}</option>`).join("");
  presetSelect.addEventListener("change", () => {
    const preset = T.PRESETS[presetSelect.value] || {};
    settings = { ...T.DEFAULTS, ...preset, toggles: { ...settings.toggles } };
    persist();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    settings = { ...T.DEFAULTS, toggles: { ...T.DEFAULTS.toggles } };
    presetSelect.value = "Default";
    persist();
  });

  // ---- Copy settings ----
  document.getElementById("copyBtn").addEventListener("click", () => {
    const out = document.getElementById("copyOut");
    const lines = Object.entries(settings)
      .filter(([k]) => k !== "toggles")
      .map(([k, v]) => `${k}: ${v}`)
      .concat(Object.entries(settings.toggles).map(([k, v]) => `toggle.${k}: ${v}`));
    out.value = lines.join("\n");
    out.hidden = false;
    navigator.clipboard?.writeText(out.value).catch(() => {});
  });

  // ---- Draft toggles ----
  const toggleShowIds = document.getElementById("toggleShowIds");
  const toggleCompact = document.getElementById("toggleCompact");
  toggleShowIds.addEventListener("change", () => { settings.toggles.showIds = toggleShowIds.checked; T.save(settings); });
  toggleCompact.addEventListener("change", () => { settings.toggles.compact = toggleCompact.checked; T.save(settings); });

  // ---- Build info + version badges ----
  function loadBuildInfo() {
    fetch("version.json", { cache: "no-store" }).then((r) => r.json()).then((v) => {
      const badge = `Draft build v${v.version} · ${v.date}`;
      document.getElementById("headVersion").textContent = badge;
      document.getElementById("footVersion").textContent = badge;
    }).catch(() => {});
    fetch("builds.json", { cache: "no-store" }).then((r) => r.json()).then((builds) => {
      document.getElementById("buildNote").textContent =
        `This is the current build (v${builds[builds.length - 1].version}). Earlier builds, once there are any, are archived in /prompts/Build History/.`;
    }).catch(() => {
      document.getElementById("buildNote").textContent = "Couldn't load build info.";
    });
  }

  function renderAll() {
    fillFontSelect(fontDisplay, settings.fontDisplay);
    fillFontSelect(fontHead, settings.fontHead);
    fillFontSelect(fontBody, settings.fontBody);
    fillFontSelect(fontUi, settings.fontUi);

    document.querySelectorAll("#weightDisplaySeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.weightDisplay)));
    document.querySelectorAll("#weightHeadSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.weightHead)));
    document.querySelectorAll("#wrapWSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.wrapW)));
    document.querySelectorAll("#appearanceSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.appearance)));
    document.querySelectorAll("#labelsSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.labels)));
    document.querySelectorAll("#animSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.anim)));
    document.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === settings.accent)));

    document.getElementById("kAll").value = settings.kAll; document.getElementById("kAllVal").textContent = Math.round(settings.kAll * 100) + "%";
    document.getElementById("kBody").value = settings.kBody; document.getElementById("kBodyVal").textContent = Math.round(settings.kBody * 100) + "%";
    document.getElementById("kHead").value = settings.kHead; document.getElementById("kHeadVal").textContent = Math.round(settings.kHead * 100) + "%";
    document.getElementById("kDisplay").value = settings.kDisplay; document.getElementById("kDisplayVal").textContent = Math.round(settings.kDisplay * 100) + "%";
    document.getElementById("lh").value = settings.lh; document.getElementById("lhVal").textContent = settings.lh.toFixed(2);
    document.getElementById("kSpace").value = settings.kSpace; document.getElementById("kSpaceVal").textContent = Math.round(settings.kSpace * 100) + "%";

    toggleShowIds.checked = !!settings.toggles.showIds;
    toggleCompact.checked = !!settings.toggles.compact;
  }

  renderAll();
  loadBuildInfo();
})();
