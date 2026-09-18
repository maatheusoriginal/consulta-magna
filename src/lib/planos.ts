import type {
  ModalidadeParticipacao,
  ParticipacaoCalculada,
  ParticipacaoId,
  Plano,
  PlanoId,
} from "./types";

/** Valor único de filiação e ativação da proteção. */
export const TAXA_ADESAO = 300;

/** Piso mínimo contratual da participação, conforme regulamento. */
export const PARTICIPACAO_MINIMA = 1800;

/** Itens comparados na tabela, na ordem em que aparecem. */
export const ITENS_COMPARACAO = [
  "Roubo e furto",
  "Perda total",
  "Incêndio e fenômenos da natureza",
  "Colisão e capotamento",
  "Assistência 24h (guincho)",
  "Pane elétrica, mecânica e seca",
  "Danos materiais a terceiros",
  "Carro reserva",
  "Vidros e para-brisas",
  "Faróis, lanternas e retrovisores",
] as const;

/**
 * As taxas são percentuais mensais sobre a tabela FIPE do veículo e estão
 * calibradas para reproduzir a tabela de referência do projeto
 * (FIPE R$ 28.436,00 → Bronze R$ 108,07 · Prata R$ 132,87 · Ouro R$ 164,27 ·
 * Premium R$ 177,77). Ajuste aqui para mudar a precificação de todos os planos.
 */
export const PLANOS: Plano[] = [
  {
    id: "bronze",
    nome: "Bronze",
    subtitulo: "Essencial",
    descricao: "Proteção fundamental contra roubo, furto e perda total.",
    taxaMensalFipe: 0.0038005,
    mensalidadeMinima: 79.9,
    destaques: [
      "Roubo, furto, incêndio e perda total",
      "Assistência 24h com guincho até 250 km",
      "Pane elétrica, mecânica e seca",
    ],
    coberturas: [
      { label: "Roubo e furto", valor: true },
      { label: "Perda total", valor: true },
      { label: "Incêndio e fenômenos da natureza", valor: true },
      { label: "Colisão e capotamento", valor: false },
      { label: "Assistência 24h (guincho)", valor: "250 km" },
      { label: "Pane elétrica, mecânica e seca", valor: true },
      { label: "Danos materiais a terceiros", valor: false },
      { label: "Carro reserva", valor: false },
      { label: "Vidros e para-brisas", valor: false },
      { label: "Faróis, lanternas e retrovisores", valor: false },
    ],
  },
  {
    id: "prata",
    nome: "Prata",
    subtitulo: "Intermediário",
    descricao: "Cobertura completa contra acidentes, colisão e danos a terceiros.",
    taxaMensalFipe: 0.0046726,
    mensalidadeMinima: 99.9,
    destaques: [
      "Roubo, furto, colisão e perda total",
      "Assistência 24h com guincho até 250 km",
      "Danos materiais a terceiros até R$ 50.000",
    ],
    coberturas: [
      { label: "Roubo e furto", valor: true },
      { label: "Perda total", valor: true },
      { label: "Incêndio e fenômenos da natureza", valor: true },
      { label: "Colisão e capotamento", valor: true },
      { label: "Assistência 24h (guincho)", valor: "250 km" },
      { label: "Pane elétrica, mecânica e seca", valor: true },
      { label: "Danos materiais a terceiros", valor: "R$ 50.000" },
      { label: "Carro reserva", valor: false },
      { label: "Vidros e para-brisas", valor: false },
      { label: "Faróis, lanternas e retrovisores", valor: false },
    ],
  },
  {
    id: "ouro",
    nome: "Ouro",
    subtitulo: "Completo",
    descricao: "Proteção avançada com assistência ampliada, terceiros e carro reserva.",
    taxaMensalFipe: 0.0057768,
    mensalidadeMinima: 119.9,
    destaques: [
      "Roubo, furto, colisão, incêndio e fenômenos da natureza",
      "Assistência 24h com guincho até 500 km",
      "Danos materiais a terceiros até R$ 100.000",
      "Carro reserva: 15 dias (carência 7 dias)",
      "Vidros e para-brisas: 70% (carência 7 dias)",
    ],
    coberturas: [
      { label: "Roubo e furto", valor: true },
      { label: "Perda total", valor: true },
      { label: "Incêndio e fenômenos da natureza", valor: true },
      { label: "Colisão e capotamento", valor: true },
      { label: "Assistência 24h (guincho)", valor: "500 km" },
      { label: "Pane elétrica, mecânica e seca", valor: true },
      { label: "Danos materiais a terceiros", valor: "R$ 100.000" },
      { label: "Carro reserva", valor: "15 dias", nota: "carência 7 dias" },
      { label: "Vidros e para-brisas", valor: "70%", nota: "carência 7 dias" },
      { label: "Faróis, lanternas e retrovisores", valor: false },
    ],
  },
  {
    id: "premium",
    nome: "Premium",
    subtitulo: "Cobertura total",
    descricao: "Proteção completa para o seu veículo com máxima cobertura e assistência.",
    taxaMensalFipe: 0.0062516,
    mensalidadeMinima: 139.9,
    destaques: [
      "Todas as coberturas do plano Ouro",
      "Assistência 24h com guincho até 750 km",
      "Danos materiais a terceiros até R$ 150.000",
      "Carro reserva: 30 dias (carência 7 dias)",
      "Faróis, lanternas e retrovisores: 70% (carência 7 dias)",
    ],
    coberturas: [
      { label: "Roubo e furto", valor: true },
      { label: "Perda total", valor: true },
      { label: "Incêndio e fenômenos da natureza", valor: true },
      { label: "Colisão e capotamento", valor: true },
      { label: "Assistência 24h (guincho)", valor: "750 km" },
      { label: "Pane elétrica, mecânica e seca", valor: true },
      { label: "Danos materiais a terceiros", valor: "R$ 150.000" },
      { label: "Carro reserva", valor: "30 dias", nota: "carência 7 dias" },
      { label: "Vidros e para-brisas", valor: "70%", nota: "carência 7 dias" },
      { label: "Faróis, lanternas e retrovisores", valor: "70%", nota: "carência 7 dias" },
    ],
  },
];

