// Snaggo — export / import
//
// Export produces a single .zip:
//   manifest.json   — all project/area/defect data, plus comments, status etc.
//                      photo & audio entries reference filenames, not blobs.
//   drawings/*.jpg   — reference drawing images
//   photos/*.jpg     — defect photos, named <defectId>_<n>.<ext>
//   audio/*.webm     — dictations, named <defectId>_<n>.<ext>
//
// That zip is what you move off the phone/tablet by hand (AirDrop, cable,
// OneDrive, email — whatever). It is never uploaded anywhere by the app.
//
// Import accepts either:
//   - a Snaggo project .zip (full restore — replaces the current project)
//   - a transcriptions .csv (defect_id, raw_transcript, polished_notes,
//     suggested_title) — merges AI notes into the matching defect's Comments

function extOf(mimeType, fallback) {
  if (!mimeType) return fallback;
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('m4a')) return 'm4a';
  return fallback;
}

const SnaggoExport = {
  async exportZip() {
    const data = await Snaggo.exportAll();
    const zip = new JSZip();

    const manifest = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      project: data.project,
      areas: data.areas,
      defects: data.defects,
      drawings: [],
      photos: [],
      audio: [],
    };

    const drawingsFolder = zip.folder('drawings');
    data.drawings.forEach((d, i) => {
      const ext = extOf(d.blob.type, 'jpg');
      const filename = `drawing_${i + 1}.${ext}`;
      drawingsFolder.file(filename, d.blob);
      manifest.drawings.push({ id: d.id, name: d.name, file: `drawings/${filename}`, createdAt: d.createdAt });
    });

    const photosFolder = zip.folder('photos');
    const photoSeq = {};
    data.photos.forEach((p) => {
      photoSeq[p.defectId] = (photoSeq[p.defectId] || 0) + 1;
      const ext = extOf(p.blob.type, 'jpg');
      const filename = `${p.defectId}_${photoSeq[p.defectId]}.${ext}`;
      photosFolder.file(filename, p.blob);
      manifest.photos.push({ id: p.id, defectId: p.defectId, file: `photos/${filename}`, order: p.order, createdAt: p.createdAt });
    });

    const audioFolder = zip.folder('audio');
    const audioSeq = {};
    data.audio.forEach((a) => {
      audioSeq[a.defectId] = (audioSeq[a.defectId] || 0) + 1;
      const ext = extOf(a.mimeType || a.blob.type, 'webm');
      const filename = `${a.defectId}_${audioSeq[a.defectId]}.${ext}`;
      audioFolder.file(filename, a.blob);
      manifest.audio.push({
        id: a.id,
        defectId: a.defectId,
        file: `audio/${filename}`,
        transcriptRaw: a.transcriptRaw || '',
        transcriptPolished: a.transcriptPolished || '',
        transcriptStatus: a.transcriptStatus || 'none',
        createdAt: a.createdAt,
      });
    });

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    const projectName = (data.project.name || 'snaggo-project').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'snaggo-project';
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${projectName}_${date}.zip`;
    SnaggoExport._download(blob, filename);
    return filename;
  },

  async importZip(file) {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('Not a Snaggo export — manifest.json missing.');
    const manifest = JSON.parse(await manifestFile.async('string'));

    const drawings = [];
    for (const d of manifest.drawings || []) {
      const blob = await zip.file(d.file).async('blob');
      drawings.push({ id: d.id, name: d.name, blob, createdAt: d.createdAt });
    }
    const photos = [];
    for (const p of manifest.photos || []) {
      const blob = await zip.file(p.file).async('blob');
      photos.push({ id: p.id, defectId: p.defectId, blob, order: p.order, createdAt: p.createdAt });
    }
    const audio = [];
    for (const a of manifest.audio || []) {
      const blob = await zip.file(a.file).async('blob');
      audio.push({
        id: a.id,
        defectId: a.defectId,
        blob,
        mimeType: blob.type,
        transcriptRaw: a.transcriptRaw || '',
        transcriptPolished: a.transcriptPolished || '',
        transcriptStatus: a.transcriptStatus || 'none',
        createdAt: a.createdAt,
      });
    }

    await Snaggo.replaceAll({
      project: manifest.project,
      areas: manifest.areas || [],
      defects: manifest.defects || [],
      drawings,
      photos,
      audio,
    });
  },

  async importTranscriptionsCsv(file) {
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (parsed.errors && parsed.errors.length) {
      console.warn('CSV parse warnings:', parsed.errors);
    }
    return Snaggo.applyTranscriptionRows(parsed.data);
  },

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
