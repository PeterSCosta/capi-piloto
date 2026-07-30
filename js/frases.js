// Falas da Capi por gatilho — o tom é o produto (guia de voz do GDD §2).
// Regras travadas por CI (scripts/lint-frases.mjs): 1ª pessoa, <=120 chars, zoeira afetuosa,
// sem culpa/vergonha/comparação/comentário sobre corpo. Sorteio sem repetição imediata no app.js.
const FRASES = {
  "capivara": {
    "soneca": [
      "Você sumiu um diazinho e eu tirei uma soneca em cima da tua sequência. Tá tudo aqui, intacto.",
      "Cochilei te esperando. O rio nem notou, a sequência nem sentiu.",
      "Um dia de folga aconteceu e eu guardei tua sequência embaixo da pata. De nada.",
      "Soneca estratégica ativada ontem. Sequência protegida, drama zero.",
      "Relaxa: dia corrido passou, eu dormi por nós dois e nada se perdeu."
    ],
    "abrir_app": [
      "Ô, chegou! Eu tava aqui de boa esperando... do meu jeito devagar, mas esperando.",
      "Opa. Sem pressa nenhuma, mas que bom te ver por aqui.",
      "Vem, senta aqui na beira do rio. Digo, do app.",
      "Você apareceu, e aparecer já é metade do caminho. Palavra de capivara.",
      "Que tal a gente fazer o mínimo hoje? O mínimo bem feito já é muito.",
      "Cheguei antes de você hoje. Tô até orgulhosa da minha produtividade."
    ],
    "agua": [
      "Aguinha desceu redonda, hein? Rio por dentro, paz por fora.",
      "Boa. Água é tipo abraço que escorre.",
      "Hidratou! Eu, capivara, aprovo com os dois dentões.",
      "Um gole de cada vez, que nem a vida.",
      "Água registrada. O rio aqui de dentro agradece.",
      "Isso. Devagarzinho a gente vira lago."
    ],
    "refeicao_bem": [
      "Mandou bem no prato! Nem capim fresco de manhã cedo ganha desse capricho.",
      "Olha só, refeição caprichada. Tô boiando de orgulho.",
      "Comeu bonito, hein? Anota aí no caderninho do rio.",
      "Prato bom é aquele que a gente termina em paz. Missão cumprida.",
      "Comida boa, mente tranquila. Filosofia de beira de rio.",
      "Capricho registrado. Hoje o banquete foi seu."
    ],
    "refeicao_meio": [
      "Meio termo é vida real. Tá valendo demais.",
      "Nem tudo é capim fresco, nem tudo é fritura. O rio segue.",
      "Meio a meio, que nem eu: metade na água, metade no barranco.",
      "Registrou, tá jogado. Equilíbrio é mais ou menos isso mesmo.",
      "Meio termo hoje, quem sabe capricho amanhã. Sem pressa.",
      "Tá honesto. E honestidade também alimenta."
    ],
    "refeicao_ruim": [
      "Foi o que deu, e deu. Registrar já é metade do caminho.",
      "Relaxa. Até capivara come mato murcho às vezes.",
      "Anotou sem esconder? Isso é coragem de beira de rio.",
      "Acontece. O rio não para por causa de uma marola.",
      "Tá registrado, tá vivido. Amanhã o rio traz coisa nova.",
      "Julgamento zero por aqui. Eu literalmente como grama."
    ],
    "treino": [
      "Treinou?! Vou aplaudir daqui, deitada, mas com muito entusiasmo.",
      "Olha o suor! Eu me molho no rio, você na academia. Cada um no seu.",
      "Você treinando e eu boiando. Que dupla equilibrada.",
      "Corpo mexeu, energia subiu. Depois deita, que descanso também é treino.",
      "Treino feito! Isso merece uma boiadinha comemorativa no rio.",
      "Mexeu o esqueleto! Eu mexi a orelha, pra mim também conta."
    ],
    "passos_meta": [
      "Bateu a meta de passos! Eu ando devagar, mas ando junto.",
      "Tanto passo... tá parecendo capivara fugindo de jacaré. Orgulho!",
      "Meta de passos batida. Minhas quatro patas se curvam.",
      "Andou tudo isso? Eu canso só de acompanhar. Mas que bonito de ver.",
      "Passo a passo você chegou. Filosofia de capivara aprovada.",
      "Meta batida! Agora senta, estica as pernas e admira o rio."
    ],
    "dia_completo": [
      "Energia 100! Hoje você foi o rio inteiro, não só a margem.",
      "Dia completo! Vou comemorar do meu jeito: boiando de alegria.",
      "Fechou o dia todinho! Nem o pôr do sol na lagoa fica tão bonito.",
      "100 de energia! Tô tão feliz que quase levantei.",
      "Dia inteiro cumprido. Isso é coisa de lenda de beira de rio.",
      "Completou tudo! Pode deitar em paz, o dia foi seu."
    ],
    "dia_parcial": [
      "Metade ou mais? Tá ótimo. Rio meio cheio também mata a sede.",
      "Dia parcial, vitória inteira. Assino embaixo com a patinha.",
      "Não foi tudo, mas foi bastante. Eu comemoro qualquer marola boa.",
      "Meio dia bem vivido vale mais que dia inteiro correndo à toa.",
      "Passou da metade! No meu ritmo, isso é praticamente um recorde.",
      "Tá valendo. Amanhã o rio continua lá, e a gente também."
    ],
    "sequencia_perdida": [
      "A sequência escorregou no barranco. Tudo bem, a gente sobe de novo.",
      "Quebrou a corrente? Relaxa, o rio nunca cobra o dia de ontem.",
      "O bônus voltou pro comecinho. Eu também volto pro rio todo dia, e tá ótimo.",
      "Perdeu a sequência, não a majestade. Bora começar outra, sem pressa.",
      "Sequência zerou. Eu, hein, nem contei pra ninguém. Recomeça comigo?",
      "Foi só o bônus que voltou pro início. Você continua inteirinho aqui."
    ],
    "evolucao": [
      "Olha eu evoluindo! Cresci sem sair do lugar. Talento.",
      "Evoluí! Mérito todo seu, viu? Eu só fiquei fofa no processo.",
      "Novo estágio desbloqueado. Sou praticamente uma capivara sênior.",
      "Cresci! Devagar, que nem tudo que presta.",
      "Evolução concluída. O rio inteiro tá comentando.",
      "Subi de estágio! Guarda esse momento: capivara emocionada é raridade."
    ],
    "molenga": [
      "Hoje tá aquele dia de boiar, né? Eu entendo. Sou especialista.",
      "Zero registro, zero problema. Mas um golinho de água anima, vai?",
      "Tô aqui no modo pedra de rio: parada, mas presente.",
      "Eu também não fui pro rio hoje. Mas uma aguinha cai bem, né?",
      "A preguiça bateu em nós dois. Empate técnico. Desempata com um registro?",
      "Dia devagar... Bora fazer só uma coisinha? Eu prometo boiar por nós dois."
    ],
    "dormindo": [
      "Shhh... tô sonhando com um rio de capim. Amanhã a gente continua.",
      "Hora de dormir. Até capivara lendária desliga o rio.",
      "Fechei os olhinhos. Descansa também, que amanhã tem rio novo.",
      "Zzz... se você tá acordado a essa hora, finge que não me viu.",
      "Dormir é meu hábito favorito. Recomendo fortemente.",
      "O rio tá quieto, eu tô quieta. Vai descansar, vai."
    ],
    "compra_loja": [
      "Comprou pra mim? Ai, que chique. Vou desfilar na beira do rio.",
      "Item novo! Trocou folhas por estilo. Negócio da China.",
      "Olha meu visual! As outras capivaras vão querer saber onde compra.",
      "Presente novo! Vou usar com muito orgulho e pouca pressa.",
      "Que capricho. Sou oficialmente a capivara mais elegante deste rio.",
      "Folhas bem gastas. Estilo assim não se acha em qualquer lagoa."
    ]
  }
};
