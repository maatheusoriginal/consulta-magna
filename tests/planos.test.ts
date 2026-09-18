import { describe, expect, it } from "vitest";

import { ITENS_COMPARACAO, PLANOS, getPlano, planosDisponiveis } from "@/lib/planos";
import type { PlanoId } from "@/lib/types";

const INCENDIO = "Incêndio, explosão e fenômenos da natureza";

describe("coberturas do Bronze", () => {
  const bronze = getPlano("bronze");

  it("NÃO cobre incêndio, explosão nem fenômenos da natureza", () => {
    const item = bronze.coberturas.find((c) => c.label === INCENDIO);
    expect(item?.valor).toBe(false);

    for (const destaque of bronze.destaques) {
      expect(destaque.toLowerCase()).not.toContain("incêndio");
      expect(destaque.toLowerCase()).not.toContain("fenômenos");
    }
    expect(bronze.descricao.toLowerCase()).not.toContain("incêndio");
  });

  it("NÃO cobre colisão e capotamento", () => {
    expect(bronze.coberturas.find((c) => c.label === "Colisão e capotamento")?.valor).toBe(false);
  });

  it("cobre roubo, furto, perda total, reboque, pane e assistência 24h de 250 km", () => {
    const porLabel = Object.fromEntries(bronze.coberturas.map((c) => [c.label, c.valor]));

    expect(porLabel["Roubo e furto"]).toBe(true);
    expect(porLabel["Perda total"]).toBe(true);
    expect(porLabel["Reboque"]).toBe(true);
    expect(porLabel["Pane elétrica, mecânica e seca"]).toBe(true);
    expect(porLabel["Assistência 24h (guincho)"]).toBe("250 km");
  });
});

describe("incêndio a partir do Prata", () => {
  for (const id of ["prata", "ouro", "premium"] as const) {
    it(`${id} cobre incêndio, explosão e fenômenos da natureza`, () => {
      expect(getPlano(id).coberturas.find((c) => c.label === INCENDIO)?.valor).toBe(true);
    });
  }
});

describe("catálogo", () => {
  it("todos os planos declaram todos os itens comparados", () => {
    for (const plano of PLANOS) {
      const labels = plano.coberturas.map((c) => c.label);
      expect(labels).toEqual([...ITENS_COMPARACAO]);
    }
  });

  it("nenhum plano guarda preço", () => {
    for (const plano of PLANOS) {
      expect(plano).not.toHaveProperty("taxaMensalFipe");
      expect(plano).not.toHaveProperty("mensalidadeMinima");
      expect(plano).not.toHaveProperty("preco");
    }
  });

  it("filtra o catálogo pelos planos oferecidos para a categoria", () => {
    const soMoto: PlanoId[] = ["bronze", "prata"];
    expect(planosDisponiveis(soMoto).map((p) => p.id)).toEqual(soMoto);
    expect(planosDisponiveis([])).toEqual([]);
  });

  it("não usa textos promocionais não comprovados", () => {
    const proibidos = [/mais escolhido/i, /cobertura total/i, /melhor/i, /imbatível/i];
    const textos = PLANOS.flatMap((p) => [p.nome, p.subtitulo, p.descricao, ...p.destaques]);

    for (const texto of textos) {
      for (const proibido of proibidos) expect(texto).not.toMatch(proibido);
    }
  });
});