export const MODALIDADES_PARTICIPACAO: ModalidadeParticipacao[] = [
  {
    id: "padrao",
    nome: "Padrão",
    badge: "Mais escolhido",
    percentual: 0.12,
    fatorMensalidade: 1,
    descricao: "Participação calculada em 12% da tabela FIPE do veículo.",
  },
  {
    id: "reduzida",
    nome: "Reduzida",
    badge: "Menor desembolso no evento",
    percentual: 0.08,
    fatorMensalidade: 1.055556,
    descricao: "Equilíbrio com menor valor a desembolsar em caso de evento coberto.",
  },
  {
    id: "minima",
    nome: "Mínima",
    percentual: 0.06,
    fatorMensalidade: 1.111111,
    descricao: "Participação de 6% da FIPE, respeitando o piso mínimo de R$ 1.800,00.",
  },
  {
    id: "zero",
    nome: "Participação zero",
    badge: "Sem desembolso no 1º evento",
    percentual: null,
    fatorMensalidade: 1.333333,
    descricao: "Você não paga participação no primeiro evento coberto.",
    carenciaDias: 60,
  },
];

export function getPlano(id: PlanoId): Plano {
  const plano = PLANOS.find((p) => p.id === id);
  if (!plano) throw new Error(`Plano desconhecido: ${id}`);
  return plano;
}

export function getModalidade(id: ParticipacaoId): ModalidadeParticipacao {
  const modalidade = MODALIDADES_PARTICIPACAO.find((m) => m.id === id);
  if (!modalidade) throw new Error(`Modalidade desconhecida: ${id}`);
  return modalidade;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Mensalidade base do plano (modalidade Padrão) a partir do valor FIPE. */
export function calcularMensalidadeBase(plano: Plano, valorFipe: number): number {
  return arredondar(Math.max(valorFipe * plano.taxaMensalFipe, plano.mensalidadeMinima));
}

export function calcularParticipacao(
  modalidade: ModalidadeParticipacao,
  valorFipe: number,
  mensalidadeBase: number,
): ParticipacaoCalculada {
  const bruto = modalidade.percentual === null ? 0 : valorFipe * modalidade.percentual;
  const pisoAplicado = modalidade.percentual !== null && bruto < PARTICIPACAO_MINIMA;

  return {
    ...modalidade,
    valor: modalidade.percentual === null ? 0 : arredondar(pisoAplicado ? PARTICIPACAO_MINIMA : bruto),
    pisoAplicado,
    mensalidade: arredondar(mensalidadeBase * modalidade.fatorMensalidade),
  };
}

/**
 * Modalidades disponíveis para um veículo, já sem opções dominadas.
 *
 * Em veículos de FIPE baixa o piso de R$ 1.800,00 iguala a participação de
 * várias faixas — oferecer a mesma participação por uma mensalidade maior seria
 * desonesto, então essas opções são removidas da lista.
 */
export function calcularTodasParticipacoes(
  valorFipe: number,
  mensalidadeBase: number,
): ParticipacaoCalculada[] {
  const calculadas = MODALIDADES_PARTICIPACAO.map((m) =>
    calcularParticipacao(m, valorFipe, mensalidadeBase),
  ).sort((a, b) => a.mensalidade - b.mensalidade);

  const disponiveis: ParticipacaoCalculada[] = [];
  let menorParticipacao = Number.POSITIVE_INFINITY;

  for (const opcao of calculadas) {
    if (opcao.valor < menorParticipacao) {
      menorParticipacao = opcao.valor;
      disponiveis.push(opcao);
    }
  }

  return disponiveis;
}

/** Mensalidade de cada plano na modalidade Padrão — usada na tela de comparação. */
export function calcularPrecos(valorFipe: number): Record<PlanoId, number> {
  return PLANOS.reduce(
    (acc, plano) => {
      acc[plano.id] = calcularMensalidadeBase(plano, valorFipe);
      return acc;
    },
    {} as Record<PlanoId, number>,
  );
}
