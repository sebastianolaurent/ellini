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

function initMapLibreMap() {
  if (!mapContainer || typeof maplibregl === 'undefined') {
    showMapMessage('Mappa non disponibile al momento. Usa il pulsante "Apri su Mappe".');
    return;
  }

  mapContainer.innerHTML = '';

  const map = new maplibregl.Map({
    container: 'wedding-map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [MAP_COORDS.lon, MAP_COORDS.lat],
    zoom: 14.8,
    attributionControl: true
  });

  map.scrollZoom.disable();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  const popup = new maplibregl.Popup({ offset: 20 }).setText(MAP_LABEL);

  new maplibregl.Marker({ color: '#8b6f4e' })
    .setLngLat([MAP_COORDS.lon, MAP_COORDS.lat])
    .setPopup(popup)
    .addTo(map);
}

function initAppleMap() {
  if (!mapContainer || typeof mapkit === 'undefined' || !window.MAPKIT_JWT) {
    return false;
  }

  const payload = parseJwtPayload(window.MAPKIT_JWT);
  if (!payload) {
    return false;
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    return false;
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
    console.warn('Apple Maps non disponibile, fallback MapLibre:', error);
    return false;
  }
}

function hasMapRendering() {
  if (!mapContainer) return false;
  return Boolean(mapContainer.querySelector('canvas, img, .maplibregl-canvas'));
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
    initMapLibreMap();
    return;
  }

  window.setTimeout(() => {
    if (!hasMapRendering()) {
      mapContainer.innerHTML = '';
      initMapLibreMap();
    }
  }, 3000);
});
