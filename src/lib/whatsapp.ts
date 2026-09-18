import { WHATSAPP_NUMERO } from "./config";
import { formatBRL, formatPercentual, formatPlaca } from "./format";
import { temPrecificacao, type CotacaoSnapshot } from "./leads/types";
import type { TipoVeiculo } from "./types";

/** Ícone do veículo por categoria, só para leitura rápida pelo consultor. */
const EMOJI_VEICULO: Record<TipoVeiculo, string> = {
  carros: "🚘",
  motos: "🏍️",
  caminhoes: "🚚",
};

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

    const linhas: string[] = [
      "Olá! Fiz uma simulação pelo site e gostaria de continuar meu atendimento.",
      "",
      // A placa é a informação mais importante para o consultor: vem primeiro.
      "🚗 PLACA",
      formatPlaca(cotacao.placa),
      "",
      "👤 CLIENTE",
      cotacao.nome,
      "",
      `${EMOJI_VEICULO[cotacao.tipoVeiculo]} VEÍCULO`,
      `${cotacao.marca} ${cotacao.modelo}`,
      String(cotacao.ano),
      "",
      "📊 FIPE",
      `Código: ${cotacao.codigoFipe}`,
      `Valor: ${formatBRL(cotacao.valorFipe)}`,
      `Referência: ${cotacao.mesReferenciaFipe}`,
      "",
    ];

    // Para motocicletas a finalidade não é perguntada; não inventamos um uso.
    if (cotacao.usoDeclarado) linhas.push("USO", cotacao.usoDeclarado, "");

    if (!temPrecificacao(cotacao)) {
      // Veículo sem regra de precificação automática: nenhum valor é inventado.
      linhas.push(
        "Código da simulação:",
        cotacao.codigo,
        "",
        "Gostaria de receber uma cotação para este veículo.",
      );
      return linhas.join("\n");
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

    linhas.push(
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
    );

    return linhas.join("\n");
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
