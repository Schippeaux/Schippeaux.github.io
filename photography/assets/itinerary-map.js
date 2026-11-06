// Itinerary overview map: a dot per place stayed, hover for which day(s)/date(s) and what
// happened there, plus a dashed arc for the one flight in the trip (Portland -> Chicago).
// Looks for a <script type="application/json" id="itinerary-data"> holding
// {markers:[{lat,lon,place,entries:[{day,weekday,date,activities}]}], flight?}.
// No-op (and loads nothing) if that tag is absent - same pattern as assets/map.js.
(() => {
  const dataEl = document.getElementById('itinerary-data');
  if (!dataEl) return;
  let data;
  try { data = JSON.parse(dataEl.textContent); } catch { return; }
  if (!data || !data.markers || !data.markers.length) return;

  const mapEl = document.getElementById('itinerary-map');
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

  const WEEKDAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
  function fmtDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${MONTHS[m - 1]}`;
  }

  // A gentle quadratic-bezier bulge between two points, in plain lat/lon space - not a true
  // geodesic, just enough curve to read as a flight path rather than a drawn straight line.
  function arcPoints([lat1, lon1], [lat2, lon2], bulge = 0.15, steps = 48) {
    const vLat = lat2 - lat1, vLon = lon2 - lon1;
    const dist = Math.hypot(vLat, vLon) || 1;
    const ctrlLat = (lat1 + lat2) / 2 + (vLon / dist) * dist * bulge;
    const ctrlLon = (lon1 + lon2) / 2 - (vLat / dist) * dist * bulge;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      pts.push([
        u * u * lat1 + 2 * u * t * ctrlLat + t * t * lat2,
        u * u * lon1 + 2 * u * t * ctrlLon + t * t * lon2,
      ]);
    }
    return pts;
  }

  Promise.all([loadCss(LEAFLET_CSS), loadJs(LEAFLET_JS)]).then(() => {
    if (!window.L) return;
    const L = window.L;
    const map = L.map(mapEl, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(map);

    const DOT = '#f2a33c', FLIGHT = '#8ec6e6';
    const bounds = [];

    data.markers.forEach(m => {
      const multi = m.entries.length > 1;
      const dayLabel = multi ? `Days ${m.entries[0].day}–${m.entries[m.entries.length - 1].day}` : `Day ${m.entries[0].day}`;
      const lines = m.entries.map(e =>
        `<div class="it-tip-day"><b>${WEEKDAY_SHORT[e.weekday] || e.weekday} ${fmtDate(e.date)}</b>${e.activities ? ` — ${e.activities}` : ''}</div>`
      ).join('');
      const tip = `<div class="it-tip"><div class="it-tip-place">${m.place}</div><div class="it-tip-range">${dayLabel}</div>${lines}</div>`;
      L.circleMarker([m.lat, m.lon], {
        radius: multi ? 7 : 5.5, color: '#fff', weight: multi ? 2 : 1.5,
        fillColor: DOT, fillOpacity: 1, opacity: 1,
      }).bindTooltip(tip, { direction: 'top', offset: [0, -6], className: 'it-tooltip' }).addTo(map);
      bounds.push([m.lat, m.lon]);
    });

    if (data.flight) {
      const pts = arcPoints(data.flight.from, data.flight.to);
      L.polyline(pts, { color: FLIGHT, weight: 2, opacity: 0.9, dashArray: '2 8' }).addTo(map);
      const mid = pts[Math.floor(pts.length / 2)];
      L.marker(mid, {
        icon: L.divIcon({ className: 'it-flight-label', html: `✈ ${data.flight.from_label} → ${data.flight.to_label}`, iconSize: null }),
        interactive: false,
      }).addTo(map);
      bounds.push(data.flight.from, data.flight.to);
    }

    if (bounds.length === 1) map.setView(bounds[0], 9);
    else map.fitBounds(bounds, { padding: [28, 28] });
  });
})();
