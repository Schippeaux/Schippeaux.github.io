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
