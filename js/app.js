/* Capi — piloto. A economia vive em js/economia.js; aqui é UI, estado e narração. */
(function () {
  'use strict';

  /* ═══ Economia ═══ As regras vivem em js/economia.js (motor puro, testado no CI).
     Aqui ficam só a UI, o estado persistido e a narração dos eventos. */
  const Ec = window.Economia;
  const Tel = window.Telemetria;
  const R = Ec.REGRAS;
  const ESTAGIOS = R.ESTAGIOS;
  const SONECAS_POR_JANELA = R.SONECAS_POR_JANELA;
  /* o piloto tem uma capivara só; a chave fica para um pet novo entrar sem refatorar */
  const PET = 'capivara';
  const NOME_PADRAO = 'Capi';
  const REFEICOES = [
    { id: 'cafe', nome: 'Café da manhã' },
    { id: 'almoco', nome: 'Almoço' },
    { id: 'jantar', nome: 'Jantar' },
  ];
  const AVALIACOES = [
    { id: 'bem', nome: 'Mandei bem', pts: R.REF.bem },
    { id: 'meio', nome: 'Meio termo', pts: R.REF.meio },
    { id: 'ruim', nome: 'Foi o que deu', pts: R.REF.ruim },
  ];
  const KEY = 'capi-v1';

  /* ═══ Estado ═══ */
  const novoDia = Ec.novoDia;

  let S = null;
  let convidado = null; /* { nome, convite, usuarioId } — vem do portão de convite */

  function estadoInicial() {
    return {
      v: 2, pet: PET, nomePet: '', configurado: false,
      metas: { agua: R.METAS_DEFAULT.agua, passos: R.METAS_DEFAULT.passos },
      folhas: 0, diasCompletos: 0, diasPresenca: 0, streak: 0, ultimoCompleto: null,
      hoje: novoDia(hojeStr(0), R.METAS_DEFAULT.passos, R.METAS_DEFAULT.agua),
      historico: {},
      sonecas: [], /* datas em que a Soneca da Capivara protegeu a sequência */
      inv: [], equip: { chapeu: null, oculos: null, pescoco: null, cenario: [] },
      simDias: 0, modoNoite: null, pendStreakMsg: false,
      ultimaFrase: {},
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      S = raw ? JSON.parse(raw) : estadoInicial();
      sanear();
    } catch (_e) {
      S = estadoInicial();
    }
  }
  /* coage campos numéricos de estados antigos/corrompidos (NaN vira null no JSON) */
  function sanear() {
    const n = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    S.folhas = n(S.folhas, 0); S.diasCompletos = n(S.diasCompletos, 0);
    /* migração: quem já jogava entra com pelo menos os dias completos como presença */
    S.diasPresenca = n(S.diasPresenca, S.diasCompletos);
    S.streak = n(S.streak, 0); S.simDias = n(S.simDias, 0);
    S.metas = S.metas || {};
    S.metas.agua = n(S.metas.agua, R.METAS_DEFAULT.agua);
    S.metas.passos = n(S.metas.passos, R.METAS_DEFAULT.passos);
    const h = S.hoje = S.hoje || novoDia(hojeStr(0), S.metas.passos, S.metas.agua);
    h.metaPassos = n(h.metaPassos, S.metas.passos);
    h.metaAgua = n(h.metaAgua, S.metas.agua);
    S.sonecas = S.sonecas || [];
    h.aguaMl = n(h.aguaMl, 0); h.eAgua = n(h.eAgua, 0); h.eRef = n(h.eRef, 0);
    h.passos = n(h.passos, 0); h.ePassos = n(h.ePassos, 0); h.eTreino = n(h.eTreino, 0);
    h.registros = n(h.registros, 0);
    h.aguaRegs = (h.aguaRegs || []).filter((ml) => Number.isFinite(ml) && ml > 0);
    h.refeicoes = h.refeicoes || { cafe: null, almoco: null, jantar: null };
    Ec.recalcularDia(h); /* caches por pilar são derivados: nunca confiar no que veio do storage */
    /* piloto passou a ter só a capivara: quem estava com outro pet mantém TODO o progresso */
    if (S.pet !== PET) S.pet = PET;
    /* estado de antes do flag explícito: quem já deu nome ao pet passou pelo onboarding */
    if (typeof S.configurado !== 'boolean') S.configurado = !!S.nomePet;
    S.equip = S.equip || { chapeu: null, oculos: null, pescoco: null, cenario: [] };
    S.equip.cenario = S.equip.cenario || [];
    S.ultimaFrase = S.ultimaFrase || {};
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

  /* datas: locais, com offset de simulação da demo */
  function dataLocal(offsetDias) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDias);
    return d;
  }
  const fmtData = Ec.fmtData;
  function hojeStr(simDias) {
    return fmtData(dataLocal(simDias == null ? (S ? S.simDias : 0) : simDias));
  }
  const energiaHoje = () => Ec.energiaDia(S.hoje);
  const estagioIdx = () => Ec.estagioIdx(Ec.diasDeProgresso(S));
  const sonecasDisponiveis = (hoje) => Ec.sonecasDisponiveis(S.sonecas, hoje);

  /* virada de dia: fecha o(s) dia(s) anterior(es); perder streak não tira nada já ganho.
     Soneca da Capivara: dias perdidos são cobertos automática e retroativamente (2 por 30 dias) —
     a sequência só quebra quando as sonecas acabam. */
  function rollover() {
    const hoje = hojeStr();
    if (S.hoje.data === hoje) return false;
    S.historico[S.hoje.data] = {
      energia: energiaHoje(), completo: S.hoje.completo, registros: S.hoje.registros,
    };
    const virada = Ec.avaliarVirada(S, hoje);
    S.streak = virada.streak;
    virada.sonecasNovas.forEach((d) => S.sonecas.push(d));
    if (virada.tipo === 'soneca') { S.pendSonecaMsg = true; Tel.registrar('soneca_usada', { dias: virada.sonecasNovas.length }); }
    if (virada.tipo === 'quebra') { S.pendStreakMsg = true; Tel.registrar('sequencia_perdida'); }
    S.hoje = novoDia(hoje, S.metas.passos, S.metas.agua);
    save();
    return true;
  }

  /* ═══ Marcos: o motor concede, a UI narra ═══ */
  function checarMarcos(opts) {
    const silencioso = opts && opts.silencioso;
    const eventos = Ec.concederFolhas(S.hoje, S);
    eventos.forEach((ev) => {
      if (silencioso) {
        if (ev.evoluiuPara != null) S._evoPend = ev.evoluiuPara;
        return;
      }
      if (ev.tipo === 'registro') {
        toast(`+${ev.delta} folhas — primeiro registro do dia`);
      } else if (ev.tipo === 'parcial') {
        Tel.registrar('dia_parcial');
        toast(`+${ev.delta} folhas — dia parcial garantido (${ev.total} hoje)`);
        falar('dia_parcial');
        if (ev.evoluiuPara != null) mostrarEvolucao(ev.evoluiuPara);
      } else if (ev.tipo === 'completo') {
        Tel.registrar('dia_completo', { streak: ev.streak });
        toast(`+${ev.delta} folhas — dia completo!${ev.bonus ? ` (bônus de sequência +${ev.bonus})` : ''}`);
        falar('dia_completo');
        celebrar();
        if (ev.evoluiuPara != null) mostrarEvolucao(ev.evoluiuPara);
      } else if (ev.tipo === 'epico') {
        Tel.registrar('dia_epico');
        toast('Barra 100 — dia épico!');
      }
    });
    save();
  }

  /* ═══ Registros ═══ */
  function registrarAgua(ml) {
    rollover();
    S.hoje.aguaMl += ml;
    S.hoje.aguaRegs.push(ml);
    Ec.recalcularDia(S.hoje);
    S.hoje.registros += 1;
    Tel.registrar('registro_agua', { ml });
    fecharSheet(); /* a reação do pet é o coração do loop — não pode ficar atrás do overlay */
    reagir('agua');
    if (S.hoje.aguaMl >= R.AGUA_ALERTA_DIA && !S.hoje.avisoAgua) {
      /* teto de segurança: avisa com carinho, nunca bloqueia o registro */
      S.hoje.avisoAgua = true;
      toast('Já é bastante água pra um dia — se cuida, tá?');
    }
    checarMarcos();
    renderTudo();
  }
  function removerAgua(idx) {
    if (rollover()) { renderTudo(); renderSheetAgua(); toast('O dia virou — registros de hoje recomeçaram'); return; }
    if (idx < 0 || idx >= S.hoje.aguaRegs.length) return;
    S.hoje.aguaMl -= S.hoje.aguaRegs[idx];
    S.hoje.aguaRegs.splice(idx, 1);
    Ec.recalcularDia(S.hoje);
    S.hoje.registros = Math.max(0, S.hoje.registros - 1);
    save();
    renderTudo();
    renderSheetAgua();
  }
  function registrarRefeicao(refId, avalId) {
    rollover();
    if (!S.hoje.refeicoes[refId]) S.hoje.registros += 1;
    S.hoje.refeicoes[refId] = avalId;
    Ec.recalcularDia(S.hoje);
    Tel.registrar('registro_refeicao', { aval: avalId });
    fecharSheet();
    reagir('refeicao_' + avalId);
    checarMarcos();
    renderTudo();
    renderSheetRef();
  }
  function setPassos(n) {
    rollover();
    const meta = S.hoje.metaPassos;
    S.hoje.passos = Math.max(0, n);
    Ec.recalcularDia(S.hoje);
    if (S.hoje.passos >= meta && !S.hoje.metaPassosBatida) {
      S.hoje.metaPassosBatida = true;
      S.hoje.registros += 1;
      Tel.registrar('registro_movimento');
      fecharSheet();
      reagir('passos_meta');
    }
    checarMarcos();
    renderTudo();
    renderSheetMov();
  }
  function treinar() {
    rollover();
    if (S.hoje.treinou) { toast('Treino de hoje já registrado (teto 1/dia no MVP)'); return; }
    S.hoje.treinou = true;
    Ec.recalcularDia(S.hoje);
    S.hoje.registros += 1;
    Tel.registrar('registro_treino');
    fecharSheet();
    reagir('treino');
    checarMarcos();
    renderTudo();
    renderSheetMov();
  }

  /* ═══ Frases (RF06): sorteio sem repetição imediata ═══ */
  function frase(trigger) {
    const pack = (FRASES[S.pet] || {})[trigger];
    if (!pack || !pack.length) return null;
    let idx = Math.floor(Math.random() * pack.length);
    if (pack.length > 1 && idx === S.ultimaFrase[trigger]) idx = (idx + 1) % pack.length;
    S.ultimaFrase[trigger] = idx;
    return pack[idx];
  }

  let bubbleTimer = null;
  function falar(trigger) {
    const txt = frase(trigger);
    if (!txt) return;
    const b = document.getElementById('bubble');
    document.getElementById('bubble-text').textContent = txt;
    b.classList.remove('hidden');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.add('hidden'), 4600);
  }

  /* reação imediata: animação de comer/beber + fala (RF06) */
  let tempStateTimer = null;
  let tempState = null;
  function reagir(trigger) {
    tempState = trigger === 'treino' || trigger === 'passos_meta' ? 'comemorando' : 'comendo';
    clearTimeout(tempStateTimer);
    tempStateTimer = setTimeout(() => { tempState = null; renderPet(); }, 1700);
    falar(trigger);
    renderPet();
  }
  function celebrar() {
    tempState = 'comemorando';
    clearTimeout(tempStateTimer);
    tempStateTimer = setTimeout(() => { tempState = null; renderPet(); }, 3500);
    confete();
    renderPet();
  }

  /* ═══ Estado visual do pet ═══ */
  function ehNoite() {
    if (S.modoNoite !== null) return S.modoNoite;
    const h = new Date().getHours();
    return h >= 22 || h < 7;
  }
  function estadoPet() {
    if (tempState) return tempState;
    if (ehNoite()) return 'dormindo';
    const e = energiaHoje();
    if (e >= 100) return 'feliz';
    if (e >= 50) return 'feliz';
    if (S.hoje.registros > 0 || e > 0) return 'neutro';
    return 'molenga';
  }

  /* ═══ Render ═══ */
  const $ = (id) => document.getElementById(id);
  const fmtNum = (n) => n.toLocaleString('pt-BR');

  function renderPet() {
    const holder = $('pet-holder');
    holder.innerHTML = PetArt.pet(S.pet, { stage: estagioIdx(), equip: S.equip });
    holder.className = 'pet-holder st-' + estadoPet();
  }
  function renderScene() {
    $('scene').innerHTML = PetArt.scene(ehNoite() ? 'noite' : 'dia', S.equip.cenario);
  }
  function renderHud() {
    $('hud-nome').textContent = S.nomePet || NOME_PADRAO;
    $('hud-estagio').textContent = ESTAGIOS[estagioIdx()].nome;
    $('hud-folhas').textContent = fmtNum(S.folhas);
    $('hud-streak').textContent = S.streak;
  }
  function renderEnergia() {
    const eA = S.hoje.eAgua, eR = S.hoje.eRef, eM = S.hoje.ePassos + S.hoje.eTreino;
    const total = eA + eR + eM;
    $('energy-num').innerHTML = `${total}<span class="energy-max">/100</span>`;
    $('seg-agua').style.width = eA + '%';
    $('seg-ref').style.width = eR + '%';
    $('seg-mov').style.width = eM + '%';
    const bar = document.querySelector('.energy-bar');
    if (bar) bar.setAttribute('aria-valuenow', total);
    $('qb-agua-sub').textContent = fmtNum(S.hoje.aguaMl) + ' ml';
    $('qb-ref-sub').textContent = REFEICOES.filter((r) => S.hoje.refeicoes[r.id]).length + '/3';
    $('qb-mov-sub').textContent = fmtNum(S.hoje.passos) + ' passos';
  }
  function renderTudo() {
    rollover();
    renderHud();
    renderEnergia();
    renderPet();
    renderScene();
  }

  /* toast */
  let toastTimer = null;
  const toastFila = [];
  function toast(msg) {
    toastFila.push(msg);
    if (!toastTimer) proximoToast();
  }
  function proximoToast() {
    const t = $('toast');
    if (!toastFila.length) { t.classList.add('hidden'); toastTimer = null; return; }
    t.textContent = toastFila.shift();
    t.classList.remove('hidden');
    toastTimer = setTimeout(proximoToast, 2100);
  }

  /* confete */
  function confete() {
    const c = $('confetti');
    const cores = ['#F2694E', '#FFD966', '#6BAE3E', '#4FA8DE', '#F06AA0'];
    c.innerHTML = '';
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = cores[i % cores.length];
      p.style.animationDuration = 1.4 + Math.random() * 1.2 + 's';
      p.style.animationDelay = Math.random() * 0.5 + 's';
      c.appendChild(p);
    }
    c.classList.remove('hidden');
    setTimeout(() => c.classList.add('hidden'), 3200);
  }

  /* ═══ Sheets ═══ */
  let sheetAberto = null;
  function abrirSheet(id) {
    fecharSheet();
    $('overlay').classList.remove('hidden');
    $(id).classList.remove('hidden');
    sheetAberto = id;
  }
  function fecharSheet() {
    if (!sheetAberto) return;
    $(sheetAberto).classList.add('hidden');
    $('overlay').classList.add('hidden');
    sheetAberto = null;
  }

  function renderSheetAgua() {
    $('agua-hoje').textContent = fmtNum(S.hoje.aguaMl) + ' ml';
    $('agua-meta').textContent = fmtNum(S.hoje.metaAgua) + ' ml';
    const box = $('agua-registros');
    box.innerHTML = S.hoje.aguaRegs.length ? '' : '<span class="sheet-meta">Nenhum registro hoje ainda.</span>';
    S.hoje.aguaRegs.forEach((ml, i) => {
      const chip = document.createElement('span');
      chip.className = 'agua-reg';
      chip.innerHTML = `<span class="mono">${ml} ml</span>`;
      const rm = document.createElement('button');
      rm.textContent = '×';
      rm.title = 'Excluir registro';
      rm.addEventListener('click', () => removerAgua(i));
      chip.appendChild(rm);
      box.appendChild(chip);
    });
  }

  function renderSheetRef() {
    const box = $('ref-lista');
    box.innerHTML = '';
    REFEICOES.forEach((r) => {
      const feito = S.hoje.refeicoes[r.id];
      const div = document.createElement('div');
      div.className = 'ref-item';
      div.innerHTML = `<h4>${r.nome}${feito ? '<span class="ref-feito">registrada</span>' : ''}</h4>`;
      const ops = document.createElement('div');
      ops.className = 'ref-opcoes';
      AVALIACOES.forEach((a) => {
        const b = document.createElement('button');
        b.className = 'ref-op' + (feito === a.id ? ' sel' : '');
        b.innerHTML = `${a.nome}<small class="mono">+${a.pts}</small>`;
        b.addEventListener('click', () => registrarRefeicao(r.id, a.id));
        ops.appendChild(b);
      });
      div.appendChild(ops);
      box.appendChild(div);
    });
  }

  function renderSheetMov() {
    $('mov-passos-num').textContent = fmtNum(S.hoje.passos);
    $('mov-passos-meta').textContent = fmtNum(S.hoje.metaPassos);
    const frac = Math.min(1, S.hoje.passos / S.hoje.metaPassos);
    $('ring-fg').style.strokeDashoffset = String(326.7 * (1 - frac));
    $('treino-status').textContent = S.hoje.treinou
      ? 'Treino de hoje registrado (+15 de energia).'
      : 'Vale academia, luta, dança, pedalada... você que sabe.';
  }

  function renderLoja() {
    $('loja-folhas').textContent = fmtNum(S.folhas);
    const grid = $('loja-grid');
    grid.innerHTML = '';
    PetArt.ITEMS.forEach((item) => {
      const tem = S.inv.includes(item.id);
      const equipado = item.slot === 'cenario'
        ? S.equip.cenario.includes(item.id)
        : S.equip[item.slot] === item.id;
      const div = document.createElement('div');
      div.className = 'loja-item' + (equipado ? ' equipado' : '');
      div.innerHTML = `<div class="li-art">${PetArt.itemIcon(item)}</div><strong>${item.nome}</strong>`;
      const b = document.createElement('button');
      if (!tem) {
        const da = S.folhas >= item.preco;
        b.className = 'li-btn ' + (da ? 'comprar' : 'caro');
        b.innerHTML = `${item.preco} folhas`;
        b.addEventListener('click', () => {
          if (S.folhas < item.preco) { toast('Folhas insuficientes — complete dias para ganhar mais'); return; }
          S.folhas -= item.preco;
          S.inv.push(item.id);
          Tel.registrar('compra_loja', { preco: item.preco });
          equipar(item);
          falar('compra_loja');
          save();
          renderTudo();
          renderLoja();
        });
      } else {
        b.className = 'li-btn';
        b.textContent = equipado ? 'Tirar' : 'Equipar';
        b.addEventListener('click', () => {
          if (equipado) desequipar(item); else equipar(item);
          save();
          renderTudo();
          renderLoja();
        });
      }
      div.appendChild(b);
      grid.appendChild(div);
    });
  }
  function equipar(item) {
    if (item.slot === 'cenario') {
      if (!S.equip.cenario.includes(item.id)) S.equip.cenario.push(item.id);
    } else {
      S.equip[item.slot] = item.id;
    }
  }
  function desequipar(item) {
    if (item.slot === 'cenario') {
      S.equip.cenario = S.equip.cenario.filter((id) => id !== item.id);
    } else {
      S.equip[item.slot] = null;
    }
  }

  function renderHistorico() {
    const hoje = hojeStr();
    const [y, m] = hoje.split('-').map(Number);
    const primeiro = new Date(y, m - 1, 1);
    const nDias = new Date(y, m, 0).getDate();
    const nomeMes = primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    $('hist-resumo').innerHTML =
      `<strong>${nomeMes}</strong> · ${fmtNum(S.diasPresenca)} dia(s) com a Capi · ${fmtNum(S.diasCompletos)} completo(s) · sequência: ${S.streak} · sonecas: ${sonecasDisponiveis(hoje)}/${SONECAS_POR_JANELA}`;
    const cal = $('hist-cal');
    cal.innerHTML = '';
    ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach((d) => {
      const el = document.createElement('div');
      el.className = 'hist-dow';
      el.textContent = d;
      cal.appendChild(el);
    });
    for (let i = 0; i < primeiro.getDay(); i++) {
      const el = document.createElement('div');
      el.className = 'hist-day vazio';
      cal.appendChild(el);
    }
    const folhaSvg = (op) => `<svg class="hleaf" viewBox="0 0 24 24" style="opacity:${op}"><path d="M20 4C10 4 4 9 4 16c0 2 1 4 2 4 .6 0 .8-.7 1.2-1.6C8.6 15.6 12 11 17 9c-4 3-7 7-8.3 10.4-.2.5.1.6.8.6 8 0 11-6 10.5-16z" fill="#6BAE3E"/></svg>`;
    for (let d = 1; d <= nDias; d++) {
      const dataStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const info = dataStr === S.hoje.data
        ? { energia: energiaHoje(), completo: S.hoje.completo, registros: S.hoje.registros }
        : S.historico[dataStr];
      const el = document.createElement('div');
      el.className = 'hist-day' + (dataStr === hoje ? ' hoje' : '');
      let marca = '';
      if (info) {
        if (info.completo) { marca = folhaSvg(1); el.classList.add('d-full'); }
        else if (info.energia >= 50) marca = folhaSvg(0.45);
        else if (info.energia > 0 || info.registros > 0) marca = '<span class="hdot"></span>';
      }
      el.innerHTML = `<span>${d}</span>${marca}`;
      cal.appendChild(el);
    }
  }

  function renderPerfil() {
    const linhaConvite = $('perfil-convite');
    if (convidado && convidado.nome) {
      linhaConvite.classList.remove('hidden');
      $('perfil-convite-nome').textContent = convidado.nome;
    } else {
      linhaConvite.classList.add('hidden');
    }
    $('cfg-nome').value = S.nomePet;
    $('cfg-agua').value = String(S.metas.agua);
    $('cfg-passos').value = String(S.metas.passos);
  }

  /* ═══ Evolução (RF09) ═══ */
  function mostrarEvolucao(idx) {
    $('evo-pet').innerHTML = PetArt.pet(S.pet, { stage: idx, equip: S.equip });
    $('evo-titulo').textContent = `${S.nomePet || NOME_PADRAO} evoluiu!`;
    $('evo-sub').textContent = `Agora é ${ESTAGIOS[idx].nome} — ${ESTAGIOS[idx].dias} dias de presença. Consistência, não perfeição.`;
    $('evo').classList.remove('hidden');
    Tel.registrar('evolucao', { estagio: idx });
    confete();
    falar('evolucao');
  }

  /* ═══ Onboarding (RF01) ═══ */
  function initOnboarding() {
    $('onboarding').classList.remove('hidden');
    $('ob-hero-pet').innerHTML = PetArt.pet(PET, { stage: 1 });
    document.querySelector('[data-ob-next]').addEventListener('click', () => passoOb(2));
    /* LGPD: dado de saúde exige consentimento explícito — o botão só destrava com o aceite */
    $('ob-consent').addEventListener('change', () => {
      $('ob-finish').disabled = !$('ob-consent').checked;
    });
    $('ob-privacidade').addEventListener('click', () => {
      Tel.registrar('abriu_privacidade');
      abrirSheet('sheet-privacidade');
    });
    $('ob-finish').addEventListener('click', () => {
      if (!$('ob-consent').checked) return;
      S.consentimento = { em: new Date().toISOString(), versao: 1 };
      S.pet = PET;
      S.configurado = true;
      S.nomePet = $('ob-nome').value.trim() || NOME_PADRAO;
      S.metas.agua = Number($('ob-agua').value);
      S.metas.passos = Number($('ob-passos').value);
      S.hoje.metaPassos = S.metas.passos; /* o dia ainda nem começou de fato */
      S.hoje.metaAgua = S.metas.agua;
      save();
      Tel.registrar('onboarding_completo');
      $('onboarding').classList.add('hidden');
      initApp();
    });
  }
  function passoOb(n) {
    document.querySelectorAll('.ob-step').forEach((s) => {
      s.classList.toggle('hidden', Number(s.dataset.step) !== n);
    });
  }

  /* ═══ Demo ═══ */
  function completarDiaAtual(silencioso) {
    rollover();
    while (S.hoje.aguaMl < S.hoje.metaAgua) {
      S.hoje.aguaRegs.push(250);
      S.hoje.aguaMl += 250;
      S.hoje.registros += 1;
    }
    REFEICOES.forEach((r) => {
      if (!S.hoje.refeicoes[r.id]) S.hoje.registros += 1;
      S.hoje.refeicoes[r.id] = 'bem';
    });
    S.hoje.passos = Math.max(S.hoje.passos, S.hoje.metaPassos);
    S.hoje.metaPassosBatida = true;
    if (!S.hoje.treinou) { S.hoje.treinou = true; S.hoje.registros += 1; }
    Ec.recalcularDia(S.hoje);
    checarMarcos({ silencioso });
  }

  function initDemo() {
    /* O painel de demonstração ("+7 dias completos", "+50 folhas") contamina o playtest se ficar à
       mão do convidado. Fica escondido, e só aparece para quem abrir com ?demo=1 — que gruda neste
       aparelho (e sai com ?demo=0). */
    const url = new URL(location.href);
    const pedido = url.searchParams.get('demo');
    if (pedido === '1') localStorage.setItem('capi-demo', '1');
    if (pedido === '0') localStorage.removeItem('capi-demo');
    if (pedido !== null) {
      url.searchParams.delete('demo');
      history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    }
    if (localStorage.getItem('capi-demo') !== '1') return;
    $('btn-demo').classList.remove('hidden');
    $('btn-demo').addEventListener('click', () => { atualizarDemoInfo(); abrirSheet('sheet-demo'); });
    $('demo-dia').addEventListener('click', () => {
      S.simDias += 1;
      rollover();
      renderTudo();
      atualizarDemoInfo();
      if (S.pendStreakMsg) { S.pendStreakMsg = false; falar('sequencia_perdida'); save(); }
      else if (S.pendSonecaMsg) { S.pendSonecaMsg = false; falar('soneca'); save(); }
      toast('Novo dia: ' + S.hoje.data);
    });
    $('demo-fechar-dia').addEventListener('click', () => {
      completarDiaAtual(false);
      renderTudo();
      atualizarDemoInfo();
    });
    $('demo-7dias').addEventListener('click', () => {
      let restantes = 7;
      while (restantes > 0) {
        if (!S.hoje.completo) {
          completarDiaAtual(true);
          restantes -= 1;
        }
        S.simDias += 1;
        rollover();
      }
      renderTudo();
      atualizarDemoInfo();
      toast('+7 dias completos simulados');
      if (S._evoPend != null) {
        mostrarEvolucao(S._evoPend);
        delete S._evoPend;
        save();
      }
    });
    $('demo-folhas').addEventListener('click', () => {
      S.folhas += 50;
      save();
      renderHud();
      toast('+50 folhas (demo)');
    });
    $('demo-noite').addEventListener('click', () => {
      S.modoNoite = S.modoNoite === null ? true : (S.modoNoite ? false : null);
      save();
      renderTudo();
      atualizarDemoInfo();
      if (S.modoNoite === true) falar('dormindo');
    });
    $('demo-reset').addEventListener('click', () => {
      if (confirm('Zerar todos os dados da PoC?')) {
        localStorage.removeItem(KEY);
        location.reload();
      }
    });
  }
  function atualizarDemoInfo() {
    const modo = S.modoNoite === null ? 'automático (relógio)' : (S.modoNoite ? 'noite forçada' : 'dia forçado');
    $('demo-info').textContent =
      `Data simulada: ${S.hoje.data} · presença: ${S.diasPresenca} · completos: ${S.diasCompletos} · sequência: ${S.streak} · sonecas: ${sonecasDisponiveis(S.hoje.data)}/${SONECAS_POR_JANELA} · modo: ${modo}`;
  }

  /* ═══ App principal ═══ */
  function initApp() {
    $('app').classList.remove('hidden');
    rollover();
    renderTudo();

    $('qb-agua').addEventListener('click', () => { renderSheetAgua(); abrirSheet('sheet-agua'); });
    $('qb-ref').addEventListener('click', () => { renderSheetRef(); abrirSheet('sheet-ref'); });
    $('qb-mov').addEventListener('click', () => { renderSheetMov(); abrirSheet('sheet-mov'); });
    $('btn-loja').addEventListener('click', () => { Tel.registrar('abriu_loja'); renderLoja(); abrirSheet('sheet-loja'); });
    $('btn-historico').addEventListener('click', () => { Tel.registrar('abriu_historico'); renderHistorico(); abrirSheet('sheet-hist'); });
    $('btn-perfil').addEventListener('click', () => { Tel.registrar('abriu_perfil'); renderPerfil(); abrirSheet('sheet-perfil'); });
    $('btn-privacidade').addEventListener('click', () => { Tel.registrar('abriu_privacidade'); abrirSheet('sheet-privacidade'); });

    document.querySelectorAll('.btn-agua').forEach((b) => {
      b.addEventListener('click', () => {
        let ml = b.dataset.ml;
        if (ml === 'custom') {
          const v = prompt('Quantos ml?', '300');
          if (!v) return;
          ml = parseInt(v, 10);
          if (!ml || ml < R.AGUA_MIN_REGISTRO || ml > R.AGUA_MAX_REGISTRO) {
            toast(`Entre ${R.AGUA_MIN_REGISTRO} e ${R.AGUA_MAX_REGISTRO} ml`); return;
          }
        } else {
          ml = Number(ml);
        }
        registrarAgua(ml);
        renderSheetAgua();
      });
    });

    $('btn-treino').addEventListener('click', treinar);
    $('btn-sync-passos').addEventListener('click', () => {
      rollover(); /* antes de ler os passos atuais, senão o total de ontem vaza pro dia novo */
      setPassos(S.hoje.passos + 800 + Math.floor(Math.random() * 2200));
      toast('Passos sincronizados (simulação)');
    });

    $('cfg-nome').addEventListener('change', () => {
      S.nomePet = $('cfg-nome').value.trim() || S.nomePet;
      save();
      renderHud();
    });
    $('cfg-agua').addEventListener('change', () => {
      S.metas.agua = Number($('cfg-agua').value);
      save();
      toast('Nova meta de água vale a partir de amanhã');
    });
    $('cfg-passos').addEventListener('change', () => {
      /* meta do dia fica congelada (S.hoje.metaPassos): mudar config no meio do dia
         não pode conceder dia completo/streak/evolução retroativos */
      S.metas.passos = Number($('cfg-passos').value);
      save();
      toast('Nova meta de passos vale a partir de amanhã');
    });
    $('btn-sair').addEventListener('click', () => {
      if (confirm('Sair do piloto neste aparelho? Seu progresso fica salvo aqui.')) window.PetAcesso.sair();
    });
    /* canal de feedback do piloto: assunto pronto + contexto técnico, sem dado de saúde */
    $('btn-feedback').addEventListener('click', () => {
      Tel.registrar('feedback_aberto');
      const ctx = [
        `estágio: ${ESTAGIOS[estagioIdx()].nome} · presença: ${S.diasPresenca} dia(s)`,
        `dias completos: ${S.diasCompletos} · sequência: ${S.streak}`,
        `convite: ${convidado ? convidado.convite : '—'} · usuário: ${convidado ? convidado.usuarioId : '—'}`,
        `tela: ${window.innerWidth}x${window.innerHeight}`,
        `navegador: ${navigator.userAgent}`,
        '',
        'uso (agregado, sem o que você registrou):',
        Tel.resumoTexto(),
      ].join('\n');
      const corpo = encodeURIComponent(
        `Conta o que achou (o que funcionou, o que irritou, o que faltou):\n\n\n` +
        `---\ncontexto técnico (pode apagar se preferir — ajuda a entender o uso):\n${ctx}\n`,
      );
      location.href = `mailto:peter.sdcosta@gmail.com?subject=${encodeURIComponent('Feedback do piloto — Capi')}&body=${corpo}`;
    });
    $('btn-exportar').addEventListener('click', () => {
      const pacote = { formato: 'capi/1', em: new Date().toISOString(), estado: S, eventos: Tel.exportar() };
      const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `capi-meus-dados-${hojeStr()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      Tel.registrar('dados_exportados');
      toast('Backup salvo — guarde esse arquivo');
    });
    /* importar fecha o par com exportar: sem backend, é o único jeito de não perder o progresso
       ao limpar o navegador ou trocar de aparelho */
    $('btn-importar').addEventListener('click', () => $('arquivo-import').click());
    $('arquivo-import').addEventListener('change', (ev) => {
      const arquivo = ev.target.files && ev.target.files[0];
      if (!arquivo) return;
      const leitor = new FileReader();
      leitor.onload = () => {
        try {
          const pacote = JSON.parse(leitor.result);
          const estado = pacote && pacote.formato === 'capi/1' ? pacote.estado : pacote;
          if (!estado || typeof estado !== 'object' || !('folhas' in estado)) throw new Error('formato');
          if (!confirm('Substituir o progresso deste aparelho pelo do arquivo?')) return;
          localStorage.setItem(KEY, JSON.stringify(estado));
          if (pacote.eventos) localStorage.setItem('capi-eventos-v1', JSON.stringify(pacote.eventos));
          location.reload();
        } catch (_e) {
          toast('Não consegui ler esse arquivo');
        } finally {
          ev.target.value = '';
        }
      };
      leitor.readAsText(arquivo);
    });
    $('btn-excluir').addEventListener('click', () => {
      if (!confirm('Excluir TODOS os seus dados deste aparelho? Apaga o progresso, o histórico de uso e o acesso ao piloto. Não tem volta.')) return;
      /* LGPD: "apaga tudo" tem que apagar tudo mesmo — inclusive a sessão do convite,
         que antes sobrevivia e fazia o app reentrar sozinho */
      Tel.limpar();
      localStorage.removeItem(KEY);
      localStorage.removeItem('capi-demo');
      window.PetAcesso.sair(); /* apaga também a sessão do convite e volta ao portão */
    });

    $('overlay').addEventListener('click', fecharSheet);
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', fecharSheet));
    $('evo-ok').addEventListener('click', () => $('evo').classList.add('hidden'));

    initDemo();

    /* PWA: instala na tela inicial e funciona offline (RNF04) */
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[sw]', e));
      /* Deploy novo assumindo o controle: recarrega UMA vez para não rodar meio app velho, meio app
         novo (o portão quebra se o JS e o convites.json divergirem). Só vale quando JÁ havia um
         service worker no comando — na primeira visita a ativação inicial não é "versão nova" e
         recarregar ali atropelaria o onboarding. */
      if (navigator.serviceWorker.controller) {
        let recarregou = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (recarregou) return;
          recarregou = true;
          location.reload();
        });
      }
    }

    /* saudação de abertura (RF06) — ou aviso de sequência quebrada */
    setTimeout(() => {
      if (S.pendStreakMsg) {
        S.pendStreakMsg = false;
        save();
        falar('sequencia_perdida');
      } else if (S.pendSonecaMsg) {
        S.pendSonecaMsg = false;
        save();
        falar('soneca');
      } else if (ehNoite()) {
        falar('dormindo');
      } else if (S.hoje.registros === 0 && new Date().getHours() >= 12) {
        falar('molenga');
      } else {
        falar('abrir_app');
      }
    }, 700);

    /* pet respira/atualiza estado a cada minuto (troca dia/noite, molenga etc.) */
    setInterval(() => { rollover(); renderTudo(); }, 60000);
    /* app retomado de suspensão: vira o dia antes de qualquer interação */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { rollover(); renderTudo(); }
    });
  }

  /* ═══ Boot ═══ quem dá a partida é o portão de convite (js/acesso.js), depois de validar o acesso. */
  function iniciar(sessao) {
    convidado = sessao || null;
    Tel.definirContexto({ usuarioId: sessao ? sessao.usuarioId : null });
    Tel.registrar('app_aberto');
    load();
    if (!S.configurado) initOnboarding();
    else initApp();
  }
  window.PetApp = { iniciar };
})();
