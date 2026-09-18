import { formatPercentual } from "../format";
import type { CategoriaVeiculo, ParticipacaoId, PlanoId } from "../types";
import { PRICING_CONFIG, type PricingConfig } from "./config";
import type {
  EntradaPrecificacao,
  ParticipacaoPrecificada,
  PricingProvider,
  ResultadoPrecificacao,
} from "./types";

/**
 * AVISO IMPORTANTE
 * ----------------
 * Regra de mensalidade INFERIDA a partir de cotações de referência.
 * Deve ser substituída por fonte oficial quando disponível.
 *
 * A estrutura abaixo foi deduzida das cotações reais listadas em
 * `REFERENCIAS` e NÃO é uma fórmula confirmada pela Magna. Por isso todo
 * resultado sai com `status: "ESTIMATED"` e jamais deve ser apresentado como
 * valor oficial.
 */
export const AVISO_REGRA_INFERIDA =
  "Regra de mensalidade inferida a partir de cotações de referência. " +
  "Deve ser substituída por fonte oficial quando disponível.";

/**
 * Cotações reais que sustentam a regra. Servem de documentação e são as mesmas
 * usadas nos testes (`tests/precificacao.test.ts`).
 */
export const REFERENCIAS = {
  CAR: [
    { nome: "Gol 2013", valorFipe: 28436, bronze: 108.07, prata: 132.87, ouro: 164.27, premium: 177.77 },
    { nome: "HB20 Premium 2013", valorFipe: 46540, bronze: 133.25, prata: 158.05, ouro: 189.45, premium: 202.95 },
    { nome: "Prisma LTZ 1.4 2015", valorFipe: 51630, bronze: 140.46, prata: 165.26, ouro: 196.66, premium: 210.16 },
  ],
  MOTORCYCLE: [
    { nome: "Honda XRE 190 Flex 2025", codigoFipe: "811141-3", valorFipe: 25197, bronze: 118.19, prata: 142.98 },
    { nome: "Honda CG 150 Fan ESi 2013", codigoFipe: "811101-4", valorFipe: 11112, bronze: 80.0, prata: 104.44 },
  ],
} as const;

/** Confiabilidade da origem de cada tabela. */
type Confianca =
  /** Ajustada contra três cotações reais de carro. */
  | "inferida-de-tres-cotacoes-de-carro"
  /** Ajustada contra duas cotações reais de moto. */
  | "inferida-de-duas-cotacoes-de-moto";

/**
 * Estrutura observada nas cotações: uma mensalidade base que cresce linearmente
 * com a FIPE, mais um adicional fixo por plano.
 *
 *     mensalidade = base + adicionalDoPlano
 *     base        = valorFixo + valorFipe * fatorFipe
 *
 * Os adicionais por plano são os mesmos em carro e moto nas cotações conhecidas.
 */
interface RegraCategoria {
  confianca: Confianca;
  origem: string;
  /** Planos efetivamente comercializados para a categoria. */
  planosDisponiveis: PlanoId[];
  base: { valorFixo: number; fatorFipe: number };
  /** Adicional fixo por plano, em reais. */
  adicionalPorPlano: Partial<Record<PlanoId, number>>;
  /** Mensalidade mínima observada para a categoria. */
  mensalidadeMinima: number;
  /** Percentual da FIPE de cada modalidade de participação. */
  percentuaisParticipacao: Record<Exclude<ParticipacaoId, "zero">, number>;
}

/**
 * Cada categoria tem a sua própria regra. A fórmula de carro NUNCA é aplicada
 * automaticamente a moto ou caminhão: categoria sem entrada aqui responde
 * `UNAVAILABLE`.
 */
const REGRAS_POR_CATEGORIA: Partial<Record<CategoriaVeiculo, RegraCategoria>> = {
  CAR: {
    confianca: "inferida-de-tres-cotacoes-de-carro",
    origem:
      "Ajustada contra Gol 2013 (FIPE R$ 28.436), HB20 Premium 2013 (FIPE R$ 46.540) " +
      "e Prisma LTZ 1.4 2015 (FIPE R$ 51.630). Divergência máxima observada: R$ 0,06.",
    planosDisponiveis: ["bronze", "prata", "ouro", "premium"],
    base: { valorFixo: 52.25, fatorFipe: 0.001395 },
    adicionalPorPlano: { bronze: 16.14, prata: 40.94, ouro: 72.34, premium: 85.84 },
    mensalidadeMinima: 0,
    percentuaisParticipacao: { padrao: 0.12, reduzida: 0.08, minima: 0.06 },
  },
  MOTORCYCLE: {
    confianca: "inferida-de-duas-cotacoes-de-moto",
    origem:
      "Ajustada contra Honda XRE 190 Flex 2025 (FIPE R$ 25.197, cód. 811141-3) e " +
      "Honda CG 150 Fan ESi 2013 (FIPE R$ 11.112, cód. 811101-4). " +
      "Só há referência de Bronze e Prata: Ouro e Premium não são oferecidos.",
    // Sem dados que confirmem Ouro/Premium para moto, a oferta para aqui.
    planosDisponiveis: ["bronze", "prata"],
    base: { valorFixo: 33.1, fatorFipe: 0.002736 },
    adicionalPorPlano: { bronze: 16.14, prata: 40.94 },
    mensalidadeMinima: 80,
    percentuaisParticipacao: { padrao: 0.15, reduzida: 0.125, minima: 0.1 },
  },
  // TRUCK não tem regra: caminhão exige análise individual, então o provedor
  // responde UNAVAILABLE e a interface encaminha para um consultor.
};

