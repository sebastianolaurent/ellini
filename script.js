const ibanText = document.getElementById('iban-text');
const feedback = document.getElementById('copy-feedback');
const heroPhoto = document.querySelector('.hero-photo');
const guestUploadTrigger = document.getElementById('guest-upload-trigger');
const guestUploadInput = document.getElementById('guest-photos');
const guestUploadStatus = document.getElementById('upload-status');
const guestGallery = document.getElementById('guest-gallery');
const viewAllPhotosButton = document.getElementById('view-all-photos');
const photoLightbox = document.getElementById('photo-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCloseButton = document.getElementById('lightbox-close');
const lightboxPrevButton = document.getElementById('lightbox-prev');
const lightboxNextButton = document.getElementById('lightbox-next');
const authorModal = document.getElementById('author-modal');
const authorModalForm = document.getElementById('author-modal-form');
const authorModalInput = document.getElementById('author-name-input');
const authorModalError = document.getElementById('author-modal-error');
const authorModalCancel = document.getElementById('author-modal-cancel');
const authorModalClose = document.getElementById('author-modal-close');
const MAX_GUEST_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_GUEST_PHOTO_DIMENSION = 2200;
const MIN_GUEST_PHOTO_DIMENSION = 960;
const HOME_GUEST_GALLERY_MAX_ITEMS = 6;
const GUEST_AUTHOR_STORAGE_KEY = 'weddingGuestAuthorName';
const DEFAULT_GUEST_AUTHOR = 'Invitato';
const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let mapInstances = [];
let usesAppleMap = false;
let supabaseClient = null;
let guestUploadsEnabled = false;
let guestGalleryItems = [];
let currentLightboxIndex = 0;
let pendingGuestAuthorName = '';
let cachedGuestAuthorName = '';
let mapTargets = [];

function showMapMessage(container, message) {
  if (!container) return;
  container.innerHTML = `<p class="map-fallback">${message}</p>`;
}

function setUploadStatus(message) {
  if (!guestUploadStatus) return;
  guestUploadStatus.textContent = message;
}

function setHeroPhotoForTheme() {
  if (!heroPhoto) return;
  heroPhoto.src = darkSchemeQuery.matches ? 'assets/images/hero.webp' : 'assets/images/gallery-2.webp';
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
}

function initMapLinkClicks() {
  const mapLinks = document.querySelectorAll('.js-map-link');
  mapLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const { lat, lon, label } = link.dataset;
      const targetUrl = getPreferredMapsUrl(lat, lon, label || 'Destinazione');
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    });
  });
}

function getMapTargets() {
  return Array.from(document.querySelectorAll('.js-inline-map'))
    .map((container) => {
      const { lat, lon, label, pinTitle } = container.dataset;
      const parsedLat = Number.parseFloat(lat);
      const parsedLon = Number.parseFloat(lon);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
        return null;
      }
      return {
        container,
        lat: parsedLat,
        lon: parsedLon,
        label: label || 'Destinazione',
        pinTitle: pinTitle || label || 'Destinazione'
      };
    })
    .filter(Boolean);
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
      index === 0 ? part : `<span class="iban-sep" aria-hidden="true">·</span>${part}`
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
  if (!mapTargets.length) return;
  if (typeof maplibregl === 'undefined') {
    mapTargets.forEach((target) => {
      showMapMessage(target.container, 'Mappa non disponibile al momento. Usa il pulsante "Apri su Mappe".');
    });
    return;
  }

  if (mapInstances.length) {
    mapInstances.forEach((instance) => {
      if (instance && typeof instance.remove === 'function') {
        instance.remove();
      }
    });
  }
  mapInstances = [];
  const styleUrl = darkSchemeQuery.matches
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  mapTargets.forEach((target) => {
    target.container.innerHTML = '';
    const map = new maplibregl.Map({
      container: target.container,
      style: styleUrl,
      center: [target.lon, target.lat],
      zoom: 15,
      attributionControl: false
    });
    mapInstances.push(map);

    map.scrollZoom.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const popup = new maplibregl.Popup({ offset: 20 }).setText(target.pinTitle);

    new maplibregl.Marker({ color: '#b99be4' })
      .setLngLat([target.lon, target.lat])
      .setPopup(popup)
      .addTo(map);
  });
}

function safeFileName(name) {
  return (name || 'foto')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 70) || 'foto';
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeGuestAuthorName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

function getGuestAuthorSlug(name) {
  const normalized = normalizeGuestAuthorName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return slug || 'invitato';
}

