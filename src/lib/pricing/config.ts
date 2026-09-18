/**
 * Parâmetros comerciais da precificação.
 *
 * Tudo aqui é configuração, não regra imutável: a Magna deve revisar cada valor
 * antes de colocar o site em produção.
 */
export interface PricingConfig {
  /**
   * Oculta modalidades de participação economicamente dominadas — aquelas em que
   * o piso mínimo iguala a participação de uma opção mais barata, fazendo o
   * usuário pagar mais por exatamente a mesma participação.
   *
   * Padrão `false`: por padrão exibimos todas as modalidades conforme a regra da
   * Magna. Ative apenas se a Magna confirmar que quer esconder as dominadas.
   */
  hideDominatedParticipationOptions: boolean;

  /** Piso mínimo contratual da participação, em reais. */
  participacaoMinima: number;

  /** Valor único de filiação e ativação da proteção, em reais. */
  taxaAdesao: number;

  /**
   * Efeito do uso comercial (aplicativo/táxi) sobre a MENSALIDADE.
   *
   * Uso comercial nunca altera o plano recomendado — isso é decidido apenas
   * pelas respostas do questionário de perfil.
   *
   * Padrão `1` (sem efeito): a Magna precisa informar o agravo real antes de
   * ligar isso em produção.
   */
  fatorUsoComercial: number;

  /**
   * Modalidades de participação indisponíveis para uso comercial.
   *
   * Padrão vazio: nenhuma restrição até a Magna confirmar a regra.
   */
  participacoesBloqueadasUsoComercial: string[];
}

function lerBooleano(valor: string | undefined, padrao: boolean): boolean {
  if (valor === undefined) return padrao;
  return valor === "true" || valor === "1";
}

function lerNumero(valor: string | undefined, padrao: number): number {
  const numero = Number.parseFloat(valor ?? "");
  return Number.isFinite(numero) && numero > 0 ? numero : padrao;
}

export const PRICING_CONFIG: PricingConfig = {
  hideDominatedParticipationOptions: lerBooleano(
    process.env.NEXT_PUBLIC_HIDE_DOMINATED_PARTICIPATION_OPTIONS,
    false,
  ),
  participacaoMinima: lerNumero(process.env.NEXT_PUBLIC_PARTICIPACAO_MINIMA, 1800),
  taxaAdesao: lerNumero(process.env.NEXT_PUBLIC_TAXA_ADESAO, 300),
  fatorUsoComercial: lerNumero(process.env.NEXT_PUBLIC_FATOR_USO_COMERCIAL, 1),
  participacoesBloqueadasUsoComercial: (
    process.env.NEXT_PUBLIC_PARTICIPACOES_BLOQUEADAS_USO_COMERCIAL ?? ""
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
};
