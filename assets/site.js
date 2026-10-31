// Fade images in once loaded
document.querySelectorAll('img').forEach(img => {
  const show = () => img.classList.add('loaded');
  if (img.complete && img.naturalWidth) show();
  else img.addEventListener('load', show);
});

// Lightbox for chapter sequences
const photos = [...document.querySelectorAll('.sequence img[data-index]')];
if (photos.length) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = '<img alt=""><button class="close">Close</button>' +
    '<button class="prev">Prev</button><button class="next">Next</button><span class="counter"></span>';
  document.body.append(box);
  const big = box.querySelector('img');
  const counter = box.querySelector('.counter');
  let current = 0;

  const show = i => {
    current = (i + photos.length) % photos.length;
    big.classList.remove('loaded');
    big.src = photos[current].currentSrc.replace(/=w\d+$/, '=w2800');
    counter.textContent = `${current + 1} / ${photos.length}`;
  };
  big.addEventListener('load', () => big.classList.add('loaded'));
  const open = i => { show(i); box.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { box.classList.remove('open'); document.body.style.overflow = ''; };

  photos.forEach((p, i) => p.addEventListener('click', () => open(i)));
  box.querySelector('.close').addEventListener('click', close);
  box.querySelector('.prev').addEventListener('click', e => { e.stopPropagation(); show(current - 1); });
  box.querySelector('.next').addEventListener('click', e => { e.stopPropagation(); show(current + 1); });
  box.addEventListener('click', e => { if (e.target === box || e.target === big) close(); });
  document.addEventListener('keydown', e => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  let startX = null;
  box.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    startX = null;
  });
}
