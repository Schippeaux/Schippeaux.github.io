// Snaggo — local folder viewer (proof of concept)
//
// This is a deliberately separate, one-off page. It does NOT use Snaggo's
// IndexedDB storage (js/db.js) at all — instead it reads and writes a
// manifest.json + photos/ folder directly on disk, via the browser's File
// System Access API (showDirectoryPicker). That API only exists in desktop
// Chrome/Edge — there is no mobile/Safari/Firefox equivalent — which is why
// this lives in its own folder rather than replacing anything in the main
// app. The main app (../index.html) is untouched and keeps using IndexedDB
// for every other project.
//
// Folder layout expected (matches a Snaggo export .zip, unzipped):
//   manifest.json   — { project, areas, defects, photos, drawings?, audio? }
//   photos/<file>    — referenced by photos[].file, e.g. "photos/B1-04-05_1.jpg"
//
// Edits (title, status, dates, etc.) are written straight back to
// manifest.json on disk, immediately, via a writable file stream. There is
// no IndexedDB and no separate "save" step.
//
// Folder access is NOT remembered across page reloads (the File System
// Access permission does not survive a reload in this POC) — reopen the
// folder each time you load this page.

const THUMB_SIZES = [72, 96, 128, 160, 200];
const THUMB_KEY = 'snaggo-local-thumb-size-idx';

const root = document.getElementById('app');

const state = {
  dirHandle: null,
  photosDirHandle: null,
  manifest: null,
  photoUrlCache: new Map(), // filename -> blob: URL
};

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function toast(message) {
  const host = document.getElementById('toast-host');
  const node = el(`<div class="toast"><span>${escapeHtml(message)}</span></div>`);
  host.appendChild(node);
  setTimeout(() => node.remove(), 2200);
}

