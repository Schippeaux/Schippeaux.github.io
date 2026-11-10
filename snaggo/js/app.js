// Snaggo — app shell, routing, rendering
'use strict';

const root = document.getElementById('app');
const toastHost = document.getElementById('toast-host');

// ---- tiny router -----------------------------------------------------
// Hash shapes:
//   #/                                     project list (home)
//   #/project/<id>                         project home (drawings, tabs, io)
//   #/project/<id>/tab/<kind>               area list
//   #/project/<id>/area/<areaId>            defect list
//   #/project/<id>/defect/<defectId>        defect detail
//   #/project/<id>/report                   full table report (all areas/defects)
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) location.hash = '#/';
  render();
});

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash.split('/').filter(Boolean).map(decodeURIComponent);
}

async function render() {
  const parts = parseHash();
  root.innerHTML = '<div class="loading">Loading…</div>';
  try {
    if (parts.length === 0) {
      await renderProjectList();
    } else if (parts[0] === 'project' && parts[1]) {
      const projectId = parts[1];
      if (parts.length === 2) {
        await renderProjectHome(projectId);
      } else if (parts[2] === 'tab' && parts[3]) {
        await renderAreaList(projectId, parts[3]);
      } else if (parts[2] === 'area' && parts[3]) {
        await renderAreaDetail(projectId, parts[3]);
      } else if (parts[2] === 'defect' && parts[3]) {
        await renderDefectDetail(projectId, parts[3]);
      } else if (parts[2] === 'report') {
        await renderReportPage(projectId);
      } else {
        location.hash = `#/project/${encodeURIComponent(projectId)}`;
      }
    } else {
      location.hash = '#/';
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error-box">Something went wrong: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

// ---- helpers -----------------------------------------------------------

function photosToFiles(photos) {
  return photos.map((p, i) => {
    const ext = (p.blob.type && p.blob.type.split('/')[1]) || 'jpg';
    return new File([p.blob], `photo_${i + 1}.${ext}`, { type: p.blob.type || 'image/jpeg' });
  });
}

async function saveToPhotosFlow(photos, shareTitle) {
  if (!photos.length) {
    toast('No photos to save yet');
    return;
  }
  const files = photosToFiles(photos);
  if (!Media.canShareFiles(files)) {
    toast("Saving to your gallery isn't supported here — long-press a photo and choose \"Save Image\" instead");
    return;
  }
  try {
    await Media.shareFiles(files, { title: shareTitle });
  } catch (err) {
    if (err.name !== 'AbortError') toast('Could not open the share sheet: ' + err.message);
  }
}

function splitDefectCode(code) {
  const idx = code.lastIndexOf('-');
  if (idx === -1) return { roomCode: code, number: '' };
  return { roomCode: code.slice(0, idx), number: code.slice(idx + 1) };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function toast(message, { undo } = {}) {
  const node = el(`
    <div class="toast">
      <span></span>
      ${undo ? '<button class="toast-undo">Undo</button>' : ''}
    </div>
  `);
  node.querySelector('span').textContent = message;
  toastHost.appendChild(node);
  let undone = false;
  if (undo) {
    node.querySelector('.toast-undo').addEventListener('click', () => {
      undone = true;
      undo();
      node.remove();
    });
  }
  setTimeout(() => {
    if (!undone) node.remove();
  }, 5000);
}

function openTextModal({ title, value, placeholder }) {
  return new Promise((resolve) => {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal-box">
          <h3>${escapeHtml(title)}</h3>
          <textarea rows="5" placeholder="${escapeHtml(placeholder || '')}"></textarea>
          <div class="modal-actions">
            <button class="btn modal-cancel">Cancel</button>
            <button class="btn btn-primary modal-save">Save</button>
          </div>
        </div>
      </div>
    `);
    const textarea = overlay.querySelector('textarea');
    textarea.value = value || '';
    document.body.appendChild(overlay);
    textarea.focus();

    function close(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    overlay.querySelector('.modal-cancel').addEventListener('click', () => close(null));
    overlay.querySelector('.modal-save').addEventListener('click', () => close(textarea.value));
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
    });
  });
}

// Full-screen photo viewer. Clicking the thumbnail that opened it (or the
// overlay itself) closes it again — "click it again to minimise".
function openLightbox(url) {
  const overlay = el(`
    <div class="lightbox-overlay">
      <img src="${url}" alt="Photo" />
    </div>
  `);
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  return close;
}

// Global thumbnail-size control (+/-), persisted per device. Used on the
// room/area page where photo thumbnails are shown in a grid.
const THUMB_SIZES = [72, 96, 128, 160, 200];
function getThumbSizeIndex() {
  const stored = parseInt(localStorage.getItem('snaggo-thumb-size-idx'), 10);
  return Number.isInteger(stored) && stored >= 0 && stored < THUMB_SIZES.length ? stored : 1;
}
function setThumbSizeIndex(idx) {
  localStorage.setItem('snaggo-thumb-size-idx', String(idx));
}
function wireThumbSizeControl(root) {
  const minusBtn = root.querySelector('.thumb-size-minus');
  const plusBtn = root.querySelector('.thumb-size-plus');
  const apply = () => {
    const px = THUMB_SIZES[getThumbSizeIndex()];
    root.style.setProperty('--thumb-size', px + 'px');
  };
  apply();
  minusBtn.addEventListener('click', () => {
    setThumbSizeIndex(Math.max(0, getThumbSizeIndex() - 1));
    apply();
  });
  plusBtn.addEventListener('click', () => {
    setThumbSizeIndex(Math.min(THUMB_SIZES.length - 1, getThumbSizeIndex() + 1));
    apply();
  });
}

function topBar(title, { back } = {}) {
  return `
    <header class="topbar">
      ${back ? `<a class="back-link" href="${back}">&larr;</a>` : ''}
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

// ---- Project list (app home) ---------------------------------------------

async function renderProjectList() {
  const projects = await Snaggo.listProjects();

  root.innerHTML = `
    ${topBar('Snaggo')}
    <main class="project-list">
      <ul class="row-list" id="project-rows"></ul>
      <button id="add-project" class="btn btn-primary btn-add">+ Add project</button>
      <p class="version-footer">Snaggo ${escapeHtml(typeof SNAGGO_VERSION !== 'undefined' ? SNAGGO_VERSION : '?')}</p>
    </main>
  `;

  const rowsEl = document.getElementById('project-rows');
  if (!projects.length) {
    rowsEl.innerHTML = '<li class="empty-hint">No projects yet — add one below.</li>';
  }
  for (const project of projects) {
    const summary = await Snaggo.projectSummary(project.id);
    const row = el(`
      <li class="row-item">
        <a class="row-link" href="#/project/${encodeURIComponent(project.id)}">
          <span class="row-name">${escapeHtml(project.name || '(untitled project)')}</span>
          <span class="row-counts">
            <span class="count-badge count-outstanding">${summary.outstanding}</span>
            <span class="count-badge count-resolved">${summary.resolved}</span>
          </span>
        </a>
        <button class="row-delete" title="Delete">&times;</button>
      </li>
    `);
    row.querySelector('.row-delete').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm(`Delete "${project.name || '(untitled project)'}"? This removes all its rooms, defects and photos.`)) return;
      await Snaggo.deleteProject(project.id);
      await renderProjectList();
    });
    rowsEl.appendChild(row);
  }

  document.getElementById('add-project').addEventListener('click', async () => {
    const name = prompt('Project name (e.g. 46 Stanley Street)');
    if (!name || !name.trim()) return;
    const project = await Snaggo.addProject(name.trim());
    location.hash = `#/project/${encodeURIComponent(project.id)}`;
  });
}

// ---- Project home (drawings, tabs, import/export) -------------------------

async function renderProjectHome(projectId) {
  const project = await Snaggo.getProjectById(projectId);
  if (!project) {
    location.hash = '#/';
    return;
  }
  const drawings = await Snaggo.listDrawings(projectId);
  const extCounts = await tabCounts(projectId, 'external');
  const intCounts = await tabCounts(projectId, 'internal');

  root.innerHTML = `
    ${topBar(project.name || 'Project', { back: '#/' })}
    <main class="home">
      <section class="project-card">
        <label class="field-label">Project name</label>
        <input id="project-name" type="text" placeholder="e.g. 46 Stanley Street" value="${escapeHtml(project.name || '')}" />
        <label class="field-label">Description</label>
        <textarea id="project-desc" rows="3" placeholder="Brief description of the project…">${escapeHtml(project.description || '')}</textarea>
      </section>

      <section class="drawings-card">
        <div class="section-head">
          <h2>Reference drawings</h2>
          <button id="add-drawing" class="icon-btn" title="Add drawing">+</button>
        </div>
        <div class="drawing-grid" id="drawing-grid"></div>
      </section>

      <nav class="tab-grid">
        <a class="tab-card" href="#/project/${encodeURIComponent(projectId)}/tab/external">
          <span class="tab-title">External</span>
          <span class="tab-counts">${extCounts.outstanding} outstanding · ${extCounts.resolved} resolved</span>
        </a>
        <a class="tab-card" href="#/project/${encodeURIComponent(projectId)}/tab/internal">
          <span class="tab-title">Internal</span>
          <span class="tab-counts">${intCounts.outstanding} outstanding · ${intCounts.resolved} resolved</span>
        </a>
      </nav>

      <section class="io-card">
        <a class="btn btn-secondary" href="#/project/${encodeURIComponent(projectId)}/report">View report</a>
        <button id="save-all-photos-btn" class="btn btn-secondary">Save all photos to gallery</button>
        <button id="export-btn" class="btn btn-secondary">Export project (.zip)</button>
        <button id="import-zip-btn" class="btn btn-secondary">Import project (.zip)</button>
      </section>

      <p class="version-footer">Snaggo ${escapeHtml(typeof SNAGGO_VERSION !== 'undefined' ? SNAGGO_VERSION : '?')}</p>
    </main>
  `;

  document.getElementById('project-name').addEventListener('change', (e) =>
    Snaggo.saveProject(projectId, { name: e.target.value })
  );
  document.getElementById('project-desc').addEventListener('change', (e) =>
    Snaggo.saveProject(projectId, { description: e.target.value })
  );

  await renderDrawingGrid(projectId, drawings);

  document.getElementById('add-drawing').addEventListener('click', () => {
    Media.pickPhotos(async (files) => {
      for (const f of files) await Snaggo.addDrawing(projectId, f.name, f);
      await renderProjectHome(projectId);
    });
  });

  document.getElementById('save-all-photos-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const allPhotos = await Snaggo.listAllPhotosForProject(projectId);
      await saveToPhotosFlow(allPhotos, `${project.name || 'Snaggo'} photos`);
    } finally {
      e.target.disabled = false;
    }
  });

  document.getElementById('export-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const filename = await SnaggoExport.exportZip(projectId);
      toast(`Exported ${filename}`);
    } catch (err) {
      toast('Export failed: ' + err.message);
    } finally {
      e.target.disabled = false;
    }
  });

  document.getElementById('import-zip-btn').addEventListener('click', () => {
    Media.pickFile('.zip', async (file) => {
      try {
        const newId = await SnaggoExport.importZip(file);
        toast('Imported as a new project');
        location.hash = `#/project/${encodeURIComponent(newId)}`;
      } catch (err) {
        toast('Import failed: ' + err.message);
      }
    });
  });

}

