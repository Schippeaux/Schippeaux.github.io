// Snaggo — camera + dictation handling
//
// Photos use a plain file input with capture="environment": this opens the
// OS camera sheet on phones/tablets and needs no special browser permission
// or secure-context dance. It works even if the app were opened as a local
// file.
//
// Audio recording uses MediaRecorder + getUserMedia, which browsers only
// allow on a secure context (https:// or http://localhost). That's the
// one reason Snaggo needs to be hosted over HTTPS rather than opened as a
// bare file — nothing about the recorded audio itself goes anywhere online.

const Media = {
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

  // --- Dictation recorder ---------------------------------------------
  // Usage:
  //   const rec = Media.createRecorder();
  //   await rec.start();      // begins recording, throws if mic denied/unsupported
  //   const { blob, mimeType } = await rec.stop();
  createRecorder() {
    let mediaRecorder = null;
    let stream = null;
    let chunks = [];

    return {
      async start() {
        if (!window.isSecureContext) {
          throw new Error(
            'Dictation needs the app to be loaded over HTTPS (or localhost). ' +
              'Open Snaggo via its hosted URL rather than as a local file.'
          );
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunks = [];
        mediaRecorder.addEventListener('dataavailable', (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        });
        mediaRecorder.start();
      },
      stop() {
        return new Promise((resolve) => {
          mediaRecorder.addEventListener(
            'stop',
            () => {
              const mimeType = mediaRecorder.mimeType || 'audio/webm';
              const blob = new Blob(chunks, { type: mimeType });
              stream.getTracks().forEach((t) => t.stop());
              resolve({ blob, mimeType });
            },
            { once: true }
          );
          mediaRecorder.stop();
        });
      },
      isRecording() {
        return !!mediaRecorder && mediaRecorder.state === 'recording';
      },
    };
  },
};
