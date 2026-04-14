const ibanText = document.getElementById('iban-text');
const feedback = document.getElementById('copy-feedback');
const mapContainer = document.getElementById('wedding-map');
const openMapsButton = document.getElementById('open-maps');
const guestUploadTrigger = document.getElementById('guest-upload-trigger');
const guestUploadInput = document.getElementById('guest-photos');
const guestUploadStatus = document.getElementById('upload-status');
const guestGallery = document.getElementById('guest-gallery');
const MAP_COORDS = { lat: 44.7692730, lon: 9.3862814 };
const MAP_LABEL = 'Agriturismo Il Torrione del Trebbia, Bobbio (PC)';
const MAX_GUEST_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_GUEST_PHOTO_DIMENSION = 2200;
const MIN_GUEST_PHOTO_DIMENSION = 960;
const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let mapInstance = null;
let usesAppleMap = false;
let supabaseClient = null;
let guestUploadsEnabled = false;

function showMapMessage(message) {
  if (!mapContainer) return;
  mapContainer.innerHTML = `<p class="map-fallback">${message}</p>`;
}

function setUploadStatus(message) {
  if (!guestUploadStatus) return;
  guestUploadStatus.textContent = message;
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

function safeFileName(name) {
  return (name || 'foto')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 70) || 'foto';
}

function getFileBaseName(name) {
  return safeFileName(name).replace(/\.[a-z0-9]+$/i, '') || 'foto';
}

function getGuestPhotoPath(file) {
  const uniqueId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  return `${Date.now()}-${uniqueId}-${getFileBaseName(file.name)}.jpg`;
}

