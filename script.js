const copyButton = document.getElementById('copy-iban');
const ibanText = document.getElementById('iban-text');
const feedback = document.getElementById('copy-feedback');
const mapContainer = document.getElementById('wedding-map');
const openMapsButton = document.getElementById('open-maps');
const MAP_COORDS = { lat: 41.8885649, lon: 12.461585 };
const MAP_LABEL = 'Villa Aurelia, Largo di Porta San Pancrazio, Roma';

function showMapMessage(message) {
  if (!mapContainer) return;
  mapContainer.innerHTML = `<p class="map-fallback">${message}</p>`;
}

function parseJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (_) {
    return null;
  }
}

function getPreferredMapsUrl(lat, lon, label) {
  const encodedLabel = encodeURIComponent(label);
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua);

  if (isIOS || isMac) {
    return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodedLabel}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

function initLeafletMap() {
  if (!mapContainer || typeof L === 'undefined') {
    showMapMessage('Mappa non disponibile al momento. Usa il pulsante "Apri su Mappe".');
    return;
  }

  mapContainer.innerHTML = '';
  const coords = [MAP_COORDS.lat, MAP_COORDS.lon];
  const map = L.map('wedding-map', { scrollWheelZoom: false }).setView(coords, 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.marker(coords).addTo(map).bindPopup(MAP_LABEL);
}

function initAppleMap() {
  if (!mapContainer) {
    return false;
  }
  if (typeof mapkit === 'undefined') {
    showMapMessage('SDK Apple MapKit non caricato. Controlla connessione o ad blocker.');
    return false;
  }
  if (!window.MAPKIT_JWT) {
    showMapMessage('Token MapKit mancante (config.js).');
    return false;
  }

  const payload = parseJwtPayload(window.MAPKIT_JWT);
  if (!payload) {
    showMapMessage('Token MapKit non valido (JWT malformato).');
    return false;
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    showMapMessage('Token MapKit scaduto. Rigeneralo su Apple Developer.');
    return false;
  }
  if (!payload.origin) {
    console.warn('JWT MapKit senza claim origin: su alcuni setup Apple Maps rifiuta il token.');
  }

  try {
    mapkit.init({
      authorizationCallback(done) {
        done(window.MAPKIT_JWT);
      }
    });

    const center = new mapkit.Coordinate(MAP_COORDS.lat, MAP_COORDS.lon);
    const map = new mapkit.Map('wedding-map', {
      center,
      isRotationEnabled: false,
      isZoomEnabled: true,
      showsCompass: mapkit.FeatureVisibility.Hidden,
      showsMapTypeControl: false
    });

    map.region = new mapkit.CoordinateRegion(
      center,
      new mapkit.CoordinateSpan(0.015, 0.02)
    );

    map.addAnnotation(new mapkit.MarkerAnnotation(center, { title: MAP_LABEL }));
    return true;
  } catch (error) {
    const msg = error && error.message ? error.message : 'Errore sconosciuto MapKit';
    showMapMessage(`Apple Maps non autorizzata: ${msg}`);
    console.warn('Apple Maps non disponibile, fallback Leaflet:', error);
    return false;
  }
}

function hasMapRendering() {
  if (!mapContainer) return false;
  return Boolean(mapContainer.querySelector('canvas, img, .leaflet-pane'));
}

if (copyButton && ibanText && feedback) {
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ibanText.textContent.trim());
      feedback.textContent = 'IBAN copiato negli appunti.';
    } catch (error) {
      feedback.textContent = "Copia non riuscita. Seleziona e copia manualmente l'IBAN.";
    }
  });
}

if (openMapsButton) {
  openMapsButton.addEventListener('click', (event) => {
    event.preventDefault();
    const { lat, lon, label } = openMapsButton.dataset;
    const targetUrl = getPreferredMapsUrl(lat, lon, label || 'Destinazione');
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  if (!initAppleMap()) {
    initLeafletMap();
    return;
  }

  window.setTimeout(() => {
    if (!hasMapRendering()) {
      mapContainer.innerHTML = '';
      initLeafletMap();
    }
  }, 3500);
});
