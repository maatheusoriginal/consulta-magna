export type TipoVeiculo = "carros" | "motos" | "caminhoes";

export interface FipeItem {
  codigo: string;
  nome: string;
}

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

export interface Plano {
  id: PlanoId;
  nome: string;
  subtitulo: string;
  descricao: string;
  /** Percentual da tabela FIPE cobrado por mês */
  taxaMensalFipe: number;
  /** Mensalidade mínima aplicada quando o percentual fica abaixo do piso */
  mensalidadeMinima: number;
  destaques: string[];
  coberturas: CoberturaItem[];
}

export type ParticipacaoId = "padrao" | "reduzida" | "minima" | "zero";

export interface ModalidadeParticipacao {
  id: ParticipacaoId;
  nome: string;
  badge?: string;
  /** Percentual da FIPE. `null` para participação zero. */
  percentual: number | null;
  /** Multiplicador aplicado sobre a mensalidade base do plano */
  fatorMensalidade: number;
  descricao: string;
  carenciaDias?: number;
}

export interface ParticipacaoCalculada extends ModalidadeParticipacao {
  /** Valor da participação em reais (já com piso mínimo aplicado) */
  valor: number;
  /** `true` quando o piso mínimo contratual foi aplicado */
  pisoAplicado: boolean;
  mensalidade: number;
}

export interface Cotacao {
  veiculo: FipeVeiculo;
  perfil: PerfilRespostas;
  plano: Plano;
  mensalidadeBase: number;
  participacao: ParticipacaoCalculada;
  taxaAdesao: number;
  codigo: string;
}

export interface Lead {
  nome: string;
  whatsapp: string;
  email?: string;
}