interface ModalidadeParticipacao {
  id: ParticipacaoId;
  nome: string;
  badge?: string;
  /** Multiplicador aplicado sobre a mensalidade base do plano. */
  fatorMensalidade: number;
  carenciaDias?: number;
}

const MODALIDADES: ModalidadeParticipacao[] = [
  { id: "padrao", nome: "Padrão", fatorMensalidade: 1 },
  {
    id: "reduzida",
    nome: "Reduzida",
    badge: "Menor desembolso no evento",
    fatorMensalidade: 1.055556,
  },
  { id: "minima", nome: "Mínima", fatorMensalidade: 1.111111 },
  {
    id: "zero",
    nome: "Participação zero",
    badge: "Sem desembolso no 1º evento",
    fatorMensalidade: 1.333333,
    carenciaDias: 60,
  },
];

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Provedor de preços baseado em regra inferida.
 *
 * Não conhece a tabela FIPE nem faz qualquer chamada de rede: recebe o valor
 * FIPE já apurado pelo `FipeProvider` e devolve somente valores comerciais.
 * Todo resultado sai marcado como `ESTIMATED`.
 */
export class EstimatedPricingProvider implements PricingProvider {
  readonly nome = "EstimatedPricingProvider";
  readonly status = "ESTIMATED" as const;

  constructor(private readonly config: PricingConfig = PRICING_CONFIG) {}

  /** Descreve de onde vieram os números de uma categoria (para auditoria e docs). */
  descreverRegra(categoria: CategoriaVeiculo): RegraCategoria | undefined {
    return REGRAS_POR_CATEGORIA[categoria];
  }

  /** Planos comercializados para a categoria. Vazio quando não há oferta. */
  getAvailablePlanIds(categoria: CategoriaVeiculo): PlanoId[] {
    return [...(REGRAS_POR_CATEGORIA[categoria]?.planosDisponiveis ?? [])];
  }

  precificar(entrada: EntradaPrecificacao): ResultadoPrecificacao {
    const regra = REGRAS_POR_CATEGORIA[entrada.categoria];

    if (!regra) {
      return {
        status: "UNAVAILABLE",
        provedor: this.nome,
        motivo:
          "Ainda não há regra de precificação para esta categoria de veículo. " +
          "Um consultor precisa avaliar o caso individualmente.",
      };
    }

    const adicional = regra.adicionalPorPlano[entrada.planoId];
    if (!regra.planosDisponiveis.includes(entrada.planoId) || adicional === undefined) {
      return {
        status: "UNAVAILABLE",
        provedor: this.nome,
        motivo: "Este plano não é oferecido para esta categoria de veículo.",
      };
    }

    if (!(entrada.valorFipe > 0)) {
      return {
        status: "UNAVAILABLE",
        provedor: this.nome,
        motivo: "Sem valor FIPE apurado não é possível estimar a mensalidade.",
      };
    }

    const base = regra.base.valorFixo + entrada.valorFipe * regra.base.fatorFipe;
    const fatorComercial = entrada.usoComercial ? this.config.fatorUsoComercial : 1;
    const mensalidadeBase = arredondar(
      Math.max(base + adicional, regra.mensalidadeMinima) * fatorComercial,
    );

    return {
      status: "ESTIMATED",
      provedor: this.nome,
      observacao: AVISO_REGRA_INFERIDA,
      mensalidadeBase,
      taxaAdesaoMinima: this.config.taxaAdesaoMinima,
      participacoes: this.calcularParticipacoes(entrada, regra, mensalidadeBase),
    };
  }

  private calcularParticipacoes(
    entrada: EntradaPrecificacao,
    regra: RegraCategoria,
    mensalidadeBase: number,
  ): ParticipacaoPrecificada[] {
    const bloqueadas = entrada.usoComercial
      ? this.config.participacoesBloqueadasUsoComercial
      : [];

    const calculadas = MODALIDADES.filter((m) => !bloqueadas.includes(m.id))
      .map<ParticipacaoPrecificada>((modalidade) => {
        const percentual =
          modalidade.id === "zero"
            ? null
            : regra.percentuaisParticipacao[modalidade.id as Exclude<ParticipacaoId, "zero">];

        const bruto = percentual === null ? 0 : entrada.valorFipe * percentual;
        const pisoAplicado = percentual !== null && bruto < this.config.participacaoMinima;
        const mensalidade = arredondar(mensalidadeBase * modalidade.fatorMensalidade);

        return {
          id: modalidade.id,
          nome: modalidade.nome,
          badge: modalidade.badge,
          descricao:
            percentual === null
              ? "Você não paga participação no primeiro evento coberto."
              : `Participação de ${formatPercentual(percentual)} da tabela FIPE do veículo.`,
          percentual,
          valor:
            percentual === null
              ? 0
              : arredondar(pisoAplicado ? this.config.participacaoMinima : bruto),
          pisoAplicado,
          mensalidade,
          // A adesão acompanha a mensalidade FINAL da modalidade escolhida.
          taxaAdesao: Math.max(this.config.taxaAdesaoMinima, mensalidade),
          carenciaDias: modalidade.carenciaDias,
        };
      })
      .sort((a, b) => a.mensalidade - b.mensalidade);

    if (!this.config.hideDominatedParticipationOptions) return calculadas;

    // Remove opções dominadas: mesma participação (ou pior) por mensalidade maior.
    const disponiveis: ParticipacaoPrecificada[] = [];
    let menorParticipacao = Number.POSITIVE_INFINITY;
    for (const opcao of calculadas) {
      if (opcao.valor < menorParticipacao) {
        menorParticipacao = opcao.valor;
        disponiveis.push(opcao);
      }
    }
    return disponiveis;
  }
}
