/* ═══ Portão de convite ═══
   O piloto é fechado: só entra quem tem um código de convite. Cada convite identifica a pessoa
   (para conversarmos sobre o feedback dela) e gera um `usuarioId` pseudonimizado — nunca guardamos
   o código em claro nem qualquer dado pessoal além do nome que a própria pessoa recebeu.

   ATENÇÃO — isto é um portão de cortesia, NÃO um controle de segurança: a validação roda no
   navegador, então quem edita o JavaScript entra sem código. Serve para manter o piloto discreto e
   saber quem está testando; não use este mecanismo para proteger dado sensível. Autenticação real
   é o RF12 (conta + sync), que exige backend.

   Fluxo: ?c=CÓDIGO no link (entra sozinho) ou digitação → SHA-256 comparado com acesso/convites.json
   → sessão salva no device → window.PetApp.iniciar(sessao). */
(function () {
  'use strict';

  const KEY_SESSAO = 'capi-sessao-v1';
  const ARQ_CONVITES = 'acesso/convites.json';
  const TEMPERO = 'capi|convite|v1'; /* evita tabela pronta de hashes; não é segredo */
  const MAX_TENTATIVAS = 4;
  const ESPERA_MS = 8000;

  const $ = (id) => document.getElementById(id);
  const normalizar = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  async function sha256Hex(texto) {
    const bytes = new TextEncoder().encode(texto);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function carregarConvites() {
    /* sem cache: revogar/adicionar convite tem que valer na hora */
    const resp = await fetch(ARQ_CONVITES, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`convites.json: HTTP ${resp.status}`);
    return resp.json();
  }

  function lerSessao() {
    try {
      const raw = localStorage.getItem(KEY_SESSAO);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }
  const salvarSessao = (s) => localStorage.setItem(KEY_SESSAO, JSON.stringify(s));

  function expirado(convite) {
    if (!convite.expira) return false;
    /* compara só a data (local), para o convite valer todo o último dia */
    return new Date(convite.expira + 'T23:59:59') < new Date();
  }

  async function validar(codigo, dados) {
    const limpo = normalizar(codigo);
    if (limpo.length < 8) return { ok: false, motivo: 'curto' };
    const hash = await sha256Hex(limpo + '|' + TEMPERO);
    const convite = (dados.convites || []).find((c) => c.hash === hash);
    if (!convite) return { ok: false, motivo: 'invalido' };
    if (convite.revogado) return { ok: false, motivo: 'revogado' };
    if (expirado(convite)) return { ok: false, motivo: 'expirado' };
    return {
      ok: true,
      sessao: {
        convite: convite.id,
        nome: convite.nome || null,
        org: convite.org || null,
        /* pseudônimo estável derivado do código — sem PII, é o que a telemetria usaria (RNF03) */
        usuarioId: (await sha256Hex(hash + '|usuario')).slice(0, 12),
        em: new Date().toISOString().slice(0, 10),
      },
    };
  }

  /* ── UI do portão ── */
  function mostrarPortao(dados) {
    const portao = $('portao');
    portao.classList.remove('hidden');
    $('portao-pet').innerHTML = window.PetArt.pet('capivara', { stage: 1 });

    const erro = $('portao-erro');
    const input = $('portao-codigo');
    const botao = $('portao-entrar');
    let tentativas = 0;

    const falhar = (msg) => {
      erro.textContent = msg;
      erro.classList.remove('hidden');
      input.setAttribute('aria-invalid', 'true');
    };

    /* máscara leve: agrupa em blocos de 4 conforme digita/cola */
    input.addEventListener('input', () => {
      const limpo = normalizar(input.value).slice(0, 12);
      const partes = [];
      for (let i = 0; i < limpo.length; i += 4) partes.push(limpo.slice(i, i + 4));
      input.value = partes.join('-');
      erro.classList.add('hidden');
      input.removeAttribute('aria-invalid');
    });

    $('portao-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (botao.disabled) return;
      const res = await validar(input.value, dados);
      if (res.ok) {
        salvarSessao(res.sessao);
        entrar(res.sessao);
        return;
      }
      tentativas += 1;
      if (res.motivo === 'curto') falhar('Código incompleto — são 12 caracteres.');
      else if (res.motivo === 'expirado') falhar('Este convite expirou. Pede um novo pra quem te chamou.');
      else if (res.motivo === 'revogado') falhar('Este convite foi encerrado.');
      else falhar('Não reconheci esse código. Confere as letras e tenta de novo.');

      if (tentativas >= MAX_TENTATIVAS) {
        tentativas = 0;
        botao.disabled = true;
        const antes = botao.textContent;
        let resta = Math.ceil(ESPERA_MS / 1000);
        botao.textContent = `Aguarde ${resta}s`;
        const t = setInterval(() => {
          resta -= 1;
          botao.textContent = resta > 0 ? `Aguarde ${resta}s` : antes;
          if (resta <= 0) { clearInterval(t); botao.disabled = false; }
        }, 1000);
      }
    });

    setTimeout(() => input.focus(), 200);
  }

  function entrar(sessao) {
    $('portao').classList.add('hidden');
    window.PetApp.iniciar(sessao);
  }

  function sair() {
    localStorage.removeItem(KEY_SESSAO);
    location.replace(location.pathname); /* volta ao portão sem o ?c= na URL */
  }
  window.PetAcesso = { sair };

  /* ── boot ── */
  (async function () {
    /* código no link (WhatsApp): entra sozinho e some da barra de endereço */
    const url = new URL(location.href);
    const doLink = url.searchParams.get('c') || url.searchParams.get('convite');

    let dados;
    try {
      dados = await carregarConvites();
    } catch (e) {
      /* sem a lista não há como validar — melhor dizer a verdade que travar em branco */
      $('portao').classList.remove('hidden');
      $('portao-erro').textContent = 'Não consegui carregar a lista de convites. Recarrega a página?';
      $('portao-erro').classList.remove('hidden');
      console.error('[acesso]', e);
      return;
    }

    if (doLink) {
      const res = await validar(doLink, dados);
      url.searchParams.delete('c');
      url.searchParams.delete('convite');
      history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
      if (res.ok) { salvarSessao(res.sessao); entrar(res.sessao); return; }
    }

    /* sessão já validada neste device: revalida contra a lista (permite revogar) */
    const sessao = lerSessao();
    if (sessao && sessao.convite) {
      const convite = (dados.convites || []).find((c) => c.id === sessao.convite);
      if (convite && !convite.revogado && !expirado(convite)) { entrar(sessao); return; }
      localStorage.removeItem(KEY_SESSAO);
    }

    mostrarPortao(dados);
  })();
})();
