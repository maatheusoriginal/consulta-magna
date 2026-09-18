import type { Plano, PlanoId } from "./types";

/**
 * Catálogo de planos: apenas coberturas e textos.
 *
 * Preço NÃO mora aqui. Quanto custa cada plano, e quais planos são oferecidos
 * para cada categoria de veículo, é responsabilidade de um `PricingProvider`
 * (`src/lib/pricing`).
 */

/** Itens comparados na tabela, na ordem em que aparecem. */
export const ITENS_COMPARACAO = [
  "Roubo e furto",
  "Perda total",
  "Incêndio, explosão e fenômenos da natureza",
  "Colisão e capotamento",
  "Assistência 24h (guincho)",
  "Reboque",
  "Pane elétrica, mecânica e seca",
  "Danos materiais a terceiros",
  "Carro reserva",
  "Vidros e para-brisas",
  "Faróis, lanternas e retrovisores",
] as const;

export const PLANOS: Plano[] = [
  {
    id: "bronze",
    nome: "Bronze",
    subtitulo: "Essencial",
    descricao: "Proteção contra roubo, furto e perda total, com assistência 24h.",
    destaques: [
      "Roubo, furto e perda total",
      "Assistência 24h com guincho até 250 km",
      "Reboque",
      "Pane elétrica, mecânica e seca",
    ],
    coberturas: [
      { label: "Roubo e furto", valor: true },
      { label: "Perda total", valor: true },
      // Incêndio, explosão e fenômenos da natureza só aparecem a partir do Prata
      // nas propostas de referência.
      { label: "Incêndio, explosão e fenômenos da natureza", valor: false },
      { label: "Colisão e capotamento", valor: false },
      { label: "Assistência 24h (guincho)", valor: "250 km" },
      { label: "Reboque", valor: true },
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
    descricao: "Acrescenta colisão, incêndio e danos materiais a terceiros.",
    destaques: [
      "Roubo, furto, colisão e perda total",
      "Incêndio, explosão e fenômenos da natureza",
      "Assistência 24h com guincho até 250 km",
      "Danos materiais a terceiros até R$ 50.000",
    ],
    coberturas: [
      { label: "Roubo e furto", valor: true },
      { label: "Perda total", valor: true },
      { label: "Incêndio, explosão e fenômenos da natureza", valor: true },
      { label: "Colisão e capotamento", valor: true },
      { label: "Assistência 24h (guincho)", valor: "250 km" },
      { label: "Reboque", valor: true },
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
    subtitulo: "Avançado",
    descricao: "Amplia a assistência e acrescenta carro reserva e vidros.",
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
      { label: "Incêndio, explosão e fenômenos da natureza", valor: true },
      { label: "Colisão e capotamento", valor: true },
      { label: "Assistência 24h (guincho)", valor: "500 km" },
      { label: "Reboque", valor: true },
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
    subtitulo: "Ampliado",
    descricao: "Os maiores limites de assistência, terceiros e carro reserva.",
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
      { label: "Incêndio, explosão e fenômenos da natureza", valor: true },
      { label: "Colisão e capotamento", valor: true },
      { label: "Assistência 24h (guincho)", valor: "750 km" },
      { label: "Reboque", valor: true },
      { label: "Pane elétrica, mecânica e seca", valor: true },
      { label: "Danos materiais a terceiros", valor: "R$ 150.000" },
      { label: "Carro reserva", valor: "30 dias", nota: "carência 7 dias" },
      { label: "Vidros e para-brisas", valor: "70%", nota: "carência 7 dias" },
      { label: "Faróis, lanternas e retrovisores", valor: "70%", nota: "carência 7 dias" },
    ],
  },
];

export function getPlano(id: PlanoId): Plano {
  const plano = PLANOS.find((p) => p.id === id);
  if (!plano) throw new Error(`Plano desconhecido: ${id}`);
  return plano;
}

/** Catálogo filtrado pelos planos oferecidos para a categoria do veículo. */
export function planosDisponiveis(ids: PlanoId[]): Plano[] {
  return PLANOS.filter((plano) => ids.includes(plano.id));
}
