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

  // --- Live speech-to-text (the phone's own dictation engine) -----------
  // Same idea as the keyboard's mic button, just reachable from one record
  // button instead of tap field → open keyboard → tap mic. Backed by the
  // browser's SpeechRecognition API, which on a phone is the OS's own
  // on-device/cloud dictation — same engine, different entry point.
  //
  // Support varies: solid on Android Chrome, present but patchier on iOS
  // Safari (stops after a pause, ~60s cap on some versions). isSupported()
  // lets callers fall back to "just record the audio" gracefully.
  isSpeechRecognitionSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  createLiveTranscriber() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-AU';

    let finalText = '';
    let active = false;
    let onInterim = null;
    let onErrorCb = null;
    let sawResult = false;
    let lastError = null;

    recognition.addEventListener('result', (e) => {
      sawResult = true;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          finalText += (finalText ? ' ' : '') + res[0].transcript.trim();
        } else {
          interim += res[0].transcript;
        }
      }
      if (onInterim) onInterim(finalText, interim);
    });

    recognition.addEventListener('end', () => {
      // Mobile browsers often end recognition after a short pause even
      // though the person hasn't hit stop — restart quietly if we're
      // still meant to be listening.
      if (active) {
        try {
          recognition.start();
        } catch (e) {
          /* already running */
        }
      }
    });

    recognition.addEventListener('error', (e) => {
      // 'no-speech' fires routinely on any gap in talking — not a real
      // error, the 'end' handler just restarts listening. Everything
      // else (not-allowed, network, audio-capture, service-not-allowed...)
      // means it's genuinely not going to produce a transcript, so record
      // it to surface to the person instead of just going quiet.
      if (e.error !== 'no-speech') {
        lastError = e.error;
        if (onErrorCb) onErrorCb(e.error);
      }
    });

    return {
      start(onInterimUpdate, onError) {
        onInterim = onInterimUpdate || null;
        onErrorCb = onError || null;
        finalText = '';
        sawResult = false;
        lastError = null;
        active = true;
        try {
          recognition.start();
        } catch (e) {
          /* ignore double-start */
        }
      },
      stop() {
        active = false;
        try {
          recognition.stop();
        } catch (e) {
          /* ignore */
        }
        return { text: finalText.trim(), sawResult, lastError };
      },
    };
  },
};
