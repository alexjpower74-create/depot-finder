// map.js — Leaflet 1.9.4 (cdnjs) with OpenStreetMap tiles. Attribution kept.
const NL_BOUNDS = [[46.6, -59.5], [60.4, -52.5]];

export function createMap(el) {
  const L = window.L;
  if (!L) return null;
  const map = L.map(el, { zoomControl: true, attributionControl: true, tap: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.fitBounds(NL_BOUNDS, { padding: [10, 10] });
  const layer = L.layerGroup().addTo(map);
  const icon = L.divIcon({ className: 'depot-pin', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -12] });
  const markers = new Map();

  return {
    map,
    setDepots(depots, onPick) {
      layer.clearLayers();
      markers.clear();
      for (const d of depots) {
        if (typeof d.lat !== 'number' || typeof d.lng !== 'number') continue;
        const m = L.marker([d.lat, d.lng], { icon, title: d.name, alt: d.name });
        m.bindPopup(`<strong>${esc(d.name)}</strong><br>${esc(d.town || '')}<br><a href="#/depot/${esc(d.id)}">Open depot page</a>`);
        m.on('click', () => onPick && onPick(d));
        m.addTo(layer);
        markers.set(d.id, m);
      }
    },
    focus(depot) {
      const m = markers.get(depot.id);
      if (m) { map.setView(m.getLatLng(), Math.max(map.getZoom(), 11)); m.openPopup(); }
    },
    fitAll(depots) {
      const pts = depots.filter((d) => typeof d.lat === 'number').map((d) => [d.lat, d.lng]);
      if (pts.length) map.fitBounds(pts, { padding: [24, 24], maxZoom: 12 }); else map.fitBounds(NL_BOUNDS);
    },
    invalidate() { setTimeout(() => map.invalidateSize(), 0); },
  };
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
