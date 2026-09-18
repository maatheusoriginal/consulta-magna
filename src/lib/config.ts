/**
 * Configuração central da marca e do canal de atendimento.
 *
 * Nenhum outro módulo deve montar link de WhatsApp por conta própria: use
 * sempre o `whatsAppService` (`src/lib/whatsapp.ts`), que lê daqui.
 */

/** Número oficial do consultor: +55 34 99196-0908. */
const WHATSAPP_PADRAO = "5534991960908";

export const WHATSAPP_NUMERO = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMERO || WHATSAPP_PADRAO
).replace(/\D/g, "");

export const MARCA = {
  nome: "Magna",
  nomeCompleto: "Magna Proteção Automotiva",
  descricao: "Proteção veicular com assistência rápida, transparência e segurança.",
};

/** Texto exibido enquanto a mensalidade vier de regra inferida. */
export const AVISO_SIMULACAO_ESTIMADA =
  "Simulação estimada. Valores sujeitos à confirmação.";