function formatAuthorFromSlug(slug) {
  if (!slug) return DEFAULT_GUEST_AUTHOR;
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAuthorFromPhotoName(fileName) {
  const match = String(fileName || '').match(/--([a-z0-9-]{2,32})--/i);
  if (!match) return DEFAULT_GUEST_AUTHOR;
  return formatAuthorFromSlug(match[1]);
}

function getFileBaseName(name) {
  return safeFileName(name).replace(/\.[a-z0-9]+$/i, '') || 'foto';
}

function getGuestPhotoPath(file, authorName) {
  const uniqueId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const authorSlug = getGuestAuthorSlug(authorName);
  return `${Date.now()}-${uniqueId}--${authorSlug}--${getFileBaseName(file.name)}.jpg`;
}

function getStoredGuestAuthorName() {
  if (cachedGuestAuthorName) return cachedGuestAuthorName;
  try {
    cachedGuestAuthorName = normalizeGuestAuthorName(
      localStorage.getItem(GUEST_AUTHOR_STORAGE_KEY) || ''
    );
    return cachedGuestAuthorName;
  } catch (_) {
    return cachedGuestAuthorName;
  }
}

function storeGuestAuthorName(authorName) {
  const normalized = normalizeGuestAuthorName(authorName);
  cachedGuestAuthorName = normalized;
  try {
    localStorage.setItem(GUEST_AUTHOR_STORAGE_KEY, normalized);
  } catch (_) {
    // Ignore storage errors and continue with in-memory upload flow.
  }
}

function askGuestAuthorName(initialValue = '') {
  if (!authorModal || !authorModalForm || !authorModalInput || !authorModalError) {
    const answer = window.prompt(
      'Come ti chiami? Inseriamo il tuo nome come autore delle foto.',
      initialValue
    );
    if (answer === null) return null;
    return Promise.resolve(normalizeGuestAuthorName(answer));
  }

  return new Promise((resolve) => {
    let settled = false;

    const closeModal = (value) => {
      if (settled) return;
      settled = true;
      authorModal.classList.remove('is-open');
      authorModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('author-modal-open');
      authorModalForm.removeEventListener('submit', onSubmit);
      authorModalCancel?.removeEventListener('click', onCancel);
      authorModalClose?.removeEventListener('click', onCancel);
      authorModal.removeEventListener('click', onBackdropClick);
      document.removeEventListener('keydown', onEscape);
      resolve(value);
    };

    const onSubmit = (event) => {
      event.preventDefault();
      const authorName = normalizeGuestAuthorName(authorModalInput.value);
      if (!authorName) {
        authorModalError.textContent = 'Inserisci il tuo nome per continuare.';
        authorModalInput.focus();
        return;
      }
      closeModal(authorName);
    };

    const onCancel = () => closeModal(null);

    const onBackdropClick = (event) => {
      if (event.target === authorModal) onCancel();
    };

    const onEscape = (event) => {
      if (event.key === 'Escape') onCancel();
    };

    authorModalInput.value = initialValue;
    authorModalError.textContent = '';
    authorModal.classList.add('is-open');
    authorModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('author-modal-open');
    authorModalForm.addEventListener('submit', onSubmit);
    authorModalCancel?.addEventListener('click', onCancel);
    authorModalClose?.addEventListener('click', onCancel);
    authorModal.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onEscape);
    requestAnimationFrame(() => {
      authorModalInput.focus();
      authorModalInput.select();
    });
  });
}

async function ensureGuestAuthorName() {
  const storedAuthorName = getStoredGuestAuthorName();
  if (storedAuthorName) return storedAuthorName;
  const authorName = await askGuestAuthorName('');
  if (!authorName) return authorName;
  storeGuestAuthorName(authorName);
  return authorName;
}

async function resolveGuestAuthorName() {
  if (pendingGuestAuthorName) return pendingGuestAuthorName;
  return ensureGuestAuthorName();
}

