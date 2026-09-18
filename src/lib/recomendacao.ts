import { getPlano } from "./planos";
import type { PerfilRespostas, Plano, PlanoId } from "./types";

/**
 * Respostas que determinam o plano recomendado.
 *
 * `finalidade` (particular ou aplicativo/táxi) é deliberadamente EXCLUÍDA deste
 * tipo: uso comercial pode afetar a mensalidade e as modalidades de participação
 * disponíveis (ver `src/lib/pricing`), mas nunca o plano recomendado — isso é
 * decidido apenas pelo questionário de perfil. Ao deixar `finalidade` fora da
 * assinatura, o compilador impede que ela volte a influenciar a recomendação.
 */
export type RespostasQuestionario = Omit<PerfilRespostas, "finalidade">;

const ORDEM: PlanoId[] = ["bronze", "prata", "ouro", "premium"];

interface Sinal {
  pontos: number;
  /** Plano mínimo exigido por esta resposta */
  minimo?: PlanoId;
  justificativa?: string;
}

const PRIORIDADE: Record<RespostasQuestionario["prioridade"], Sinal> = {
  roubo: { pontos: 0, justificativa: "Sua prioridade é proteção contra roubo e furto." },
  colisao: {
    pontos: 2,
    minimo: "prata",
    justificativa: "Você priorizou cobertura para colisão e acidentes.",
  },
  terceiros: {
    pontos: 2,
    minimo: "prata",
    justificativa: "Você priorizou a proteção para danos a terceiros.",
  },
  completa: {
    pontos: 3,
    minimo: "ouro",
    justificativa: "Você pediu uma proteção mais completa.",
  },
};

const VIAGENS: Record<RespostasQuestionario["viagens"], Sinal> = {
  "quase-nunca": { pontos: 0 },
  "as-vezes": { pontos: 1 },
  frequencia: {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Você informou que costuma viajar e rodar longas distâncias.",
  },
};

const CARRO_RESERVA: Record<RespostasQuestionario["carroReserva"], Sinal> = {
  "nao-preciso": { pontos: 0 },
  interessante: { pontos: 1 },
  "muito-importante": {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Ter carro reserva é muito importante para você.",
  },
};

const TERCEIROS: Record<RespostasQuestionario["terceiros"], Sinal> = {
  "nao-prioridade": { pontos: 0 },
  intermediaria: { pontos: 1, minimo: "prata" },
  alta: {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Você busca uma proteção maior para terceiros.",
  },
};

const VIDROS: Record<RespostasQuestionario["vidros"], Sinal> = {
  nao: { pontos: 0 },
  "um-pouco": { pontos: 1 },
  sim: {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Vidros, faróis e retrovisores são importantes para você.",
  },
};

export interface Recomendacao {
  plano: Plano;
  justificativas: string[];
  pontuacao: number;
  /**
   * `true` quando o perfil apontava para um plano mais completo do que os
   * oferecidos para a categoria do veículo (moto, por exemplo, só tem Bronze e
   * Prata). Nesse caso `plano` é a opção disponível mais completa.
   */
  limitadoPelaCategoria: boolean;
}

/**
 * Recomenda um plano a partir do questionário, sempre dentro dos planos
 * efetivamente oferecidos para a categoria do veículo.
 *
 * @param disponiveis planos comercializados para a categoria, vindos de
 *   `PricingProvider.getAvailablePlanIds()`. O plano recomendado pertence
 *   obrigatoriamente a esta lista.
 */
export function recomendarPlano(
  respostas: RespostasQuestionario,
  disponiveis: PlanoId[] = ORDEM,
): Recomendacao {
  const sinais: Sinal[] = [
    PRIORIDADE[respostas.prioridade],
    VIAGENS[respostas.viagens],
    CARRO_RESERVA[respostas.carroReserva],
    TERCEIROS[respostas.terceiros],
    VIDROS[respostas.vidros],
  ];

  const pontuacao = sinais.reduce((total, sinal) => total + sinal.pontos, 0);

  // Faixa de pontuação (0 a 11) → plano sugerido.
  let indice: number;
  if (pontuacao <= 2) indice = 0;
  else if (pontuacao <= 5) indice = 1;
  else if (pontuacao <= 8) indice = 2;
  else indice = 3;

  // Respostas com exigência explícita elevam o piso da recomendação.
  for (const sinal of sinais) {
    if (sinal.minimo) indice = Math.max(indice, ORDEM.indexOf(sinal.minimo));
  }

  // O plano ideal é então ajustado à oferta real da categoria do veículo.
  const ofertados = ORDEM.filter((id) => disponiveis.includes(id));
  if (ofertados.length === 0) {
    throw new Error("Nenhum plano disponível para recomendar nesta categoria.");
  }

  const idIdeal = ORDEM[indice];
  const idEscolhido =
    [...ofertados].reverse().find((id) => ORDEM.indexOf(id) <= indice) ?? ofertados[0];
  const limitadoPelaCategoria = idEscolhido !== idIdeal;

  const justificativas = sinais
    .map((sinal) => sinal.justificativa)
    .filter((j): j is string => Boolean(j))
    .slice(0, limitadoPelaCategoria ? 2 : 3);

  const plano = getPlano(idEscolhido);

  if (limitadoPelaCategoria) {
    justificativas.push(
      `${plano.nome} é a opção mais completa disponível para este tipo de veículo.`,
    );
  }

  // Sempre entregamos três motivos; completamos com o diferencial do plano.
  while (justificativas.length < 3) {
    const extra = plano.destaques[justificativas.length];
    justificativas.push(
      extra
        ? `Inclui ${extra.toLowerCase()}.`
        : "Equilíbrio entre cobertura e mensalidade para as respostas informadas.",
    );
  }

  return { plano, justificativas, pontuacao, limitadoPelaCategoria };
}
