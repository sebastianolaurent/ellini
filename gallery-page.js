const galleryStatus = document.getElementById('gallery-status');
const galleryGrid = document.getElementById('all-photos-gallery');
const gallerySentinel = document.getElementById('gallery-sentinel');
const galleryUploadTrigger = document.getElementById('gallery-upload-trigger');
const galleryUploadInput = document.getElementById('gallery-photos');
const photoLightbox = document.getElementById('photo-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCloseButton = document.getElementById('lightbox-close');
const lightboxPrevButton = document.getElementById('lightbox-prev');
const lightboxNextButton = document.getElementById('lightbox-next');

const PAGE_SIZE = 80;
const MAX_GUEST_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_GUEST_PHOTO_DIMENSION = 2200;
const MIN_GUEST_PHOTO_DIMENSION = 960;
let supabaseClient = null;
let offset = 0;
let hasMore = true;
let isLoading = false;
let items = [];
let currentLightboxIndex = 0;

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAuthorFromSlug(slug) {
  if (!slug) return 'Invitato';
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAuthorFromPhotoName(fileName) {
  const match = String(fileName || '').match(/--([a-z0-9-]{2,32})--/i);
  if (!match) return 'Invitato';
  return formatAuthorFromSlug(match[1]);
}

function setStatus(message) {
  if (!galleryStatus) return;
  galleryStatus.textContent = message;
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
  if ((file.type || '').toLowerCase() === 'image/gif') return file;
  if (file.size <= MAX_GUEST_PHOTO_BYTES) return file;

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
    if (!ctx) return file;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
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

    if (!bestBlob) return file;
    const outputName = `${getFileBaseName(file.name)}.jpg`;
    return blobToFile(bestBlob, outputName);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function isImageStorageObject(entry) {
  if (!entry || !entry.name || entry.name.endsWith('/')) return false;
  const mimeType = String(entry.metadata?.mimetype || '').toLowerCase();
  if (mimeType.startsWith('image/')) return true;
  return /\.(avif|webp|jpe?g|png|gif|heic|heif)$/i.test(entry.name);
}

function getImageSortKey(image) {
  const createdAtMs = new Date(image.createdAt || '').getTime();
  if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
    return createdAtMs;
  }
  const prefix = Number.parseInt(String(image.name || '').split('-')[0], 10);
  return Number.isFinite(prefix) ? prefix : 0;
}

function getMosaicVariantClass(index) {
  const pattern = ['is-square', 'is-wide', 'is-tall', 'is-square', 'is-square', 'is-wide'];
  return pattern[index % pattern.length];
}

function renderEmpty(message) {
  if (!galleryGrid) return;
  galleryGrid.classList.add('is-empty');
  galleryGrid.innerHTML = `
    <div class="guest-gallery-empty">
      <strong>Album ancora vuoto</strong>
      ${message}
    </div>
  `;
}

function bindCardImageLoadingState(image) {
  if (!image) return;
  const card = image.closest('.guest-photo-card');
  if (!card) return;

  const markLoaded = () => {
    card.classList.remove('is-loading');
    image.classList.add('is-loaded');
  };

  if (image.complete && image.naturalWidth > 0) {
    markLoaded();
    return;
  }

  image.addEventListener('load', markLoaded, { once: true });
}

function renderGallery() {
  if (!galleryGrid) return;
  if (!items.length) {
    renderEmpty('Appena qualcuno carica una foto, la vedrai qui.');
    return;
  }

  galleryGrid.classList.remove('is-empty');
  galleryGrid.innerHTML = items
    .map((image, index) => {
      const variant = getMosaicVariantClass(index);
      return `
      <figure class="guest-photo-card ${variant} is-loading" data-photo-index="${index}">
        <img src="${image.url}" alt="Foto di ${escapeHtml(image.author)}" loading="lazy" />
        <figcaption class="guest-photo-author">${escapeHtml(image.author)}</figcaption>
      </figure>
    `;
    })
    .join('');

  galleryGrid.querySelectorAll('.guest-photo-card img').forEach((img) => {
    bindCardImageLoadingState(img);
    img.addEventListener(
      'error',
      () => {
        const card = img.closest('.guest-photo-card');
        if (!card) return;
        const idx = Number.parseInt(card.dataset.photoIndex || '-1', 10);
        if (idx >= 0 && idx < items.length) {
          items.splice(idx, 1);
          renderGallery();
        }
      },
      { once: true }
    );
  });
}

function openLightbox(index) {
  if (!photoLightbox || !lightboxImage || !items.length) return;
  const safeIndex = ((index % items.length) + items.length) % items.length;
  currentLightboxIndex = safeIndex;
  lightboxImage.src = items[safeIndex].url;
  lightboxImage.alt = `Foto di ${items[safeIndex].author}`;
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

function showNext(direction) {
  openLightbox(currentLightboxIndex + direction);
}

async function loadNextPage() {
  if (!supabaseClient || isLoading || !hasMore) return;
  const { bucket } = window.SUPABASE_CONFIG || {};
  if (!bucket) return;

  isLoading = true;
  setStatus('Carico altre foto...');

  const { data, error } = await supabaseClient.storage.from(bucket).list('', {
    limit: PAGE_SIZE,
    offset,
    sortBy: { column: 'created_at', order: 'desc' }
  });

  isLoading = false;
  if (error) {
    console.error('Errore caricamento pagina galleria:', error);
    setStatus('Non riesco a caricare le foto ora.');
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

  offset += (data || []).length;
  hasMore = (data || []).length === PAGE_SIZE;

  const uniqueByName = new Map();
  [...items, ...pageItems].forEach((item) => uniqueByName.set(item.name, item));
  items = Array.from(uniqueByName.values()).sort((a, b) => getImageSortKey(b) - getImageSortKey(a));
  renderGallery();
  setStatus('');
}

async function uploadPhotos(files) {
  if (!supabaseClient || !files.length) return;
  const { bucket } = window.SUPABASE_CONFIG || {};
  if (!bucket) return;

  if (galleryUploadTrigger) galleryUploadTrigger.disabled = true;
  let completed = 0;
  let skipped = 0;

  for (const file of files) {
    setStatus(`Ottimizzo foto ${completed + 1}/${files.length}...`);
    const optimizedFile = await compressGuestPhoto(file);
    if (optimizedFile.size > MAX_GUEST_PHOTO_BYTES) {
      skipped += 1;
      continue;
    }

    const path = getGuestPhotoPath(optimizedFile);
    const { error } = await supabaseClient.storage.from(bucket).upload(path, optimizedFile, {
      upsert: false,
      cacheControl: '3600',
      contentType: optimizedFile.type || 'image/jpeg'
    });
    if (error) {
      console.error('Errore upload foto:', error);
      setStatus("Upload non riuscito. Riprova tra poco.");
      if (galleryUploadTrigger) galleryUploadTrigger.disabled = false;
      return;
    }

    completed += 1;
  }

  if (completed > 0) {
    offset = 0;
    hasMore = true;
    items = [];
    await loadNextPage();
  }

  if (completed === 0 && skipped > 0) {
    setStatus('Nessuna foto caricata: tutte oltre 1.5MB dopo ottimizzazione.');
  } else {
    setStatus('');
  }

  if (galleryUploadTrigger) galleryUploadTrigger.disabled = false;
}

function initLightboxEvents() {
  if (!galleryGrid || !photoLightbox || !lightboxImage) return;

  galleryGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.guest-photo-card');
    if (!card) return;
    const index = Number.parseInt(card.dataset.photoIndex || '-1', 10);
    if (index >= 0) openLightbox(index);
  });

  if (lightboxCloseButton) lightboxCloseButton.addEventListener('click', closeLightbox);
  if (lightboxPrevButton) lightboxPrevButton.addEventListener('click', () => showNext(-1));
  if (lightboxNextButton) lightboxNextButton.addEventListener('click', () => showNext(1));

  photoLightbox.addEventListener('click', (event) => {
    if (event.target === photoLightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (!photoLightbox.classList.contains('is-open')) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showNext(-1);
    if (event.key === 'ArrowRight') showNext(1);
  });
}

function initInfiniteScroll() {
  if (!gallerySentinel || typeof IntersectionObserver !== 'function') return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadNextPage();
    });
  }, { rootMargin: '240px 0px' });
  observer.observe(gallerySentinel);
}

function initGalleryPage() {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    renderEmpty('Caricamento non disponibile al momento.');
    return;
  }

  const { url, anonKey, bucket } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey || !bucket) {
    renderEmpty('Manca la configurazione Supabase.');
    return;
  }

  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  initLightboxEvents();
  initInfiniteScroll();
  if (galleryUploadTrigger && galleryUploadInput) {
    galleryUploadTrigger.addEventListener('click', () => {
      if (galleryUploadTrigger.disabled) return;
      galleryUploadInput.click();
    });

    galleryUploadInput.addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []).filter((file) =>
        (file.type || '').startsWith('image/')
      );
      if (!files.length) {
        setStatus('Seleziona almeno una foto valida.');
        return;
      }
      await uploadPhotos(files);
      galleryUploadInput.value = '';
    });
  }

  loadNextPage();
}

window.addEventListener('DOMContentLoaded', initGalleryPage);
