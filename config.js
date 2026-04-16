(() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  // Nessun token locale: in localhost usiamo fallback Leaflet.
  const localhostToken = '';

  // Token valido per il dominio pubblico autorizzato.
  const productionToken = 'eyJraWQiOiJCUVU1VkxHV1ZYIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJEOFVSSjk3UEZQIiwiaWF0IjoxNzc2MTYzMzY4LCJvcmlnaW4iOiJsdWNhZWxlb25vcmEuY29tIiwic2NvcGUiOiJtYXBraXRfanMifQ.NMZiB1QwZHLdRG1L4KLuURXwF9MOZnk87RgO7_K28K3pD2pgs89j70-pY7-C7v58YZvVtLUCb4J1UKsRQGWQlw';

  window.MAPKIT_JWT = isLocalhost ? localhostToken : productionToken;

  window.SUPABASE_CONFIG = {
    url: 'https://edontmlcteelyjrqxnzf.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkb250bWxjdGVlbHlqcnF4bnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgzODEsImV4cCI6MjA5MTczNDM4MX0.yPcp_tj1CIyICpH4-Ik-HiAx7o6HByCNgPiEQ44MjRU',
    bucket: 'wedding-photos'
  };

  window.WEDDING_EVENT_CONFIG = {
    timezone: 'Europe/Rome',
    weddingDate: '2026-09-26',
    galleryWindow: {
      startDate: '2026-09-24',
      endDate: '2026-09-29'
    }
  };
})();
