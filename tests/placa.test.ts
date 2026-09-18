import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatPlaca, isPlacaValida, normalizePlaca } from "@/lib/format";
import type { FipeItem, FipeVeiculo, TipoVeiculo } from "@/lib/types";

/** Anos com três combustíveis distintos, para provar que nada é descartado. */
const ANOS: FipeItem[] = [
  { codigo: "2015-1", nome: "2015 Gasolina" },
  { codigo: "2015-3", nome: "2015 Diesel" },
  { codigo: "2015-6", nome: "2015 Flex" },
  { codigo: "2014-1", nome: "2014 Gasolina" },
];

const listarMarcas = vi.fn(async (tipo: TipoVeiculo): Promise<FipeItem[]> =>
  tipo === "motos"
    ? [{ codigo: "80", nome: "HONDA" }]
    : [{ codigo: "59", nome: "VW - VolksWagen" }],
);
const listarModelos = vi.fn(async (tipo: TipoVeiculo): Promise<FipeItem[]> =>
  tipo === "motos"
    ? [
        { codigo: "10", nome: "CG 150 FAN ESi" },
        { codigo: "11", nome: "CG 160 START" },
      ]
    : [
        { codigo: "1", nome: "Gol 1.0 Total Flex 8V 5p" },
        { codigo: "2", nome: "Polo 1.6 Total Flex" },
      ],
);
const listarAnos = vi.fn(async (): Promise<FipeItem[]> => ANOS);
const consultarPreco = vi.fn(
  async (tipo: string, marca: string, modelo: string, ano: string): Promise<FipeVeiculo> => ({
    tipo: tipo as FipeVeiculo["tipo"],
    marcaCodigo: marca,
    marca: tipo === "motos" ? "Honda" : "VolksWagen",
    modeloCodigo: modelo,
    modelo: `Modelo ${modelo}`,
    anoCodigo: ano,
    anoModelo: Number(ano.split("-")[0]),
    combustivel: ANOS.find((a) => a.codigo === ano)?.nome.split(" ")[1] ?? "Gasolina",
    codigoFipe: `00532${modelo}-${ano.split("-")[1]}`,
    mesReferencia: "setembro de 2026",
    valor: 28000 + Number(modelo) * 1000,
  }),
);

vi.mock("@/lib/fipe", () => ({ listarMarcas, listarModelos, listarAnos, consultarPreco }));

const { consultarPlaca, normalizarTipoVeiculoPlaca } = await import("@/lib/placa");

function respostaProvedor(extra: Record<string, unknown> = {}) {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({ marca: "VOLKSWAGEN", modelo: "GOL", ano: "2015", ...extra }),
        { status: 200 },
      ),
  );
}

beforeEach(() => {
  process.env.PLACA_API_URL = "https://provedor.exemplo/placa/{placa}";
  vi.stubGlobal("fetch", respostaProvedor());
});

afterEach(() => {
  delete process.env.PLACA_API_URL;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ------------------------------------------------------- categoria do veículo

describe("normalizarTipoVeiculoPlaca", () => {
  it("reconhece as variações de carro", () => {
    for (const valor of ["CARRO", "AUTOMOVEL", "Automóvel", "car", "auto", "passeio", 1, "1"]) {
      expect(normalizarTipoVeiculoPlaca(valor)).toBe("carros");
    }
  });

  it("reconhece as variações de moto", () => {
    for (const valor of ["MOTO", "MOTOCICLETA", "motorcycle", "ciclomotor", 2, "2"]) {
      expect(normalizarTipoVeiculoPlaca(valor)).toBe("motos");
    }
  });

  it("reconhece as variações de caminhão", () => {
    for (const valor of ["CAMINHAO", "Caminhão", "truck", "ônibus", 3, "3"]) {
      expect(normalizarTipoVeiculoPlaca(valor)).toBe("caminhoes");
    }
  });

  it("devolve undefined em vez de chutar quando não reconhece", () => {
    for (const valor of [undefined, null, "", "   ", "BARCO", "xyz", {}]) {
      expect(normalizarTipoVeiculoPlaca(valor)).toBeUndefined();
    }
  });
});

describe("categoria na consulta por placa", () => {
  it("placa de moto NUNCA é pesquisada na FIPE de carros", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ marca: "HONDA", modelo: "CG 150 FAN", ano: "2015", tipo: "MOTOCICLETA" }),
            { status: 200 },
          ),
      ),
    );

    const resultado = await consultarPlaca("ABC1D23");

    expect(resultado.candidatos.length).toBeGreaterThan(0);
    for (const chamada of listarMarcas.mock.calls) expect(chamada[0]).toBe("motos");
    for (const chamada of listarModelos.mock.calls) expect(chamada[0]).toBe("motos");
    for (const candidato of resultado.candidatos) expect(candidato.tipo).toBe("motos");
  });

  it("sem categoria do provedor NÃO assume carros: pede o tipo ao usuário", async () => {
    const resultado = await consultarPlaca("ABC1D23");

    expect(resultado.configurado).toBe(true);
    expect(resultado.precisaTipoVeiculo).toBe(true);
    expect(resultado.candidatos).toEqual([]);
    // Nenhuma consulta à FIPE foi disparada às cegas.
    expect(listarMarcas).not.toHaveBeenCalled();
    expect(listarModelos).not.toHaveBeenCalled();
    expect(consultarPreco).not.toHaveBeenCalled();
  });

  it("usa o tipo informado pelo usuário quando o provedor não informa", async () => {
    const resultado = await consultarPlaca("ABC1D23", "motos");

    expect(resultado.precisaTipoVeiculo).toBeUndefined();
    for (const chamada of listarMarcas.mock.calls) expect(chamada[0]).toBe("motos");
  });
});

