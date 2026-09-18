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
 * As taxas abaixo foram deduzidas de um punhado de cotações de exemplo e NÃO
 * são uma fórmula confirmada pela Magna. Por isso todo resultado deste provedor
 * sai com `status: "ESTIMATED"` e jamais deve ser apresentado como valor oficial.
 */
export const AVISO_REGRA_INFERIDA =
  "Regra de mensalidade inferida a partir de cotações de referência. " +
  "Deve ser substituída por fonte oficial quando disponível.";

/** Confiabilidade da origem de cada tabela de taxas. */
type Confianca =
  /** Reproduz exatamente as cotações de referência conhecidas. */
  | "calibrada-com-cotacoes-de-referencia"
  /** Sem cotações de referência: valores provisórios aguardando a Magna. */
  | "provisoria-aguardando-tabela-da-magna";

interface TaxaPlano {
  /** Percentual mensal sobre o valor FIPE do veículo. */
  taxaMensalFipe: number;
  /** Mensalidade mínima aplicada quando o percentual fica abaixo do piso. */
  mensalidadeMinima: number;
}

interface RegraCategoria {
  confianca: Confianca;
  /** De onde vieram os números desta tabela. */
  origem: string;
  taxas: Record<PlanoId, TaxaPlano>;
}

/**
 * Cada categoria tem a sua própria tabela. A fórmula de carro NUNCA é aplicada
 * automaticamente a moto ou caminhão: categoria sem entrada aqui responde
 * `UNAVAILABLE`.
 */
const REGRAS_POR_CATEGORIA: Partial<Record<CategoriaVeiculo, RegraCategoria>> = {
  CAR: {
    confianca: "calibrada-com-cotacoes-de-referencia",
    origem:
      "Calibrada para reproduzir as cotações de referência de um veículo com FIPE " +
      "R$ 28.436,00 (Bronze R$ 108,07 · Prata R$ 132,87 · Ouro R$ 164,27 · Premium R$ 177,77).",
    taxas: {
      bronze: { taxaMensalFipe: 0.0038005, mensalidadeMinima: 79.9 },
      prata: { taxaMensalFipe: 0.0046726, mensalidadeMinima: 99.9 },
      ouro: { taxaMensalFipe: 0.0057768, mensalidadeMinima: 119.9 },
      premium: { taxaMensalFipe: 0.0062516, mensalidadeMinima: 139.9 },
    },
  },
  MOTORCYCLE: {
    confianca: "provisoria-aguardando-tabela-da-magna",
    origem:
      "Não há cotações de referência de motocicleta. Estes números são provisórios " +
      "e precisam ser substituídos pela tabela da Magna antes de ir a produção.",
    taxas: {
      bronze: { taxaMensalFipe: 0.0052, mensalidadeMinima: 69.9 },
      prata: { taxaMensalFipe: 0.0063, mensalidadeMinima: 84.9 },
      ouro: { taxaMensalFipe: 0.0078, mensalidadeMinima: 99.9 },
      premium: { taxaMensalFipe: 0.0085, mensalidadeMinima: 114.9 },
    },
  },
  // TRUCK não tem regra: caminhão exige análise individual, então o provedor
  // responde UNAVAILABLE e a interface encaminha para um consultor.
};

interface ModalidadeParticipacao {
  id: ParticipacaoId;
  nome: string;
  badge?: string;
  /** Percentual da FIPE. `null` para participação zero. */
  percentual: number | null;
  /** Multiplicador aplicado sobre a mensalidade base do plano. */
  fatorMensalidade: number;
  descricao: string;
  carenciaDias?: number;
}

const MODALIDADES: ModalidadeParticipacao[] = [
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
    descricao: "Participação de 6% da FIPE, respeitando o piso mínimo contratual.",
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

    if (!(entrada.valorFipe > 0)) {
      return {
        status: "UNAVAILABLE",
        provedor: this.nome,
        motivo: "Sem valor FIPE apurado não é possível estimar a mensalidade.",
      };
    }

    const taxa = regra.taxas[entrada.planoId];
    const fatorComercial = entrada.usoComercial ? this.config.fatorUsoComercial : 1;
    const mensalidadeBase = arredondar(
      Math.max(entrada.valorFipe * taxa.taxaMensalFipe, taxa.mensalidadeMinima) * fatorComercial,
    );

    return {
      status: "ESTIMATED",
      provedor: this.nome,
      observacao: AVISO_REGRA_INFERIDA,
      mensalidadeBase,
      taxaAdesao: this.config.taxaAdesao,
      participacoes: this.calcularParticipacoes(entrada, mensalidadeBase),
    };
  }

  private calcularParticipacoes(
    entrada: EntradaPrecificacao,
    mensalidadeBase: number,
  ): ParticipacaoPrecificada[] {
    const bloqueadas = entrada.usoComercial
      ? this.config.participacoesBloqueadasUsoComercial
      : [];

    const calculadas = MODALIDADES.filter((m) => !bloqueadas.includes(m.id))
      .map<ParticipacaoPrecificada>((modalidade) => {
        const bruto =
          modalidade.percentual === null ? 0 : entrada.valorFipe * modalidade.percentual;
        const pisoAplicado =
          modalidade.percentual !== null && bruto < this.config.participacaoMinima;

        return {
          id: modalidade.id,
          nome: modalidade.nome,
          badge: modalidade.badge,
          descricao: modalidade.descricao,
          percentual: modalidade.percentual,
          valor:
            modalidade.percentual === null
              ? 0
              : arredondar(pisoAplicado ? this.config.participacaoMinima : bruto),
          pisoAplicado,
          mensalidade: arredondar(mensalidadeBase * modalidade.fatorMensalidade),
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
