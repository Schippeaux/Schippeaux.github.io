// Snaggo — IndexedDB data layer
// Everything lives on-device. Nothing here ever touches a network.
//
// Schema (object stores), v2 — multi-project:
//   projects   keyPath 'id'                     — { id, name, description, createdAt }
//   drawings   keyPath 'id', index 'projectId'   — { id, projectId, name, blob, createdAt }
//   areas      keyPath 'id', index 'projectId'   — { id, projectId, kind: 'external'|'internal',
//                                                     name, order, createdAt }
//   defects    keyPath 'id' (uuid), index 'areaId' — { id, areaId, code, seq, title, description,
//                                                       comments, status, complete, targetResolution,
//                                                       createdAt, updatedAt }
//              `code` is the human-readable label (e.g. INT-BATH2-03) — only unique *within* a
//              project, so it is no longer the primary key. The id is a uuid so defects from
//              different projects (or an imported PDF with its own numbering) can never collide.
//   photos     keyPath 'id', index 'defectId'    — { id, defectId, blob, order, createdAt }
//   audio      keyPath 'id', index 'defectId'    — { id, defectId, blob, mimeType, transcriptRaw,
//                                                     transcriptPolished, transcriptStatus,
//                                                     transcriptNote, createdAt }
//   meta       keyPath 'key'                     — legacy, pre-v2 single-project data lived here
//                                                     under key 'project' until migrated below.