// --------------------------------------------------- matching de ano e combustível

describe("matching de ano e combustível", () => {
  it("preserva todas as entradas do mesmo ano com combustíveis diferentes", async () => {
    const { candidatos } = await consultarPlaca("ABC1D23", "carros");

    const anosConsultados = consultarPreco.mock.calls.map((c) => c[3]);
    expect(anosConsultados).toContain("2015-1");
    expect(anosConsultados).toContain("2015-3");
    expect(anosConsultados).toContain("2015-6");
    // O ano que não bate fica de fora.
    expect(anosConsultados).not.toContain("2014-1");

    const combustiveis = new Set(candidatos.map((c) => c.combustivel));
    expect(combustiveis.size).toBeGreaterThan(1);
  });

  it("não seleciona silenciosamente o primeiro código de ano", async () => {
    const { candidatos } = await consultarPlaca("ABC1D23", "carros");

    expect(candidatos.length).toBeGreaterThan(1);
    expect(new Set(candidatos.map((c) => c.anoCodigo)).size).toBeGreaterThan(1);
  });

  it("o combustível da placa prioriza a ordem, mas não descarta candidatos", async () => {
    vi.stubGlobal("fetch", respostaProvedor({ combustivel: "Diesel" }));

    const { candidatos } = await consultarPlaca("ABC1D23", "carros");

    expect(candidatos[0].combustivel).toBe("Diesel");
    // As outras opções continuam disponíveis para o usuário.
    expect(candidatos.some((c) => c.combustivel !== "Diesel")).toBe(true);
  });

  it("cada candidato traz marca, versão, ano, combustível, código e valor FIPE", async () => {
    const { candidatos } = await consultarPlaca("ABC1D23", "carros");

    for (const candidato of candidatos) {
      expect(candidato.marca).toBeTruthy();
      expect(candidato.modelo).toBeTruthy();
      expect(candidato.anoModelo).toBe(2015);
      expect(candidato.combustivel).toBeTruthy();
      expect(candidato.codigoFipe).toBeTruthy();
      expect(candidato.valor).toBeGreaterThan(0);
      expect(candidato.placa).toBe("ABC1D23");
    }
  });

  it("só oferece versões aderentes ao modelo informado pela placa", async () => {
    const { candidatos } = await consultarPlaca("ABC1D23", "carros");
    // "Polo" não combina com "GOL".
    expect(candidatos.map((c) => c.modeloCodigo)).not.toContain("2");
  });

  it("sem o ano do veículo não arrisca candidatos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ marca: "VOLKSWAGEN", modelo: "GOL" }), { status: 200 })),
    );

    const resultado = await consultarPlaca("ABC1D23", "carros");
    expect(resultado.candidatos).toEqual([]);
  });
});

// ------------------------------------------------------------------- provedor

describe("provedor de placa", () => {
  it("sem PLACA_API_URL responde configurado: false e não consulta a FIPE", async () => {
    delete process.env.PLACA_API_URL;

    const resultado = await consultarPlaca("ABC1D23", "carros");

    expect(resultado.configurado).toBe(false);
    expect(resultado.candidatos).toEqual([]);
    expect(listarMarcas).not.toHaveBeenCalled();
  });

  it("não sobrou integração específica com a Invertexto", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/placa.ts"), "utf8");
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(codigo).not.toContain("api.invertexto.com");
    expect(codigo).not.toContain("PLACA_API_TOKEN");
    expect(codigo).toContain("PLACA_API_URL");
    expect(codigo).toContain("PLACA_API_AUTH_HEADER");
  });

  it("o módulo não expõe nenhum atalho de 'melhor correspondência'", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/placa.ts"), "utf8");
    expect(fonte).not.toMatch(/export\s+(async\s+)?function\s+melhorCorrespondencia/);
    expect(fonte).not.toMatch(/sugestao/i);
  });
});

// ----------------------------------------------------------------- normalização

describe("normalização da placa", () => {
  it("ABC-1D23 vira ABC1D23", () => {
    expect(normalizePlaca("ABC-1D23")).toBe("ABC1D23");
  });

  it("abc1d23 vira ABC1D23", () => {
    expect(normalizePlaca("abc1d23")).toBe("ABC1D23");
  });

  it("remove espaços, pontos e outros caracteres", () => {
    expect(normalizePlaca(" abc 1d23 ")).toBe("ABC1D23");
    expect(normalizePlaca("abc.1d23")).toBe("ABC1D23");
    expect(normalizePlaca("abc/1d.23")).toBe("ABC1D23");
  });

  it("aceita o padrão antigo e o Mercosul", () => {
    expect(isPlacaValida("abc-1234")).toBe(true);
    expect(isPlacaValida("ABC1234")).toBe(true);
    expect(isPlacaValida("abc1d23")).toBe(true);
    expect(isPlacaValida("BRA2E19")).toBe(true);
  });

  it("rejeita placas inválidas", () => {
    for (const invalida of ["", "ABC", "AB1234", "ABCD123", "1234ABC", "ABC12E3"]) {
      expect(isPlacaValida(invalida)).toBe(false);
    }
  });

  it("formata para exibição com hífen", () => {
    expect(formatPlaca("abc1d23")).toBe("ABC-1D23");
  });
});
