// Snaggo — IndexedDB data layer
// Everything lives on-device. Nothing here ever touches a network.
// Schema (object stores):
//   meta       keyPath 'key'                 — { key: 'project', name, description, createdAt }
//   drawings   keyPath 'id'                  — { id, name, blob, createdAt }
//   areas      keyPath 'id', index 'kind'    — { id, kind: 'external'|'internal', name, order, createdAt }
//   defects    keyPath 'id', index 'areaId'  — { id (human code, e.g. INT-BATH2-03), areaId, title,
//                                                description, comments, status, complete, createdAt, updatedAt }
//   photos     keyPath 'id', index 'defectId'— { id, defectId, blob, order, createdAt }
//   audio      keyPath 'id', index 'defectId'— { id, defectId, blob, mimeType, transcriptRaw,
//                                                transcriptPolished, transcriptStatus, createdAt }

const DB_NAME = 'snaggo-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('drawings')) {
        db.createObjectStore('drawings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('areas')) {
        const s = db.createObjectStore('areas', { keyPath: 'id' });
        s.createIndex('kind', 'kind', { unique: false });
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
  async getProject() {
    const p = await Store.get('meta', 'project');
    return p || { key: 'project', name: '', description: '', createdAt: Date.now() };
  },
  async saveProject(fields) {
    const current = await Snaggo.getProject();
    const next = { ...current, ...fields, key: 'project' };
    await Store.put('meta', next);
    return next;
  },

  async listDrawings() {
    return Store.getAll('drawings');
  },
  async addDrawing(name, blob) {
    const id = crypto.randomUUID();
    return Store.put('drawings', { id, name, blob, createdAt: Date.now() });
  },
  async deleteDrawing(id) {
    return Store.delete('drawings', id);
  },

  async listAreas(kind) {
    const areas = await Store.getAllByIndex('areas', 'kind', kind);
    return areas.sort((a, b) => a.order - b.order);
  },
  async addArea(kind, name) {
    const existing = await Snaggo.listAreas(kind);
    const id = crypto.randomUUID();
    const order = existing.length;
    return Store.put('areas', { id, kind, name, order, createdAt: Date.now() });
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

  async listDefects(areaId) {
    const defects = await Store.getAllByIndex('defects', 'areaId', areaId);
    return defects.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  },
  async getDefect(id) {
    return Store.get('defects', id);
  },

  _slug(name) {
    const clean = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.slice(0, 8) || 'AREA';
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
      id: code,
      areaId,
      seq,
      title: '',
      description: '',
      comments: '',
      status: 'Incomplete',
      complete: false,
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

  async listAudio(defectId) {
    const clips = await Store.getAllByIndex('audio', 'defectId', defectId);
    return clips.sort((a, b) => a.createdAt - b.createdAt);
  },
  async addAudio(defectId, blob, mimeType) {
    const id = crypto.randomUUID();
    return Store.put('audio', {
      id,
      defectId,
      blob,
      mimeType,
      transcriptRaw: '',
      transcriptPolished: '',
      transcriptStatus: 'none', // none | pending | reviewed
      createdAt: Date.now(),
    });
  },
  async deleteAudio(id) {
    return Store.delete('audio', id);
  },

  // Export the whole project as plain-object data (blobs included) —
  // export.js turns this into a zip.
  async exportAll() {
    const project = await Snaggo.getProject();
    const drawings = await Store.getAll('drawings');
    const areas = await Store.getAll('areas');
    const defects = await Store.getAll('defects');
    const photos = await Store.getAll('photos');
    const audio = await Store.getAll('audio');
    return { project, drawings, areas, defects, photos, audio };
  },

  // Wipe and replace everything (used by zip import).
  async replaceAll(data) {
    for (const s of ['meta', 'drawings', 'areas', 'defects', 'photos', 'audio']) {
      await Store.clear(s);
    }
    await Store.put('meta', { ...data.project, key: 'project' });
    for (const d of data.drawings || []) await Store.put('drawings', d);
    for (const a of data.areas || []) await Store.put('areas', a);
    for (const d of data.defects || []) await Store.put('defects', d);
    for (const p of data.photos || []) await Store.put('photos', p);
    for (const a of data.audio || []) await Store.put('audio', a);
  },

  async applyTranscriptionRows(rows) {
    // rows: [{ defect_id, raw_transcript, polished_notes, suggested_title }]
    let applied = 0;
    for (const row of rows) {
      const defectId = (row.defect_id || '').trim();
      if (!defectId) continue;
      const defect = await Store.get('defects', defectId);
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
