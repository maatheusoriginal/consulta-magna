import { getPlano } from "./planos";
import type { PerfilRespostas, Plano, PlanoId } from "./types";

const ORDEM: PlanoId[] = ["bronze", "prata", "ouro", "premium"];

interface Sinal {
  pontos: number;
  /** Plano mínimo exigido por esta resposta */
  minimo?: PlanoId;
  justificativa?: string;
}

const PRIORIDADE: Record<PerfilRespostas["prioridade"], Sinal> = {
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

const VIAGENS: Record<PerfilRespostas["viagens"], Sinal> = {
  "quase-nunca": { pontos: 0 },
  "as-vezes": { pontos: 1 },
  frequencia: {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Você informou que costuma viajar e rodar longas distâncias.",
  },
};

const CARRO_RESERVA: Record<PerfilRespostas["carroReserva"], Sinal> = {
  "nao-preciso": { pontos: 0 },
  interessante: { pontos: 1 },
  "muito-importante": {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Ter carro reserva é muito importante para você.",
  },
};

const TERCEIROS: Record<PerfilRespostas["terceiros"], Sinal> = {
  "nao-prioridade": { pontos: 0 },
  intermediaria: { pontos: 1, minimo: "prata" },
  alta: {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Você busca uma proteção maior para terceiros.",
  },
};

const VIDROS: Record<PerfilRespostas["vidros"], Sinal> = {
  nao: { pontos: 0 },
  "um-pouco": { pontos: 1 },
  sim: {
    pontos: 2,
    minimo: "ouro",
    justificativa: "Vidros, faróis e retrovisores são importantes para você.",
  },
};

const FINALIDADE: Record<PerfilRespostas["finalidade"], Sinal> = {
  particular: { pontos: 0 },
  aplicativo: {
    pontos: 2,
    minimo: "prata",
    justificativa: "Como o veículo roda em aplicativo, a exposição diária é maior.",
  },
};

export interface Recomendacao {
  plano: Plano;
  justificativas: string[];
  pontuacao: number;
}

export function recomendarPlano(perfil: PerfilRespostas): Recomendacao {
  const sinais: Sinal[] = [
    FINALIDADE[perfil.finalidade],
    PRIORIDADE[perfil.prioridade],
    VIAGENS[perfil.viagens],
    CARRO_RESERVA[perfil.carroReserva],
    TERCEIROS[perfil.terceiros],
    VIDROS[perfil.vidros],
  ];

  const pontuacao = sinais.reduce((total, sinal) => total + sinal.pontos, 0);

  // Faixa de pontuação (0 a 13) → plano sugerido.
  let indice: number;
  if (pontuacao <= 2) indice = 0;
  else if (pontuacao <= 5) indice = 1;
  else if (pontuacao <= 9) indice = 2;
  else indice = 3;

  // Respostas com exigência explícita elevam o piso da recomendação.
  for (const sinal of sinais) {
    if (sinal.minimo) indice = Math.max(indice, ORDEM.indexOf(sinal.minimo));
  }

  const justificativas = sinais
    .map((sinal) => sinal.justificativa)
    .filter((j): j is string => Boolean(j))
    .slice(0, 3);

  // Sempre entregamos três motivos; completamos com o diferencial do plano.
  const plano = getPlano(ORDEM[indice]);
  while (justificativas.length < 3) {
    const extra = plano.destaques[justificativas.length];
    justificativas.push(extra ? `Inclui ${extra.toLowerCase()}.` : "Melhor equilíbrio entre cobertura e mensalidade para o seu perfil.");
  }

  return { plano, justificativas, pontuacao };
}
