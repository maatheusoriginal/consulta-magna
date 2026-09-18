import { formatBRL, formatPlaca } from "./format";
import type { FipeVeiculo, Lead, ParticipacaoCalculada, Plano } from "./types";

export function montarMensagemWhatsApp({
  codigo,
  veiculo,
  plano,
  participacao,
  taxaAdesao,
  lead,
}: {
  codigo: string;
  veiculo: FipeVeiculo;
  plano: Plano;
  participacao: ParticipacaoCalculada;
  taxaAdesao: number;
  lead?: Lead | null;
}): string {
  const participacaoTexto =
    participacao.percentual === null
      ? "R$ 0 no 1º evento coberto (carência de 60 dias)"
      : participacao.pisoAplicado
        ? `${formatBRL(participacao.valor)} (piso mínimo contratual)`
        : `${formatBRL(participacao.valor)} (${Math.round(participacao.percentual * 100)}% da FIPE)`;

  const linhas = [
    `Olá! Gostaria de dar continuidade à simulação ${codigo}:`,
    "",
    `• Veículo: ${veiculo.marca} ${veiculo.modelo} ${veiculo.anoModelo}`,
    veiculo.placa ? `• Placa: ${formatPlaca(veiculo.placa)}` : null,
    `• Valor FIPE: ${formatBRL(veiculo.valor)} (cód. ${veiculo.codigoFipe})`,
    `• Plano: ${plano.nome} — ${formatBRL(participacao.mensalidade)}/mês`,
    `• Participação: ${participacaoTexto}`,
    `• Taxa de adesão: ${formatBRL(taxaAdesao)}`,
    lead?.nome ? "" : null,
    lead?.nome ? `Meu nome é ${lead.nome}.` : null,
  ];

  return linhas.filter((linha) => linha !== null).join("\n");
}
