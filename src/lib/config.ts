/** Número do consultor no formato internacional, só dígitos. Ex.: 5511999999999 */
export const WHATSAPP_NUMERO = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? "5511999999999"
).replace(/\D/g, "");

export const MARCA = {
  nome: "Magna",
  nomeCompleto: "Magna Proteção Automotiva",
  descricao: "Proteção veicular com assistência rápida, transparência e segurança.",
};

export function linkWhatsApp(mensagem: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}
