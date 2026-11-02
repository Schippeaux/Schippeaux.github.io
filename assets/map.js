// Chapter route map. Looks for a <script type="application/json" id="route-data"> holding
// the cumulative points/tracks up to and including the current chapter; draws them on a
// Leaflet map styled to match the site. No-op (and loads nothing) if that tag is absent.
(() => {
  const dataEl = document.getElementById('route-data');
  if (!dataEl) return;
  let data;
  try { data = JSON.parse(dataEl.textContent); } catch { return; }
  if (!data || !data.points || !data.points.length) return;

  const mapEl = document.getElementById('chapter-map');
  if (!mapEl) return;

  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  function loadCss(href) {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = href;
      link.onload = resolve; link.onerror = resolve;
      document.head.append(link);
    });
  }
  function loadJs(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.append(s);
    });
  }

  Promise.all([loadCss(LEAFLET_CSS), loadJs(LEAFLET_JS)]).then(() => {
    if (!window.L) return;
    const L = window.L;
    const map = L.map(mapEl, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Standard OpenStreetMap tiles (no API key needed), inverted to a dark theme via CSS
    // (see .chapter-map .leaflet-tile-pane in style.css) rather than a keyed dark-tile provider.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(map);

    // Muted brown-gray for everything travelled so far, a deep accent for the leg/point this
    // chapter just added - so the map reads as "the route so far, with where we are now".
    // A "driven" segment (a lift in a car, not cycled) always renders flat grey and dashed,
    // regardless of how recent it is - it should read as "not ridden", not "freshest leg".
    const OLD = '#6b6459', LATEST = '#9c3b2e', DRIVEN = '#8c8c8c';
    const bounds = [];
    const lastTrackIdx = (data.tracks || []).length - 1;
    (data.tracks || []).forEach((t, i) => {
      if (!t.coords || t.coords.length < 2) return;
      const latest = i === lastTrackIdx;
      const driven = t.precision === 'driven';
      L.polyline(t.coords, {
        color: driven ? DRIVEN : (latest ? LATEST : OLD),
        weight: driven ? 2.5 : (latest ? 3.5 : 2),
        opacity: driven ? 0.7 : (t.precision === 'approx' ? (latest ? 0.75 : 0.4) : (latest ? 0.92 : 0.55)),
        dashArray: driven ? '4 6' : (t.precision === 'approx' ? '2 7' : null),
      }).addTo(map);
      t.coords.forEach((c) => bounds.push(c));
    });

    const lastIdx = data.points.length - 1;
    data.points.forEach((p, i) => {
      const latest = i === lastIdx;
      L.circleMarker([p.lat, p.lon], {
        radius: latest ? 6.5 : 3,
        color: latest ? '#fff' : OLD,
        fillColor: latest ? LATEST : OLD,
        fillOpacity: latest ? 1 : 0.65,
        weight: latest ? 2 : 1,
        opacity: 1,
      }).bindTooltip(p.name, { direction: 'top', offset: [0, -4] }).addTo(map);
      bounds.push([p.lat, p.lon]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 9);
    } else {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  });
})();
