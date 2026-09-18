export type TipoVeiculo = "carros" | "motos" | "caminhoes";

/** Categoria de domínio usada pela precificação, independente do vocabulário da FIPE. */
export type CategoriaVeiculo = "CAR" | "MOTORCYCLE" | "TRUCK";

const CATEGORIA_POR_TIPO: Record<TipoVeiculo, CategoriaVeiculo> = {
  carros: "CAR",
  motos: "MOTORCYCLE",
  caminhoes: "TRUCK",
};

export function categoriaDoTipo(tipo: TipoVeiculo): CategoriaVeiculo {
  return CATEGORIA_POR_TIPO[tipo];
}

/**
 * Categorias em que a finalidade (particular ou aplicativo/táxi) não altera a
 * cotação e por isso não é perguntada.
 *
 * Importante: não perguntar NÃO significa que o uso seja particular. Nesses
 * casos o uso declarado fica vazio e a precificação usa a faixa padrão.
 */
export function finalidadeNaoAlteraCotacao(tipo: TipoVeiculo): boolean {
  return categoriaDoTipo(tipo) === "MOTORCYCLE";
}

/** Faixa de uso considerada pela precificação. */
export type UsoPrecificacao = "STANDARD" | "COMERCIAL";

export interface FipeItem {
  codigo: string;
  nome: string;
}

/**
 * Dados do veículo apurados na tabela FIPE.
 *
 * Este objeto descreve apenas o VEÍCULO. Ele não contém — e não deve conter —
 * nenhum valor comercial da Magna (mensalidade, participação ou adesão).
 */
export interface FipeVeiculo {
  tipo: TipoVeiculo;
  marcaCodigo: string;
  marca: string;
  modeloCodigo: string;
  modelo: string;
  anoCodigo: string;
  anoModelo: number;
  combustivel: string;
  codigoFipe: string;
  mesReferencia: string;
  valor: number;
  placa?: string;
}

export type Finalidade = "particular" | "aplicativo";

export interface PerfilRespostas {
  finalidade: Finalidade;
  prioridade: "roubo" | "colisao" | "terceiros" | "completa";
  viagens: "quase-nunca" | "as-vezes" | "frequencia";
  carroReserva: "nao-preciso" | "interessante" | "muito-importante";
  terceiros: "nao-prioridade" | "intermediaria" | "alta";
  vidros: "nao" | "um-pouco" | "sim";
}

export type PlanoId = "bronze" | "prata" | "ouro" | "premium";

export interface CoberturaItem {
  /** Rótulo usado na tabela comparativa */
  label: string;
  /** `true` = incluso, `false` = não incluso, string = valor/limite */
  valor: boolean | string;
  /** Observação curta, ex.: carência */
  nota?: string;
}

/**
 * Catálogo de coberturas de um plano.
 *
 * Deliberadamente sem preço: quanto custa cada plano é responsabilidade de um
 * `PricingProvider` (ver `src/lib/pricing`).
 */
export interface Plano {
  id: PlanoId;
  nome: string;
  subtitulo: string;
  descricao: string;
  destaques: string[];
  coberturas: CoberturaItem[];
}

export type ParticipacaoId = "padrao" | "reduzida" | "minima" | "zero";

export interface Lead {
  nome: string;
  whatsapp: string;
  email?: string;
}