function isGuestAuthorNameMissing(authorName) {
  return !normalizeGuestAuthorName(authorName);
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

function isImageStorageObject(entry) {
  if (!entry || !entry.name || entry.name.endsWith('/')) return false;
  const mimeType = String(entry.metadata?.mimetype || '').toLowerCase();
  if (mimeType.startsWith('image/')) return true;
  return /\.(avif|webp|jpe?g|png|gif|heic|heif)$/i.test(entry.name);
}

function handleGuestImageLoadError(event) {
  const image = event.currentTarget;
  if (!image || !guestGallery) return;

  const card = image.closest('.guest-photo-card');
  const photoName = card?.dataset?.photoName || '';
  if (photoName) {
    guestGalleryItems = guestGalleryItems.filter((item) => item.name !== photoName);
  }
  if (card) card.remove();

  if (!guestGalleryItems.length) {
    renderGuestGalleryEmpty('Per ora non vediamo foto valide: caricane una nuova.');
    return;
  }

  renderGuestGallery(guestGalleryItems);
}

function getMosaicVariantClass(index) {
  const pattern = ['is-square', 'is-wide', 'is-tall', 'is-square', 'is-square', 'is-wide'];
  return pattern[index % pattern.length];
}

function openLightbox(index) {
  if (!photoLightbox || !lightboxImage || !guestGalleryItems.length) return;
  const safeIndex = ((index % guestGalleryItems.length) + guestGalleryItems.length) % guestGalleryItems.length;
  const image = guestGalleryItems[safeIndex];
  if (!image) return;

  currentLightboxIndex = safeIndex;
  lightboxImage.src = image.url;
  lightboxImage.alt = `Foto di ${image.author}`;
  photoLightbox.classList.add('is-open');
  photoLightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
}

function closeLightbox() {
  if (!photoLightbox || !lightboxImage) return;
  photoLightbox.classList.remove('is-open');
  photoLightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.src = '';
  document.body.classList.remove('lightbox-open');
}

function showNextLightboxImage(direction) {
  if (!guestGalleryItems.length) return;
  openLightbox(currentLightboxIndex + direction);
}

function renderGuestGallery(images) {
  if (!guestGallery) return;

  if (!images.length) {
    if (viewAllPhotosButton) viewAllPhotosButton.hidden = true;
    guestGallery.classList.add('is-empty');
    guestGallery.innerHTML = `
      <div class="guest-gallery-empty">
        <strong>Album ancora vuoto</strong>
        Carica la prima foto e inaugura il carosello dei ricordi.
      </div>
    `;
    return;
  }

  guestGallery.classList.remove('is-empty');
  guestGallery.innerHTML = images
    .map((image, index) => {
      const variantClass = getMosaicVariantClass(index);
      return `
      <figure class="guest-photo-card ${variantClass}" data-photo-name="${image.name}" data-photo-index="${index}">
        <img src="${image.url}" alt="Foto di ${escapeHtml(image.author)}" loading="lazy" />
        <figcaption class="guest-photo-author">${escapeHtml(image.author)}</figcaption>
      </figure>
    `;
    })
    .join('');

  guestGallery.querySelectorAll('.guest-photo-card img').forEach((img) => {
    img.addEventListener('error', handleGuestImageLoadError, { once: true });
  });
}

function renderGuestGalleryEmpty(message) {
  if (!guestGallery) return;
  if (viewAllPhotosButton) viewAllPhotosButton.hidden = true;
  guestGallery.classList.add('is-empty');
  guestGallery.innerHTML = `
    <div class="guest-gallery-empty">
      <strong>Album ancora vuoto</strong>
      ${message}
    </div>
  `;
}

async function loadGuestPhotos() {
  if (!supabaseClient || !guestGallery) return;
  const { bucket } = window.SUPABASE_CONFIG || {};
  if (!bucket) return;

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .list('', {
      limit: HOME_GUEST_GALLERY_MAX_ITEMS + 1,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) {
    console.error('Errore caricamento galleria invitati:', error);
    setUploadStatus('Non riesco a leggere la galleria. Controlla il bucket Supabase.');
    renderGuestGalleryEmpty('Per ora non vediamo foto: riprova tra poco.');
    return;
  }

  const pageItems = (data || [])
    .filter((entry) => isImageStorageObject(entry))
    .map((entry) => {
      const publicData = supabaseClient.storage.from(bucket).getPublicUrl(entry.name);
      return {
        name: entry.name,
        createdAt: entry.created_at || entry.updated_at || '',
        author: getAuthorFromPhotoName(entry.name),
        url: publicData.data.publicUrl
      };
    });

  guestGalleryItems = pageItems
    .sort((a, b) => getImageSortKey(b) - getImageSortKey(a))
    .slice(0, HOME_GUEST_GALLERY_MAX_ITEMS);

  if (viewAllPhotosButton) {
    viewAllPhotosButton.hidden = pageItems.length <= HOME_GUEST_GALLERY_MAX_ITEMS;
  }

  renderGuestGallery(guestGalleryItems);
}

async function uploadGuestPhotos(files, authorName) {
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

    const path = getGuestPhotoPath(optimizedFile, authorName);
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
  if (completed === 0 && skipped > 0) {
    setUploadStatus('Nessuna foto caricata: tutte oltre 1.5MB dopo ottimizzazione.');
  } else {
    setUploadStatus('');
  }
  setGuestUploaderState(true);
}

function initGuestGallery() {
  if (!guestUploadInput || !guestUploadTrigger || !guestGallery) return;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    setUploadStatus('Upload non disponibile: libreria Supabase non caricata.');
    setGuestUploaderState(false);
    renderGuestGalleryEmpty('Caricamento non disponibile al momento.');
    return;
  }

  const { url, anonKey, bucket } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey || !bucket) {
    setUploadStatus('Configura SUPABASE_CONFIG in config.js per abilitare la galleria.');
    setGuestUploaderState(false);
    renderGuestGalleryEmpty('Manca la configurazione per mostrare le foto.');
    return;
  }

  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  guestUploadTrigger.addEventListener('click', async () => {
    if (!guestUploadsEnabled) return;
    const authorName = await ensureGuestAuthorName();
    if (authorName === null) {
      setUploadStatus('Upload annullato.');
      return;
    }
    if (isGuestAuthorNameMissing(authorName)) {
      setUploadStatus('Inserisci un nome prima di caricare le foto.');
      return;
    }
    pendingGuestAuthorName = authorName;
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
    const authorName = await resolveGuestAuthorName();
    if (authorName === null) {
      setUploadStatus('Upload annullato.');
      guestUploadInput.value = '';
      pendingGuestAuthorName = '';
      return;
    }
    if (isGuestAuthorNameMissing(authorName)) {
      setUploadStatus('Inserisci un nome prima di caricare le foto.');
      guestUploadInput.value = '';
      pendingGuestAuthorName = '';
      return;
    }
    await uploadGuestPhotos(files, authorName);
    guestUploadInput.value = '';
    pendingGuestAuthorName = '';
  });

  guestGallery.addEventListener('click', (event) => {
    const card = event.target.closest('.guest-photo-card');
    if (!card) return;
    const index = Number.parseInt(card.dataset.photoIndex || '-1', 10);
    if (index < 0) return;
    openLightbox(index);
  });

  if (photoLightbox && lightboxCloseButton && lightboxPrevButton && lightboxNextButton) {
    lightboxCloseButton.addEventListener('click', closeLightbox);
    lightboxPrevButton.addEventListener('click', () => showNextLightboxImage(-1));
    lightboxNextButton.addEventListener('click', () => showNextLightboxImage(1));
    photoLightbox.addEventListener('click', (event) => {
      if (event.target === photoLightbox) {
        closeLightbox();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!photoLightbox.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        showNextLightboxImage(-1);
      } else if (event.key === 'ArrowRight') {
        showNextLightboxImage(1);
      }
    });
  }

  setGuestUploaderState(true);
  loadGuestPhotos();
}

