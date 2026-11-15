/* ============================================================
   Prompts — Claude dev panel.
   A slide-out pane (not a page) for jotting review notes while
   looking at a build, and for seeing the current version and
   build history. Notes are committed straight to this repo via
   the GitHub Contents API, using a token kept only in this
   browser's localStorage — never committed anywhere.

   Include this script on every page that has a
   <button id="claudeIconBtn"> in its header.
   ============================================================ */
(function () {
  const REPO = "schippeaux/schippeaux.github.io";
  const NOTES_PATH = "prompts/dev-notes.json";
  const TOKEN_KEY = "prompts.devnotes.token";
  const API_BASE = `https://api.github.com/repos/${REPO}/contents/`;

  function h(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function injectStyles() {
    const css = `
      .cp-overlay{ position:fixed; inset:0; background:rgba(0,0,0,0.25); opacity:0; pointer-events:none; transition:opacity .18s ease; z-index:60; }
      .cp-overlay.open{ opacity:1; pointer-events:auto; }
      .cp-pane{
        position:fixed; top:0; right:0; height:100%; width:min(380px, 92vw);
        background:var(--card); color:var(--fg); border-left:1px solid var(--border);
        transform:translateX(100%); transition:transform .22s ease; z-index:61;
        display:flex; flex-direction:column; font-family:var(--f-body);
      }
      .cp-pane.open{ transform:translateX(0); }
      .cp-head{ padding:16px 18px 10px; border-bottom:1px solid var(--border); }
      .cp-head h2{ margin:0 0 4px; font-family:var(--f-head); font-weight:var(--w-head); font-size:16px; }
      .cp-body{ padding:16px 18px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:18px; }
      .cp-section h3{ margin:0 0 8px; font-size:12px; font-family:var(--f-ui); color:var(--fg-dim); text-transform:uppercase; letter-spacing:.06em; }
      .cp-notes{ width:100%; min-height:140px; resize:vertical; border:1px solid var(--border); border-radius:8px; padding:10px; font-family:var(--f-body); font-size:13px; background:var(--bg); color:var(--fg); }
      .cp-row{ display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap; }
      .cp-btn{ font-family:var(--f-ui); font-size:12px; padding:7px 11px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--fg); cursor:pointer; }
      .cp-btn:hover{ border-color:var(--accent); color:var(--accent); }
      .cp-btn.primary{ background:var(--accent); border-color:var(--accent); color:#fff; }
      .cp-status{ font-size:11px; color:var(--fg-faint); }
      .cp-token-input{ width:100%; font-family:var(--f-mono); font-size:12px; padding:7px 9px; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg); }
      .cp-help{ font-size:11px; color:var(--fg-faint); line-height:1.5; margin-top:6px; }
      .cp-builds{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
      .cp-builds li{ font-size:12px; display:flex; justify-content:space-between; gap:8px; border-bottom:1px dashed var(--border); padding-bottom:5px; }
      .cp-builds a{ color:var(--accent); text-decoration:none; }
      .cp-close{ position:absolute; top:12px; right:14px; background:none; border:none; font-size:18px; color:var(--fg-faint); cursor:pointer; line-height:1; }
      .cp-pane{ position:fixed; }
      .cp-head{ position:relative; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode("0x" + p1)));
  }
  function b64DecodeUnicode(str) {
    return decodeURIComponent(Array.prototype.map.call(atob(str), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
  }

  function build() {
    injectStyles();

    const overlay = h(`<div class="cp-overlay"></div>`);
    const pane = h(`
      <aside class="cp-pane" role="dialog" aria-label="Claude dev panel">
        <div class="cp-head">
          <button class="cp-close" aria-label="Close">×</button>
          <span class="draft-label ui-label">Not part of the public site</span>
          <h2>Claude dev panel</h2>
          <span class="version-badge" id="cpVersionBadge">Draft build — loading…</span>
        </div>
        <div class="cp-body">
          <div class="cp-section">
            <h3 class="ui-label">Notes for Claude</h3>
            <textarea class="cp-notes" id="cpNotes" placeholder="Type review notes / change requests while looking at this build…"></textarea>
            <div class="cp-row">
              <button class="cp-btn primary" id="cpSave">Save to repo</button>
              <span class="cp-status" id="cpStatus"></span>
            </div>
            <div id="cpTokenArea"></div>
          </div>
          <div class="cp-section">
            <h3 class="ui-label">Previous builds</h3>
            <ul class="cp-builds" id="cpBuilds"><li>Loading…</li></ul>
          </div>
        </div>
      </aside>
    `);

    document.body.appendChild(overlay);
    document.body.appendChild(pane);

    function open() {
      overlay.classList.add("open");
      pane.classList.add("open");
      loadVersion();
      loadBuilds();
      loadNotes();
      renderTokenArea();
    }
    function close() {
      overlay.classList.remove("open");
      pane.classList.remove("open");
    }
    overlay.addEventListener("click", close);
    pane.querySelector(".cp-close").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && pane.classList.contains("open")) close();
    });

    const btn = document.getElementById("claudeIconBtn");
    if (btn) btn.addEventListener("click", open);

    function loadVersion() {
      fetch("version.json", { cache: "no-store" })
        .then((r) => r.json())
        .then((v) => {
          pane.querySelector("#cpVersionBadge").textContent = `Draft build v${v.version} · ${v.date}`;
        })
        .catch(() => {
          pane.querySelector("#cpVersionBadge").textContent = "Draft build — version unknown";
        });
    }

    function loadBuilds() {
      fetch("builds.json", { cache: "no-store" })
        .then((r) => r.json())
        .then((builds) => {
          const sorted = [...builds].reverse(); // newest first (file is append-only, oldest-first)
          const el = pane.querySelector("#cpBuilds");
          if (!sorted.length) { el.innerHTML = "<li>No builds logged yet.</li>"; return; }
          el.innerHTML = sorted.map((b, i) => {
            const isLatest = i === 0;
            const archiveHref = `Build History/index_v${b.version}_${b.date}.html`;
            const link = isLatest
              ? `<span>current</span>`
              : `<a href="${escapeHtml(archiveHref)}">view</a>`;
            return `<li><span><strong>v${escapeHtml(b.version)}</strong> · ${escapeHtml(b.date)} — ${escapeHtml(b.notes || "")}</span>${link}</li>`;
          }).join("");
        })
        .catch(() => { pane.querySelector("#cpBuilds").innerHTML = "<li>Couldn't load builds.json.</li>"; });
    }

    function loadNotes() {
      const ta = pane.querySelector("#cpNotes");
      fetch(NOTES_PATH, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { notes: "" }))
        .then((d) => { ta.value = d.notes || ""; })
        .catch(() => {});
    }

    function getToken() {
      try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
    }
    function setToken(t) {
      try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    }

    function renderTokenArea() {
      const area = pane.querySelector("#cpTokenArea");
      const token = getToken();
      if (token) {
        area.innerHTML = `<p class="cp-help">A GitHub token is saved in this browser. <button class="cp-btn" id="cpForgetToken" style="margin-top:4px">Forget token</button></p>`;
        area.querySelector("#cpForgetToken").addEventListener("click", () => { setToken(""); renderTokenArea(); });
      } else {
        area.innerHTML = `
          <p class="cp-help">Saving commits straight to this repo needs a fine-grained GitHub token (Contents: read/write, scoped to this repo only). It's kept in this browser's localStorage and sent only to api.github.com.</p>
          <input class="cp-token-input" id="cpTokenInput" type="password" placeholder="github_pat_…">
          <div class="cp-row"><button class="cp-btn" id="cpSaveToken">Save token</button></div>
        `;
        area.querySelector("#cpSaveToken").addEventListener("click", () => {
          const v = area.querySelector("#cpTokenInput").value.trim();
          if (v) { setToken(v); renderTokenArea(); }
        });
      }
    }

    pane.querySelector("#cpSave").addEventListener("click", async () => {
      const status = pane.querySelector("#cpStatus");
      const notes = pane.querySelector("#cpNotes").value;
      const token = getToken();
      if (!token) { status.textContent = "Add a token below first."; return; }
      status.textContent = "Saving…";
      try {
        const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github+json" };
        let sha;
        const getRes = await fetch(API_BASE + NOTES_PATH, { headers, cache: "no-store" });
        if (getRes.ok) { const data = await getRes.json(); sha = data.sha; }
        const payload = {
          message: "prompts: update dev notes",
          content: b64EncodeUnicode(JSON.stringify({ notes, updated: new Date().toISOString() }, null, 2)),
          branch: "main",
        };
        if (sha) payload.sha = sha;
        const putRes = await fetch(API_BASE + NOTES_PATH, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!putRes.ok) {
          const err = await putRes.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${putRes.status}`);
        }
        status.textContent = "Saved to repo.";
      } catch (e) {
        status.textContent = "Couldn't save: " + e.message;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
