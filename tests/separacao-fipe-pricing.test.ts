import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import * as fipe from "@/lib/fipe";
import * as planos from "@/lib/planos";
import { EstimatedPricingProvider } from "@/lib/pricing";

const raiz = resolve(__dirname, "..");
const ler = (caminho: string) => readFileSync(resolve(raiz, caminho), "utf8");

describe("a FIPE não calcula mensalidade", () => {
  it("o módulo da FIPE não exporta nada de precificação", () => {
    const exportados = Object.keys(fipe);
    // O único "preço" que a FIPE conhece é o valor de tabela do veículo.
    expect(exportados).toContain("consultarPreco");

    for (const nome of exportados.filter((n) => n !== "consultarPreco")) {
      expect(nome).not.toMatch(/mensalidade|participac|adesao|plano|preco/i);
    }
  });

  it("consultarPreco devolve apenas dados do veículo, sem valores comerciais", () => {
    const campos = [
      "tipo",
      "marcaCodigo",
      "marca",
      "modeloCodigo",
      "modelo",
      "anoCodigo",
      "anoModelo",
      "combustivel",
      "codigoFipe",
      "mesReferencia",
      "valor",
    ];
    const fonte = ler("src/lib/fipe.ts");
    const retorno = fonte.slice(fonte.lastIndexOf("return {"));

    // Aceita tanto `campo: valor` quanto a forma abreviada `campo,`.
    for (const campo of campos) {
      expect(retorno).toMatch(new RegExp(`\\b${campo}\\s*[,:]`));
    }
    for (const proibido of ["mensalidade", "participacao", "taxaAdesao", "planoId"]) {
      expect(retorno).not.toContain(proibido);
    }
  });

  it("o catálogo de planos não guarda preço", () => {
    for (const plano of planos.PLANOS) {
      expect(plano).not.toHaveProperty("taxaMensalFipe");
      expect(plano).not.toHaveProperty("mensalidadeMinima");
      expect(plano).not.toHaveProperty("preco");
    }
  });
});

describe("PricingProvider é separado do FipeProvider", () => {
  it("o módulo de precificação não importa a FIPE", () => {
    for (const arquivo of [
      "src/lib/pricing/types.ts",
      "src/lib/pricing/config.ts",
      "src/lib/pricing/estimated-pricing-provider.ts",
      "src/lib/pricing/index.ts",
    ]) {
      expect(ler(arquivo)).not.toMatch(/from ["'].*fipe["']/);
    }
  });

  it("a FIPE não importa a precificação", () => {
    expect(ler("src/lib/fipe.ts")).not.toMatch(/from ["'].*pricing/);
  });

  it("o provedor precifica sem nenhuma chamada de rede", async () => {
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("o PricingProvider não pode acessar a rede");
    }) as typeof fetch;

    try {
      const resultado = new EstimatedPricingProvider().precificar({
        categoria: "CAR",
        valorFipe: 28436,
        planoId: "ouro",
        usoComercial: false,
      });
      expect(resultado.status).toBe("ESTIMATED");
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});
