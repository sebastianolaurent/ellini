const copyButton = document.getElementById('copy-iban');
const ibanText = document.getElementById('iban-text');
const feedback = document.getElementById('copy-feedback');

if (copyButton && ibanText && feedback) {
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ibanText.textContent.trim());
      feedback.textContent = 'IBAN copiato negli appunti.';
    } catch (error) {
      feedback.textContent = 'Copia non riuscita. Seleziona e copia manualmente l\'IBAN.';
    }
  });
}

const mapContainer = document.getElementById('wedding-map');
const villaAureliaCoords = { latitude: 41.8885649, longitude: 12.461585 };

function renderMapFallback(message) {
  if (!mapContainer) return;
  mapContainer.innerHTML = `<p class="map-fallback">${message}</p>`;
}

function buildAppleMap() {
  if (!mapContainer) return;
  if (typeof mapkit === 'undefined') {
    renderMapFallback('MapKit non disponibile. Usa il pulsante Apple Maps qui accanto.');
    return;
  }

  const token = window.MAPKIT_JWT;
  if (!token || token === 'INSERISCI_QUI_IL_TOKEN_MAPKIT_JWT') {
    renderMapFallback(
      'Per visualizzare la mappa Apple incorporata, crea config.js con MAPKIT_JWT valido.'
    );
    return;
  }

  mapkit.init({
    authorizationCallback(done) {
      done(token);
    }
  });

  const map = new mapkit.Map('wedding-map', {
    center: villaAureliaCoords,
    showsCompass: mapkit.FeatureVisibility.Visible,
    isRotationEnabled: false,
    isZoomEnabled: true
  });

  map.region = new mapkit.CoordinateRegion(
    new mapkit.Coordinate(villaAureliaCoords.latitude, villaAureliaCoords.longitude),
    new mapkit.CoordinateSpan(0.015, 0.02)
  );

  const annotation = new mapkit.MarkerAnnotation(
    new mapkit.Coordinate(villaAureliaCoords.latitude, villaAureliaCoords.longitude),
    {
      title: 'Villa Aurelia',
      subtitle: 'Largo di Porta San Pancrazio, Roma',
      color: '#8b6f4e'
    }
  );

  map.addAnnotation(annotation);
}

window.initWeddingMap = buildAppleMap;

if (mapContainer) {
  window.setTimeout(() => {
    if (typeof mapkit === 'undefined') {
      renderMapFallback('MapKit non disponibile. Usa il pulsante Apple Maps qui accanto.');
    }
  }, 2000);
}
