// Fade images in once loaded
document.querySelectorAll('img').forEach(img => {
  const show = () => img.classList.add('loaded');
  if (img.complete && img.naturalWidth) show();
  else img.addEventListener('load', show);
});

// Chapter slideshow
const viewerRoot = document.getElementById('viewer');
const photoData = document.getElementById('photos');
if (viewerRoot && photoData) {
  new Viewer(viewerRoot, JSON.parse(photoData.textContent), { hash: true });
}

// Journey best-of slideshow (the hero at the top of a journey's contents page):
// auto-advancing, no filmstrip, no fullscreen-click - it's a header, not the main viewer.
const bestOfRoot = document.getElementById('best-of-viewer');
const bestOfData = document.getElementById('best-of-photos');
if (bestOfRoot && bestOfData) {
  new Viewer(bestOfRoot, JSON.parse(bestOfData.textContent), { fullscreenClick: false, autoplay: 5000, cropMain: true });
}