const DB_NAME = 'snaggo-db';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = e.target.transaction;

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('drawings')) {
        const s = db.createObjectStore('drawings', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId', { unique: false });
      } else {
        const s = tx.objectStore('drawings');
        if (!s.indexNames.contains('projectId')) s.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('areas')) {
        const s = db.createObjectStore('areas', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId', { unique: false });
      } else {
        const s = tx.objectStore('areas');
        if (!s.indexNames.contains('projectId')) s.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('defects')) {
        const s = db.createObjectStore('defects', { keyPath: 'id' });
        s.createIndex('areaId', 'areaId', { unique: false });
      }
      if (!db.objectStoreNames.contains('photos')) {
        const s = db.createObjectStore('photos', { keyPath: 'id' });
        s.createIndex('defectId', 'defectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('audio')) {
        const s = db.createObjectStore('audio', { keyPath: 'id' });
        s.createIndex('defectId', 'defectId', { unique: false });
      }

      // One-time migration: fold any pre-v2 single-project data into a real
      // project record, so upgrading never loses what's already on the
      // device. Pre-v2 defects used their human code as the id — kept as-is
      // (still unique, since there was only ever one project) and `code` is
      // backfilled from it.
      if (e.oldVersion > 0 && e.oldVersion < 2) {
        const metaStore = tx.objectStore('meta');
        const projectsStore = tx.objectStore('projects');
        const areasStore = tx.objectStore('areas');
        const drawingsStore = tx.objectStore('drawings');
        const defectsStore = tx.objectStore('defects');

        metaStore.get('project').onsuccess = (ev) => {
          const old = ev.target.result;
          areasStore.getAll().onsuccess = (ev2) => {
            const existingAreas = ev2.target.result || [];
            if (!old && existingAreas.length === 0) return; // nothing to migrate
            const projectId = 'migrated-' + Date.now();
            projectsStore.put({
              id: projectId,
              name: (old && old.name) || 'My Project',
              description: (old && old.description) || '',
              createdAt: (old && old.createdAt) || Date.now(),
            });
            for (const area of existingAreas) {
              area.projectId = projectId;
              areasStore.put(area);
            }
            drawingsStore.getAll().onsuccess = (ev3) => {
              for (const d of ev3.target.result || []) {
                d.projectId = projectId;
                drawingsStore.put(d);
              }
            };
            defectsStore.getAll().onsuccess = (ev4) => {
              for (const d of ev4.target.result || []) {
                if (!d.code) {
                  d.code = d.id;
                  defectsStore.put(d);
                }
              }
            };
          };
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let _dbPromise = null;
function db() {
  if (!_dbPromise) _dbPromise = openDB();
  return _dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return db().then((d) => d.transaction(storeNames, mode));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const Store = {
  async get(storeName, key) {
    const t = await tx([storeName]);
    return reqToPromise(t.objectStore(storeName).get(key));
  },
  async getAll(storeName) {
    const t = await tx([storeName]);
    return reqToPromise(t.objectStore(storeName).getAll());
  },
  async getAllByIndex(storeName, indexName, value) {
    const t = await tx([storeName]);
    return reqToPromise(t.objectStore(storeName).index(indexName).getAll(value));
  },
  async put(storeName, value) {
    const t = await tx([storeName], 'readwrite');
    await reqToPromise(t.objectStore(storeName).put(value));
    return value;
  },
  async delete(storeName, key) {
    const t = await tx([storeName], 'readwrite');
    return reqToPromise(t.objectStore(storeName).delete(key));
  },
  async clear(storeName) {
    const t = await tx([storeName], 'readwrite');
    return reqToPromise(t.objectStore(storeName).clear());
  },
};

// ---- Higher-level helpers -------------------------------------------------

const Snaggo = {
  // --- Projects ------------------------------------------------------------
  async listProjects() {
    const projects = await Store.getAll('projects');
    return projects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
  async getProjectById(id) {
    return Store.get('projects', id);
  },
  async addProject(name, description = '') {
    const id = crypto.randomUUID();
    const project = { id, name: name || '', description, createdAt: Date.now() };
    await Store.put('projects', project);
    return project;
  },
  async saveProject(id, fields) {
    const current = await Store.get('projects', id);
    if (!current) return;
    const next = { ...current, ...fields };
    await Store.put('projects', next);
    return next;
  },
  async deleteProject(id) {
    const areas = await Store.getAllByIndex('areas', 'projectId', id);
    for (const a of areas) await Snaggo.deleteArea(a.id);
    const drawings = await Store.getAllByIndex('drawings', 'projectId', id);
    for (const d of drawings) await Store.delete('drawings', d.id);
    return Store.delete('projects', id);
  },
  async projectSummary(id) {
    const areas = await Store.getAllByIndex('areas', 'projectId', id);
    let outstanding = 0, resolved = 0;
    for (const area of areas) {
      const c = await Snaggo.defectCounts(area.id);
      outstanding += c.outstanding;
      resolved += c.resolved;
    }
    return { outstanding, resolved, areaCount: areas.length };
  },

  // --- Drawings --------------------------------------------------------
  async listDrawings(projectId) {
    return Store.getAllByIndex('drawings', 'projectId', projectId);
  },
  async addDrawing(projectId, name, blob) {
    const id = crypto.randomUUID();
    return Store.put('drawings', { id, projectId, name, blob, createdAt: Date.now() });
  },
  async deleteDrawing(id) {
    return Store.delete('drawings', id);
  },

  // --- Areas -------------------------------------------------------------
  async listAreas(projectId, kind) {
    const all = await Store.getAllByIndex('areas', 'projectId', projectId);
    return all.filter((a) => a.kind === kind).sort((a, b) => a.order - b.order);
  },
  async addArea(projectId, kind, name) {
    const existing = await Snaggo.listAreas(projectId, kind);
    const id = crypto.randomUUID();
    const order = existing.length;
    return Store.put('areas', { id, projectId, kind, name, order, createdAt: Date.now() });
  },
  async renameArea(id, name) {
    const area = await Store.get('areas', id);
    if (!area) return;
    area.name = name;
    return Store.put('areas', area);
  },
  async deleteArea(id) {
    const defects = await Store.getAllByIndex('defects', 'areaId', id);
    for (const d of defects) await Snaggo.deleteDefect(d.id);
    return Store.delete('areas', id);
  },

  _slug(name) {
    const clean = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.slice(0, 8) || 'AREA';
  },

  // --- Defects -----------------------------------------------------------
  async listDefects(areaId) {
    const defects = await Store.getAllByIndex('defects', 'areaId', areaId);
    return defects.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  },
  async getDefect(id) {
    return Store.get('defects', id);
  },

  async addDefect(areaId, kind) {
    const area = await Store.get('areas', areaId);
    const existing = await Snaggo.listDefects(areaId);
    const seq = existing.length + 1;
    const prefix = kind === 'external' ? 'EXT' : 'INT';
    const slug = Snaggo._slug(area ? area.name : '');
    const code = `${prefix}-${slug}-${String(seq).padStart(2, '0')}`;
    const now = Date.now();
    const defect = {
      id: crypto.randomUUID(),
      areaId,
      code,
      seq,
      title: '',
      description: '',
      comments: '',
      status: 'Incomplete',
      complete: false,
      targetResolution: '',
      createdAt: now,
      updatedAt: now,
    };
    await Store.put('defects', defect);
    return defect;
  },

  async updateDefect(id, fields) {
    const defect = await Store.get('defects', id);
    if (!defect) return;
    const next = { ...defect, ...fields, updatedAt: Date.now() };
    await Store.put('defects', next);
    return next;
  },

  async deleteDefect(id) {
    const photos = await Store.getAllByIndex('photos', 'defectId', id);
    for (const p of photos) await Store.delete('photos', p.id);
    const audio = await Store.getAllByIndex('audio', 'defectId', id);
    for (const a of audio) await Store.delete('audio', a.id);
    return Store.delete('defects', id);
  },

  async defectCounts(areaId) {
    const defects = await Snaggo.listDefects(areaId);
    const outstanding = defects.filter((d) => !d.complete).length;
    const resolved = defects.filter((d) => d.complete).length;
    return { outstanding, resolved, total: defects.length };
  },

  // --- Photos --------------------------------------------------------------
  async listPhotos(defectId) {
    const photos = await Store.getAllByIndex('photos', 'defectId', defectId);
    return photos.sort((a, b) => a.order - b.order);
  },
  async addPhoto(defectId, blob) {
    const existing = await Snaggo.listPhotos(defectId);
    const id = crypto.randomUUID();
    return Store.put('photos', { id, defectId, blob, order: existing.length, createdAt: Date.now() });
  },
  async deletePhoto(id) {
    return Store.delete('photos', id);
  },
  async listAllPhotosForProject(projectId) {
    const areas = await Store.getAllByIndex('areas', 'projectId', projectId);
    const photos = [];
    for (const area of areas) {
      for (const d of await Snaggo.listDefects(area.id)) {
        photos.push(...(await Snaggo.listPhotos(d.id)));
      }
    }
    return photos.sort((a, b) => a.createdAt - b.createdAt);
  },

  // --- Audio -----------------------------------------------------------
  async listAudio(defectId) {
    const clips = await Store.getAllByIndex('audio', 'defectId', defectId);
    return clips.sort((a, b) => a.createdAt - b.createdAt);
  },
  async addAudio(defectId, blob, mimeType, transcriptRaw = '', transcriptNote = '') {
    const id = crypto.randomUUID();
    return Store.put('audio', {
      id,
      defectId,
      blob,
      mimeType,
      transcriptRaw,
      transcriptPolished: '',
      // none = no raw transcript at all (needs PC speech-to-text);
      // captured = phone's live dictation got a raw transcript already,
      //            just needs the "polish into a professional note" pass;
      // reviewed = transcriptPolished has been applied and reviewed.
      transcriptStatus: transcriptRaw ? 'captured' : 'none',
      // Why transcriptRaw is empty, when it is — e.g. "not supported on
      // this browser", "microphone/speech permission blocked", "no network
      // for speech recognition" — shown in place of the generic placeholder
      // so it's obvious what actually happened instead of just "nothing".
      transcriptNote,
      createdAt: Date.now(),
    });
  },
  async updateAudio(id, fields) {
    const clip = await Store.get('audio', id);
    if (!clip) return;
    const next = { ...clip, ...fields };
    await Store.put('audio', next);
    return next;
  },
  async deleteAudio(id) {
    return Store.delete('audio', id);
  },

  // --- Export / import -----------------------------------------------------
  // Exports a single project's full data (blobs included) — export.js turns
  // this into a zip.
  async exportProject(projectId) {
    const project = await Store.get('projects', projectId);
    const drawings = await Store.getAllByIndex('drawings', 'projectId', projectId);
    const areas = await Store.getAllByIndex('areas', 'projectId', projectId);
    const defects = [];
    const photos = [];
    const audio = [];
    for (const area of areas) {
      const ds = await Snaggo.listDefects(area.id);
      defects.push(...ds);
      for (const d of ds) {
        photos.push(...(await Snaggo.listPhotos(d.id)));
        audio.push(...(await Snaggo.listAudio(d.id)));
      }
    }
    return { project, areas, defects, drawings, photos, audio };
  },

  // Importing a zip always creates a brand-new project — it never touches or
  // replaces any project already on this device. All ids are regenerated so
  // an import can never collide with something already here.
  async importAsNewProject(data) {
    const projectId = crypto.randomUUID();
    const src = data.project || {};
    await Store.put('projects', {
      id: projectId,
      name: src.name || 'Imported project',
      description: src.description || '',
      createdAt: Date.now(),
    });

    const areaIdMap = {};
    for (const a of data.areas || []) {
      const newId = crypto.randomUUID();
      areaIdMap[a.id] = newId;
      await Store.put('areas', { ...a, id: newId, projectId });
    }
    for (const d of data.drawings || []) {
      await Store.put('drawings', { ...d, id: crypto.randomUUID(), projectId });
    }
    const defectIdMap = {};
    for (const d of data.defects || []) {
      const newId = crypto.randomUUID();
      defectIdMap[d.id] = newId;
      await Store.put('defects', {
        ...d,
        id: newId,
        areaId: areaIdMap[d.areaId] || d.areaId,
        code: d.code || d.id,
        targetResolution: d.targetResolution || '',
      });
    }
    for (const p of data.photos || []) {
      await Store.put('photos', { ...p, id: crypto.randomUUID(), defectId: defectIdMap[p.defectId] || p.defectId });
    }
    for (const a of data.audio || []) {
      await Store.put('audio', { ...a, id: crypto.randomUUID(), defectId: defectIdMap[a.defectId] || a.defectId });
    }
    return projectId;
  },

  // rows: [{ defect_code, raw_transcript, polished_notes, suggested_title }]
  // Matched by `code` within the given project — codes are only unique
  // per-project, not globally, now that a device can hold several.
  async applyTranscriptionRows(projectId, rows) {
    const areas = await Store.getAllByIndex('areas', 'projectId', projectId);
    const byCode = {};
    for (const area of areas) {
      for (const d of await Snaggo.listDefects(area.id)) byCode[d.code] = d;
    }
    let applied = 0;
    for (const row of rows) {
      const code = (row.defect_code || row.defect_id || '').trim();
      if (!code) continue;
      const defect = byCode[code];
      if (!defect) continue;
      const note = (row.polished_notes || '').trim();
      if (note) {
        const tag = `[AI transcription — reviewed]\n${note}`;
        defect.comments = defect.comments ? `${defect.comments}\n\n${tag}` : tag;
      }
      defect.updatedAt = Date.now();
      await Store.put('defects', defect);
      applied++;
    }
    return applied;
  },
};
