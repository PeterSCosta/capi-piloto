/* ═══ Sync com o backend (opcional, atrás de flag) ═══
   O app funciona 100% sem isto: o localStorage continua sendo a fonte da verdade da experiência —
   a Capi reage ao gesto na hora, sem esperar rede. O sync existe para o progresso não morrer com o
   navegador e para o mesmo diário abrir em dois aparelhos.

   Três regras que vêm dos princípios do produto:

   1. O servidor NUNCA abaixa número. Reconciliação é por máximo: se o servidor souber mais (outro
      aparelho registrou), o app adota; se souber menos, o app mantém e a diferença vira métrica.
      Servidor que "corrige para menos" produziria a tela proibida — o resumo do que você perdeu.
   2. Registro nunca falha por falta de rede. Cada gesto entra numa outbox local e é reenviado
      depois; como o id do evento nasce no aparelho, reenviar é sempre seguro.
   3. Modo demonstração NÃO sincroniza. O painel demo adianta o calendário do próprio app: se
      aquilo subisse, "+7 dias completos" viraria Lendário no servidor.

   Ligar: ?sync=1 usa /api do mesmo domínio; ?sync=http://localhost:5199 aponta para outro lugar.
   Desligar: ?sync=0 (o que já está na outbox continua guardado). */
(function () {
  'use strict';

  const KEY_CFG = 'capi-sync-cfg';
  const KEY_OUTBOX = 'capi-outbox';
  const TETO_OUTBOX = 2000;

  const ler = (chave, padrao) => {
    try {
      const raw = localStorage.getItem(chave);
      return raw ? JSON.parse(raw) : padrao;
    } catch (_e) { return padrao; }
  };
  const gravar = (chave, valor) => {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (_e) { /* cota cheia */ }
  };

  let cfg = ler(KEY_CFG, null);
  let sincronizando = false;
  let aoMudar = null;

  const ativo = () => !!(cfg && cfg.url);
  const salvarCfg = () => gravar(KEY_CFG, cfg);

  /* ── configuração pela URL ── */
  function configurarPelaUrl() {
    const url = new URL(location.href);
    const pedido = url.searchParams.get('sync');
    if (pedido === null) return false;

    if (pedido === '0' || pedido === 'off') {
      cfg = null;
      localStorage.removeItem(KEY_CFG);
    } else {
      const base = (pedido === '1' || pedido === 'on')
        ? new URL('api', location.href.replace(/[^/]*$/, '')).toString().replace(/\/$/, '')
        : pedido.replace(/\/$/, '');
      cfg = Object.assign({ dispositivoId: null, token: null, cursor: 0, migrou: false }, cfg || {}, { url: base });
      salvarCfg();
    }
    url.searchParams.delete('sync');
    history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    return true;
  }

  /* ── outbox ── */
  const outbox = () => ler(KEY_OUTBOX, []);

  /** Registra um evento para subir depois. Sempre local primeiro: nunca bloqueia o gesto. */
  function registrar(tipo, payload, diaLocal, opcoes) {
    const o = opcoes || {};
    if (o.demo) return null; /* calendário fabricado não sobe */
    const evento = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
      tipo,
      diaLocal,
      ocorridoEm: new Date().toISOString(),
      offsetMin: -new Date().getTimezoneOffset(),
      fusoIana: (Intl.DateTimeFormat().resolvedOptions().timeZone) || null,
      payload: payload || {},
    };
    const fila = outbox();
    fila.push(evento);
    /* o teto existe para a outbox não virar um vazamento silencioso se o servidor ficar fora do ar
       por semanas; os mais antigos já foram vividos no estado local */
    gravar(KEY_OUTBOX, fila.length > TETO_OUTBOX ? fila.slice(-TETO_OUTBOX) : fila);
    return evento.id;
  }

  /* ── conversa com o servidor ── */
  async function pedir(caminho, opcoes) {
    const o = opcoes || {};
    const resp = await fetch(cfg.url + caminho, {
      method: o.metodo || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
      ),
      body: o.corpo ? JSON.stringify(o.corpo) : undefined,
      cache: 'no-store',
    });
    if (!resp.ok) throw new Error(`${caminho}: HTTP ${resp.status}`);
    return resp.status === 204 ? null : resp.json();
  }

  async function garantirDispositivo(contexto) {
    if (cfg.token) return;
    const criado = await pedir('/dispositivos', {
      metodo: 'POST',
      corpo: {
        apelido: (contexto && contexto.apelido) || null,
        plataforma: 'web',
        fusoIana: (Intl.DateTimeFormat().resolvedOptions().timeZone) || null,
        convite: (contexto && contexto.convite) || null,
      },
    });
    cfg.dispositivoId = criado.dispositivoId;
    cfg.token = criado.token;
    salvarCfg();
  }

  /**
   * Sobe o que está na outbox e traz o estado do servidor.
   * Devolve { ok, estado, divergencia } — quem chama decide o que fazer com a divergência.
   */
  async function sincronizar(contexto) {
    if (!ativo() || sincronizando) return { ok: false, motivo: 'inativo' };
    if (!navigator.onLine) return { ok: false, motivo: 'offline' };
    sincronizando = true;
    try {
      await garantirDispositivo(contexto);

      const fila = outbox();
      /* o saldo do piloto sobe UMA vez, como abertura: reconstruir registro de hábito a partir de
         um resumo seria inventar dado de saúde que a pessoa nunca registrou */
      if (!cfg.migrou && contexto && contexto.abertura) {
        fila.unshift({
          id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
          tipo: 'AberturaMigracao',
          diaLocal: contexto.hoje,
          ocorridoEm: new Date().toISOString(),
          offsetMin: -new Date().getTimezoneOffset(),
          fusoIana: (Intl.DateTimeFormat().resolvedOptions().timeZone) || null,
          payload: contexto.abertura,
        });
      }

      const resposta = await pedir('/sync', {
        metodo: 'POST',
        corpo: { eventos: fila, desde: cfg.cursor || 0, hoje: contexto ? contexto.hoje : null },
      });

      /* só tira da outbox o que o servidor confirmou ter recebido (aceito OU duplicado);
         recusado fica de fora para não voltar em laço infinito, mas vira aviso */
      const resolvidos = new Set(
        (resposta.recebidos || []).filter((v) => v.situacao !== 'recusado').map((v) => v.id),
      );
      const recusados = (resposta.recebidos || []).filter((v) => v.situacao === 'recusado');
      const sobra = fila.filter((e) => !resolvidos.has(e.id) && !recusados.some((v) => v.id === e.id));
      gravar(KEY_OUTBOX, sobra);

      cfg.cursor = resposta.cursor;
      cfg.migrou = true;
      cfg.ultimoEm = new Date().toISOString();
      salvarCfg();

      if (recusados.length) console.warn('[sync] eventos recusados:', recusados);
      if (aoMudar) aoMudar();
      return { ok: true, estado: resposta.estado, recusados };
    } catch (erro) {
      console.warn('[sync]', erro.message);
      return { ok: false, motivo: erro.message };
    } finally {
      sincronizando = false;
    }
  }

  /**
   * Reconciliação: o servidor nunca abaixa número. Devolve os campos que o app deve ADOTAR
   * (só quando o servidor sabe mais) e a divergência para virar métrica.
   */
  function reconciliar(local, doServidor) {
    if (!doServidor) return { adotar: {}, divergencia: null };
    const campos = ['folhas', 'diasPresenca', 'diasCompletos', 'streak'];
    const adotar = {};
    const divergencia = {};
    campos.forEach((campo) => {
      const meu = Number(local[campo] || 0);
      const dele = Number(doServidor[campo] || 0);
      if (dele > meu) adotar[campo] = dele;
      if (dele !== meu) divergencia[campo] = dele - meu;
    });
    return { adotar, divergencia: Object.keys(divergencia).length ? divergencia : null };
  }

  function estado() {
    return {
      ativo: ativo(),
      url: cfg ? cfg.url : null,
      pendentes: outbox().length,
      ultimoEm: cfg ? cfg.ultimoEm || null : null,
      dispositivoId: cfg ? cfg.dispositivoId : null,
    };
  }

  function limpar() {
    localStorage.removeItem(KEY_CFG);
    localStorage.removeItem(KEY_OUTBOX);
    cfg = null;
  }

  configurarPelaUrl();

  window.CapiSync = {
    ativo, registrar, sincronizar, reconciliar, estado, limpar,
    aoMudar: (fn) => { aoMudar = fn; },
  };
})();
