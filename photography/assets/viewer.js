// Slideshow with filmstrip: one large photo, faint side arrows, thumbnail reel below.
// Shared by the public chapter pages and the editor.
(() => {
  const WIDTHS = [800, 1400, 2000, 2800];
  const SIZES = '(max-width: 700px) 100vw, 80vw';
  // Photo host: the Cloudflare cache when configured (data/site.json "image_base"), else Drive
  const meta = document.querySelector('meta[name="image-base"]');
  const url = (id, size) => `${Viewer.imageBase}/${id}=${size}`;
  const srcsetFor = p => WIDTHS.map(w => `${url(p.id, 'w' + w)} ${w}w`).join(', ');
  // How many photos ahead/behind to keep warm. Forward browsing is far more common than back,
  // so look further ahead than behind.
  const PREFETCH_AHEAD = 2, PREFETCH_BEHIND = 1;

  // Crop rendering: a photo.crop = {x,y,w,h} (fractions 0-1 of the full image) is rendered
  // without any backend reprocessing by stretch-filling that rectangle into a container sized
  // to exactly the crop rectangle's own aspect ratio - the crop rect's edges map exactly onto
  // the container's edges, with no distortion since the container's aspect ratio was derived
  // from the crop itself. Two container shapes:
  //  - "fill" mode (cover-style contexts: hero/thumbnail covers, best-of slideshow): the
  //    container always fills 100%/100% of its box (a plain CSS percentage, independent of
  //    content), cropping further if the box's own aspect ratio doesn't match the crop's -
  //    same as object-fit:cover would for the whole photo.
  //  - "contain" mode (the ordinary free-aspect viewer/lightbox): the container should
  //    letterbox within the frame exactly as object-fit:contain does for a whole photo, using
  //    the crop's aspect ratio instead of the photo's. CSS aspect-ratio + max-width/max-height
  //    can't do this on its own here - the wrapper's only content is the absolutely-positioned
  //    (out-of-flow) <img>, so it has no in-flow content to size against, and both Chromium's
  //    flex and grid auto-sizing resolve that to a 0x0 box rather than consulting
  //    aspect-ratio. So this is measured in JS instead (see Viewer#layoutCrop), the same way
  //    layoutDesc() measures the frame for the description box.
  const cropImgStyle = c => `position:absolute;max-width:none;` +
    `width:calc(100%/${c.w});height:calc(100%/${c.h});` +
    `left:calc(-100%*${c.x}/${c.w});top:calc(-100%*${c.y}/${c.h})`;

  // Apply/clear crop styling on a live <img> + its positioning-span wrapper. In fill mode this
  // alone is enough (percentage sizing, independent of frame measurement); contain mode also
  // needs layoutCrop() to size the wrapper from the frame's actual pixel box.
  function applyCrop(img, wrap, photo, fill) {
    if (!wrap) return;
    if (photo && photo.crop) {
      img.style.cssText = cropImgStyle(photo.crop);
      wrap.style.cssText = fill
        ? 'position:relative;width:100%;height:100%;overflow:hidden;display:block'
        : 'position:relative;overflow:hidden;display:block;margin:auto';
    } else {
      img.style.cssText = '';
      // Fill-mode contexts need the wrapper to keep filling its box even with no crop set
      // (it's standing in for the plain <img> that normal CSS, e.g. object-fit:cover, sizes);
      // contain-mode contexts just clear back to a plain unstyled span around the <img>.
      wrap.style.cssText = fill ? 'position:relative;width:100%;height:100%;display:block' : '';
    }
  }

  // Wrap an already-built `<img ...>` HTML string in a crop-positioning span when the photo
  // has a crop rectangle; otherwise return it unchanged. Used for hand-built thumbnail markup
  // (editor home/chapter covers etc.) that doesn't go through the Viewer class.
  function cropWrap(photo, imgHtml) {
    if (!photo || !photo.crop) return imgHtml;
    const styled = imgHtml.replace('<img ', `<img style="${cropImgStyle(photo.crop)}" `);
    return `<span class="crop">${styled}</span>`;
  }

  class Viewer {
    constructor(root, photos, opts = {}) {
      this.root = root;
      this.opts = opts;
      this.index = 0;
      // The main image is always wrapped in a positioning span so a per-photo crop rectangle
      // can be rendered (see applyCrop above). With no crop set, the wrapper is styled to be
      // a no-op passthrough, so this changes nothing when a photo has no crop.
      root.innerHTML = `
        <div class="stage">
          <button class="arrow prev" aria-label="Previous photo"><span>‹</span></button>
          <div class="frame">
            <span class="crop-main"><img class="main" alt=""></span>
            <div class="desc" hidden><p></p><button class="desc-toggle" aria-label="Hide description">−</button></div>
          </div>
          <button class="arrow next" aria-label="Next photo"><span>›</span></button>
        </div>
        <div class="reel" role="list"></div>`;
      this.stage = root.querySelector('.stage');
      this.frame = root.querySelector('.frame');
      this.img = root.querySelector('.main');
      this.cropWrapEl = root.querySelector('.crop-main');
      this.desc = root.querySelector('.desc');
      this.reel = root.querySelector('.reel');

      root.querySelector('.prev').addEventListener('click', () => this.show(this.index - 1));
      root.querySelector('.next').addEventListener('click', () => this.show(this.index + 1));
      this.img.addEventListener('load', () => this.img.classList.add('loaded'));
      // Click the photo to go fullscreen (chrome hidden, filmstrip tucked off the bottom
      // edge - hover or touch its sliver to bring it up); click again to exit. Off by default
      // for the editor, which needs its own chrome on screen while editing.
      if (opts.fullscreenClick !== false) {
        this.frame.addEventListener('click', e => {
          if (e.target.closest('.desc')) return;
          document.body.classList.toggle('fullscreen');
        });
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && document.body.classList.contains('fullscreen')) {
            document.body.classList.remove('fullscreen');
          }
        });
      }
      // − / + minimises the description; the choice sticks while browsing and between visits
      try { this.descMin = localStorage.getItem('desc-min') === '1'; } catch { this.descMin = false; }
      this.desc.querySelector('.desc-toggle').addEventListener('click', e => {
        e.stopPropagation();
        this.descMin = !this.descMin;
        try { localStorage.setItem('desc-min', this.descMin ? '1' : ''); } catch {}
        this.layoutDesc();
      });
      window.addEventListener('resize', () => { this.layoutDesc(); this.layoutCrop(); });
      // Reusable <link rel=preload> elements: imagesrcset/imagesizes let the browser resolve
      // the same width it would actually pick for the <img>, so the cache warm-up can't miss
      // the real request the way a single fixed-width Image() guess can.
      this.preloadLinks = Array.from({ length: PREFETCH_AHEAD + PREFETCH_BEHIND }, () => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.imageSizes = SIZES;
        document.head.append(link);
        return link;
      });
      this.reel.addEventListener('click', e => {
        const t = e.target.closest('.thumb');
        if (!t) return;
        const i = [...this.reel.children].indexOf(t);
        // The editor can take over clicks (e.g. Ctrl/Shift-click to select) by returning false
        if (this.opts.onThumbClick && this.opts.onThumbClick(e, i) === false) return;
        this.show(i);
      });
      document.addEventListener('keydown', e => {
        if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
        if (!this.root.offsetParent) return;  // viewer not on screen (e.g. editor on another page)
        if (e.key === 'ArrowLeft') this.show(this.index - 1);
        if (e.key === 'ArrowRight') this.show(this.index + 1);
      });
      let startX = null;
      this.stage.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
      this.stage.addEventListener('touchend', e => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) this.show(this.index + (dx < 0 ? 1 : -1));
        startX = null;
      });

      // Autoplay (for a decorative header slideshow, not the main chapter viewer): advances
      // every opts.autoplay ms, pauses on hover, and resets its timer after manual navigation.
      if (opts.autoplay) {
        let timer;
        const tick = () => { timer = setTimeout(() => { this.show(this.index + 1); tick(); }, opts.autoplay); };
        const restart = () => { clearTimeout(timer); tick(); };
        tick();
        root.addEventListener('mouseenter', () => clearTimeout(timer));
        root.addEventListener('mouseleave', restart);
        root.querySelector('.prev').addEventListener('click', restart);
        root.querySelector('.next').addEventListener('click', restart);
      }

      const start = opts.hash ? parseInt(location.hash.slice(1), 10) - 1 : 0;
      this.setPhotos(photos, null, Number.isFinite(start) ? start : 0);
    }

    get current() { return this.photos[this.index]; }

    setPhotos(photos, keepId = null, startIndex = this.index) {
      this.photos = photos;
      this.reel.innerHTML = '';
      for (const p of photos) {
        const b = document.createElement('button');
        b.className = 'thumb';
        b.dataset.id = p.id;
        b.setAttribute('role', 'listitem');
        b.innerHTML = `<img src="${url(p.id, 'h240')}" alt="" loading="lazy" style="aspect-ratio:${p.w}/${p.h}">`;
        b.firstChild.addEventListener('load', e => e.target.classList.add('loaded'));
        this.reel.append(b);
      }
      const keep = keepId ? photos.findIndex(p => p.id === keepId) : -1;
      this.show(keep >= 0 ? keep : startIndex, true);
    }

    show(i, force = false) {
      if (!this.photos.length) {
        this.img.removeAttribute('src');
        this.img.removeAttribute('srcset');
        this.desc.hidden = true;
        return;
      }
      i = (i + this.photos.length) % this.photos.length;
      const changed = force || i !== this.index || !this.img.getAttribute('src');
      this.index = i;
      const p = this.current;
      if (changed && this.img.dataset.id !== p.id) {
        this.img.classList.remove('loaded');
        this.img.dataset.id = p.id;
        this.img.width = p.w;
        this.img.height = p.h;
        this.img.srcset = srcsetFor(p);
        this.img.sizes = SIZES;
        this.img.src = url(p.id, 'w2000');
        applyCrop(this.img, this.cropWrapEl, p, !!this.opts.cropFill);
        this.layoutCrop();
        // Warm the next few neighbours (more ahead than behind) at the exact same
        // srcset/sizes as the real <img>, so whichever width the browser picks on
        // arrival is already cached.
        const offsets = [];
        for (let k = 1; k <= PREFETCH_AHEAD; k++) offsets.push(k);
        for (let k = 1; k <= PREFETCH_BEHIND; k++) offsets.push(-k);
        offsets.forEach((n, slot) => {
          const q = this.photos[(i + n + this.photos.length) % this.photos.length];
          const link = this.preloadLinks[slot];
          if (q && link) link.imageSrcset = srcsetFor(q);
        });
      }
      [...this.reel.children].forEach((t, n) => t.classList.toggle('active', n === i));
      const active = this.reel.children[i];
      if (active) {
        // Scroll only the reel (scrollIntoView would also scroll the page)
        const left = active.offsetLeft - (this.reel.clientWidth - active.offsetWidth) / 2;
        this.reel.scrollTo({ left, behavior: 'smooth' });
      }
      this.refresh();
      if (this.opts.hash) history.replaceState(null, '', `#${i + 1}`);
      if (this.opts.onShow) this.opts.onShow(i, p);
    }

    // Re-apply crop to the currently-shown photo without reloading its image - for when the
    // editor changes photo.crop on the photo already on screen (show()'s image-reload guard
    // skips re-applying crop since the photo id itself hasn't changed).
    refreshCrop() {
      applyCrop(this.img, this.cropWrapEl, this.current, !!this.opts.cropFill);
      this.layoutCrop();
    }

    // Re-apply description and any thumbnail decorations (editor badges) without reloading
    refresh() {
      const p = this.current;
      const text = (p && p.desc || '').trim();
      this.desc.hidden = !text;
      this.desc.querySelector('p').textContent = text;
      this.layoutDesc();
      if (this.opts.decorateThumb) {
        [...this.reel.children].forEach((t, n) => this.opts.decorateThumb(t, this.photos[n]));
      }
    }
  }

  // Size the description box: the full text on at most two lines, growing leftwards
  // from the bottom-right corner. Text too long for two lines at full photo width wraps further.
  Viewer.prototype.layoutDesc = function () {
    const box = this.desc, p = box.querySelector('p'), btn = box.querySelector('.desc-toggle');
    box.classList.toggle('min', this.descMin);
    btn.textContent = this.descMin ? '+' : '−';
    btn.setAttribute('aria-label', this.descMin ? 'Show description' : 'Hide description');
    box.style.width = '';
    if (box.hidden || this.descMin) return;
    const frameW = box.parentElement.clientWidth;
    if (!frameW) return;
    p.style.whiteSpace = 'nowrap';
    const oneLine = p.scrollWidth;
    p.style.whiteSpace = '';
    const chrome = box.offsetWidth - p.clientWidth;  // padding + button
    const maxW = Math.max(160, frameW - 24);
    const textW = oneLine <= 340 ? oneLine : Math.ceil(oneLine / 2) + 30;  // slack for word breaks
    box.style.width = `${Math.min(textW + chrome + 2, maxW)}px`;
  };

  // Contain-mode crop sizing: measure the frame's actual pixel box and size the crop wrapper
  // to the largest box with the crop's aspect ratio that still fits inside it (mirroring what
  // object-fit:contain would do natively for a whole photo). No-op in fill mode (pure CSS
  // percentages there, already correct) or when the current photo has no crop.
  Viewer.prototype.layoutCrop = function () {
    const wrap = this.cropWrapEl, p = this.current;
    if (!wrap || this.opts.cropFill || !p || !p.crop) return;
    const fw = this.frame.clientWidth, fh = this.frame.clientHeight;
    if (!fw || !fh) return;
    const cw = p.w * p.crop.w, ch = p.h * p.crop.h;
    const scale = Math.min(fw / cw, fh / ch);
    wrap.style.width = `${cw * scale}px`;
    wrap.style.height = `${ch * scale}px`;
  };

  Viewer.imageBase =(meta && meta.content || 'https://lh3.googleusercontent.com/d').replace(/\/$/, '');
  Viewer.url = url;
  Viewer.cropWrap = cropWrap;
  window.Viewer = Viewer;
})();