function topBar(title, { back } = {}) {
  return `
    <header class="topbar">
      ${back ? `<a class="back-btn" href="${back}" aria-label="Back">&larr;</a>` : ''}
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

function splitDefectCode(code) {
  const idx = code.lastIndexOf('-');
  if (idx === -1) return { roomCode: code, number: '' };
  return { roomCode: code.slice(0, idx), number: code.slice(idx + 1) };
}

function openLightbox(url) {
  const overlay = el(`<div class="lightbox-overlay"><img src="${url}" alt="Photo" /></div>`);
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  return close;
}

function getThumbSizeIndex() {
  const raw = parseInt(localStorage.getItem(THUMB_KEY), 10);
  return Number.isInteger(raw) && raw >= 0 && raw < THUMB_SIZES.length ? raw : 1;
}
function setThumbSizeIndex(i) {
  localStorage.setItem(THUMB_KEY, String(i));
  document.documentElement.style.setProperty('--thumb-size', `${THUMB_SIZES[i]}px`);
}
function wireThumbSizeControl(container) {
  const idx = getThumbSizeIndex();
  setThumbSizeIndex(idx);
  const control = container.querySelector('.thumb-size-control');
  if (!control) return;
  control.querySelector('.thumb-size-minus').addEventListener('click', () => {
    const i = Math.max(0, getThumbSizeIndex() - 1);
    setThumbSizeIndex(i);
  });
  control.querySelector('.thumb-size-plus').addEventListener('click', () => {
    const i = Math.min(THUMB_SIZES.length - 1, getThumbSizeIndex() + 1);
    setThumbSizeIndex(i);
  });
}

// ---- disk I/O -----------------------------------------------------------

async function pickFolder() {
  if (!('showDirectoryPicker' in window)) {
    toast('Your browser does not support picking a local folder (needs desktop Chrome or Edge).');
    return;
  }
  let handle;
  try {
    handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err.name !== 'AbortError') toast('Could not open that folder: ' + err.message);
    return;
  }
  let manifestFile;
  try {
    const manifestHandle = await handle.getFileHandle('manifest.json');
    manifestFile = await manifestHandle.getFile();
  } catch (err) {
    toast('No manifest.json found in that folder — pick the project folder (the one containing manifest.json and photos/).');
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(await manifestFile.text());
  } catch (err) {
    toast('manifest.json in that folder is not valid JSON.');
    return;
  }
  state.dirHandle = handle;
  state.manifest = manifest;
  try {
    state.photosDirHandle = await handle.getDirectoryHandle('photos');
  } catch (err) {
    state.photosDirHandle = null;
  }
  location.hash = '#/areas';
}

async function saveManifest() {
  try {
    const fileHandle = await state.dirHandle.getFileHandle('manifest.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state.manifest, null, 2));
    await writable.close();
  } catch (err) {
    toast('Could not save to manifest.json: ' + err.message);
  }
}

async function getPhotoUrl(filename) {
  if (state.photoUrlCache.has(filename)) return state.photoUrlCache.get(filename);
  if (!state.photosDirHandle) return '';
  try {
    const fh = await state.photosDirHandle.getFileHandle(filename);
    const file = await fh.getFile();
    const url = URL.createObjectURL(file);
    state.photoUrlCache.set(filename, url);
    return url;
  } catch (err) {
    return '';
  }
}

function photoFilenameOf(photoEntry) {
  // photos[].file is like "photos/B1-04-05_1.jpg"
  const f = photoEntry.file || '';
  const idx = f.lastIndexOf('/');
  return idx === -1 ? f : f.slice(idx + 1);
}

// ---- data helpers ---------------------------------------------------------

function listAreas() {
  return [...state.manifest.areas].sort((a, b) => (a.order || 0) - (b.order || 0));
}
function listDefects(areaId) {
  return state.manifest.defects.filter((d) => d.areaId === areaId);
}
function listPhotosForDefect(defectId) {
  return state.manifest.photos.filter((p) => p.defectId === defectId).sort((a, b) => (a.order || 0) - (b.order || 0));
}
function getArea(areaId) {
  return state.manifest.areas.find((a) => a.id === areaId);
}
function getDefect(defectId) {
  return state.manifest.defects.find((d) => d.id === defectId);
}

// ---- router ---------------------------------------------------------------

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

async function render() {
  const hash = location.hash || '#/';
  if (!state.manifest) {
    renderPicker();
    return;
  }
  const parts = hash.replace(/^#\/?/, '').split('/');
  try {
    if (parts[0] === 'areas' || parts[0] === '') {
      await renderAreaList();
    } else if (parts[0] === 'area' && parts[1]) {
      await renderAreaDetail(parts[1]);
    } else if (parts[0] === 'defect' && parts[1]) {
      await renderDefectDetail(parts[1]);
    } else if (parts[0] === 'report') {
      await renderReportPage();
    } else {
      await renderAreaList();
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error-box">Something went wrong: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

function renderPicker() {
  root.innerHTML = `
    ${topBar('Snaggo — local folder')}
    <main class="picker">
      <p>Reads and writes a Snaggo project straight from a folder on this
      computer — nothing goes into the browser's own storage. Desktop
      Chrome or Edge only.</p>
      <button id="pick-folder-btn" class="btn btn-primary">Open project folder&hellip;</button>
    </main>
  `;
  document.getElementById('pick-folder-btn').addEventListener('click', pickFolder);
}

async function renderAreaList() {
  const project = state.manifest.project || {};
  const areas = listAreas();
  root.innerHTML = `
    ${topBar(project.name || 'Snaggo project')}
    <main class="area-list">
      <section class="io-card">
        <a class="btn btn-secondary" href="#/report">View report</a>
        <button id="close-folder-btn" class="btn btn-secondary">Close folder</button>
      </section>
      <div class="area-list-head">
        <span class="area-code">Code</span>
        <span class="row-name">Name</span>
      </div>
      <ul class="row-list">
        ${areas.map((a) => {
          const defects = listDefects(a.id);
          const outstanding = defects.filter((d) => !d.complete).length;
          const resolved = defects.length - outstanding;
          return `
            <li class="row-item">
              <a class="row-link" href="#/area/${encodeURIComponent(a.id)}">
                <span class="area-code">${escapeHtml(a.code || '')}</span>
                <span class="row-name">${escapeHtml(a.name)}</span>
                <span class="row-counts">
                  <span class="count-badge count-outstanding">${outstanding}</span>
                  <span class="count-badge count-resolved">${resolved}</span>
                </span>
              </a>
            </li>
          `;
        }).join('')}
      </ul>
    </main>
  `;
  document.getElementById('close-folder-btn').addEventListener('click', () => {
    state.dirHandle = null;
    state.manifest = null;
    state.photosDirHandle = null;
    state.photoUrlCache.clear();
    location.hash = '#/';
    render();
  });
}

async function renderAreaDetail(areaId) {
  const area = getArea(areaId);
  if (!area) { location.hash = '#/areas'; return; }
  const defects = listDefects(areaId);
  const areaLabel = area.code ? `${area.code} &middot; ${escapeHtml(area.name)}` : escapeHtml(area.name);

  root.innerHTML = `
    ${topBar('', { back: '#/areas' })}
    <main class="defect-list">
      <h1 class="area-title">${areaLabel}</h1>
      <div class="thumb-size-control">
        <span>Thumbnail size</span>
        <button class="icon-btn thumb-size-minus" title="Smaller thumbnails" aria-label="Smaller thumbnails">&minus;</button>
        <button class="icon-btn thumb-size-plus" title="Larger thumbnails" aria-label="Larger thumbnails">+</button>
      </div>
      <ul class="row-list" id="defect-rows"></ul>
    </main>
  `;
  wireThumbSizeControl(root.querySelector('main.defect-list'));

  const rowsEl = document.getElementById('defect-rows');
  for (const defect of defects) {
    const { number } = splitDefectCode(defect.code || '');
    const photos = listPhotosForDefect(defect.id);
    const first = photos[0];
    const thumbUrl = first ? await getPhotoUrl(photoFilenameOf(first)) : '';
    const row = el(`
      <li class="row-item">
        <a class="row-link" href="#/defect/${encodeURIComponent(defect.id)}">
          <span class="defect-row-thumb">${thumbUrl ? `<img src="${thumbUrl}" alt="" />` : ''}</span>
          <span class="row-name">${escapeHtml(number ? `#${number} ` : '')}${escapeHtml(defect.title || defect.description || '(untitled defect)')}</span>
          ${defect.complete
            ? '<span class="count-badge count-resolved">✓</span>'
            : `<span class="status-badge status-${(defect.status || '').toLowerCase()}">${escapeHtml(defect.status || '')}</span>`}
        </a>
      </li>
    `);
    rowsEl.appendChild(row);
  }
}

async function renderDefectDetail(defectId) {
  const defect = getDefect(defectId);
  if (!defect) { location.hash = '#/areas'; return; }
  const area = getArea(defect.areaId);
  const photos = listPhotosForDefect(defectId);

  root.innerHTML = `
    ${topBar(defect.code || '(unnamed defect)', { back: area ? `#/area/${encodeURIComponent(area.id)}` : '#/areas' })}
    <main class="defect-detail">
      <label class="field-label">Title</label>
      <input id="d-title" type="text" value="${escapeHtml(defect.title || '')}" placeholder="Short title" />

      <div class="field-row">
        <div>
          <label class="field-label">Status</label>
          <select id="d-status">
            <option value="Incomplete" ${defect.status === 'Incomplete' ? 'selected' : ''}>Incomplete</option>
            <option value="Defect" ${defect.status === 'Defect' ? 'selected' : ''}>Defect</option>
          </select>
        </div>
        <label class="complete-toggle">
          <input id="d-complete" type="checkbox" ${defect.complete ? 'checked' : ''} />
          Complete
        </label>
      </div>

      <div class="field-row">
        <div>
          <label class="field-label">Date identified</label>
          <input id="d-date" type="text" value="${escapeHtml(defect.dateIdentified || '')}" placeholder="e.g. 10/11/2026" />
        </div>
        <div>
          <label class="field-label">Subcontractor</label>
          <input id="d-subcontractor" type="text" value="${escapeHtml(defect.subcontractor || '')}" placeholder="Responsible trade" />
        </div>
      </div>

      <label class="field-label">Target resolution</label>
      <input id="d-target" type="text" value="${escapeHtml(defect.targetResolution || '')}" placeholder="e.g. a date, or before practical completion" />

      <label class="field-label">Description</label>
      <textarea id="d-description" rows="4" placeholder="Describe the defect…">${escapeHtml(defect.description || '')}</textarea>

      <section class="photos-section">
        <div class="section-head">
          <h2>Photos</h2>
        </div>
        <div class="photo-grid" id="photo-grid"></div>
      </section>
    </main>
  `;

  const save = async (field, value) => {
    defect[field] = value;
    await saveManifest();
    toast('Saved');
  };
  document.getElementById('d-title').addEventListener('change', (e) => save('title', e.target.value));
  document.getElementById('d-description').addEventListener('change', (e) => save('description', e.target.value));
  document.getElementById('d-date').addEventListener('change', (e) => save('dateIdentified', e.target.value));
  document.getElementById('d-subcontractor').addEventListener('change', (e) => save('subcontractor', e.target.value));
  document.getElementById('d-status').addEventListener('change', (e) => save('status', e.target.value));
  document.getElementById('d-target').addEventListener('change', (e) => save('targetResolution', e.target.value));
  document.getElementById('d-complete').addEventListener('change', (e) => save('complete', e.target.checked));

  const grid = document.getElementById('photo-grid');
  for (const photo of photos) {
    const filename = photoFilenameOf(photo);
    const url = await getPhotoUrl(filename);
    if (!url) continue;
    const thumb = el(`<div class="photo-thumb"><img src="${url}" alt="" /></div>`);
    thumb.querySelector('img').addEventListener('click', () => openLightbox(url));
    grid.appendChild(thumb);
  }
}

async function renderReportPage() {
  const project = state.manifest.project || {};
  const areas = listAreas();

  root.innerHTML = `
    ${topBar('Report', { back: '#/areas' })}
    <main class="report">
      <p class="report-project-name">${escapeHtml(project.name || '(untitled project)')}</p>
      <div class="report-table-wrap">
        <table class="report-table" id="report-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Room</th>
              <th>Description</th>
              <th>Photo</th>
              <th>Date identified</th>
              <th>Subcontractor</th>
              <th>Status</th>
              <th>Target resolution</th>
              <th>Complete</th>
            </tr>
          </thead>
          <tbody id="report-rows"></tbody>
        </table>
      </div>
    </main>
  `;

  const tbody = document.getElementById('report-rows');
  let rowCount = 0;
  for (const area of areas) {
    for (const defect of listDefects(area.id)) {
      rowCount++;
      const photos = listPhotosForDefect(defect.id);
      const first = photos[0];
      const thumbUrl = first ? await getPhotoUrl(photoFilenameOf(first)) : '';
      const roomLabel = area.code ? `${area.code} · ${area.name}` : area.name;
      const row = el(`
        <tr>
          <td>${escapeHtml(defect.code || '')}</td>
          <td>${escapeHtml(roomLabel)}</td>
          <td>${escapeHtml(defect.title || defect.description || '')}</td>
          <td class="report-photo-cell">${thumbUrl ? `<img src="${thumbUrl}" alt="" />` : ''}</td>
          <td>${escapeHtml(defect.dateIdentified || '')}</td>
          <td>${escapeHtml(defect.subcontractor || '')}</td>
          <td>${escapeHtml(defect.status || '')}</td>
          <td>${escapeHtml(defect.targetResolution || '')}</td>
          <td>${defect.complete ? '✓' : ''}</td>
        </tr>
      `);
      if (thumbUrl) {
        row.querySelector('.report-photo-cell img').addEventListener('click', () => openLightbox(thumbUrl));
      }
      tbody.appendChild(row);
    }
  }
  if (!rowCount) {
    tbody.innerHTML = `<tr><td colspan="9">No defects yet.</td></tr>`;
  }
}

render();
