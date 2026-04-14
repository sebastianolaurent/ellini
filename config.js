(() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  const localhostToken = 'eyJraWQiOiJTNTNDVEpQN1c2IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJEOFVSSjk3UEZQIiwiaWF0IjoxNzc2MTUxNjA3LCJzY29wZSI6Im1hcGtpdF9qcyIsImV4cCI6MTc3Njg0MTE5OX0.AETn0QcJ7kab0HKYeko9WEzIT7s6TU_lP2Yh7R32IKOiT-tybB5hbavxurbxrjpXQ8vdTCvb2_64bcZngEXQKg';
  const productionToken = 'eyJraWQiOiJVWFQzUDkyWEczIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJEOFVSSjk3UEZQIiwiaWF0IjoxNzc2MTUxMzM3LCJvcmlnaW4iOiJzZWJhc3RpYW5vbGF1cmVudC5naXRodWIuaW8iLCJzY29wZSI6Im1hcGtpdF9qcyJ9.XxvrGKPNF5T7DI-scRCZ5_v0xpwNUAEsntKWgdJk6nLNN2P1r_yy';

  window.MAPKIT_JWT = isLocalhost ? localhostToken : productionToken;
})();