function blobToFile(blob, fileName) {
  return new File([blob], fileName, {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now()
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Immagine non leggibile'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Compressione non riuscita'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

async function compressGuestPhoto(file) {
  if ((file.type || '').toLowerCase() === 'image/gif') {
    return file;
  }

  if (file.size <= MAX_GUEST_PHOTO_BYTES) {
    return file;
  }

  const { image, objectUrl } = await loadImageFromFile(file);
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const initialScale = Math.min(1, MAX_GUEST_PHOTO_DIMENSION / Math.max(sourceWidth, sourceHeight));

    let width = Math.max(1, Math.round(sourceWidth * initialScale));
    let height = Math.max(1, Math.round(sourceHeight * initialScale));
    let quality = 0.86;
    let bestBlob = null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    for (let attempt = 0; attempt < 16; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= MAX_GUEST_PHOTO_BYTES) {
        bestBlob = blob;
        break;
      }

      if (quality > 0.5) {
        quality = Math.max(0.48, quality - 0.08);
        continue;
      }

      const nextWidth = Math.round(width * 0.85);
      const nextHeight = Math.round(height * 0.85);

      if (
        nextWidth === width ||
        nextHeight === height ||
        Math.max(nextWidth, nextHeight) <= MIN_GUEST_PHOTO_DIMENSION
      ) {
        break;
      }

      width = nextWidth;
      height = nextHeight;
      quality = 0.8;
    }

    if (!bestBlob) {
      return file;
    }

    const outputName = `${getFileBaseName(file.name)}.jpg`;
    return blobToFile(bestBlob, outputName);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getImageSortKey(image) {
  const createdAtMs = new Date(image.createdAt || '').getTime();
  if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
    return createdAtMs;
  }

  const prefix = Number.parseInt(String(image.name || '').split('-')[0], 10);
  return Number.isFinite(prefix) ? prefix : 0;
}

function setGuestUploaderState(enabled) {
  guestUploadsEnabled = enabled;
  if (guestUploadTrigger) {
    guestUploadTrigger.disabled = !enabled;
  }
}

function renderGuestGallery(images) {
  if (!guestGallery) return;

  if (!images.length) {
    guestGallery.innerHTML = '<p class="guest-gallery-empty">Nessuna foto caricata per ora.</p>';
    return;
  }

  guestGallery.innerHTML = images
    .map(
      (image) => `
      <figure class="guest-photo-card">
        <img src="${image.url}" alt="Foto degli invitati" loading="lazy" />
      </figure>
    `
    )
    .join('');
}

async function loadGuestPhotos() {
  if (!supabaseClient || !guestGallery) return;
  const { bucket } = window.SUPABASE_CONFIG || {};
  if (!bucket) return;

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .list('', { limit: 200, offset: 0, sortBy: { column: 'created_at', order: 'desc' } });

  if (error) {
    console.error('Errore caricamento galleria invitati:', error);
    setUploadStatus('Non riesco a leggere la galleria. Controlla il bucket Supabase.');
    return;
  }

  const images = (data || [])
    .filter((entry) => entry.name && !entry.name.endsWith('/'))
    .map((entry) => {
      const publicData = supabaseClient.storage.from(bucket).getPublicUrl(entry.name);
      return {
        name: entry.name,
        createdAt: entry.created_at || entry.updated_at || '',
        url: publicData.data.publicUrl
      };
    })
    .sort((a, b) => getImageSortKey(b) - getImageSortKey(a));

  renderGuestGallery(images);
}

async function uploadGuestPhotos(files) {
  if (!supabaseClient || !files.length) return;
  const { bucket } = window.SUPABASE_CONFIG || {};
  if (!bucket) return;

  setGuestUploaderState(false);
  setUploadStatus(`Caricamento di ${files.length} foto in corso...`);

  let completed = 0;
  let skipped = 0;
  for (const file of files) {
    setUploadStatus(`Ottimizzo foto ${completed + 1}/${files.length}...`);
    const optimizedFile = await compressGuestPhoto(file);
    if (optimizedFile.size > MAX_GUEST_PHOTO_BYTES) {
      skipped += 1;
      setUploadStatus(
        'Una o piu foto superano 1.5MB anche dopo ottimizzazione. Salta quelle immagini.'
      );
      continue;
    }

    const path = getGuestPhotoPath(optimizedFile);
    const { error } = await supabaseClient.storage.from(bucket).upload(path, optimizedFile, {
      upsert: false,
      cacheControl: '3600',
      contentType: optimizedFile.type || 'image/jpeg'
    });

    if (error) {
      console.error('Errore upload foto invitato:', error);
      setUploadStatus("Upload non riuscito per una o più foto. Riprova tra poco.");
      setGuestUploaderState(true);
      return;
    }

    completed += 1;
    setUploadStatus(`Caricata ${completed}/${files.length} (max 1.5MB/foto)...`);
  }

  await loadGuestPhotos();
  if (completed > 0 && skipped > 0) {
    setUploadStatus(`Caricate ${completed} foto. ${skipped} saltate per limite 1.5MB.`);
  } else if (completed > 0) {
    setUploadStatus('Foto caricate con successo.');
  } else if (skipped > 0) {
    setUploadStatus('Nessuna foto caricata: tutte oltre 1.5MB dopo ottimizzazione.');
  }
  setGuestUploaderState(true);
}

function initGuestGallery() {
  if (!guestUploadInput || !guestUploadTrigger || !guestGallery) return;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    setUploadStatus('Upload non disponibile: libreria Supabase non caricata.');
    setGuestUploaderState(false);
    return;
  }

  const { url, anonKey, bucket } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey || !bucket) {
    setUploadStatus('Configura SUPABASE_CONFIG in config.js per abilitare la galleria.');
    setGuestUploaderState(false);
    renderGuestGallery([]);
    return;
  }

  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  guestUploadTrigger.addEventListener('click', () => {
    if (!guestUploadsEnabled) return;
    guestUploadInput.click();
  });

  guestUploadInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      (file.type || '').startsWith('image/')
    );
    if (!files.length) {
      setUploadStatus('Seleziona almeno una foto valida.');
      return;
    }
    await uploadGuestPhotos(files);
    guestUploadInput.value = '';
  });

  setGuestUploaderState(true);
  setUploadStatus('Seleziona una o più foto da caricare.');
  loadGuestPhotos();
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
  initGuestGallery();
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
