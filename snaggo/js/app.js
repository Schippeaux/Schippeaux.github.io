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

function describeSpeechError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone/speech permission was blocked for this page';
    case 'network':
      return 'No network — live transcription needs a connection';
    case 'audio-capture':
      return "Couldn't access the microphone for speech recognition";
    case 'aborted':
      return 'Speech recognition was interrupted';
    case 'language-not-supported':
      return "This device's speech service doesn't support the current language";
    default:
      return `Live transcription failed (${code})`;
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
      if (!confirm(`Delete "${project.name || '(untitled project)'}"? This removes all its rooms, defects, photos and dictations.`)) return;
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
        <button id="save-all-photos-btn" class="btn btn-secondary">Save all photos to gallery</button>
        <button id="export-btn" class="btn btn-secondary">Export project (.zip)</button>
        <button id="import-zip-btn" class="btn btn-secondary">Import project (.zip)</button>
        <button id="import-csv-btn" class="btn btn-secondary">Import transcriptions (.csv)</button>
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

  document.getElementById('import-csv-btn').addEventListener('click', () => {
    Media.pickFile('.csv', async (file) => {
      try {
        const n = await SnaggoExport.importTranscriptionsCsv(projectId, file);
        toast(`Applied transcriptions to ${n} defect${n === 1 ? '' : 's'}`);
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
    const name = prompt(kind === 'external' ? 'Area name (e.g. Front Facade)' : 'Room name (e.g. Bathroom 2)');
    if (!name || !name.trim()) return;
    await Snaggo.addArea(projectId, kind, name.trim());
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

  root.innerHTML = `
    ${topBar(area.name, { back: `#/project/${encodeURIComponent(projectId)}/tab/${area.kind}` })}
    <main class="defect-list">
      <ul class="row-list" id="defect-rows"></ul>
      <button id="add-defect" class="btn btn-primary btn-add">+ Add defect</button>
    </main>
  `;

  const rowsEl = document.getElementById('defect-rows');
  if (!defects.length) {
    rowsEl.innerHTML = '<li class="empty-hint">No defects logged yet — add one below.</li>';
  }
  for (const defect of defects) {
    const { roomCode, number } = splitDefectCode(defect.code || '');
    const row = el(`
      <li class="row-item defect-row">
        <div class="defect-row-main">
          <a class="row-link" href="#/project/${encodeURIComponent(projectId)}/defect/${encodeURIComponent(defect.id)}">
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
          <button class="action-btn record-btn" title="Record dictation" aria-label="Record dictation">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
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
      });
    });

    wireInlineRecorder(row.querySelector('.record-btn'), defect.id, {
      onSaved: () => toast(`Dictation saved to ${defect.code}`),
      onError: (code) => {
        if (code !== 'unsupported') toast(describeSpeechError(code) + ' — still recording audio');
      },
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
      if (!confirm(`Delete ${defect.code}? This removes its photos and dictations too.`)) return;
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
  const audioClips = await Snaggo.listAudio(defectId);

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

      <section class="audio-section">
        <div class="section-head">
          <h2>Dictation</h2>
          <button id="rec-btn" class="btn btn-record">● Record</button>
        </div>
        <p id="live-transcript-preview" class="live-transcript" hidden></p>
        <ul class="audio-list" id="audio-list"></ul>
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

  await renderAudioList(projectId, defectId, audioClips);
  wireRecordButton(projectId, defectId);
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
    card.querySelector('.thumb-delete').addEventListener('click', async () => {
      if (!confirm('Delete this photo?')) return;
      await Snaggo.deletePhoto(p.id);
      await renderDefectDetail(projectId, defectId);
    });
    grid.appendChild(card);
  }
}

async function renderAudioList(projectId, defectId, clips) {
  const list = document.getElementById('audio-list');
  if (!clips.length) {
    list.innerHTML = '<li class="empty-hint">No dictations yet.</li>';
    return;
  }
  list.innerHTML = '';
  clips.forEach((clip, i) => {
    const url = URL.createObjectURL(clip.blob);
    const when = new Date(clip.createdAt).toLocaleString();
    const hasTranscript = !!(clip.transcriptRaw || '').trim();
    const placeholder = hasTranscript
      ? ''
      : clip.transcriptNote
      ? clip.transcriptNote
      : 'No live transcript captured — add one manually, or transcribe this clip on the PC later.';
    const item = el(`
      <li class="audio-item">
        <audio controls src="${url}" class="audio-player"></audio>
        <div class="audio-item-row">
          <span class="audio-meta">Dictation ${i + 1} · ${escapeHtml(when)}</span>
          <button class="row-delete" title="Delete">&times;</button>
        </div>
        <textarea class="audio-transcript" rows="2" placeholder="${escapeHtml(placeholder)}">${escapeHtml(clip.transcriptRaw || '')}</textarea>
        <div class="audio-transcript-actions">
          <button class="btn-link save-transcript">Save</button>
          <button class="btn-link add-to-comments">Add to comments</button>
        </div>
      </li>
    `);

    item.querySelector('.row-delete').addEventListener('click', async () => {
      if (!confirm('Delete this dictation?')) return;
      await Snaggo.deleteAudio(clip.id);
      await renderDefectDetail(projectId, defectId);
    });

    const textarea = item.querySelector('.audio-transcript');
    item.querySelector('.save-transcript').addEventListener('click', async () => {
      await Snaggo.updateAudio(clip.id, { transcriptRaw: textarea.value });
      toast('Transcript saved');
    });
    item.querySelector('.add-to-comments').addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        toast('Nothing to add — the transcript is empty');
        return;
      }
      const defect = await Snaggo.getDefect(defectId);
      const next = defect.comments ? `${defect.comments}\n\n${text}` : text;
      await Snaggo.updateDefect(defectId, { comments: next });
      await renderDefectDetail(projectId, defectId);
      toast('Added to comments');
    });

    list.appendChild(item);
  });
}

