/* ═══ Telemetria local ═══
   O piloto precisa medir o que veio validar (RNF07: onboarding_completo, registro_*, dia_completo,
   evolucao, compra_loja, retenção D1/D7/D30) — mas não há backend, e registro de hábito é dado de
   saúde. A saída honesta: TUDO fica no aparelho. Nada é enviado automaticamente, para lugar nenhum.

   O participante decide o que sai: o botão de feedback leva só o RESUMO agregado (contagens e
   datas, sem o que ele comeu ou bebeu), e "exportar meus dados" leva o log completo, se ele quiser.
   "Excluir tudo" apaga isto junto. É o mesmo princípio do resto do app: nunca vigiar, nunca cobrar.

   Quando existir backend (RF12), este módulo vira o produtor de eventos do pipeline — os nomes já
   são os do RNF07 e o identificador já é o usuarioId pseudonimizado do portão. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Telemetria = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KEY = 'capi-eventos-v1';
  const TETO = 800; /* ~2 meses de uso intenso; acima disso descarta os mais antigos */

  /* catálogo fechado: nome fora desta lista é erro de programação, não evento novo */
  const EVENTOS = [
    'app_aberto', 'onboarding_completo',
    'registro_agua', 'registro_refeicao', 'registro_movimento', 'registro_treino',
    'dia_parcial', 'dia_completo', 'dia_epico', 'evolucao', 'soneca_usada', 'sequencia_perdida',
    'compra_loja', 'item_equipado',
    'abriu_historico', 'abriu_loja', 'abriu_perfil', 'abriu_privacidade',
    'feedback_aberto', 'dados_exportados', 'dados_importados', 'dados_excluidos',
  ];

  let contexto = { usuarioId: null };

  const hoje = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  };

  function ler() {
    try {
      const raw = localStorage.getItem(KEY);
      const dados = raw ? JSON.parse(raw) : null;
      if (!dados || !Array.isArray(dados.eventos)) return { desde: hoje(), eventos: [] };
      return dados;
    } catch (_e) {
      return { desde: hoje(), eventos: [] };
    }
  }
  const gravar = (dados) => {
    try { localStorage.setItem(KEY, JSON.stringify(dados)); } catch (_e) { /* cota cheia: seguir sem medir */ }
  };

  function definirContexto(ctx) {
    contexto = Object.assign({}, contexto, ctx || {});
  }

  /* props devem ser NÚMEROS ou rótulos curtos — nunca o conteúdo do registro do usuário */
  function registrar(nome, props) {
    if (!EVENTOS.includes(nome)) {
      console.warn('[telemetria] evento fora do catálogo:', nome);
      return;
    }
    const dados = ler();
    dados.eventos.push(Object.assign(
      { e: nome, t: new Date().toISOString(), d: hoje() },
      props || {},
    ));
    if (dados.eventos.length > TETO) dados.eventos = dados.eventos.slice(-TETO);
    gravar(dados);
  }

  /* Resumo agregado: é isto que vai no e-mail de feedback. Sem nenhum detalhe de hábito. */
  function resumo() {
    const dados = ler();
    const evs = dados.eventos;
    if (!evs.length) return { desde: dados.desde, total: 0, dias: 0, contagem: {}, retencao: {} };

    const contagem = {};
    const dias = new Set();
    evs.forEach((ev) => {
      contagem[ev.e] = (contagem[ev.e] || 0) + 1;
      dias.add(ev.d);
    });

    const ordenados = [...dias].sort();
    const primeiro = dados.desde || ordenados[0];
    const diff = (a, b) => Math.round(
      (new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5,
    );
    const desdeInicio = diff(primeiro, ordenados[ordenados.length - 1]);
    /* retenção clássica: voltou no dia seguinte? na 1ª semana? no 1º mês? */
    const voltouEm = (limite) => ordenados.some((d) => {
      const n = diff(primeiro, d);
      return n >= 1 && n <= limite;
    });

    return {
      desde: primeiro,
      total: evs.length,
      dias: dias.size,
      janelaDias: desdeInicio + 1,
      contagem,
      retencao: { d1: voltouEm(1), d7: voltouEm(7), d30: voltouEm(30) },
      ultimoDia: ordenados[ordenados.length - 1],
    };
  }

  /* Linhas legíveis para colar no e-mail de feedback (o participante vê o que está mandando) */
  function resumoTexto() {
    const r = resumo();
    if (!r.total) return 'sem eventos registrados ainda';
    const principais = ['app_aberto', 'registro_agua', 'registro_refeicao', 'registro_movimento',
      'registro_treino', 'dia_parcial', 'dia_completo', 'evolucao', 'compra_loja'];
    const linhas = principais
      .filter((e) => r.contagem[e])
      .map((e) => `${e}: ${r.contagem[e]}`);
    return [
      `desde ${r.desde} · ${r.dias} dia(s) com uso em ${r.janelaDias} dia(s)`,
      `voltou: D1 ${r.retencao.d1 ? 'sim' : 'não'} · D7 ${r.retencao.d7 ? 'sim' : 'não'} · D30 ${r.retencao.d30 ? 'sim' : 'não'}`,
      linhas.join(' · '),
    ].join('\n');
  }

  const exportar = () => ler();
  const limpar = () => localStorage.removeItem(KEY);

  return { EVENTOS, definirContexto, registrar, resumo, resumoTexto, exportar, limpar };
});
