/* ═══ Service worker ═══
   Torna o piloto instalável e utilizável offline (RNF04: registro nunca pode falhar por falta de
   internet). Estratégia: network-first com o cache como rede de segurança — ver o comentário no
   handler de fetch para o porquê.

   Ao mexer em qualquer arquivo do SHELL, suba a VERSAO — é o que limpa o cache antigo. */
const VERSAO = 'v6';
const CACHE = `capi-${VERSAO}`;

const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/economia.js',
  'js/telemetria.js',
  'js/sync.js',
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

/* ═══ Push ═══
   O payload carrega só { gatilho, variante, dia } — nenhuma palavra sobre o hábito da pessoa. O
   serviço de push vê tamanho e horário mesmo sem ler o corpo cifrado; uma frase sobre a rotina de
   alguém ali seria dado de saúde saindo por metadado. O texto é montado AQUI, do MESMO pacote de
   falas do app — assim as notificações passam pelo lint anti-culpa como todo o resto. */
importScripts('js/frases.js');

const GATILHO_PARA_FALA = {
  LembreteDeAgua: 'push_agua',
  LembreteDeRefeicao: 'push_refeicao',
  ResumoDaNoite: 'push_resumo',
  VoltaSemCulpa: 'push_volta',
};

self.addEventListener('push', (ev) => {
  let dados = {};
  try { dados = ev.data ? ev.data.json() : {}; } catch (_e) { /* payload estranho: usa o padrão */ }
  const chave = GATILHO_PARA_FALA[dados.gatilho] || 'push_agua';
  const falas = (FRASES.capivara && FRASES.capivara[chave]) || ['Oi! Passei pra dar um alô.'];
  const fala = falas[(dados.variante || 0) % falas.length];

  ev.waitUntil(self.registration.showNotification('Capi', {
    body: fala,
    icon: 'icones/icone-192.png',
    badge: 'icones/icone-192.png',
    tag: 'capi-' + (dados.gatilho || 'lembrete'),
    data: { dia: dados.dia || null },
  }));
});

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  ev.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const nossa = abertas.find((c) => c.url.includes(self.registration.scope));
    if (nossa) return nossa.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
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
