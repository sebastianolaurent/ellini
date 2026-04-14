(() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  // Nessun token locale: in localhost usiamo fallback Leaflet.
  const localhostToken = '';

  // Token valido per il dominio pubblico autorizzato.
  const productionToken = 'eyJraWQiOiJCUVU1VkxHV1ZYIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJEOFVSSjk3UEZQIiwiaWF0IjoxNzc2MTYzMzY4LCJvcmlnaW4iOiJsdWNhZWxlb25vcmEuY29tIiwic2NvcGUiOiJtYXBraXRfanMifQ.NMZiB1QwZHLdRG1L4KLuURXwF9MOZnk87RgO7_K28K3pD2pgs89j70-pY7-C7v58YZvVtLUCb4J1UKsRQGWQlw';

  window.MAPKIT_JWT = isLocalhost ? localhostToken : productionToken;
})();
