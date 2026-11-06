// Editor: unlocks with a password, edits the encrypted private data, and publishes
// photography/data/public.json (public photos only) + photography/data/private.json
// (everything, encrypted) to GitHub in one commit. GitHub Actions then rebuilds the
// public site. The whole repo is a monorepo of several sites, each in its own top-level
// folder (see CLAUDE.md) - this one's is "photography/", so every path below carries
// that prefix even though this file itself lives one level down, at photography/edit/.
//
// Files in the repo:
//   photography/data/vault.json       password-encrypted: GitHub token, data key, inbox private key
//   photography/data/private.json     data-key-encrypted: all sections/chapters/photos incl. hidden
//   photography/data/public.json      plaintext: public photos only (what the site is built from)
//   photography/data/inbox-key.pem    public key tools/drive_index.py encrypts new photo batches with
//   photography/data/inbox/*.json     encrypted batches from drive_index.py, merged here on unlock
(() => {
  const OWNER = 'Schippeaux', REPO = 'Schippeaux.github.io', BRANCH = 'main';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const ITERATIONS = 600000;
  const INSTA_MAX = 10;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const $ = id => document.getElementById(id);

  const state = {
    token: null, pwKey: null, vaultSalt: null, dataKey: null, secrets: null,
    data: null, site: null, inboxPaths: [], dirty: false,
    section: null, chapterIdx: 0, viewer: null,
  };

  // ---------- crypto ----------
  const b64 = buf => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function passwordKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function unseal(key, box) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    return JSON.parse(dec.decode(pt));
  }
  const importDataKey = raw => crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function openInboxBatch(box) {
    const rsa = await crypto.subtle.importKey('jwk', state.secrets.inboxKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsa, unb64(box.ek));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    return unseal(key, box);
  }

  // ---------- GitHub ----------
  async function gh(path, opts = {}, token = state.token) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + path, { ...opts, headers, cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
    if (r.status === 204) return true;
    return (opts.raw ? r.text() : r.json());
  }
  const readFile = (path, token) => gh(`/contents/${path}?ref=${BRANCH}`, { raw: true, headers: { Accept: 'application/vnd.github.raw+json' } }, token);

  // Before unlocking there is no token, and GitHub rate-limits anonymous API calls,
  // so fall back to the copy the site itself serves (may lag a minute behind).
  async function readVault() {
    try { return await readFile('photography/data/vault.json'); }
    catch (err) {
      console.warn('GitHub API unavailable, using site copy of vault:', err.message);
      const r = await fetch('/photography/data/vault.json', { cache: 'no-store' });
      return r.ok ? r.text() : null;
    }
  }

  async function commit(files, deletes, message) {
    const ref = await gh(`/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const parent = await gh(`/git/commits/${head}`);
    const tree = [
      ...Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
      ...deletes.map(path => ({ path, mode: '100644', type: 'blob', sha: null })),
    ];
    const t = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
    const c = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: t.sha, parents: [head] }) });
    await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
  }

  async function checkToken(token) {
    const repo = await gh('', {}, token);
    if (!repo) throw new Error('Token cannot see the Schippeaux.github.io repository.');
    if (!repo.permissions || !repo.permissions.push) throw new Error('Token needs Contents: Read and write on Schippeaux.github.io.');
  }

  // ---------- data ----------
  // Inbox batches come in two kinds: the original photo batches from tools/drive_index.py
  // (no "kind" field, run on Ciaran's own machine with Drive access) and itinerary batches
  // (kind: "itinerary") built the same way - encrypted with photography/data/inbox-key.pem - for seeding
  // trip-day/place data that doesn't need Drive access at all. Both merge the same way: new
  // inbox files are picked up and merged on the next editor login (see unlock()).
  function mergeBatch(batch) {
    if (batch.kind === 'itinerary') return mergeItineraryBatch(batch);
    const sec = state.data.sections[batch.section] ??= { cover: null, chapters: [], best_of: [] };
    if (!sec.cover && batch.cover) sec.cover = batch.cover;
    for (const ch of batch.chapters) {
      let c = sec.chapters.find(x => x.folder_id === ch.folder_id);
      if (!c) {
        c = { folder_id: ch.folder_id, folder: ch.folder, number: ch.number, title: ch.title, slug: ch.slug,
              text: '', cover: ch.cover || null, photos: [], insta: [] };
        sec.chapters.push(c);
      }
      const have = new Map(c.photos.map(p => [p.id, p]));
      for (const p of ch.photos) {
        const existing = have.get(p.id);
        if (existing) Object.assign(existing, { w: p.w, h: p.h, date: p.date });
        else c.photos.push({ id: p.id, w: p.w, h: p.h, date: p.date, public: !!batch.default_public, desc: '' });
      }
    }
    sec.chapters.sort((a, b) => a.number - b.number);
  }

  // Seeds (or replaces) a journey's day-by-day itinerary table, and tags existing chapters
  // with a day range by slug (a chapter's slug is fixed once created, unlike its title - see
  // CLAUDE.md). A full-table replace is fine here since this only ever runs once, before any
  // live edits exist to clobber; if a correction batch is ever sent after Ciaran has edited
  // the itinerary live, it would overwrite those edits, so that's a one-way door to use with
  // care, not a general sync mechanism.
  function mergeItineraryBatch(batch) {
    const sec = state.data.sections[batch.section] ??= { cover: null, chapters: [], best_of: [] };
    if (batch.itinerary) sec.itinerary = batch.itinerary;
    if (batch.flight) sec.flight = batch.flight;
    if (batch.chapter_days) {
      for (const c of sec.chapters) {
        const d = batch.chapter_days[c.slug];
        if (d) Object.assign(c, { day_start: d.day_start, day_end: d.day_end });
      }
    }
  }

  function publicData() {
    const out = { sections: {} };
    for (const [slug, sec] of Object.entries(state.data.sections)) {
      // A chapter with no explicit public flag defaults OFF - publishing is opt-in per chapter.
      const chapters = sec.chapters.filter(c => c.public === true).map(c => {
        const photos = c.photos.filter(p => p.public).map(({ id, w, h, date, desc }) => ({ id, w, h, date, desc: desc || '' }));
        if (!photos.length) return null;
        const cover = photos.some(p => p.id === c.cover) ? c.cover : photos[0].id;
        const out = { slug: c.slug, number: c.number, title: c.title, text: c.text || '', cover, photos };
        // Require both ends of the range - a half-set pair (one field edited, the other
        // still blank) would reach the site as e.g. "Day 12-null"; just wait for both.
        if (c.day_start != null && c.day_end != null) { out.day_start = c.day_start; out.day_end = c.day_end; }
        return out;
      }).filter(Boolean);
      if (!chapters.length) continue;
      const all = chapters.flatMap(c => c.photos);
      const bestOf = (sec.best_of || []).filter(id => all.some(p => p.id === id));
      out.sections[slug] = { cover: all.some(p => p.id === sec.cover) ? sec.cover : chapters[0].cover, text: sec.text || '', chapters };
      if (bestOf.length) out.sections[slug].best_of = bestOf;
      // Itinerary/flight aren't gated on any chapter's public flag like photos are - once
      // typed in, they're trip-level facts (dates, places), not something with a hide toggle.
      if (sec.itinerary && sec.itinerary.length) out.sections[slug].itinerary = sec.itinerary;
      if (sec.flight) out.sections[slug].flight = sec.flight;
    }
    // Homepage cover only if that photo is public; otherwise the build falls back to a section cover
    const publicIds = new Set(Object.values(out.sections).flatMap(s => s.chapters.flatMap(c => c.photos.map(p => p.id))));
    if (publicIds.has(state.data.home_cover)) out.home_cover = state.data.home_cover;
    return out;
  }

  // ---------- UI helpers ----------
  function toast(msg, ms = 3500) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, ms);
  }
  function setDirty(on = true) {
    state.dirty = on;
    $('save-btn').disabled = !on;
    $('status').textContent = on ? 'Unsaved changes' : '';
  }
  const showOnly = id => ['login', 'setup', 'workspace'].forEach(x => { $(x).hidden = x !== id; });
  const sec = () => state.data.sections[state.section];
  const chapter = () => sec() && sec().chapters[state.chapterIdx];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const WEEKDAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtItinDate(r) {
    const [, m, d] = r.date.split('-').map(Number);
    return `${WEEKDAY_SHORT[r.weekday] || r.weekday} ${d} ${MONTHS_SHORT[m - 1]}`;
  }
  const thumbUrl = (id, size) => Viewer.url(id, size);
  const sectionMeta = slug => {
    for (const g of state.site.groups) for (const s of g.sections) if (s.slug === slug) return s;
    return { slug, title: slug, place: '', year: '' };
  };

  // ---------- navigation: mirrors the public site (home → section → chapter) ----------
  function showView(id) {
    ['home-view', 'section-view', 'chapter-view'].forEach(v => { $(v).hidden = v !== id; });
    window.scrollTo(0, 0);
  }

  function setCrumbs(parts) {
    $('crumbs').innerHTML = parts
      .map(([label, href]) => href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)
      .join('<span class="sep">/</span>');
  }

  function route() {
    const [slug, chSlug] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!slug) return renderHome();
    const s = state.data.sections[slug];
    if (!chSlug) {
      // Single-chapter sections go straight into the chapter, like the public site
      if (s && s.chapters.length === 1) return location.replace(`#/${slug}/${s.chapters[0].slug}`);
      return renderSection(slug);
    }
    const idx = s ? s.chapters.findIndex(c => c.slug === chSlug) : -1;
    if (idx < 0) return location.replace(`#/${slug}`);
    state.section = slug;
    state.chapterIdx = idx;
    const title = sectionMeta(slug).title;
    setCrumbs(s.chapters.length === 1
      ? [['Editor', '#/'], [title]]
      : [['Editor', '#/'], [title, `#/${slug}`], [s.chapters[idx].title]]);
    showView('chapter-view');
    loadChapter();
  }

  function renderHome() {
    setCrumbs([['Editor']]);
    $('home-view').innerHTML = state.site.groups.map(g => `
      <section class="index-section">
        <header class="section-head"><p class="eyebrow">${g.sections.length} sections</p><h2>${esc(g.title)}</h2></header>
        <div class="trip-list">${g.sections.map((meta, i) => {
          const s = state.data.sections[meta.slug];
          const photos = s ? s.chapters.flatMap(c => c.photos) : [];
          const cover = photos.find(p => p.id === s.cover) || photos[0];
          const stats = photos.length
            ? `${s.chapters.length} chapter${s.chapters.length > 1 ? 's' : ''} · ${photos.filter(p => p.public).length} of ${photos.length} public`
            : 'No photos yet';
          return `
          <a class="trip-row${photos.length ? '' : ' pending'}" href="#/${meta.slug}">
            <span class="num">${pad(i + 1)}</span>
            <div class="trip-text"><h3>${esc(meta.title)}</h3><p class="meta">${esc(meta.place)} · ${esc(meta.year)} · ${stats}</p></div>
            <div class="trip-thumb">${cover
              ? `<img class="thumb loaded" src="${thumbUrl(cover.id, 'w1000')}" alt="">`
              : '<div class="thumb placeholder"><span>No photos yet</span></div>'}</div>
          </a>`;
        }).join('')}</div>
      </section>`).join('');
    showView('home-view');
  }

  // Resolve a journey's best-of ids to photo objects, drawn from across all its chapters,
  // and quietly drop any id whose photo no longer exists.
  function resolveBestof(s) {
    const byId = new Map(s.chapters.flatMap(c => c.photos).map(p => [p.id, p]));
    s.best_of = (s.best_of || []).filter(id => byId.has(id));
    return s.best_of.map(id => byId.get(id));
  }

  let bestofGridSortable = null;
  function renderBestofGrid(s, slug) {
    const byId = new Map(s.chapters.flatMap(c => c.photos).map(p => [p.id, p]));
    const grid = $('bestof-arrange');
    grid.innerHTML = s.best_of.map((id, i) => {
      const p = byId.get(id);
      return `
      <button class="tile" data-id="${id}" title="${i + 1}">
        <img src="${thumbUrl(id, 'h300')}" alt="" loading="lazy" class="loaded" style="aspect-ratio:${p.w}/${p.h}">
        <span class="n">${i + 1}</span>
        <span class="rm" title="Remove from Best-Of">✕</span>
      </button>`;
    }).join('');
    grid.querySelectorAll('.rm').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = e.target.closest('.tile').dataset.id;
      s.best_of = s.best_of.filter(x => x !== id);
      setDirty();
      if (s.best_of.length) renderBestofGrid(s, slug);
      else renderSection(slug);
    }));
    if (bestofGridSortable) bestofGridSortable.destroy();
    bestofGridSortable = Sortable.create(grid, {
      animation: 150, delay: 150, delayOnTouchOnly: true, forceFallback: true,
      onEnd: () => {
        s.best_of = [...grid.querySelectorAll('.tile')].map(t => t.dataset.id);
        setDirty();
      },
    });
  }
  function openBestofArrange(s, slug) {
    $('bestof-slideshow').hidden = true;
    $('bestof-arrange-wrap').hidden = false;
    renderBestofGrid(s, slug);
  }

  function renderSection(slug) {
    const meta = sectionMeta(slug), s = state.data.sections[slug];
    if (s) s.best_of ??= [];
    setCrumbs([['Editor', '#/'], [meta.title]]);
    const chapters = s ? s.chapters : [];
    const rows = chapters.length
      ? chapters.map(c => {
          const cover = c.photos.find(p => p.id === c.cover) || c.photos[0];
          const chapterOn = c.public === true;
          return `
          <li class="toc-row${chapterOn ? '' : ' off'}">
            <label class="toggle ch-public" title="Publish this whole chapter, or take it off the site - doesn't change which of its photos you've picked as public">
              <input type="checkbox" class="ch-public-toggle" data-folder="${esc(c.folder_id)}" ${chapterOn ? 'checked' : ''}>
            </label>
            <a href="#/${slug}/${c.slug}">
              <span class="num">${pad(c.number)}</span>
              <span class="ch-title">${esc(c.title)}</span>
              <span class="ch-meta">${c.photos.filter(p => p.public).length} / ${c.photos.length} photos public${chapterOn ? '' : ' · chapter off'}<span class="count">★ ${c.insta.length}</span></span>
              <span class="ch-thumb">${cover ? `<img class="loaded" src="${thumbUrl(cover.id, 'w400')}" alt="">` : ''}</span>
            </a>
          </li>`;
        }).join('')
      : (meta.planned || []).map((name, i) => `
          <li class="pending"><span class="num">${pad(i + 1)}</span><span class="ch-title">${esc(name)}</span><span class="ch-meta">No photos yet</span></li>`).join('');
    const itin = s && s.itinerary;
    const itinBlock = itin && itin.length ? `
      <details class="itinerary-edit">
        <summary>Itinerary · ${itin.length} days · edit place &amp; activities</summary>
        <div class="itin-edit-table-wrap">
          <table class="itin-edit-table">
            <thead><tr><th>Day</th><th>Date</th><th>Place</th><th>Activities</th></tr></thead>
            <tbody>
              ${itin.map((r, i) => `
              <tr>
                <td class="it-day">${r.day}</td>
                <td class="it-date">${esc(fmtItinDate(r))}</td>
                <td><input type="text" class="itin-place" data-i="${i}" value="${esc(r.place)}"></td>
                <td><input type="text" class="itin-activities" data-i="${i}" value="${esc(r.activities || '')}"></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </details>` : '';
    const bestOf = s ? s.best_of : [];
    const bestofBlock = s ? `
        <div class="bestof-head">
          <p class="eyebrow">Best-of slideshow${bestOf.length ? ' · click to reorder' : ''}</p>
          ${bestOf.length ? `
            <div class="bestof-slideshow" id="bestof-slideshow"></div>
            <div class="bestof-arrange-wrap" id="bestof-arrange-wrap" hidden>
              <div class="arrange" id="bestof-arrange"></div>
              <button class="btn small" id="bestof-done">Done reordering</button>
            </div>`
            : '<p class="hint">Tick “Best-Of” on photos while browsing chapters to build this journey\'s slideshow.</p>'}
        </div>` : '';
    $('section-view').innerHTML = `
      <header class="page-head">
        <p class="eyebrow">${esc(meta.place)} · ${esc(meta.year)}</p>
        <h1>${esc(meta.title)}</h1>
        ${chapters.length ? '' : '<p class="status">No photos indexed yet</p>'}
      </header>
      <section class="contents">
        ${bestofBlock}
        ${s ? `<label class="field section-desc">Journey description
          <textarea id="section-text" rows="5" placeholder="What this journey is about. Shown above the chapter list. Blank line = new paragraph.">${esc(s.text || '')}</textarea>
        </label>` : ''}
        ${itinBlock}
        ${rows ? `<p class="eyebrow">Chapters${chapters.length ? ' · tick to take a whole chapter on or off the site, independent of which photos in it are public' : ''}</p><ol class="toc">${rows}</ol>` : ''}
      </section>`;
    if (s) {
      $('section-text').addEventListener('input', e => { s.text = e.target.value; setDirty(); });
      if (itin && itin.length) {
        $('section-view').querySelectorAll('.itin-place').forEach(inp => {
          inp.addEventListener('input', e => { itin[+e.target.dataset.i].place = e.target.value; setDirty(); });
        });
        $('section-view').querySelectorAll('.itin-activities').forEach(inp => {
          inp.addEventListener('input', e => { itin[+e.target.dataset.i].activities = e.target.value; setDirty(); });
        });
      }
      $('section-view').querySelectorAll('.ch-public-toggle').forEach(cb => {
        cb.addEventListener('change', () => {
          const c = s.chapters.find(x => x.folder_id === cb.dataset.folder);
          if (!c) return;
          c.public = cb.checked;  // chapter-level switch only - never touches c.photos[].public
          setDirty();
          renderSection(slug);
        });
      });
      if (bestOf.length) {
        new Viewer($('bestof-slideshow'), resolveBestof(s), { fullscreenClick: false });
        $('bestof-slideshow').addEventListener('click', e => {
          if (e.target.closest('.arrow')) return;
          openBestofArrange(s, slug);
        });
        $('bestof-done').addEventListener('click', () => renderSection(slug));
      }
    }
    showView('section-view');
  }

  function setSideCollapsed(on) {
    $('chapter-view').classList.toggle('side-collapsed', on);
    $('side-toggle').textContent = on ? '‹' : '›';
    $('side-toggle').setAttribute('aria-expanded', String(!on));
    $('side-toggle').setAttribute('aria-label', on ? 'Expand panel' : 'Collapse panel');
    try { localStorage.setItem('ed-side-collapsed', on ? '1' : ''); } catch {}
  }

  // ---------- chapter workspace ----------
  // Selection is shared by the reel and the Arrange grid. Ctrl/Shift-click in the reel,
  // plain click in the grid. Moves and visibility changes can be undone.
  const sel = new Set();
  let anchorId = null, pickMode = false, arranging = false, undoStack = [];
  let reelSortable = null, gridSortable = null, instaSortable = null, bestofSideSortable = null;
  let sideTab = 'insta', pendingShowId = null;

  function decorate(el, p) {
    const ch = chapter();
    el.classList.toggle('is-hidden', !p.public);
    el.classList.toggle('is-insta', ch.insta.includes(p.id));
    el.classList.toggle('is-cover', ch.cover === p.id);
    el.classList.toggle('is-selected', sel.has(p.id));
  }

  function loadChapter() {
    const c = chapter();
    sel.clear(); anchorId = null; pickMode = false; undoStack = [];
    $('chapter-title').value = c.title;
    $('chapter-text').value = c.text || '';
    $('chapter-day-start').value = c.day_start ?? '';
    $('chapter-day-end').value = c.day_end ?? '';
    if (!state.viewer) {
      state.viewer = new Viewer($('ed-viewer'), c.photos, {
        fullscreenClick: false,
        decorateThumb: decorate,
        onShow: () => syncPhotoTools(),
        onThumbClick: (e, i) => {
          const id = chapter().photos[i].id;
          if (pickMode) { moveSelection('before', id); return false; }
          if (e.shiftKey || e.ctrlKey || e.metaKey) { selectClick(id, e.shiftKey); return false; }
          return true;  // plain click: show the photo
        },
      });
    } else {
      state.viewer.setPhotos(c.photos, null, 0);
    }
    if (reelSortable) reelSortable.destroy();
    reelSortable = Sortable.create(state.viewer.reel, {
      animation: 150, direction: 'horizontal', delay: 150, delayOnTouchOnly: true, forceFallback: true,
      onEnd: e => dropped(e.item.dataset.id, state.viewer.reel),
    });
    setArranging(arranging);
    renderInsta();
    renderBestofSidebar();
    setSideTab(sideTab);
    syncPhotoTools();
    updateSelBar();
    if (pendingShowId) {
      const idx = c.photos.findIndex(p => p.id === pendingShowId);
      pendingShowId = null;
      if (idx >= 0) state.viewer.show(idx);
    }
  }

  // Re-render everything that shows the chapter's photos, keeping the current photo in view
  function refreshPhotos() {
    const c = chapter();
    state.viewer.setPhotos(c.photos, state.viewer.current?.id);
    if (arranging) renderGrid();
    renderInsta();
    renderBestofSidebar();
    syncPhotoTools();
    updateSelBar();
  }

  // ---- undo: remembers order, visibility, Instagram and journey Best-Of picks (not descriptions/text) ----
  function checkpoint() {
    const c = chapter();
    undoStack.push({ order: c.photos.map(p => p.id), pub: c.photos.map(p => p.public), insta: [...c.insta], bestOf: [...(sec().best_of || [])] });
    if (undoStack.length > 50) undoStack.shift();
    $('undo-btn').disabled = false;
  }
  function undo() {
    const snap = undoStack.pop();
    $('undo-btn').disabled = !undoStack.length;
    if (!snap) return;
    const c = chapter();
    const byId = new Map(c.photos.map(p => [p.id, p]));
    c.photos.splice(0, c.photos.length, ...snap.order.map(id => byId.get(id)).filter(Boolean));
    c.photos.forEach((p, i) => { p.public = snap.pub[i]; });
    c.insta = snap.insta;
    sec().best_of = snap.bestOf;
    refreshPhotos();
    setDirty();
  }

  // ---- selection ----
  function selectClick(id, range) {
    const ids = chapter().photos.map(p => p.id);
    if (range && anchorId && ids.includes(anchorId)) {
      const [a, b] = [ids.indexOf(anchorId), ids.indexOf(id)].sort((x, y) => x - y);
      ids.slice(a, b + 1).forEach(x => sel.add(x));
    } else {
      sel.has(id) ? sel.delete(id) : sel.add(id);
      anchorId = id;
    }
    redecorate();
    updateSelBar();
  }
  function clearSelection() { sel.clear(); anchorId = null; setPickMode(false); redecorate(); updateSelBar(); }
  function redecorate() {
    state.viewer.refresh();
    if (arranging) [...$('arrange').children].forEach(t => decorate(t, chapter().photos.find(p => p.id === t.dataset.id)));
  }

  function setPickMode(on) {
    pickMode = on && sel.size > 0;
    $('chapter-view').classList.toggle('picking', pickMode);
    updateSelBar();
  }

  function updateSelBar() {
    const n = sel.size;
    $('sel-actions').hidden = !n;
    $('sel-count').textContent = `${n} selected`;
    if (n) populateMoveChapterOptions();
    $('sel-hint').textContent = pickMode
      ? 'Now click the photo to move them in front of. Esc to cancel.'
      : n ? '' : arranging
        ? 'Click photos to select · Shift-click for a range · drag to move · double-click to open'
        : 'Ctrl-click thumbnails to select several · Shift-click for a range';
  }

  // ---- moving ----
  // where: 'start' | 'end' | 'before' (targetId)
  function moveSelection(where, targetId) {
    const c = chapter();
    if (where === 'before' && sel.has(targetId)) { toast('Pick a photo that isn’t selected.'); return; }
    checkpoint();
    const moving = c.photos.filter(p => sel.has(p.id));
    const rest = c.photos.filter(p => !sel.has(p.id));
    const at = where === 'start' ? 0 : where === 'end' ? rest.length : rest.findIndex(p => p.id === targetId);
    rest.splice(at, 0, ...moving);
    c.photos.splice(0, c.photos.length, ...rest);
    setPickMode(false);
    refreshPhotos();
    setDirty();
    toast(`Moved ${moving.length} photo${moving.length > 1 ? 's' : ''}.`, 1800);
  }

  // A drag finished in the reel or grid. Dragging a selected photo moves the whole selection.
  function dropped(id, container) {
    const order = [...container.children].map(t => t.dataset.id);
    const c = chapter();
    if (sel.has(id) && sel.size > 1) {
      // Drop the selection in front of the first unselected photo after where it landed
      const after = order.slice(order.indexOf(id) + 1).find(x => !sel.has(x));
      moveSelection(after ? 'before' : 'end', after);
      return;
    }
    checkpoint();
    const byId = new Map(c.photos.map(p => [p.id, p]));
    c.photos.splice(0, c.photos.length, ...order.map(x => byId.get(x)));
    refreshPhotos();
    setDirty();
  }

  function setVisibility(pub) {
    checkpoint();
    chapter().photos.forEach(p => { if (sel.has(p.id)) p.public = pub; });
    redecorate(); syncPhotoTools(); setDirty();
  }

  // Move the selected photos out of this chapter and onto the end of another chapter in the
  // same journey (cross-chapter - moveSelection above only reorders within one chapter). They
  // land at the end of the target; drag them into exact position there with Arrange, same as
  // any other reorder. Dropped from this chapter's Instagram picks too, since those ids would
  // otherwise dangle; best-of is untouched since it's already journey-wide, not chapter-scoped.
  function moveToChapter(targetIdx) {
    const c = chapter();
    const target = sec().chapters[targetIdx];
    if (!target || target === c) return;
    checkpoint();
    const moving = c.photos.filter(p => sel.has(p.id));
    // Reassign rather than splice-in-place: the viewer still holds this exact array
    // reference until refreshPhotos() below calls setPhotos(), so mutating it now would
    // desync it from the still-on-screen (stale) reel/grid DOM that clearSelection()'s
    // redecorate() is about to touch.
    c.photos = c.photos.filter(p => !sel.has(p.id));
    target.photos.push(...moving);
    c.insta = (c.insta || []).filter(id => !sel.has(id));
    setArranging(false);
    clearSelection();
    refreshPhotos();
    setDirty();
    toast(`Moved ${moving.length} photo${moving.length > 1 ? 's' : ''} to "${target.title}". Switch to that chapter and drag them into position in Arrange.`, 4500);
  }

  function populateMoveChapterOptions() {
    const select = $('sel-move-chapter');
    const s = sec();
    if (!select || !s) return;
    const current = select.value;
    select.innerHTML = '<option value="">Move to chapter…</option>' + s.chapters.map((c, i) =>
      i === state.chapterIdx ? '' : `<option value="${i}">Ch. ${c.number} - ${esc(c.title)}</option>`
    ).join('');
    select.value = current;
  }

  // ---- Arrange grid ----
  function setArranging(on) {
    arranging = on;
    $('mode-slides').classList.toggle('on', !on);
    $('mode-arrange').classList.toggle('on', on);
    $('ed-viewer').hidden = on;
    $('photo-tools').hidden = on;
    $('arrange').hidden = !on;
    if (on) renderGrid();
    else if (gridSortable) { gridSortable.destroy(); gridSortable = null; }
    updateSelBar();
  }

  function renderGrid() {
    const c = chapter(), grid = $('arrange');
    grid.innerHTML = c.photos.map((p, i) => `
      <button class="tile" data-id="${p.id}" title="${i + 1}">
        <img src="${thumbUrl(p.id, 'h300')}" alt="" loading="lazy" class="loaded" style="aspect-ratio:${p.w}/${p.h}">
        <span class="n">${i + 1}</span>
      </button>`).join('');
    [...grid.children].forEach((t, i) => decorate(t, c.photos[i]));
    if (gridSortable) gridSortable.destroy();
    gridSortable = Sortable.create(grid, {
      animation: 150, delay: 150, delayOnTouchOnly: true, forceFallback: true,
      onStart: e => { if (sel.has(e.item.dataset.id)) grid.classList.add('dragging-group'); },
      onEnd: e => { grid.classList.remove('dragging-group'); dropped(e.item.dataset.id, grid); },
    });
  }

  function bindArrange() {
    const grid = $('arrange');
    grid.addEventListener('click', e => {
      const t = e.target.closest('.tile');
      if (!t) return;
      if (pickMode) moveSelection('before', t.dataset.id);
      else selectClick(t.dataset.id, e.shiftKey);
    });
    grid.addEventListener('dblclick', e => {
      const t = e.target.closest('.tile');
      if (!t) return;
      sel.delete(t.dataset.id);
      setArranging(false);
      state.viewer.show(chapter().photos.findIndex(p => p.id === t.dataset.id));
      redecorate(); updateSelBar();
    });
    $('mode-slides').addEventListener('click', () => setArranging(false));
    $('mode-arrange').addEventListener('click', () => setArranging(true));
    $('undo-btn').addEventListener('click', undo);
    $('sel-actions').addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'start' || act === 'end') moveSelection(act);
      else if (act === 'before') setPickMode(!pickMode);
      else if (act === 'public') setVisibility(true);
      else if (act === 'hide') setVisibility(false);
      else if (act === 'clear') clearSelection();
    });
    $('sel-move-chapter').addEventListener('change', e => {
      const idx = e.target.value;
      e.target.value = '';
      if (idx !== '') moveToChapter(parseInt(idx, 10));
    });
    document.addEventListener('keydown', e => {
      if ($('chapter-view').hidden || e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'Escape') { pickMode ? setPickMode(false) : clearSelection(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && arranging) {
        e.preventDefault();
        chapter().photos.forEach(p => sel.add(p.id));
        redecorate(); updateSelBar();
      }
    });
  }

  function syncPhotoTools() {
    const c = chapter(), p = state.viewer?.current;
    if (!c || !p) return;
    $('t-public').checked = !!p.public;
    $('t-insta').checked = c.insta.includes(p.id);
    $('t-bestof').checked = (sec().best_of || []).includes(p.id);
    $('photo-desc').value = p.desc || '';
    $('cover-chapter').textContent = c.cover === p.id ? 'Chapter cover ✓' : 'Use as chapter cover';
    $('cover-section').textContent = sec().cover === p.id ? 'Journey cover ✓' : 'Use as journey cover';
    $('cover-home').textContent = state.data.home_cover === p.id ? 'Homepage cover ✓' : 'Use as homepage cover';
    const visible = c.photos.filter(x => x.public).length;
    $('photo-pos').textContent = `${state.viewer.index + 1} / ${c.photos.length} · ${visible} public`;
    [...$('insta-list').children].forEach(li => li.classList.toggle('active', li.dataset.id === p.id));
    [...$('bestof-list').children].forEach(li => li.classList.toggle('active', li.dataset.id === p.id));
  }

  // ---- sidebar: two tabs sharing the same look, Instagram (chapter-scoped) and
  // Best-Of (journey-scoped - drawn from any chapter in this journey) ----
  function setSideTab(tab) {
    sideTab = tab;
    $('tab-insta').classList.toggle('on', tab === 'insta');
    $('tab-bestof').classList.toggle('on', tab === 'bestof');
    $('tab-insta').setAttribute('aria-selected', String(tab === 'insta'));
    $('tab-bestof').setAttribute('aria-selected', String(tab === 'bestof'));
    $('insta-list').hidden = tab !== 'insta';
    $('bestof-list').hidden = tab !== 'bestof';
    $('insta-empty').hidden = tab !== 'insta' || chapter().insta.length > 0;
    $('bestof-empty').hidden = tab !== 'bestof' || (sec().best_of || []).length > 0;
    $('side-count').textContent = tab === 'insta'
      ? `${chapter().insta.length} / ${INSTA_MAX}`
      : `${(sec().best_of || []).length}`;
    try { localStorage.setItem('ed-side-tab', tab); } catch {}
  }

  function renderInsta() {
    const c = chapter();
    const list = $('insta-list');
    list.innerHTML = '';
    const byId = new Map(c.photos.map(p => [p.id, p]));
    c.insta = c.insta.filter(id => byId.has(id));
    c.insta.forEach((id, n) => {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.innerHTML = `<span class="n">${n + 1}</span><img src="${thumbUrl(id, 'w400')}" alt="" class="loaded"><button class="rm" title="Remove from Instagram">✕</button>`;
      li.querySelector('.rm').addEventListener('click', e => { e.stopPropagation(); toggleInsta(id); });
      li.addEventListener('click', () => {
        if (arranging) setArranging(false);
        state.viewer.show(c.photos.findIndex(p => p.id === id));
      });
      list.append(li);
    });
    if (sideTab === 'insta') $('side-count').textContent = `${c.insta.length} / ${INSTA_MAX}`;
    $('insta-empty').hidden = sideTab !== 'insta' || c.insta.length > 0;
    if (instaSortable) instaSortable.destroy();
    instaSortable = Sortable.create(list, {
      animation: 150, delay: 150, delayOnTouchOnly: true, forceFallback: true,
      onEnd: () => {
        checkpoint();
        chapter().insta = [...list.children].map(li => li.dataset.id);
        renderInsta();
        setDirty();
      },
    });
  }

  function toggleInsta(id) {
    const c = chapter();
    if (c.insta.includes(id)) { checkpoint(); c.insta = c.insta.filter(x => x !== id); }
    else if (c.insta.length >= INSTA_MAX) { toast(`Instagram is limited to ${INSTA_MAX} per chapter. Remove one from the sidebar first.`); syncPhotoTools(); return; }
    else { checkpoint(); c.insta.push(id); }
    renderInsta();
    state.viewer.refresh();
    syncPhotoTools();
    setDirty();
  }

  // Best-Of lives on the journey, not the chapter: its list can include photos from any
  // chapter, so clicking an entry may need to jump to a different chapter first.
  function renderBestofSidebar() {
    const s = sec();
    const list = $('bestof-list');
    list.innerHTML = '';
    const byId = new Map(s.chapters.flatMap(c => c.photos).map(p => [p.id, p]));
    s.best_of = (s.best_of || []).filter(id => byId.has(id));
    s.best_of.forEach((id, n) => {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.innerHTML = `<span class="n">${n + 1}</span><img src="${thumbUrl(id, 'w400')}" alt="" class="loaded"><button class="rm" title="Remove from Best-Of">✕</button>`;
      li.querySelector('.rm').addEventListener('click', e => { e.stopPropagation(); toggleBestof(id); });
      li.addEventListener('click', () => jumpToPhoto(id));
      list.append(li);
    });
    if (sideTab === 'bestof') $('side-count').textContent = `${s.best_of.length}`;
    $('bestof-empty').hidden = sideTab !== 'bestof' || s.best_of.length > 0;
    if (bestofSideSortable) bestofSideSortable.destroy();
    bestofSideSortable = Sortable.create(list, {
      animation: 150, delay: 150, delayOnTouchOnly: true, forceFallback: true,
      onEnd: () => {
        checkpoint();
        sec().best_of = [...list.children].map(li => li.dataset.id);
        renderBestofSidebar();
        setDirty();
      },
    });
  }

  function toggleBestof(id) {
    const s = sec();
    s.best_of ??= [];
    if (s.best_of.includes(id)) { checkpoint(); s.best_of = s.best_of.filter(x => x !== id); }
    else { checkpoint(); s.best_of.push(id); }
    renderBestofSidebar();
    state.viewer.refresh();
    syncPhotoTools();
    setDirty();
  }

  // Show a photo that may belong to a different chapter than the one currently open.
  function jumpToPhoto(id) {
    const s = sec();
    const idx = s.chapters.findIndex(c => c.photos.some(p => p.id === id));
    if (idx < 0) return;
    if (idx === state.chapterIdx) {
      if (arranging) setArranging(false);
      state.viewer.show(chapter().photos.findIndex(p => p.id === id));
    } else {
      pendingShowId = id;
      location.hash = `#/${state.section}/${s.chapters[idx].slug}`;
    }
  }

  function bindWorkspace() {
    window.addEventListener('hashchange', route);
    $('side-toggle').addEventListener('click', () => setSideCollapsed(!$('chapter-view').classList.contains('side-collapsed')));
    let collapsed = false;
    try { collapsed = localStorage.getItem('ed-side-collapsed') === '1'; } catch {}
    setSideCollapsed(collapsed);
    try { sideTab = localStorage.getItem('ed-side-tab') === 'bestof' ? 'bestof' : 'insta'; } catch {}
    $('tab-insta').addEventListener('click', () => setSideTab('insta'));
    $('tab-bestof').addEventListener('click', () => setSideTab('bestof'));
    bindArrange();
    const setBarHeight = () => document.body.style.setProperty('--bar-h', `${document.querySelector('.ed-bar').offsetHeight}px`);
    new ResizeObserver(setBarHeight).observe(document.querySelector('.ed-bar'));
    $('t-public').addEventListener('change', e => {
      checkpoint();
      state.viewer.current.public = e.target.checked;
      state.viewer.refresh(); syncPhotoTools(); setDirty();
    });
    $('t-insta').addEventListener('change', () => toggleInsta(state.viewer.current.id));
    $('t-bestof').addEventListener('change', () => toggleBestof(state.viewer.current.id));
    $('photo-desc').addEventListener('input', e => {
      state.viewer.current.desc = e.target.value;
      state.viewer.refresh(); setDirty();
    });
    $('chapter-title').addEventListener('input', e => {
      chapter().title = e.target.value;
      if (sec().chapters.length > 1) $('crumbs').lastElementChild.textContent = e.target.value;
      setDirty();
    });
    $('chapter-text').addEventListener('input', e => { chapter().text = e.target.value; setDirty(); });
    const dayField = (id, key) => $(id).addEventListener('input', e => {
      const v = e.target.value.trim();
      chapter()[key] = v === '' ? null : Number(v);
      setDirty();
    });
    dayField('chapter-day-start', 'day_start');
    dayField('chapter-day-end', 'day_end');
    $('cover-chapter').addEventListener('click', () => { chapter().cover = state.viewer.current.id; state.viewer.refresh(); syncPhotoTools(); setDirty(); });
    $('cover-section').addEventListener('click', () => { sec().cover = state.viewer.current.id; syncPhotoTools(); setDirty(); });
    $('cover-home').addEventListener('click', () => { state.data.home_cover = state.viewer.current.id; syncPhotoTools(); setDirty(); });
    $('save-btn').addEventListener('click', save);
    $('lock-btn').addEventListener('click', () => {
      if (state.dirty && !confirm('Discard unsaved changes and lock?')) return;
      state.dirty = false;
      location.reload();
    });
    $('token-btn').addEventListener('click', replaceToken);
    window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  async function save() {
    $('save-btn').disabled = true;
    $('status').textContent = 'Saving…';
    try {
      const publicJson = JSON.stringify(publicData(), null, 1) + '\n';
      const files = {
        'photography/data/private.json': JSON.stringify(await seal(state.dataKey, state.data)) + '\n',
        'photography/data/public.json': publicJson,
      };
      await commit(files, state.inboxPaths, 'Edit photos');
      state.inboxPaths = [];
      setDirty(false);
      $('status').textContent = 'Published · updating the site…';
      watchLive(publicJson);
    } catch (err) {
      setDirty(true);
      toast('Save failed: ' + err.message, 8000);
    }
  }

  // GitHub rebuilds the site ~30-60 s after a save, and browsers may keep a page they've
  // already seen for up to 10 minutes. Poll the live data until it matches what we saved,
  // then offer a link with ?v=… so the browser fetches the fresh page instead of its copy.
  let liveWatch = 0;
  async function watchLive(expected) {
    const run = ++liveWatch;
    const started = Date.now();
    while (run === liveWatch && Date.now() - started < 4 * 60 * 1000) {
      await new Promise(r => setTimeout(r, 6000));
      try {
        const r = await fetch(`/photography/data/public.json?v=${Date.now()}`, { cache: 'no-store' });
        if (r.ok && (await r.text()) === expected) {
          if (run === liveWatch && !state.dirty) {
            $('status').innerHTML = `Live ✓ <a href="${liveUrl()}" target="_blank" rel="noopener">View ↗</a>`;
          }
          return;
        }
      } catch {}
    }
    if (run === liveWatch && !state.dirty) $('status').textContent = 'Published · the site is taking longer than usual to update';
  }

  function liveUrl() {
    const v = `?v=${Date.now()}`;
    const c = chapter();
    const group = state.site.groups.find(g => g.sections.some(s => s.slug === state.section));
    if ($('chapter-view').hidden || !c || !group || !c.photos.some(p => p.public)) return `/${v}`;
    return `/${group.slug}/${state.section}/${c.slug}/${v}`;
  }

  async function replaceToken() {
    const token = prompt('Paste the new GitHub token (fine-grained, Contents: Read and write on Schippeaux.github.io):');
    if (!token) return;
    try {
      await checkToken(token.trim());
      state.secrets.token = token.trim();
      const vault = { v: 1, salt: b64(state.vaultSalt), iterations: ITERATIONS, ...(await seal(state.pwKey, state.secrets)) };
      state.token = state.secrets.token;
      await commit({ 'photography/data/vault.json': JSON.stringify(vault) + '\n' }, [], 'Replace editor token');
      toast('Token replaced.');
    } catch (err) { toast(err.message, 8000); }
  }

  // ---------- unlock / setup ----------
  async function unlock(password) {
    const vault = JSON.parse(await readVault());
    state.vaultSalt = unb64(vault.salt);
    state.pwKey = await passwordKey(password, state.vaultSalt);
    try { state.secrets = await unseal(state.pwKey, vault); }
    catch { throw new Error('Wrong password.'); }
    state.token = state.secrets.token;
    state.dataKey = await importDataKey(state.secrets.dataKey);

    const [priv, site, inbox] = await Promise.all([
      readFile('photography/data/private.json'), readFile('photography/data/site.json'), gh(`/contents/photography/data/inbox?ref=${BRANCH}`),
    ]);
    state.data = priv ? await unseal(state.dataKey, JSON.parse(priv)) : { sections: {} };
    state.site = JSON.parse(site);
    if (state.site.image_base) Viewer.imageBase = state.site.image_base.replace(/\/$/, '');
    let merged = 0;
    for (const f of (inbox || []).filter(f => f.name.endsWith('.json'))) {
      mergeBatch(await openInboxBatch(JSON.parse(await readFile(f.path))));
      state.inboxPaths.push(f.path);
      merged++;
    }
    showOnly('workspace');
    bindWorkspace();
    route();
    if (merged) { setDirty(); toast(`Added ${merged} new photo batch${merged > 1 ? 'es' : ''} from Drive. Review, then Save & publish.`, 6000); }
  }

  async function setup(token, password) {
    await checkToken(token);
    if (await readFile('photography/data/vault.json', token)) throw new Error('The editor is already set up. Reload to unlock.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const pwKey = await passwordKey(password, salt);
    const dataKeyRaw = crypto.getRandomValues(new Uint8Array(32));
    const pair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    const spki = b64(await crypto.subtle.exportKey('spki', pair.publicKey));
    const pem = `-----BEGIN PUBLIC KEY-----\n${spki.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
    const secrets = { token, dataKey: b64(dataKeyRaw), inboxKey: await crypto.subtle.exportKey('jwk', pair.privateKey) };
    const vault = { v: 1, salt: b64(salt), iterations: ITERATIONS, ...(await seal(pwKey, secrets)) };
    const dataKey = await importDataKey(secrets.dataKey);
    state.token = token;
    await commit({
      'photography/data/vault.json': JSON.stringify(vault) + '\n',
      'photography/data/inbox-key.pem': pem,
      'photography/data/private.json': JSON.stringify(await seal(dataKey, { sections: {} })) + '\n',
    }, [], 'Set up editor');
  }

  async function init() {
    const hasVault = !!(await readVault());
    showOnly(hasVault ? 'login' : 'setup');
    (hasVault ? $('login-password') : $('setup-token')).focus();

    $('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true;
      $('login-msg').textContent = 'Unlocking…';
      try { await unlock($('login-password').value); }
      catch (err) { $('login-msg').textContent = err.message; btn.disabled = false; }
    });
    $('setup-form').addEventListener('submit', async e => {
      e.preventDefault();
      const pw = $('setup-password').value;
      if (pw !== $('setup-confirm').value) { $('setup-msg').textContent = 'Passwords don’t match.'; return; }
      const btn = e.submitter; btn.disabled = true;
      $('setup-msg').textContent = 'Setting up…';
      try {
        await setup($('setup-token').value.trim(), pw);
        $('setup-msg').textContent = 'Done. Unlocking…';
        await unlock(pw);
      } catch (err) { $('setup-msg').textContent = err.message; btn.disabled = false; }
    });
  }

  init();
})();
