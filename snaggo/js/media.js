// Snaggo — camera handling
//
// Photos use a plain file input with capture="environment": this opens the
// OS camera sheet on phones/tablets and needs no special browser permission
// or secure-context dance. It works even if the app were opened as a local
// file.
//
// There's no in-app dictation recorder — defect notes are plain text
// fields, and on a phone you get speech-to-text for free by tapping the
// keyboard's own dictation/mic button, same as any other text field.

const Media = {
  // --- Saving photos out to the phone's own gallery --------------------
  // There's no web API that writes silently into Photos/Gallery, or that
  // targets a specific album — both are deliberately off-limits to web
  // content, the same category of restriction as the keyboard's dictation
  // mic. The closest available thing is the OS share sheet: it has a
  // "Save Image(s)"/"Save to Photos" target built in on both iOS and
  // Android, so sharing is one tap away from actually landing in the
  // gallery. canShareFiles() checks whether that's available at all;
  // shareFiles() opens the sheet with the given photos already attached.
  canShareFiles(files) {
    return !!(navigator.share && navigator.canShare && navigator.canShare({ files }));
  },

  async shareFiles(files, { title } = {}) {
    if (!this.canShareFiles(files)) {
      throw new Error("Sharing isn't supported on this browser");
    }
    await navigator.share({ files, title });
  },

  pickPhotos(onFiles) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      if (input.files && input.files.length) onFiles(Array.from(input.files));
      input.remove();
    });
    input.click();
  },

  pickFile(accept, onFile) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) onFile(input.files[0]);
      input.remove();
    });
    input.click();
  },
};
