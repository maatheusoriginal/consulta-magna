export function formatBRL(valor: number, comCentavos = true): string {
  return (
    valor
      .toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: comCentavos ? 2 : 0,
        maximumFractionDigits: comCentavos ? 2 : 0,
      })
      // O Intl separa "R$" do número com espaço não-quebrável (U+00A0). Trocamos
      // por um espaço comum para que o texto seja previsível em mensagens,
      // comparações e no link do WhatsApp.
      .replace(/\u00A0/g, " ")
  );
}

/** Separa "R$ 164,27" em { simbolo: "R$", valor: "164,27" } para a hierarquia tipográfica. */
export function splitBRL(valor: number): { simbolo: string; numero: string } {
  return { simbolo: "R$", numero: formatBRL(valor).replace(/^R\$\s*/, "") };
}

/** Converte "R$ 28.436,00" (formato da FIPE) em 28436 */
export function parseValorFipe(valor: string): number {
  const limpo = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = Number.parseFloat(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

/** Normaliza placa para 7 caracteres alfanuméricos maiúsculos */
export function normalizePlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

/** Aceita padrão antigo (ABC1234) e Mercosul (ABC1D23) */
export function isPlacaValida(placa: string): boolean {
  const p = normalizePlaca(placa);
  return /^[A-Z]{3}\d{4}$/.test(p) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p);
}

/** Exibe BRA2E19 como BRA-2E19 */
export function formatPlaca(placa: string): string {
  const p = normalizePlaca(placa);
  return p.length > 3 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function formatWhatsApp(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isWhatsAppValido(valor: string): boolean {
  return /^\d{10,11}$/.test(valor.replace(/\D/g, ""));
}

export function isEmailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());
}

/** Título em Capitalização: "VOLKSWAGEN" -> "Volkswagen" */
export function titleCase(texto: string): string {
  return texto
    .toLowerCase()
    .split(" ")
    .map((palavra) =>
      palavra.length <= 2 && /^[a-z]+$/.test(palavra)
        ? palavra
        : palavra.charAt(0).toUpperCase() + palavra.slice(1),
    )
    .join(" ");
}

/**
 * A FIPE devolve algumas marcas com prefixo de sigla ("VW - VolksWagen",
 * "GM - Chevrolet"). Mantemos a sigla na lista de seleção, mas limpamos na
 * exibição do veículo escolhido.
 */
export function limparMarca(marca: string): string {
  return marca.replace(/^[A-Za-z]{2,4}\s*-\s*/, "").trim();
}

/**
 * Percentual de participação para exibição: "12%", "12,5%", "10%".
 *
 * Nunca arredonda para inteiro — a moto usa 12,5% e mostrar "13%" seria errado.
 */
export function formatPercentual(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
