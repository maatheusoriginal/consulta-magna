import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FipeVeiculo } from "@/lib/types";

vi.mock("@/lib/fipe", () => ({
  listarMarcas: vi.fn(async () => [
    { codigo: "59", nome: "VW - VolksWagen" },
    { codigo: "23", nome: "GM - Chevrolet" },
  ]),
  listarModelos: vi.fn(async () => [
    { codigo: "1", nome: "Gol 1.0 Total Flex 8V 5p" },
    { codigo: "2", nome: "Gol 1.6 Total Flex 8V 5p" },
    { codigo: "3", nome: "Gol 1.6 Rallye Total Flex" },
    { codigo: "4", nome: "Polo 1.6 Total Flex" },
  ]),
  listarAnos: vi.fn(async () => [
    { codigo: "2013-1", nome: "2013 Gasolina" },
    { codigo: "2012-1", nome: "2012 Gasolina" },
  ]),
  consultarPreco: vi.fn(
    async (tipo: string, marca: string, modelo: string, ano: string): Promise<FipeVeiculo> => ({
      tipo: tipo as FipeVeiculo["tipo"],
      marcaCodigo: marca,
      marca: "VolksWagen",
      modeloCodigo: modelo,
      modelo: `Modelo ${modelo}`,
      anoCodigo: ano,
      anoModelo: 2013,
      combustivel: "Gasolina",
      codigoFipe: `00532${modelo}-4`,
      mesReferencia: "setembro de 2026",
      valor: 28000 + Number(modelo) * 1000,
    }),
  ),
}));

const { consultarPlaca } = await import("@/lib/placa");

const RESPOSTA_PROVEDOR = {
  marca: "VOLKSWAGEN",
  modelo: "GOL",
  ano: "2013",
  combustivel: "Gasolina",
};

beforeEach(() => {
  process.env.PLACA_API_URL = "https://provedor.exemplo/placa/{placa}";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(RESPOSTA_PROVEDOR), { status: 200 })),
  );
});

afterEach(() => {
  delete process.env.PLACA_API_URL;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("consulta por placa", () => {
  it("não seleciona uma versão sozinha: devolve os candidatos para o usuário confirmar", async () => {
    const resultado = await consultarPlaca("BRA2E19", "carros");

    expect(resultado.configurado).toBe(true);
    // Três modelos "Gol" combinam com o texto da placa — nenhum é escolhido por nós.
    expect(resultado.candidatos.length).toBeGreaterThan(1);
    expect(resultado).not.toHaveProperty("sugestao");
    expect(resultado).not.toHaveProperty("veiculo");
  });

  it("cada candidato traz versão, ano, combustível, código e valor FIPE", async () => {
    const { candidatos } = await consultarPlaca("BRA2E19", "carros");

    for (const candidato of candidatos) {
      expect(candidato.modelo).toBeTruthy();
      expect(candidato.anoModelo).toBe(2013);
      expect(candidato.combustivel).toBe("Gasolina");
      expect(candidato.codigoFipe).toMatch(/^\d{5}\d-\d$/);
      expect(candidato.valor).toBeGreaterThan(0);
      expect(candidato.placa).toBe("BRA2E19");
    }
  });

  it("só oferece versões aderentes ao modelo informado pela placa", async () => {
    const { candidatos } = await consultarPlaca("BRA2E19", "carros");
    // "Polo" não combina com "GOL" e não pode entrar na lista.
    expect(candidatos.map((c) => c.modeloCodigo)).not.toContain("4");
  });

  it("sem o ano do veículo não arrisca candidatos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ marca: "VOLKSWAGEN", modelo: "GOL" }), { status: 200 }),
      ),
    );

    const resultado = await consultarPlaca("BRA2E19", "carros");
    expect(resultado.configurado).toBe(true);
    expect(resultado.candidatos).toEqual([]);
  });

  it("sem provedor configurado responde configurado: false", async () => {
    delete process.env.PLACA_API_URL;
    delete process.env.PLACA_API_TOKEN;

    const resultado = await consultarPlaca("BRA2E19", "carros");
    expect(resultado.configurado).toBe(false);
    expect(resultado.candidatos).toEqual([]);
  });

  it("o módulo não expõe nenhum atalho de 'melhor correspondência'", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/placa.ts"), "utf8");
    expect(fonte).not.toMatch(/export\s+(async\s+)?function\s+melhorCorrespondencia/);
    expect(fonte).not.toMatch(/sugestao/i);
  });
});
