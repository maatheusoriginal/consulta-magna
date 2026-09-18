import { WHATSAPP_NUMERO } from "./config";
import { formatBRL } from "./format";
import type { CotacaoSnapshot } from "./leads/types";

/**
 * Serviço de WhatsApp.
 *
 * Sempre usa o número da configuração central e monta a mensagem a partir do
 * snapshot da cotação que o usuário acabou de fazer — nada de veículo, FIPE,
 * plano ou valor fixo no código.
 */
export class WhatsAppService {
  constructor(private readonly numero: string = WHATSAPP_NUMERO) {}

  get numeroConfigurado(): string {
    return this.numero;
  }

  montarMensagem(cotacao: CotacaoSnapshot): string {
    const participacao =
      cotacao.percentualParticipacao === null
        ? {
            percentual: "Sem participação no 1º evento coberto",
            valor: `${formatBRL(cotacao.valorParticipacao)} no 1º evento coberto`,
          }
        : {
            percentual: `${Math.round(cotacao.percentualParticipacao * 100)}% da FIPE`,
            valor: `${formatBRL(cotacao.valorParticipacao)} por evento coberto`,
          };

    return [
      "Olá! Fiz uma simulação pelo site e gostaria de continuar meu atendimento.",
      "",
      "NOME",
      cotacao.nome,
      "",
      "VEÍCULO",
      `${cotacao.marca} ${cotacao.modelo}`,
      String(cotacao.ano),
      "",
      "FIPE",
      `Código: ${cotacao.codigoFipe}`,
      `Valor: ${formatBRL(cotacao.valorFipe)}`,
      `Referência: ${cotacao.mesReferenciaFipe}`,
      "",
      "USO",
      cotacao.tipoUso,
      "",
      "PLANO",
      cotacao.planoEscolhido.toUpperCase(),
      "",
      "MENSALIDADE",
      `${formatBRL(cotacao.mensalidade)}/mês`,
      "",
      "PARTICIPAÇÃO",
      `${cotacao.modalidadeParticipacao} — ${participacao.percentual}`,
      participacao.valor,
      "",
      "ADESÃO",
      formatBRL(cotacao.adesao),
      "",
      `SIMULAÇÃO ${cotacao.codigo}`,
      "",
      "Gostaria de continuar o atendimento.",
    ].join("\n");
  }

  montarLink(cotacao: CotacaoSnapshot): string {
    return this.montarLinkComTexto(this.montarMensagem(cotacao));
  }

  /** Link para conversas que não partem de uma cotação fechada. */
  montarLinkComTexto(mensagem: string): string {
    return `https://wa.me/${this.numero}?text=${encodeURIComponent(mensagem)}`;
  }
}

export const whatsAppService = new WhatsAppService();
