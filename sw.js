/* ═══ Service worker ═══
   Torna o piloto instalável e utilizável offline (RNF04: registro nunca pode falhar por falta de
   internet). Estratégia: network-first com o cache como rede de segurança — ver o comentário no
   handler de fetch para o porquê.

   Ao mexer em qualquer arquivo do SHELL, suba a VERSAO — é o que limpa o cache antigo. */
const VERSAO = 'v2';
const CACHE = `capi-${VERSAO}`;

const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/economia.js',
  'js/frases.js',
  'js/pets.js',
  'js/app.js',
  'js/acesso.js',
  'manifest.webmanifest',
  'favicon.svg',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/icone-180.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      /* addAll é tudo-ou-nada: um 404 aborta a instalação inteira, então vai um por um */
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch((e) => {
        console.warn('[sw] não cacheei', url, e);
      }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; /* nada de terceiros para cachear */

  /* NETWORK-FIRST para tudo do próprio site, com o cache como rede de segurança offline.
     Por que não cache-first: o app é pequeno (~90 KB) e o piloto recebe deploys frequentes de tom e
     de economia. Com cache-first, o primeiro acesso depois de um deploy servia o app ANTIGO — e um
     shell velho com acesso/convites.json novo quebrava o login (mistura de versões). Offline-first
     aqui é dos DADOS (que vivem no localStorage), não do código. */
  ev.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req).then((cacheado) => {
        if (cacheado) return cacheado;
        /* navegação offline sem cache da URL exata: entrega o shell */
        if (req.mode === 'navigate') {
          return caches.match('index.html').then((r) => r || caches.match('./'));
        }
        return Response.error();
      })),
  );
});
