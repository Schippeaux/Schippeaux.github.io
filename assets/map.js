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

    // Bold brick red for everything travelled so far, a vivid amber for the leg this chapter
    // just added - so the current leg really stands out against the accumulated route behind it.
    // A "driven" segment (a lift in a car, not cycled) always renders flat grey and dashed,
    // regardless of how recent it is - it should read as "not ridden", not "freshest leg".
    const OLD = '#a8402c', LATEST = '#f2a33c', DRIVEN = '#8c8c8c';
    const bounds = [];
    const lastTrackIdx = (data.tracks || []).length - 1;
    (data.tracks || []).forEach((t, i) => {
      if (!t.coords || t.coords.length < 2) return;
      const latest = i === lastTrackIdx;
      const driven = t.precision === 'driven';
      L.polyline(t.coords, {
        color: driven ? DRIVEN : (latest ? LATEST : OLD),
        weight: driven ? 2.5 : (latest ? 5 : 3),
        opacity: driven ? 0.7 : (t.precision === 'approx' ? (latest ? 0.9 : 0.55) : (latest ? 1 : 0.85)),
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

    // A marker that tracks wherever the elevation/distance slider below is being scrubbed.
    // Hidden until the first hover/drag; always drawn above the trails.
    const scrubMarker = L.circleMarker([0, 0], {
      radius: 7, color: '#fff', weight: 2, fillColor: LATEST, fillOpacity: 0, opacity: 0,
    }).addTo(map);

    renderProfile(data, scrubMarker);
    renderStats(data);
  });

  // Elevation/distance slider for "this leg" (the current chapter's own cycled distance -
  // a driven/lifted stretch, if any, is skipped rather than shown as rideable ground; see
  // profile_gaps). Hover or drag scrubs a position dot that follows along on the map above.
  function renderProfile(data, scrubMarker) {
    const el = document.getElementById('route-profile');
    const profile = data.profile;
    if (!el || !profile || !profile.length) return;

    const W = 1000, H = 220, PAD_L = 44, PAD_R = 10, PAD_T = 14, PAD_B = 22;
    const dists = profile.map(p => p[0]), eles = profile.map(p => p[1]);
    const minD = dists[0], maxD = dists[dists.length - 1];
    const minE = Math.min(...eles), maxE = Math.max(...eles);
    const eleSpan = Math.max(1, maxE - minE);
    const padE = eleSpan * 0.12;
    const x = d => PAD_L + (d - minD) / (maxD - minD) * (W - PAD_L - PAD_R);
    const y = e => PAD_T + (1 - (e - (minE - padE)) / (eleSpan + padE * 2)) * (H - PAD_T - PAD_B);

    const linePts = profile.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
    const areaPts = `${x(minD).toFixed(1)},${y(minE - padE).toFixed(1)} ${linePts} ${x(maxD).toFixed(1)},${y(minE - padE).toFixed(1)}`;

    const gaps = data.profile_gaps || [];
    const gapLines = gaps.map(g => {
      const gx = x(g).toFixed(1);
      return `<line class="gap-line" x1="${gx}" y1="${PAD_T}" x2="${gx}" y2="${H - PAD_B}"/>` +
             `<text class="gap-label" x="${gx}" y="${PAD_T - 3}" text-anchor="middle">lift</text>`;
    }).join('');

    // A handful of elevation gridlines with labels, so the chart reads as a real profile
    // rather than an abstract squiggle.
    const GRID_LINES = 3;
    let grid = '';
    for (let i = 0; i <= GRID_LINES; i++) {
      const e = (minE - padE) + (eleSpan + padE * 2) * i / GRID_LINES;
      const gy = y(e).toFixed(1);
      grid += `<line class="grid-line" x1="${PAD_L}" y1="${gy}" x2="${W - PAD_R}" y2="${gy}"/>` +
              `<text class="grid-label" x="${PAD_L - 6}" y="${gy}" text-anchor="end" dominant-baseline="middle">${Math.round(e)}m</text>`;
    }

    el.innerHTML = `
      <svg class="profile-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--profile-fill-top)"/>
            <stop offset="100%" stop-color="var(--profile-fill-bottom)"/>
          </linearGradient>
        </defs>
        <g class="grid">${grid}</g>
        ${gapLines}
        <polygon class="profile-area" points="${areaPts}" fill="url(#profile-fill)"/>
        <polyline class="profile-line" points="${linePts}" fill="none"/>
        <g class="scrub" hidden>
          <line class="scrub-line" x1="0" y1="${PAD_T}" x2="0" y2="${H - PAD_B}"/>
          <circle class="scrub-dot" r="4.5" cy="0" cx="0"/>
        </g>
      </svg>
      <div class="profile-readout" hidden></div>`;

    const svg = el.querySelector('.profile-svg');
    const scrubG = el.querySelector('.scrub');
    const scrubLine = el.querySelector('.scrub-line');
    const scrubDot = el.querySelector('.scrub-dot');
    const readout = el.querySelector('.profile-readout');

    function nearest(distKm) {
      // profile is sorted by distance; binary search for the closest sample.
      let lo = 0, hi = profile.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (profile[mid][0] < distKm) lo = mid + 1; else hi = mid;
      }
      if (lo > 0 && Math.abs(profile[lo - 1][0] - distKm) < Math.abs(profile[lo][0] - distKm)) lo -= 1;
      return profile[lo];
    }

    function update(clientX) {
      const rect = svg.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetX = PAD_L + frac * (W - PAD_L - PAD_R);
      const targetD = minD + (targetX - PAD_L) / (W - PAD_L - PAD_R) * (maxD - minD);
      const p = nearest(targetD);
      const [d, e, lat, lon] = p;
      const px = x(d), py = y(e);
      scrubLine.setAttribute('x1', px); scrubLine.setAttribute('x2', px);
      scrubDot.setAttribute('cx', px); scrubDot.setAttribute('cy', py);
      scrubG.removeAttribute('hidden');
      readout.hidden = false;
      readout.textContent = `${d.toFixed(1)} km · ${Math.round(e)} m`;
      readout.style.left = `${(px / W) * 100}%`;
      scrubMarker.setLatLng([lat, lon]);
      scrubMarker.setStyle({ opacity: 1, fillOpacity: 1 });
    }
    function clear() {
      scrubG.setAttribute('hidden', '');
      readout.hidden = true;
      scrubMarker.setStyle({ opacity: 0, fillOpacity: 0 });
    }

    svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); update(e.clientX); });
    svg.addEventListener('pointermove', e => update(e.clientX));
    svg.addEventListener('pointerleave', clear);
    svg.addEventListener('pointerup', e => { try { svg.releasePointerCapture(e.pointerId); } catch {} });
  }

  function renderStats(data) {
    const el = document.getElementById('route-stats');
    const s = data.stats;
    if (!el || !s) return;
    const km = n => `${n.toFixed(1)} km`;
    const m = n => `${Math.round(n).toLocaleString()} m`;
    const cells = [
      ['This leg', km(s.leg_km)],
      ['Climbed', m(s.leg_gain_m)],
    ];
    if (s.total_km != null) cells.push(['Trip so far', km(s.total_km)]);
    if (s.total_gain_m != null) cells.push(['Climbed so far', m(s.total_gain_m)]);
    el.innerHTML = cells.map(([label, value]) =>
      `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`
    ).join('');
  }
})();
