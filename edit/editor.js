// Editor: unlocks with a password, edits the encrypted private data, and publishes
// data/public.json (public photos only) + data/private.json (everything, encrypted)
// to GitHub in one commit. GitHub Actions then rebuilds the public site.
//
// Files in the repo:
//   data/vault.json       password-encrypted: GitHub token, data key, inbox private key
//   data/private.json     data-key-encrypted: all sections/chapters/photos incl. hidden
//   data/public.json      plaintext: public photos only (what the site is built from)
//   data/inbox-key.pem    public key tools/drive_index.py encrypts new photo batches with
//   data/inbox/*.json     encrypted batches from drive_index.py, merged here on unlock
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
    try { return await readFile('data/vault.json'); }
    catch (err) {
      console.warn('GitHub API unavailable, using site copy of vault:', err.message);
      const r = await fetch('/data/vault.json', { cache: 'no-store' });
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
  function mergeBatch(batch) {
    const sec = state.data.sections[batch.section] ??= { cover: null, chapters: [] };
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

  function publicData() {
    const out = { sections: {} };
    for (const [slug, sec] of Object.entries(state.data.sections)) {
      const chapters = sec.chapters.map(c => {
        const photos = c.photos.filter(p => p.public).map(({ id, w, h, date, desc }) => ({ id, w, h, date, desc: desc || '' }));
        if (!photos.length) return null;
        const cover = photos.some(p => p.id === c.cover) ? c.cover : photos[0].id;
        return { slug: c.slug, number: c.number, title: c.title, text: c.text || '', cover, photos };
      }).filter(Boolean);
      if (!chapters.length) continue;
      const all = chapters.flatMap(c => c.photos);
      out.sections[slug] = { cover: all.some(p => p.id === sec.cover) ? sec.cover : chapters[0].cover, chapters };
    }
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

  function renderSection(slug) {
    const meta = sectionMeta(slug), s = state.data.sections[slug];
    setCrumbs([['Editor', '#/'], [meta.title]]);
    const chapters = s ? s.chapters : [];
    const rows = chapters.length
      ? chapters.map(c => {
          const cover = c.photos.find(p => p.id === c.cover) || c.photos[0];
          return `
          <li><a href="#/${slug}/${c.slug}">
            <span class="num">${pad(c.number)}</span>
            <span class="ch-title">${esc(c.title)}</span>
            <span class="ch-meta">${c.photos.filter(p => p.public).length} / ${c.photos.length} public<span class="count">★ ${c.insta.length}</span></span>
            <span class="ch-thumb">${cover ? `<img class="loaded" src="${thumbUrl(cover.id, 'w400')}" alt="">` : ''}</span>
          </a></li>`;
        }).join('')
      : (meta.planned || []).map((name, i) => `
          <li class="pending"><span class="num">${pad(i + 1)}</span><span class="ch-title">${esc(name)}</span><span class="ch-meta">No photos yet</span></li>`).join('');
    $('section-view').innerHTML = `
      <header class="page-head">
        <p class="eyebrow">${esc(meta.place)} · ${esc(meta.year)}</p>
        <h1>${esc(meta.title)}</h1>
        ${chapters.length ? '' : '<p class="status">No photos indexed yet</p>'}
      </header>
      <section class="contents">${rows ? `<p class="eyebrow">Chapters</p><ol class="toc">${rows}</ol>` : ''}</section>`;
    showView('section-view');
  }

  function setSideCollapsed(on) {
    $('chapter-view').classList.toggle('side-collapsed', on);
    $('side-toggle').textContent = on ? '‹' : '›';
    $('side-toggle').setAttribute('aria-expanded', String(!on));
    $('side-toggle').setAttribute('aria-label', on ? 'Expand Instagram panel' : 'Collapse Instagram panel');
    try { localStorage.setItem('ed-side-collapsed', on ? '1' : ''); } catch {}
  }

  // ---------- chapter workspace ----------
  let reelSortable = null, instaSortable = null;
  function loadChapter() {
    const c = chapter();
    $('chapter-title').value = c.title;
    $('chapter-text').value = c.text || '';
    if (!state.viewer) {
      state.viewer = new Viewer($('ed-viewer'), c.photos, {
        decorateThumb: (el, p) => {
          const ch = chapter();
          el.classList.toggle('is-hidden', !p.public);
          el.classList.toggle('is-insta', ch.insta.includes(p.id));
          el.classList.toggle('is-cover', ch.cover === p.id);
        },
        onShow: () => syncPhotoTools(),
      });
    } else {
      state.viewer.setPhotos(c.photos, null, 0);
    }
    if (reelSortable) reelSortable.destroy();
    reelSortable = Sortable.create(state.viewer.reel, {
      animation: 150, direction: 'horizontal', delay: 150, delayOnTouchOnly: true, forceFallback: true,
      onEnd: () => {
        const ch = chapter();
        const order = [...state.viewer.reel.children].map(t => t.dataset.id);
        const byId = new Map(ch.photos.map(p => [p.id, p]));
        ch.photos.splice(0, ch.photos.length, ...order.map(id => byId.get(id)));
        state.viewer.setPhotos(ch.photos, state.viewer.current.id);
        setDirty();
      },
    });
    renderInsta();
    syncPhotoTools();
  }

  function syncPhotoTools() {
    const c = chapter(), p = state.viewer?.current;
    if (!c || !p) return;
    $('t-public').checked = !!p.public;
    $('t-insta').checked = c.insta.includes(p.id);
    $('photo-desc').value = p.desc || '';
    $('cover-chapter').textContent = c.cover === p.id ? 'Chapter cover ✓' : 'Use as chapter cover';
    $('cover-section').textContent = sec().cover === p.id ? 'Section cover ✓' : 'Use as section cover';
    const visible = c.photos.filter(x => x.public).length;
    $('photo-pos').textContent = `${state.viewer.index + 1} / ${c.photos.length} · ${visible} public`;
    [...$('insta-list').children].forEach(li => li.classList.toggle('active', li.dataset.id === p.id));
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
      li.addEventListener('click', () => state.viewer.show(c.photos.findIndex(p => p.id === id)));
      list.append(li);
    });
    $('insta-count').textContent = `${c.insta.length} / ${INSTA_MAX}`;
    $('insta-empty').hidden = c.insta.length > 0;
    if (instaSortable) instaSortable.destroy();
    instaSortable = Sortable.create(list, {
      animation: 150, delay: 150, delayOnTouchOnly: true, forceFallback: true,
      onEnd: () => {
        chapter().insta = [...list.children].map(li => li.dataset.id);
        renderInsta();
        setDirty();
      },
    });
  }

  function toggleInsta(id) {
    const c = chapter();
    if (c.insta.includes(id)) c.insta = c.insta.filter(x => x !== id);
    else if (c.insta.length >= INSTA_MAX) { toast(`Instagram is limited to ${INSTA_MAX} per chapter. Remove one from the sidebar first.`); syncPhotoTools(); return; }
    else c.insta.push(id);
    renderInsta();
    state.viewer.refresh();
    syncPhotoTools();
    setDirty();
  }

  function bindWorkspace() {
    window.addEventListener('hashchange', route);
    $('side-toggle').addEventListener('click', () => setSideCollapsed(!$('chapter-view').classList.contains('side-collapsed')));
    let collapsed = false;
    try { collapsed = localStorage.getItem('ed-side-collapsed') === '1'; } catch {}
    setSideCollapsed(collapsed);
    $('t-public').addEventListener('change', e => {
      state.viewer.current.public = e.target.checked;
      state.viewer.refresh(); syncPhotoTools(); setDirty();
    });
    $('t-insta').addEventListener('change', () => toggleInsta(state.viewer.current.id));
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
    $('cover-chapter').addEventListener('click', () => { chapter().cover = state.viewer.current.id; state.viewer.refresh(); syncPhotoTools(); setDirty(); });
    $('cover-section').addEventListener('click', () => { sec().cover = state.viewer.current.id; syncPhotoTools(); setDirty(); });
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
      const files = {
        'data/private.json': JSON.stringify(await seal(state.dataKey, state.data)) + '\n',
        'data/public.json': JSON.stringify(publicData(), null, 1) + '\n',
      };
      await commit(files, state.inboxPaths, 'Edit photos');
      state.inboxPaths = [];
      setDirty(false);
      $('status').textContent = 'Published · live in about a minute';
    } catch (err) {
      setDirty(true);
      toast('Save failed: ' + err.message, 8000);
    }
  }

  async function replaceToken() {
    const token = prompt('Paste the new GitHub token (fine-grained, Contents: Read and write on Schippeaux.github.io):');
    if (!token) return;
    try {
      await checkToken(token.trim());
      state.secrets.token = token.trim();
      const vault = { v: 1, salt: b64(state.vaultSalt), iterations: ITERATIONS, ...(await seal(state.pwKey, state.secrets)) };
      state.token = state.secrets.token;
      await commit({ 'data/vault.json': JSON.stringify(vault) + '\n' }, [], 'Replace editor token');
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
      readFile('data/private.json'), readFile('data/site.json'), gh(`/contents/data/inbox?ref=${BRANCH}`),
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
    if (await readFile('data/vault.json', token)) throw new Error('The editor is already set up. Reload to unlock.');
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
      'data/vault.json': JSON.stringify(vault) + '\n',
      'data/inbox-key.pem': pem,
      'data/private.json': JSON.stringify(await seal(dataKey, { sections: {} })) + '\n',
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