// Generic record-toggle wiring, used both by the big "Record" button on the
// defect detail page and the compact record icon on each row of a room's
// defect list. Runs audio capture and the phone's own live dictation side
// by side where dictation is supported — one button instead of "record
// audio" and "transcribe it" as separate steps.
function wireInlineRecorder(btn, defectId, { onStart, onStop, onSaved, onInterim, onError } = {}) {
  let recorder = null;
  let transcriber = null;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!recorder) {
      recorder = Media.createRecorder();
      try {
        await recorder.start();
        btn.classList.add('recording');
        if (Media.isSpeechRecognitionSupported()) {
          transcriber = Media.createLiveTranscriber();
          transcriber.start(
            (finalText, interim) => {
              if (onInterim) onInterim(finalText, interim);
            },
            (errorCode) => {
              if (onError) onError(errorCode);
            }
          );
        } else if (onError) {
          onError('unsupported');
        }
        if (onStart) onStart(btn);
      } catch (err) {
        toast('Could not start recording: ' + err.message);
        recorder = null;
      }
      return;
    }
    btn.disabled = true;
    if (onStop) onStop(btn);
    let transcriptRaw = '';
    let transcriptNote = '';
    if (transcriber) {
      const result = transcriber.stop();
      transcriptRaw = result.text;
      if (!transcriptRaw) {
        transcriptNote = result.lastError
          ? describeSpeechError(result.lastError)
          : result.sawResult
          ? '' // got results but they were empty/silence — leave note blank
          : 'No speech was recognised during this recording';
      }
    } else {
      transcriptNote = "This browser has no built-in speech recognition — tap this box and use your keyboard's own dictation mic";
    }
    transcriber = null;
    const { blob, mimeType } = await recorder.stop();
    await Snaggo.addAudio(defectId, blob, mimeType, transcriptRaw, transcriptNote);
    recorder = null;
    if (onSaved) await onSaved();
  });
}

function wireRecordButton(projectId, defectId) {
  const btn = document.getElementById('rec-btn');
  const preview = document.getElementById('live-transcript-preview');
  wireInlineRecorder(btn, defectId, {
    onStart: (b) => {
      b.textContent = '■ Stop';
      if (preview) {
        preview.hidden = false;
        preview.classList.remove('live-transcript-error');
        preview.textContent = Media.isSpeechRecognitionSupported()
          ? 'Listening…'
          : 'Recording — this browser has no built-in speech recognition, so this clip will be audio only (tap the transcript box after stopping to dictate with your keyboard instead)';
      }
    },
    onInterim: (finalText, interim) => {
      if (preview && !preview.classList.contains('live-transcript-error')) {
        preview.textContent = [finalText, interim].filter(Boolean).join(' ') || 'Listening…';
      }
    },
    onError: (code) => {
      if (preview) {
        preview.classList.add('live-transcript-error');
        preview.textContent =
          code === 'unsupported'
            ? "Recording (live transcript isn't supported on this device — audio only)"
            : describeSpeechError(code) + ' — still recording audio';
      }
    },
    onStop: () => {
      if (preview) preview.hidden = true;
    },
    onSaved: async () => {
      await renderDefectDetail(projectId, defectId);
      // No live transcript on this browser (e.g. iOS Safari, which has no
      // SpeechRecognition API at all — not something a web page can add).
      // The closest we can get to "one button": jump straight to the new
      // clip's transcript box so the keyboard — with its own dictation mic
      // — is already up, ready for a single tap instead of having to find
      // and tap into the field first.
      if (!Media.isSpeechRecognitionSupported()) {
        const boxes = document.querySelectorAll('.audio-transcript');
        const last = boxes[boxes.length - 1];
        if (last) {
          last.scrollIntoView({ behavior: 'smooth', block: 'center' });
          last.focus();
        }
      }
    },
  });
}
