/* Arte SVG dos pets, cenário e itens da loja — estilo inspirado no design system do Duolingo
   (design.duolingo.com/illustration): 3 formas básicas (retângulo arredondado, círculo,
   triângulo arredondado), ~15 formas por personagem, perspectiva chapada, sem contornos,
   olhos-pílula com pupila baixa, boca assimétrica, pés flutuantes e sombra em pílula.
   Paleta oficial deles: Grizzly #A56644, Monkey #E5A259, Eel #4B4B4B, Polar #F7F7F7,
   Bee #FFC800, Fox #FF9600, Lion #FFB100, Canary #FFF5D3, Macaw #1CB0F6, Owl #58CC02…

   O piloto tem UM pet (a capivara). A API mantém a chave do pet (`pet('capivara', …)`) para que
   um pet novo entre sem refatorar nada — ver "pets extras" no roadmap.

   Estados visuais controlados por classes CSS no contêiner:
   .eyes-open/.eyes-half/.eyes-closed, .mouth-smile/.mouth-flat/.mouth-open, .zzz */
(function () {
  'use strict';

  const C = {
    /* pets — paleta terrosa, menos saturada (tom mais adulto) */
    capiBody: '#9E6C4B', capiMuzzle: '#C79B6B', capiDark: '#46352A', capiEar: '#7E5238',
    /* base Duolingo (acentos, itens, cenário) */
    grizzly: '#A56644', monkey: '#E5A259', eel: '#4B4B4B', polar: '#F7F7F7',
    bee: '#FFC800', fox: '#FF9600', lion: '#FFB100', canary: '#FFF5D3',
    macaw: '#1CB0F6', whale: '#1899D6', owl: '#58CC02', turtle: '#A5ED6E',
    treefrog: '#58A700', iguana: '#DDF4FF', narwhal: '#1453A3', humpback: '#2B70C9',
    cardinal: '#FF4B4B', fireant: '#EA2B2B', crab: '#FF7878', starfish: '#FFAADE',
    duck: '#FBE56D', guineapig: '#CD7900', wolf: '#777777',
  };

  /* ── acessórios (arte local centrada em 0,0; chapéus crescem em -y a partir da base y=0) ── */
  const ITEM_ART = {
    bone: `<path d="M-26 0 A26 24 0 0 1 26 0 Z" fill="${C.macaw}"/><rect x="0" y="-5" width="36" height="9" rx="4.5" fill="${C.whale}"/><circle cx="0" cy="-22" r="4" fill="${C.whale}"/>`,
    'chapeu-festa': `<path d="M-19 0 L19 0 Q6 -38 0 -44 Q-6 -38 -19 0 Z" fill="${C.cardinal}"/><path d="M-13 -14 Q0 -20 13 -14 L10 -22 Q0 -27 -10 -22 Z" fill="${C.bee}"/><circle cx="0" cy="-44" r="6" fill="${C.bee}"/>`,
    cartola: `<rect x="-30" y="-7" width="60" height="9" rx="4.5" fill="${C.eel}"/><rect x="-18" y="-42" width="36" height="37" rx="8" fill="${C.eel}"/><rect x="-18" y="-16" width="36" height="7" fill="${C.cardinal}"/>`,
    coroa: `<path d="M-24 0 Q-26 -4 -24 -20 Q-16 -8 -12 -12 Q-4 -24 0 -26 Q4 -24 12 -12 Q16 -8 24 -20 Q26 -4 24 0 Z" fill="${C.bee}"/><circle cx="0" cy="-7" r="3.5" fill="${C.cardinal}"/>`,
    'chapeu-palha': `<rect x="-38" y="-6" width="76" height="10" rx="5" fill="${C.duck}"/><path d="M-22 -4 A22 20 0 0 1 22 -4 Z" fill="${C.canary}"/><rect x="-22" y="-12" width="44" height="7" rx="3.5" fill="${C.grizzly}"/>`,
    'oculos-sol': `<rect x="-36" y="-9" width="30" height="19" rx="9" fill="${C.eel}"/><rect x="6" y="-9" width="30" height="19" rx="9" fill="${C.eel}"/><rect x="-7" y="-5" width="14" height="4" rx="2" fill="${C.eel}"/>`,
    'oculos-coracao': `<path d="M-21 -8 C-25 -14 -35 -12 -35 -4 C-35 2 -27 8 -21 11 C-15 8 -7 2 -7 -4 C-7 -12 -17 -14 -21 -8 Z" fill="${C.starfish}"/><path d="M21 -8 C17 -14 7 -12 7 -4 C7 2 15 8 21 11 C27 8 35 2 35 -4 C35 -12 25 -14 21 -8 Z" fill="${C.starfish}"/><rect x="-8" y="-5" width="16" height="4" rx="2" fill="${C.starfish}"/>`,
    laco: `<path d="M-4 0 Q-24 -14 -26 -10 Q-28 -6 -26 10 Q-24 14 -4 0 Z" fill="${C.cardinal}"/><path d="M4 0 Q24 -14 26 -10 Q28 -6 26 10 Q24 14 4 0 Z" fill="${C.cardinal}"/><circle cx="0" cy="0" r="6" fill="${C.fireant}"/>`,
    cachecol: `<rect x="-30" y="-7" width="60" height="15" rx="7.5" fill="${C.fox}"/><rect x="12" y="4" width="14" height="28" rx="7" fill="${C.fox}"/><rect x="12" y="14" width="14" height="4" rx="2" fill="${C.bee}"/><rect x="12" y="22" width="14" height="4" rx="2" fill="${C.bee}"/><rect x="-18" y="-7" width="5" height="15" rx="2.5" fill="${C.bee}"/><rect x="0" y="-7" width="5" height="15" rx="2.5" fill="${C.bee}"/>`,
  };

  /* itens de cenário (desenhados direto no cenário 320x300) */
  const SCENE_ART = {
    placa: `<g><rect x="22" y="196" width="6" height="40" rx="3" fill="${C.grizzly}"/><rect x="6" y="178" width="66" height="26" rx="8" fill="${C.monkey}"/><rect x="10" y="182" width="58" height="18" rx="6" fill="${C.canary}"/><text x="39" y="195" text-anchor="middle" font-size="9" font-weight="800" fill="${C.grizzly}" font-family="inherit">BEBA ÁGUA</text></g>`,
    plantinha: `<g><path d="M282 236 q-4 -34 -18 -44" stroke="${C.treefrog}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M284 236 q2 -30 14 -40" stroke="${C.owl}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M283 236 q0 -26 -2 -34" stroke="${C.turtle}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M270 234 h26 l-4 22 h-18 Z" fill="${C.guineapig}"/><rect x="268" y="230" width="30" height="8" rx="4" fill="${C.grizzly}"/></g>`,
    patinho: `<g class="patinho"><rect x="44" y="268" width="34" height="18" rx="9" fill="${C.duck}"/><circle cx="72" cy="264" r="9" fill="${C.duck}"/><path d="M80 262 q8 1 9 4 q-1 3 -9 4 Z" fill="${C.fox}"/><circle cx="74" cy="262" r="1.8" fill="${C.eel}"/></g>`,
    luzinhas: `<g><path d="M0 26 Q80 48 160 30 Q240 12 320 34" stroke="${C.wolf}" stroke-width="2" fill="none"/><circle cx="40" cy="34" r="5" fill="${C.cardinal}"/><circle cx="90" cy="41" r="5" fill="${C.bee}"/><circle cx="140" cy="35" r="5" fill="${C.owl}"/><circle cx="190" cy="24" r="5" fill="${C.macaw}"/><circle cx="240" cy="21" r="5" fill="${C.starfish}"/><circle cx="290" cy="28" r="5" fill="${C.bee}"/></g>`,
  };

  const ITEMS = [
    { id: 'bone', nome: 'Boné azul', preco: 15, slot: 'chapeu' },
    { id: 'chapeu-festa', nome: 'Chapéu de festa', preco: 20, slot: 'chapeu' },
    { id: 'laco', nome: 'Gravatinha', preco: 20, slot: 'pescoco' },
    { id: 'oculos-sol', nome: 'Óculos escuros', preco: 25, slot: 'oculos' },
    { id: 'chapeu-palha', nome: 'Chapéu de palha', preco: 30, slot: 'chapeu' },
    { id: 'cachecol', nome: 'Cachecol', preco: 30, slot: 'pescoco' },
    { id: 'oculos-coracao', nome: 'Óculos coração', preco: 35, slot: 'oculos' },
    { id: 'cartola', nome: 'Cartola', preco: 40, slot: 'chapeu' },
    { id: 'coroa', nome: 'Coroa', preco: 60, slot: 'chapeu' },
    { id: 'placa', nome: 'Placa "beba água"', preco: 15, slot: 'cenario' },
    { id: 'plantinha', nome: 'Samambaia', preco: 20, slot: 'cenario' },
    { id: 'patinho', nome: 'Patinho no rio', preco: 25, slot: 'cenario' },
    { id: 'luzinhas', nome: 'Luzinhas', preco: 40, slot: 'cenario' },
  ];

  /* âncoras dos acessórios por pet: [x, y, escala] no viewBox 0 0 200 170 */
  const ANCORAS = {
    capivara: { chapeu: [100, 36, 1], oculos: [100, 76, 1.05], pescoco: [100, 148, 1] },
  };

  function acessorios(pet, equip) {
    if (!equip) return '';
    let out = '';
    for (const slot of ['pescoco', 'oculos', 'chapeu']) {
      const id = equip[slot];
      if (!id || !ITEM_ART[id]) continue;
      const [x, y, s] = ANCORAS[pet][slot];
      out += `<g transform="translate(${x},${y}) scale(${s})">${ITEM_ART[id]}</g>`;
    }
    return out;
  }

  /* ── olhos pequenos e deadpan (estilos "almond"/"dots" do guia — menos infantil);
        brilho mínimo, pálpebra abaixada da cor do corpo no molenga ── */
  function olhos(ex1, ex2, ey, r, lidColor, cor) {
    const ink = cor || '#33261A';
    const abertos = (px) => `
      <circle cx="${px}" cy="${ey}" r="${r}" fill="${ink}"/>
      <circle cx="${px + r * 0.32}" cy="${ey - r * 0.32}" r="${r * 0.26}" fill="#FFF" opacity=".85"/>`;
    const meio = (px) => `
      <circle cx="${px}" cy="${ey}" r="${r}" fill="${ink}"/>
      <rect x="${px - r - 1.5}" y="${ey - r - 1.5}" width="${r * 2 + 3}" height="${r * 1.15}" rx="3" fill="${lidColor}"/>`;
    return `
      <g class="eyes-open">${abertos(ex1)}${abertos(ex2)}</g>
      <g class="eyes-half">${meio(ex1)}${meio(ex2)}</g>
      <g class="eyes-closed" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none">
        <path d="M ${ex1 - r} ${ey} q ${r} ${r * 1.1} ${r * 2} 0"/>
        <path d="M ${ex2 - r} ${ey} q ${r} ${r * 1.1} ${r * 2} 0"/>
      </g>`;
  }

  /* bocas assimétricas ("favorecem um lado", como no guia) */
  function bocas(mx, my, w, cor, extraSmile) {
    const h = w / 2;
    return `
      <g class="mouth-smile">${extraSmile || ''}
        <path d="M ${mx - w / 2} ${my} q ${w * 0.62} ${h * 1.15} ${w} -2" stroke="${cor}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      </g>
      <g class="mouth-flat">${extraSmile || ''}
        <path d="M ${mx - w / 3} ${my + 2} q ${w / 3} 2 ${w / 1.5} 0" stroke="${cor}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      </g>
      <g class="mouth-open">
        <rect x="${mx - w / 2.1}" y="${my - 3}" width="${w / 1.05}" height="${h * 1.5}" rx="${w / 3}" fill="${C.eel}"/>
        <rect x="${mx - w / 4.5}" y="${my + h * 0.55}" width="${w / 2.25}" height="${h * 0.7}" rx="${w / 5}" fill="${C.crab}"/>
      </g>`;
  }

  const zzz = `
    <g class="zzz">
      <text x="148" y="34" font-size="18" font-weight="800" fill="${C.eel}">z</text>
      <text x="162" y="22" font-size="14" font-weight="800" fill="${C.eel}" opacity=".75">z</text>
      <text x="173" y="12" font-size="11" font-weight="800" fill="${C.eel}" opacity=".55">z</text>
    </g>`;

  /* pés flutuantes (acento, como os do Duo) */
  const pes = (x1, x2, y, cor) =>
    `<rect x="${x1}" y="${y}" width="30" height="12" rx="6" fill="${cor}"/><rect x="${x2}" y="${y}" width="30" height="12" rx="6" fill="${cor}"/>`;

  /* ── os três pets (corpo+cabeça em 1–2 formas, repetição de formas, ~15 formas) ── */
  function capivara(equip) {
    const dentes = `<rect x="93" y="122" width="6.5" height="9" rx="2.5" fill="#F6EFE2"/><rect x="100.5" y="122" width="6.5" height="9" rx="2.5" fill="#F6EFE2"/>`;
    return `
      <rect x="56" y="30" width="22" height="18" rx="9" fill="${C.capiBody}"/>
      <rect x="122" y="30" width="22" height="18" rx="9" fill="${C.capiBody}"/>
      <rect x="62" y="35" width="10" height="9" rx="4.5" fill="${C.capiEar}"/>
      <rect x="128" y="35" width="10" height="9" rx="4.5" fill="${C.capiEar}"/>
      <rect x="30" y="40" width="140" height="112" rx="38" fill="${C.capiBody}"/>
      <rect x="42" y="100" width="116" height="46" rx="23" fill="${C.capiMuzzle}"/>
      <rect x="85" y="108" width="30" height="11" rx="5.5" fill="${C.capiDark}"/>
      ${olhos(70, 130, 80, 6.5, C.capiBody, C.capiDark)}
      ${bocas(100, 132, 18, C.capiDark, dentes)}
      ${pes(58, 112, 158, C.capiMuzzle)}
      ${zzz}
      ${acessorios('capivara', equip)}`;
  }

  const CORPOS = { capivara };

  const ESCALA_ESTAGIO = [0.78, 0.92, 1.06, 1.14];

  /* Lendário: brilhos redondos (nada pontudo) + aura em pílula */
  const SPARKS = `
    <g class="lendario">
      <circle class="spark s1" cx="34" cy="46" r="6" fill="${C.bee}"/>
      <circle class="spark s2" cx="168" cy="32" r="5" fill="${C.bee}"/>
      <circle class="spark s3" cx="174" cy="102" r="4" fill="${C.bee}"/>
      <circle class="spark s4" cx="24" cy="112" r="4" fill="${C.bee}"/>
    </g>`;

  /* pet completo — stage: 0..3, equip: {chapeu,oculos,pescoco} */
  function pet(key, opts) {
    const o = opts || {};
    const stage = o.stage == null ? 1 : o.stage;
    const s = ESCALA_ESTAGIO[stage] || 1;
    const aura = stage === 3
      ? `<rect x="20" y="140" width="160" height="26" rx="13" fill="${C.bee}" opacity=".25"/>${SPARKS}`
      : '';
    return `<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg">
      ${aura}
      <g transform="translate(100,168) scale(${s}) translate(-100,-168)">${CORPOS[key](o.equip)}</g>
    </svg>`;
  }

  /* cenário 320x300 — modo 'dia' | 'noite', cenario: array de ids equipados */
  function scene(modo, cenario) {
    const noite = modo === 'noite';
    const ceu = noite
      ? `<rect width="320" height="300" fill="${C.narwhal}"/>
         <circle cx="252" cy="52" r="24" fill="${C.canary}"/><circle cx="242" cy="46" r="22" fill="${C.narwhal}"/>
         <circle cx="60" cy="40" r="2.5" fill="${C.polar}" opacity=".9"/><circle cx="120" cy="70" r="2" fill="${C.polar}" opacity=".7"/>
         <circle cx="180" cy="36" r="2.5" fill="${C.polar}" opacity=".8"/><circle cx="90" cy="110" r="2" fill="${C.polar}" opacity=".5"/>
         <circle cx="286" cy="120" r="2.5" fill="${C.polar}" opacity=".6"/><circle cx="30" cy="86" r="2" fill="${C.polar}" opacity=".7"/>`
      : `<rect width="320" height="300" fill="${C.iguana}"/>
         <circle cx="258" cy="54" r="26" fill="#F5C542"/>
         <rect x="42" y="46" width="66" height="18" rx="9" fill="${C.polar}"/>
         <rect x="66" y="60" width="44" height="14" rx="7" fill="${C.polar}" opacity=".8"/>
         <rect x="196" y="102" width="52" height="14" rx="7" fill="${C.polar}" opacity=".7"/>`;
    const verdeTras = noite ? C.treefrog : '#B7E098';
    const verdeFrente = noite ? '#46830B' : '#67B84E';
    const rio = noite ? C.humpback : '#45A5DF';
    const onda = noite ? C.whale : '#8ECDF0';
    const extras = (cenario || []).filter((id) => SCENE_ART[id]).map((id) => SCENE_ART[id]).join('');
    return `<svg viewBox="0 0 320 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
      ${ceu}
      <circle cx="58" cy="288" r="96" fill="${verdeTras}"/>
      <circle cx="262" cy="298" r="110" fill="${verdeTras}"/>
      <rect x="0" y="228" width="320" height="44" fill="${verdeFrente}"/>
      <rect y="264" width="320" height="36" fill="${rio}"/>
      <path d="M0 272 q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="${onda}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="102" y="254" width="116" height="12" rx="6" fill="#000" opacity=".12"/>
      ${extras}
    </svg>`;
  }

  const ICON_VIEWBOX = {
    placa: '2 172 76 70', plantinha: '252 186 54 74',
    patinho: '38 250 56 44', luzinhas: '20 12 280 40',
  };
  function itemIcon(item) {
    if (item.slot === 'cenario') {
      const vb = ICON_VIEWBOX[item.id] || '0 0 320 300';
      return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${SCENE_ART[item.id]}</svg>`;
    }
    return `<svg viewBox="-45 -50 90 70" preserveAspectRatio="xMidYMid meet">${ITEM_ART[item.id]}</svg>`;
  }

  window.PetArt = { pet, scene, ITEMS, itemIcon };
})();
