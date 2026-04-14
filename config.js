(() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  // Nessun token locale: in localhost usiamo fallback Leaflet.
  const localhostToken = '';

  // Token valido per il dominio pubblico autorizzato.
  const productionToken = 'eyJraWQiOiJVWFQzUDkyWEczIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJEOFVSSjk3UEZQIiwiaWF0IjoxNzc2MTUxMzM3LCJvcmlnaW4iOiJzZWJhc3RpYW5vbGF1cmVudC5naXRodWIuaW8iLCJzY29wZSI6Im1hcGtpdF9qcyJ9.XxvrGKPNF5T7DI-scRCZ5_v0xpwNUAEsntKWgdJk6nLNN2P1r_yyfgcLMjM-FhUrei90fVY583dckDB9XFFd5Q';

  window.MAPKIT_JWT = isLocalhost ? localhostToken : productionToken;
})();