async function tabCounts(projectId, kind) {
  const areas = await Snaggo.listAreas(projectId, kind);
  let outstanding = 0, resolved = 0;
  for (const area of areas) {
    const c = await Snaggo.defectCounts(area.id);
    outstanding += c.outstanding;
    resolved += c.resolved;
  }
  return { outstanding, resolved };
}

async function renderDrawingGrid(projectId, drawings) {
  const grid = document.getElementById('drawing-grid');
  if (!drawings.length) {
    grid.innerHTML = '<p class="empty-hint">No drawings added yet.</p>';
    return;
  }
  grid.innerHTML = '';
  for (const d of drawings) {
    const url = URL.createObjectURL(d.blob);
    const card = el(`
      <div class="drawing-thumb">
        <img src="${url}" alt="${escapeHtml(d.name)}" />
        <button class="thumb-delete" title="Delete">&times;</button>
      </div>
    `);
    card.querySelector('.thumb-delete').addEventListener('click', async () => {
      await Snaggo.deleteDrawing(d.id);
      await renderProjectHome(projectId);
    });
    grid.appendChild(card);
  }
}

// ---- Area list (External or Internal tab) --------------------------------

async function renderAreaList(projectId, kind) {
  if (kind !== 'external' && kind !== 'internal') {
    location.hash = `#/project/${encodeURIComponent(projectId)}`;
    return;
  }
  const label = kind === 'external' ? 'External' : 'Internal';
  const areas = await Snaggo.listAreas(projectId, kind);

  root.innerHTML = `
    ${topBar(label, { back: `#/project/${encodeURIComponent(projectId)}` })}
    <main class="area-list">
      <div class="area-list-head">
        <span class="area-code">Code</span>
        <span class="row-name">Name</span>
      </div>
      <ul class="row-list" id="area-rows"></ul>
      <button id="add-area" class="btn btn-primary btn-add">+ Add ${kind === 'external' ? 'area' : 'room'}</button>
    </main>
  `;

  const rowsEl = document.getElementById('area-rows');
  if (!areas.length) {
    rowsEl.innerHTML = `<li class="empty-hint">No ${kind === 'external' ? 'areas' : 'rooms'} yet — add one below.</li>`;
  }
  for (const area of areas) {
    const counts = await Snaggo.defectCounts(area.id);
    const row = el(`
      <li class="row-item">
        <a class="row-link" href="#/project/${encodeURIComponent(projectId)}/area/${encodeURIComponent(area.id)}">
          <span class="area-code">${escapeHtml(area.code || '')}</span>
          <span class="row-name">${escapeHtml(area.name)}</span>
          <span class="row-counts">
            <span class="count-badge count-outstanding">${counts.outstanding}</span>
            <span class="count-badge count-resolved">${counts.resolved}</span>
          </span>
        </a>
        <button class="row-delete" title="Delete">&times;</button>
      </li>
    `);
    row.querySelector('.row-delete').addEventListener('click', async (e) => {
      e.preventDefault();
      const snapshot = area;
      await Snaggo.deleteArea(area.id);
      await renderAreaList(projectId, kind);
      toast(`Deleted "${snapshot.name}"`, {
        undo: async () => {
          await Store.put('areas', snapshot);
          await renderAreaList(projectId, kind);
        },
      });
    });
    rowsEl.appendChild(row);
  }

  document.getElementById('add-area').addEventListener('click', async () => {
    const code = prompt(kind === 'external' ? 'Area code (optional, e.g. E-1)' : 'Room code (optional, e.g. B1-04)');
    if (code === null) return;
    const name = prompt(kind === 'external' ? 'Area name (e.g. Front Facade)' : 'Room name (e.g. Bathroom 2)');
    if (!name || !name.trim()) return;
    await Snaggo.addArea(projectId, kind, name.trim(), code.trim());
    await renderAreaList(projectId, kind);
  });
}

// ---- Area detail (defect list) -------------------------------------------

async function renderAreaDetail(projectId, areaId) {
  const area = await Store.get('areas', areaId);
  if (!area) {
    location.hash = `#/project/${encodeURIComponent(projectId)}`;
    return;
  }
  const defects = await Snaggo.listDefects(areaId);
  const areaLabel = area.code ? `${area.code} · ${area.name}` : area.name;

  root.innerHTML = `
    ${topBar(areaLabel, { back: `#/project/${encodeURIComponent(projectId)}/tab/${area.kind}` })}
    <main class="defect-list">
      <div class="thumb-size-control">
        <span>Thumbnail size</span>
        <button class="icon-btn thumb-size-minus" title="Smaller thumbnails" aria-label="Smaller thumbnails">&minus;</button>
        <button class="icon-btn thumb-size-plus" title="Larger thumbnails" aria-label="Larger thumbnails">+</button>
      </div>
      <ul class="row-list" id="defect-rows"></ul>
      <button id="add-defect" class="btn btn-primary btn-add">+ Add defect</button>
    </main>
  `;

  wireThumbSizeControl(root.querySelector('main.defect-list'));

  const rowsEl = document.getElementById('defect-rows');
  if (!defects.length) {
    rowsEl.innerHTML = '<li class="empty-hint">No defects logged yet — add one below.</li>';
  }
  for (const defect of defects) {
    const { roomCode, number } = splitDefectCode(defect.code || '');
    const photos = await Snaggo.listPhotos(defect.id);
    const thumbUrl = photos.length ? URL.createObjectURL(photos[0].blob) : '';
    const row = el(`
      <li class="row-item defect-row">
        <div class="defect-row-main">
          <a class="row-link" href="#/project/${encodeURIComponent(projectId)}/defect/${encodeURIComponent(defect.id)}">
            <span class="defect-row-thumb">${thumbUrl ? `<img src="${thumbUrl}" alt="" />` : ''}</span>
            <span class="row-name">
              <span class="defect-code">${escapeHtml(roomCode)}${number ? ' · ' + escapeHtml(number) : ''}</span>
              <span class="${defect.title ? '' : 'defect-title-empty'}">${escapeHtml(defect.title || '(unnamed defect)')}</span>
            </span>
          </a>
          <button class="row-delete" title="Delete">&times;</button>
        </div>
        <div class="row-actions">
          <button class="action-btn camera-btn" title="Add photo" aria-label="Add photo">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="14" r="3.5"/></svg>
          </button>
          <button class="action-btn comment-btn" title="Add comment" aria-label="Add comment">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <span class="status-badge status-${defect.status.toLowerCase()}">${escapeHtml(defect.status)}</span>
        </div>
      </li>
    `);

    row.querySelector('.camera-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Media.pickPhotos(async (files) => {
        for (const f of files) await Snaggo.addPhoto(defect.id, f);
        toast(`Photo added to ${defect.code}`);
        await renderAreaDetail(projectId, areaId);
      });
    });

    row.querySelector('.comment-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const result = await openTextModal({
        title: `Comment — ${defect.code}`,
        value: defect.comments,
        placeholder: 'Add a comment…',
      });
      if (result === null) return;
      await Snaggo.updateDefect(defect.id, { comments: result });
      toast('Comment saved');
    });

    row.querySelector('.row-delete').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm(`Delete ${defect.code}? This removes its photos too.`)) return;
      await Snaggo.deleteDefect(defect.id);
      await renderAreaDetail(projectId, areaId);
      toast(`Deleted ${defect.code}`);
    });

    rowsEl.appendChild(row);
  }

  document.getElementById('add-defect').addEventListener('click', async () => {
    await Snaggo.addDefect(areaId, area.kind);
    await renderAreaDetail(projectId, areaId);
  });
}

// ---- Defect detail ---------------------------------------------------------

async function renderDefectDetail(projectId, defectId) {
  const defect = await Snaggo.getDefect(defectId);
  if (!defect) {
    location.hash = `#/project/${encodeURIComponent(projectId)}`;
    return;
  }
  const area = await Store.get('areas', defect.areaId);
  const photos = await Snaggo.listPhotos(defectId);

  root.innerHTML = `
    ${topBar(defect.code || '(unnamed defect)', { back: `#/project/${encodeURIComponent(projectId)}/area/${encodeURIComponent(defect.areaId)}` })}
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
      <textarea id="d-desc" rows="4" placeholder="Describe the defect…">${escapeHtml(defect.description || '')}</textarea>

      <section class="photos-section">
        <div class="section-head">
          <h2>Photos</h2>
          <div class="section-head-actions">
            <button id="save-photos" class="icon-btn" title="Save photos to your phone's gallery">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M12 15l-4-4M12 15l4-4"/><path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
            </button>
            <button id="add-photo" class="icon-btn" title="Add photo">+</button>
          </div>
        </div>
        <div class="photo-grid" id="photo-grid"></div>
      </section>

      <label class="field-label">Comments</label>
      <textarea id="d-comments" rows="4" placeholder="Additional comments…">${escapeHtml(defect.comments || '')}</textarea>
    </main>
  `;

  document.getElementById('d-title').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { title: e.target.value })
  );
  document.getElementById('d-status').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { status: e.target.value })
  );
  document.getElementById('d-complete').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { complete: e.target.checked })
  );
  document.getElementById('d-target').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { targetResolution: e.target.value })
  );
  document.getElementById('d-date').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { dateIdentified: e.target.value })
  );
  document.getElementById('d-subcontractor').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { subcontractor: e.target.value })
  );
  document.getElementById('d-desc').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { description: e.target.value })
  );
  document.getElementById('d-comments').addEventListener('change', (e) =>
    Snaggo.updateDefect(defectId, { comments: e.target.value })
  );

  await renderPhotoGrid(projectId, defectId, photos);
  document.getElementById('add-photo').addEventListener('click', () => {
    Media.pickPhotos(async (files) => {
      for (const f of files) await Snaggo.addPhoto(defectId, f);
      await renderDefectDetail(projectId, defectId);
    });
  });
  document.getElementById('save-photos').addEventListener('click', async () => {
    const current = await Snaggo.listPhotos(defectId);
    await saveToPhotosFlow(current, `${defect.code} photos`);
  });
}

async function renderPhotoGrid(projectId, defectId, photos) {
  const grid = document.getElementById('photo-grid');
  if (!photos.length) {
    grid.innerHTML = '<p class="empty-hint">No photos yet.</p>';
    return;
  }
  grid.innerHTML = '';
  for (const p of photos) {
    const url = URL.createObjectURL(p.blob);
    const card = el(`
      <div class="photo-thumb">
        <img src="${url}" alt="Defect photo" />
        <button class="thumb-delete" title="Delete">&times;</button>
      </div>
    `);
    card.querySelector('img').addEventListener('click', () => openLightbox(url));
    card.querySelector('.thumb-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this photo?')) return;
      await Snaggo.deletePhoto(p.id);
      await renderDefectDetail(projectId, defectId);
    });
    grid.appendChild(card);
  }
}

// ---- Report (flat table, PDF-style) ---------------------------------------

async function renderReportPage(projectId) {
  const project = await Snaggo.getProjectById(projectId);
  if (!project) {
    location.hash = '#/';
    return;
  }
  const areas = [
    ...(await Snaggo.listAreas(projectId, 'external')),
    ...(await Snaggo.listAreas(projectId, 'internal')),
  ];

  root.innerHTML = `
    ${topBar('Report', { back: `#/project/${encodeURIComponent(projectId)}` })}
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
    const defects = await Snaggo.listDefects(area.id);
    for (const defect of defects) {
      rowCount++;
      const photos = await Snaggo.listPhotos(defect.id);
      const thumbUrl = photos.length ? URL.createObjectURL(photos[0].blob) : '';
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
    tbody.innerHTML = '<tr><td colspan="9" class="empty-hint">No defects logged yet.</td></tr>';
  }
}

