/* ============================================================
   Prompts — shared theme engine.
   Loaded on every page. Reads/writes localStorage['prompts.settings.v1'],
   applies CSS custom properties + data-* attributes, lazy-loads
   Google Fonts, and exposes window.PromptsTheme for settings.html.
   ============================================================ */
(function () {
  const STORAGE_KEY = "prompts.settings.v1";
  const SYSTEM_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const FONTS = [
    { id: "system",      label: "System default",   stack: SYSTEM_STACK },
    { id: "century",     label: "Century Gothic",    stack: '"Century Gothic", CenturyGothic, AppleGothic, ' + SYSTEM_STACK },
    { id: "nunito",      label: "Nunito",            google: "Nunito:wght@300;400;500;600;700",      stack: '"Nunito", ' + SYSTEM_STACK },
    { id: "quicksand",   label: "Quicksand",         google: "Quicksand:wght@300;400;500;600;700",   stack: '"Quicksand", ' + SYSTEM_STACK },
    { id: "varela",      label: "Varela Round",      google: "Varela+Round:wght@400",                stack: '"Varela Round", ' + SYSTEM_STACK },
    { id: "fredoka",     label: "Fredoka",           google: "Fredoka:wght@300;400;500;600",         stack: '"Fredoka", ' + SYSTEM_STACK },
    { id: "figtree",     label: "Figtree",           google: "Figtree:wght@300;400;500;600",         stack: '"Figtree", ' + SYSTEM_STACK },
    { id: "lexend",      label: "Lexend",            google: "Lexend:wght@300;400;500;600",          stack: '"Lexend", ' + SYSTEM_STACK },
    { id: "dmsans",      label: "DM Sans",           google: "DM+Sans:wght@400;500;700",             stack: '"DM Sans", ' + SYSTEM_STACK },
    { id: "outfit",      label: "Outfit",            google: "Outfit:wght@300;400;500;600",          stack: '"Outfit", ' + SYSTEM_STACK },
    { id: "manrope",     label: "Manrope",           google: "Manrope:wght@300;400;500;600;700",     stack: '"Manrope", ' + SYSTEM_STACK },
    { id: "poppins",     label: "Poppins",           google: "Poppins:wght@300;400;500;600",         stack: '"Poppins", ' + SYSTEM_STACK },
    { id: "fraunces",    label: "Fraunces",          google: "Fraunces:wght@300;400;500;600",        stack: '"Fraunces", Georgia, serif' },
    { id: "lora",        label: "Lora",              google: "Lora:wght@400;500;600",                stack: '"Lora", Georgia, serif' },
  ];

  const WEIGHTS = { Light: 300, Regular: 400, Medium: 500 };

  const DEFAULTS = {
    fontDisplay: "system",
    fontHead: "system",
    fontBody: "system",
    fontUi: "system",
    weightDisplay: "Medium",
    weightHead: "Medium",
    kAll: 1,
    kBody: 1,
    kHead: 1,
    kDisplay: 1,
    lh: 1.5,
    kSpace: 1,
    wrapW: "standard", // narrow | standard | wide
    appearance: "light", // light | dark | match
    accent: "default",   // default | teal | indigo | rose | olive
    labels: "sentence",  // sentence | upper
    anim: "full",        // full | reduced
    toggles: { showIds: false, compact: false },
  };

  const WRAP_WIDTHS = { narrow: "560px", standard: "760px", wide: "960px" };

  const PRESETS = {
    "Default": {},
    "Soft & friendly": { fontDisplay: "fredoka", fontHead: "quicksand", fontBody: "nunito", fontUi: "nunito", accent: "rose", labels: "sentence", kSpace: 1.1 },
    "Classic serif headings": { fontDisplay: "fraunces", fontHead: "fraunces", fontBody: "lora", fontUi: "system", accent: "olive" },
    "Clean & minimal": { fontDisplay: "manrope", fontHead: "manrope", fontBody: "dmsans", fontUi: "dmsans", accent: "indigo", labels: "upper" },
    "Large & clear": { kAll: 1.18, lh: 1.7, kSpace: 1.25, wrapW: "wide", anim: "reduced" },
    "Night reading": { appearance: "dark", fontBody: "lora", lh: 1.65, accent: "teal" },
  };

  const loadedGoogleFonts = new Set();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS, toggles: { ...DEFAULTS.toggles } };
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed, toggles: { ...DEFAULTS.toggles, ...(parsed.toggles || {}) } };
    } catch (e) {
      return { ...DEFAULTS, toggles: { ...DEFAULTS.toggles } };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* ignore — e.g. storage disabled */ }
  }

  function fontById(id) {
    return FONTS.find((f) => f.id === id) || FONTS[0];
  }

  function ensureGoogleFont(fontId) {
    const f = fontById(fontId);
    if (!f.google || loadedGoogleFonts.has(f.id)) return;
    loadedGoogleFonts.add(f.id);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
    document.head.appendChild(link);
  }

  function resolveAppearance(settings) {
    if (settings.appearance === "match") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return settings.appearance;
  }

  function resolveAnim(settings) {
    if (settings.anim === "reduced") return "reduced";
    const osReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return osReduced ? "reduced" : "full";
  }

  function apply(settings) {
    ensureGoogleFont(settings.fontDisplay);
    ensureGoogleFont(settings.fontHead);
    ensureGoogleFont(settings.fontBody);
    ensureGoogleFont(settings.fontUi);

    const html = document.documentElement;
    const style = html.style;
    style.setProperty("--f-display", fontById(settings.fontDisplay).stack);
    style.setProperty("--f-head", fontById(settings.fontHead).stack);
    style.setProperty("--f-body", fontById(settings.fontBody).stack);
    style.setProperty("--f-ui", fontById(settings.fontUi).stack);
    style.setProperty("--w-display", String(WEIGHTS[settings.weightDisplay] || 500));
    style.setProperty("--w-head", String(WEIGHTS[settings.weightHead] || 500));
    style.setProperty("--k-all", String(settings.kAll));
    style.setProperty("--k-body", String(settings.kBody));
    style.setProperty("--k-head", String(settings.kHead));
    style.setProperty("--k-display", String(settings.kDisplay));
    style.setProperty("--lh", String(settings.lh));
    style.setProperty("--k-space", String(settings.kSpace));
    style.setProperty("--wrap-w", WRAP_WIDTHS[settings.wrapW] || WRAP_WIDTHS.standard);

    html.setAttribute("data-mode", resolveAppearance(settings));
    html.setAttribute("data-accent", settings.accent);
    html.setAttribute("data-labels", settings.labels === "upper" ? "upper" : "sentence");
    html.setAttribute("data-anim", resolveAnim(settings));
  }

  // react live to OS changes when "match"/OS-following is in effect
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const s = loadSettings();
      if (s.appearance === "match") apply(s);
    });
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
      const s = loadSettings();
      if (s.anim !== "reduced") apply(s);
    });
  }

  const settings = loadSettings();
  apply(settings);

  window.PromptsTheme = {
    STORAGE_KEY, FONTS, WEIGHTS, DEFAULTS, WRAP_WIDTHS, PRESETS,
    load: loadSettings, save: saveSettings, apply, fontById,
  };
})();