function initAppleMap() {
  if (!mapTargets.length || typeof mapkit === 'undefined' || !window.MAPKIT_JWT) {
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

    mapTargets.forEach((target) => {
      const center = new mapkit.Coordinate(target.lat, target.lon);
      const map = new mapkit.Map(target.container.id, {
        center,
        isRotationEnabled: false,
        isZoomEnabled: true,
        showsCompass: mapkit.FeatureVisibility.Hidden,
        showsMapTypeControl: false
      });

      map.region = new mapkit.CoordinateRegion(
        center,
        new mapkit.CoordinateSpan(0.01, 0.01)
      );

      map.addAnnotation(new mapkit.MarkerAnnotation(center, { title: target.pinTitle }));
    });
    return true;
  } catch (error) {
    console.warn('Apple Maps non disponibile, fallback MapLibre:', error);
    return false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setHeroPhotoForTheme();
  initIbanDisplay();
  initIbanCopy();
  hydrateMapLinks();
  initMapLinkClicks();
  mapTargets = getMapTargets();
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
    setHeroPhotoForTheme();
    if (!usesAppleMap) initMapLibreMap();
  });
} else if (typeof darkSchemeQuery.addListener === 'function') {
  darkSchemeQuery.addListener(() => {
    setHeroPhotoForTheme();
    if (!usesAppleMap) initMapLibreMap();
  });
}
