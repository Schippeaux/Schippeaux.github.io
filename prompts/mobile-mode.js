/* ============================================================
   Prompts — "View as mobile" toggle.
   Not a screenshot or a sandboxed iframe: this narrows the page's
   own .shell element to the chosen device's logical width, so the
   real layout reflows (including the @container-based responsive
   rules in index.html) and stays fully interactive — same page,
   same event handlers, just narrower.

   The icon toggles between a phone glyph (off) and a desktop glyph
   (on); clicking it while on switches back to the normal desktop
   width. The device itself is the same `previewDevice` setting used
   by the Settings panel's Preview group.

   Include this script (after theme.js) on every page that has a
   <button id="mobileIconBtn"> in its header and a .shell wrapper.
   ============================================================ */
(function () {
  const T = window.PromptsTheme;

  const PHONE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><line x1="11" y1="18.5" x2="13" y2="18.5"/></svg>';
  const DESKTOP_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>';

  function shellEl() {
    return document.querySelector(".shell") || document.body;
  }

  function init() {
    const btn = document.getElementById("mobileIconBtn");
    if (!btn) return;
    const shell = shellEl();
    let active = false;

    function render() {
      if (active) {
        const settings = T.load();
        const device = T.DEVICES.find((d) => d.id === settings.previewDevice) || T.DEVICES[0];
        shell.style.maxWidth = device.width + "px";
        shell.classList.add("mobile-mode");
        btn.innerHTML = DESKTOP_SVG;
        btn.title = `Back to desktop (currently ${device.label})`;
      } else {
        shell.style.maxWidth = "";
        shell.classList.remove("mobile-mode");
        btn.innerHTML = PHONE_SVG;
        btn.title = "View as mobile";
      }
    }

    btn.addEventListener("click", () => { active = !active; render(); });

    // If the device is changed (in Settings) while mobile mode is on, re-apply the new width live.
    window.addEventListener("prompts:preview-device-changed", () => { if (active) render(); });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
