const ibanText = document.getElementById('iban-text');
const feedback = document.getElementById('copy-feedback');
const mapContainer = document.getElementById('wedding-map');
const openMapsButton = document.getElementById('open-maps');
const MAP_COORDS = { lat: 44.7692730, lon: 9.3862814 };
const MAP_LABEL = 'Agriturismo Il Torrione del Trebbia, Bobbio (PC)';
const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let mapInstance = null;
let usesAppleMap = false;

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
  const isAndroid = /Android/i.test(ua);

  if (isAndroid) {
    if (lat && lon) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodedLabel}`;
  }

  if (lat && lon) {
    return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodedLabel}`;
  }

  return `https://maps.apple.com/?q=${encodedLabel}`;
}

function hydrateMapLinks() {
  const mapLinks = document.querySelectorAll('.js-map-link');
  mapLinks.forEach((link) => {
    const { lat, lon, label } = link.dataset;
    const targetUrl = getPreferredMapsUrl(lat, lon, label || 'Destinazione');
    link.setAttribute('href', targetUrl);
  });

  if (openMapsButton) {
    const { lat, lon, label } = openMapsButton.dataset;
    const targetUrl = getPreferredMapsUrl(lat, lon, label || 'Destinazione');
    openMapsButton.setAttribute('href', targetUrl);
  }
}

function normalizeIban(text) {
  return (text || '').replace(/\s+/g, '').trim();
}

function getIbanParts(iban) {
  if (!iban) return [];
  if (/^IT/i.test(iban) && iban.length >= 27) {
    const countryCode = iban.slice(0, 2);
    const checkDigits = iban.slice(2, 4);
    const cin = iban.slice(4, 5);
    const abi = iban.slice(5, 10);
    const cab = iban.slice(10, 15);
    const account = iban.slice(15, 27);
    return [countryCode, checkDigits, cin, abi, cab, account];
  }

  const countryCode = iban.slice(0, 2);
  const chunks = (iban.slice(2).match(/.{1,4}/g) || []);
  return [countryCode, ...chunks];
}

function formatIbanForDisplay(iban) {
  const parts = getIbanParts(iban);
  return parts
    .map((part, index) =>
      index === 0 ? part : `<span class="iban-sep" aria-hidden="true"> · </span>${part}`
    )
    .join('');
}

function initIbanDisplay() {
  if (!ibanText) return;
  const rawIban = normalizeIban(ibanText.textContent);
  ibanText.dataset.ibanRaw = rawIban;
  ibanText.innerHTML = formatIbanForDisplay(rawIban);
}

function getIbanValue() {
  if (!ibanText) return '';
  return ibanText.dataset.ibanRaw || normalizeIban(ibanText.textContent);
}

function setCopyFeedback(message) {
  if (!feedback) return;
  feedback.textContent = message;
}

async function copyToClipboard(text) {
  if (!text) return false;
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    return false;
  }

  await navigator.clipboard.writeText(text);
  return true;
}

function initIbanCopy() {
  if (!ibanText || !feedback) return;

  const copyIban = async () => {
    try {
      const ibanValue = getIbanValue();
      const copied = await copyToClipboard(ibanValue);
      if (!copied) {
        throw new Error('Clipboard API non disponibile');
      }
      setCopyFeedback('IBAN copiato negli appunti.');
    } catch (error) {
      setCopyFeedback("Copia non riuscita. Seleziona e copia manualmente l'IBAN.");
    }
  };

  ibanText.addEventListener('click', copyIban);
  ibanText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      copyIban();
    }
  });
}

function initMapLibreMap() {
  if (!mapContainer || typeof maplibregl === 'undefined') {
    showMapMessage('Mappa non disponibile al momento. Usa il pulsante "Apri su Mappe".');
    return;
  }

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  mapContainer.innerHTML = '';
  const styleUrl = darkSchemeQuery.matches
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  const map = new maplibregl.Map({
    container: 'wedding-map',
    style: styleUrl,
    center: [MAP_COORDS.lon, MAP_COORDS.lat],
    zoom: 14.8,
    attributionControl: true
  });
  mapInstance = map;

  map.scrollZoom.disable();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  const popup = new maplibregl.Popup({ offset: 20 }).setText(MAP_LABEL);

  new maplibregl.Marker({ color: '#b99be4' })
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

if (openMapsButton) {
  openMapsButton.addEventListener('click', (event) => {
    event.preventDefault();
    const { lat, lon, label } = openMapsButton.dataset;
    const targetUrl = getPreferredMapsUrl(lat, lon, label || 'Destinazione');
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initIbanDisplay();
  initIbanCopy();
  hydrateMapLinks();
  if (!initAppleMap()) {
    usesAppleMap = false;
    initMapLibreMap();
  } else {
    usesAppleMap = true;
  }
});

if (typeof darkSchemeQuery.addEventListener === 'function') {
  darkSchemeQuery.addEventListener('change', () => {
    if (!usesAppleMap) initMapLibreMap();
  });
} else if (typeof darkSchemeQuery.addListener === 'function') {
  darkSchemeQuery.addListener(() => {
    if (!usesAppleMap) initMapLibreMap();
  });
}
