import { describe, expect, it } from "vitest";

import { formatBRL, formatPercentual, formatPlaca, isPlacaValida } from "@/lib/format";

describe("formatPercentual", () => {
  it("não arredonda 12,5% para 13%", () => {
    expect(formatPercentual(0.125)).toBe("12,5%");
  });

  it("mostra percentuais inteiros sem casas decimais", () => {
    expect(formatPercentual(0.12)).toBe("12%");
    expect(formatPercentual(0.15)).toBe("15%");
    expect(formatPercentual(0.1)).toBe("10%");
    expect(formatPercentual(0.08)).toBe("8%");
    expect(formatPercentual(0.06)).toBe("6%");
  });
});

describe("formatBRL", () => {
  it("usa espaço comum entre o símbolo e o número", () => {
    expect(formatBRL(1800)).toBe("R$ 1.800,00");
    expect(formatBRL(1800)).not.toContain(" ");
  });
});

describe("placa", () => {
  it("aceita padrão antigo e Mercosul", () => {
    expect(isPlacaValida("ABC1234")).toBe(true);
    expect(isPlacaValida("BRA2E19")).toBe(true);
    expect(isPlacaValida("AB1234")).toBe(false);
  });

  it("formata com hífen", () => {
    expect(formatPlaca("BRA2E19")).toBe("BRA-2E19");
  });
});
