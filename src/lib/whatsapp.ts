import { WHATSAPP_NUMERO } from "./config";
import { formatBRL, formatPercentual, formatPlaca } from "./format";
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
    if (!cotacao.placa) {
      throw new Error("A mensagem do WhatsApp exige a placa do veículo.");
    }

    const participacao =
      cotacao.percentualParticipacao === null
        ? {
            percentual: "Sem participação no 1º evento coberto",
            valor: `${formatBRL(cotacao.valorParticipacao)} no 1º evento coberto`,
          }
        : {
            percentual: formatPercentual(cotacao.percentualParticipacao),
            valor: `${formatBRL(cotacao.valorParticipacao)} por evento coberto`,
          };

    const linhas: Array<string | null> = [
      "Olá! Fiz uma simulação pelo site e gostaria de continuar meu atendimento.",
      "",
      // A placa é a informação mais importante para o consultor: vem primeiro.
      "🚗 PLACA",
      formatPlaca(cotacao.placa),
      "",
      "👤 CLIENTE",
      cotacao.nome,
      "",
      "🚘 VEÍCULO",
      `${cotacao.marca} ${cotacao.modelo}`,
      String(cotacao.ano),
      "",
      "📊 FIPE",
      `Código: ${cotacao.codigoFipe}`,
      `Valor: ${formatBRL(cotacao.valorFipe)}`,
      `Referência: ${cotacao.mesReferenciaFipe}`,
      "",
      // Em moto a finalidade não é perguntada; não inventamos um uso declarado.
      ...(cotacao.usoDeclarado ? ["USO", cotacao.usoDeclarado, ""] : []),
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
      "Código da simulação:",
      cotacao.codigo,
      "",
      "Gostaria de continuar o atendimento.",
    ];

    return linhas.filter((linha): linha is string => linha !== null).join("\n");
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
