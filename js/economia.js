/* ═══ Motor de economia — puro, sem IO ═══
   Fonte única da verdade das regras do GDD §5 + decisões de 27/07/2026.
   Usado pelo app (browser, via window.Economia) e pelos testes do CI (Node, via require).
   Invariantes garantidos por teste (tests/economia.test.js):
     · folhas, dias completos e estágio NUNCA diminuem — "nunca pune, nunca tira o ganho";
     · quebra de sequência só zera o bônus;
     · dia completo aos 80 (barra segue até 100 como "dia épico");
     · folhas por FAIXA do dia (3 / 10 / 20 no total), nunca cumulativas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Economia = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const REGRAS = {
    AGUA_TETO: 30,                                  /* proporcional ao volume vs meta do dia */
    REF: { bem: 10, meio: 7, ruim: 5 }, REF_TETO: 30,
    PASSOS_MAX: 25,                                 /* proporcional à meta de passos do dia */
    TREINO: 15,                                     /* teto 1/dia no MVP */
    PARCIAL_EM: 50,
    DIA_COMPLETO_EM: 80,
    BARRA_MAX: 100,
    FOLHAS: { REGISTRO: 3, PARCIAL: 10, COMPLETO: 20, STREAK_PASSO: 5, STREAK_TETO: 25 },
    SONECAS_POR_JANELA: 2,
    SONECA_JANELA_DIAS: 30,
    ESTAGIOS: [
      { nome: 'Filhote', dias: 0 },
      { nome: 'Jovem', dias: 7 },
      { nome: 'Adulto', dias: 21 },
      { nome: 'Lendário', dias: 50 },
    ],
    METAS_DEFAULT: { agua: 2000, passos: 6000 },
    AGUA_MIN_REGISTRO: 100,
    AGUA_MAX_REGISTRO: 3000,
  };

  /* ── datas (strings YYYY-MM-DD, sempre locais) ── */
  function fmtData(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseData(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function somaDias(dataStr, n) {
    const d = parseData(dataStr);
    d.setDate(d.getDate() + n);
    return fmtData(d);
  }
  function diasEntre(a, b) {
    return Math.round((parseData(b) - parseData(a)) / 864e5);
  }

  /* ── dia ── */
  function novoDia(data, metaPassos, metaAgua) {
    return {
      data,
      /* metas congeladas no início do dia: mudar a config no meio do dia não pode
         conceder dia completo/streak/evolução retroativos */
      metaPassos: metaPassos || REGRAS.METAS_DEFAULT.passos,
      metaAgua: metaAgua || REGRAS.METAS_DEFAULT.agua,
      aguaMl: 0, aguaRegs: [], eAgua: 0,
      refeicoes: { cafe: null, almoco: null, jantar: null }, eRef: 0,
      passos: 0, ePassos: 0, metaPassosBatida: false,
      treinou: false, eTreino: 0,
      registros: 0,
      folhasReg: false, folhasParcial: false, completo: false, epico: false,
    };
  }

  /* ── energia por pilar ── */
  const energiaAgua = (aguaMl, metaAgua) =>
    Math.min(REGRAS.AGUA_TETO, Math.floor(REGRAS.AGUA_TETO * Math.max(0, aguaMl) / metaAgua));

  function energiaRefeicoes(refeicoes) {
    let soma = 0;
    for (const k of Object.keys(refeicoes || {})) {
      const aval = refeicoes[k];
      if (aval && REGRAS.REF[aval]) soma += REGRAS.REF[aval];
    }
    return Math.min(REGRAS.REF_TETO, soma);
  }

  const energiaPassos = (passos, metaPassos) =>
    Math.min(REGRAS.PASSOS_MAX, Math.floor(REGRAS.PASSOS_MAX * Math.max(0, passos) / metaPassos));

  const energiaTreino = (treinou) => (treinou ? REGRAS.TREINO : 0);

  /* recalcula os caches por pilar do dia e devolve a energia total */
  function recalcularDia(dia) {
    dia.eAgua = energiaAgua(dia.aguaMl, dia.metaAgua);
    dia.eRef = energiaRefeicoes(dia.refeicoes);
    dia.ePassos = energiaPassos(dia.passos, dia.metaPassos);
    dia.eTreino = energiaTreino(dia.treinou);
    return dia.eAgua + dia.eRef + dia.ePassos + dia.eTreino;
  }
  const energiaDia = (dia) => dia.eAgua + dia.eRef + dia.ePassos + dia.eTreino;

  /* ── faixas, bônus e estágios ── */
  function faixaFolhas(energia) {
    const F = REGRAS.FOLHAS;
    if (energia >= REGRAS.DIA_COMPLETO_EM) return F.COMPLETO;
    if (energia >= REGRAS.PARCIAL_EM) return F.PARCIAL;
    if (energia > 0) return F.REGISTRO;
    return 0;
  }
  const bonusSequencia = (streak) =>
    Math.min(REGRAS.FOLHAS.STREAK_PASSO * Math.max(0, streak - 1), REGRAS.FOLHAS.STREAK_TETO);
  /* total de folhas que um dia rende (faixa + bônus se fechou) — referência dos testes */
  const folhasDoDia = (energia, streakAposFechar) =>
    faixaFolhas(energia) + (energia >= REGRAS.DIA_COMPLETO_EM ? bonusSequencia(streakAposFechar) : 0);

  function estagioIdx(diasCompletos) {
    let idx = 0;
    REGRAS.ESTAGIOS.forEach((e, i) => { if (diasCompletos >= e.dias) idx = i; });
    return idx;
  }
  const estagio = (diasCompletos) => REGRAS.ESTAGIOS[estagioIdx(diasCompletos)];

  /* ── Soneca da Capivara ── */
  function sonecasDisponiveis(sonecas, hoje) {
    const usadas = (sonecas || []).filter((d) => diasEntre(d, hoje) < REGRAS.SONECA_JANELA_DIAS).length;
    return Math.max(0, REGRAS.SONECAS_POR_JANELA - usadas);
  }

  /* Decide o destino da sequência na virada do dia, sem mutar nada.
     'soneca' → dias perdidos cobertos automática e retroativamente; 'quebra' → só o bônus volta ao início. */
  function avaliarVirada(estado, hoje) {
    const res = { tipo: 'nada', streak: estado.streak, sonecasNovas: [] };
    if (!(estado.streak > 0) || !estado.ultimoCompleto) return res;
    const perdidos = diasEntre(estado.ultimoCompleto, hoje) - 1;
    if (perdidos <= 0) return res;
    if (perdidos <= sonecasDisponiveis(estado.sonecas, hoje)) {
      for (let i = 1; i <= perdidos; i++) res.sonecasNovas.push(somaDias(estado.ultimoCompleto, i));
      res.tipo = 'soneca';
    } else {
      res.tipo = 'quebra';
      res.streak = 0;
    }
    return res;
  }

  /* ── concessão incremental de folhas/marcos ──
     Premia ao vivo, mas por FAIXA: cada marco concede só a diferença sobre o anterior,
     de modo que o total do dia bate com folhasDoDia(). Devolve eventos para a UI narrar. */
  function concederFolhas(dia, estado) {
    const F = REGRAS.FOLHAS;
    const e = energiaDia(dia);
    const eventos = [];

    if (e > 0 && !dia.folhasReg) {
      dia.folhasReg = true;
      estado.folhas += F.REGISTRO;
      eventos.push({ tipo: 'registro', delta: F.REGISTRO, total: F.REGISTRO });
    }
    if (e >= REGRAS.PARCIAL_EM && !dia.folhasParcial) {
      dia.folhasParcial = true;
      const delta = F.PARCIAL - F.REGISTRO;
      estado.folhas += delta;
      eventos.push({ tipo: 'parcial', delta, total: F.PARCIAL });
    }
    if (e >= REGRAS.DIA_COMPLETO_EM && !dia.completo) {
      const estagioAntes = estagioIdx(estado.diasCompletos);
      dia.completo = true;
      /* só a virada do dia zera a sequência (a soneca preserva); aqui a corrente continua */
      estado.streak = estado.streak > 0 ? estado.streak + 1 : 1;
      estado.ultimoCompleto = dia.data;
      const bonus = bonusSequencia(estado.streak);
      const delta = F.COMPLETO - F.PARCIAL + bonus;
      estado.folhas += delta;
      estado.diasCompletos += 1;
      const estagioDepois = estagioIdx(estado.diasCompletos);
      eventos.push({
        tipo: 'completo', delta, bonus, total: F.COMPLETO + bonus,
        streak: estado.streak,
        evoluiuPara: estagioDepois > estagioAntes ? estagioDepois : null,
      });
    }
    if (e >= REGRAS.BARRA_MAX && !dia.epico) {
      dia.epico = true;
      eventos.push({ tipo: 'epico', delta: 0 });
    }
    return eventos;
  }

  /* ── simulador de balanceamento (playtest sem esperar dias reais) ──
     PRNG determinístico (mulberry32) para o resultado ser reprodutível no CI. */
  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* perfil do usuário simulado:
       presenca  — chance de abrir o app no dia
       agua      — chance de registrar água | aguaAlvo   — fração da meta que costuma atingir
       refeicao  — chance de registrar cada refeição | qualidade — chance de ser "mandei bem"
       passos    — chance de ter passos no dia | passosAlvo — fração da meta que costuma andar
       treino    — chance de treinar
     Devolve estado final + série diária. */
  function simular(opts) {
    const o = opts || {};
    const dias = o.dias || 30;
    const p = Object.assign(
      {
        presenca: 0.9,
        agua: 0.8, aguaAlvo: 0.85,
        refeicao: 0.8, qualidade: 0.5,
        passos: 0.6, passosAlvo: 0.9,
        treino: 0.3,
      },
      o.perfil || {},
    );
    const rand = prng(o.seed == null ? 42 : o.seed);
    const metas = Object.assign({}, REGRAS.METAS_DEFAULT, o.metas || {});
    const estado = {
      folhas: 0, diasCompletos: 0, streak: 0, ultimoCompleto: null, sonecas: [],
    };
    const inicio = o.inicio || '2026-01-01';
    const serie = [];

    for (let i = 0; i < dias; i++) {
      const data = somaDias(inicio, i);
      const virada = avaliarVirada(estado, data);
      estado.streak = virada.streak;
      virada.sonecasNovas.forEach((d) => estado.sonecas.push(d));

      const dia = novoDia(data, metas.passos, metas.agua);
      if (rand() < p.presenca) {
        if (rand() < p.agua) {
          /* volume gira em torno do alvo do perfil, em múltiplos de 250 ml (copos) */
          const frac = Math.max(0, Math.min(1.3, p.aguaAlvo * (0.7 + 0.6 * rand())));
          const copos = Math.max(1, Math.round(metas.agua * frac / 250));
          dia.aguaMl = copos * 250;
          dia.aguaRegs = Array.from({ length: copos }, () => 250);
          dia.registros += copos;
        }
        ['cafe', 'almoco', 'jantar'].forEach((ref) => {
          if (rand() < p.refeicao) {
            const r = rand();
            dia.refeicoes[ref] = r < p.qualidade ? 'bem' : (r < p.qualidade + (1 - p.qualidade) * 0.7 ? 'meio' : 'ruim');
            dia.registros += 1;
          }
        });
        if (rand() < p.passos) {
          dia.passos = Math.floor(metas.passos * Math.max(0, p.passosAlvo * (0.6 + 0.8 * rand())));
          dia.metaPassosBatida = dia.passos >= metas.passos;
          dia.registros += 1;
        }
        if (rand() < p.treino) { dia.treinou = true; dia.registros += 1; }
      }
      const energia = recalcularDia(dia);
      const folhasAntes = estado.folhas;
      const eventos = concederFolhas(dia, estado);
      serie.push({
        data, energia, completo: dia.completo, streak: estado.streak,
        folhasGanhas: estado.folhas - folhasAntes, folhas: estado.folhas,
        soneca: virada.tipo === 'soneca', quebra: virada.tipo === 'quebra',
        eventos: eventos.map((ev) => ev.tipo),
      });
    }
    return { estado, serie, estagio: estagio(estado.diasCompletos) };
  }

  return {
    REGRAS,
    fmtData, parseData, somaDias, diasEntre,
    novoDia,
    energiaAgua, energiaRefeicoes, energiaPassos, energiaTreino, recalcularDia, energiaDia,
    faixaFolhas, bonusSequencia, folhasDoDia, estagioIdx, estagio,
    sonecasDisponiveis, avaliarVirada, concederFolhas,
    simular,
  };
});
