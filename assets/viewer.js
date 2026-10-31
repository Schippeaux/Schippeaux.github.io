// Slideshow with filmstrip: one large photo, faint side arrows, thumbnail reel below.
// Shared by the public chapter pages and the editor.
(() => {
  const WIDTHS = [800, 1400, 2000, 2800];
  // Photo host: the Cloudflare cache when configured (data/site.json "image_base"), else Drive
  const meta = document.querySelector('meta[name="image-base"]');
  const url = (id, size) => `${Viewer.imageBase}/${id}=${size}`;

  class Viewer {
    constructor(root, photos, opts = {}) {
      this.root = root;
      this.opts = opts;
      this.index = 0;
      root.innerHTML = `
        <div class="stage">
          <button class="arrow prev" aria-label="Previous photo"><span>‹</span></button>
          <div class="frame">
            <img class="main" alt="">
            <div class="desc" hidden><p></p></div>
          </div>
          <button class="arrow next" aria-label="Next photo"><span>›</span></button>
        </div>
        <div class="reel" role="list"></div>`;
      this.stage = root.querySelector('.stage');
      this.img = root.querySelector('.main');
      this.desc = root.querySelector('.desc');
      this.reel = root.querySelector('.reel');

      root.querySelector('.prev').addEventListener('click', () => this.show(this.index - 1));
      root.querySelector('.next').addEventListener('click', () => this.show(this.index + 1));
      this.img.addEventListener('load', () => this.img.classList.add('loaded'));
      this.desc.addEventListener('click', () => this.desc.classList.toggle('open'));
      this.reel.addEventListener('click', e => {
        const t = e.target.closest('.thumb');
        if (t) this.show([...this.reel.children].indexOf(t));
      });
      document.addEventListener('keydown', e => {
        if (e.target.closest('input, textarea, select, [contenteditable]')) return;
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
        this.img.srcset = WIDTHS.map(w => `${url(p.id, 'w' + w)} ${w}w`).join(', ');
        this.img.sizes = '(max-width: 700px) 100vw, 80vw';
        this.img.src = url(p.id, 'w2000');
        // Warm the neighbours so arrowing feels instant
        for (const n of [i + 1, i - 1]) {
          const q = this.photos[(n + this.photos.length) % this.photos.length];
          if (q) new Image().src = url(q.id, 'w2000');
        }
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

    // Re-apply description and any thumbnail decorations (editor badges) without reloading
    refresh() {
      const p = this.current;
      const text = (p && p.desc || '').trim();
      this.desc.hidden = !text;
      this.desc.classList.remove('open');
      this.desc.querySelector('p').textContent = text;
      if (this.opts.decorateThumb) {
        [...this.reel.children].forEach((t, n) => this.opts.decorateThumb(t, this.photos[n]));
      }
    }
  }

  Viewer.imageBase = (meta && meta.content || 'https://lh3.googleusercontent.com/d').replace(/\/$/, '');
  Viewer.url = url;
  window.Viewer = Viewer;
})();
