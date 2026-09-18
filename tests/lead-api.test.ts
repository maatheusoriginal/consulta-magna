import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CotacaoSnapshot } from "@/lib/leads/types";

const SNAPSHOT: CotacaoSnapshot = {
  simulationId: "7c1f2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
  codigo: "MG-12345",
  criadoEm: "2026-09-18T12:00:00.000Z",
  nome: "Ana Souza",
  telefone: "34991960908",
  email: "ana@exemplo.com",
  placa: "abc-1d23",
  tipoVeiculo: "carros",
  marca: "VolksWagen",
  modelo: "Gol 1.0 Total Flex 8V 5p",
  versao: "Gol 1.0 Total Flex 8V 5p",
  ano: 2013,
  combustivel: "Gasolina",
  codigoFipe: "005324-4",
  valorFipe: 28436,
  mesReferenciaFipe: "setembro de 2026",
  usoDeclarado: "Particular",
  usoParaPrecificacao: "STANDARD",
  respostasQuestionario: {
    prioridade: "roubo",
    viagens: "quase-nunca",
    carroReserva: "nao-preciso",
    terceiros: "nao-prioridade",
    vidros: "nao",
  },
  planoRecomendado: "bronze",
  planoEscolhido: "bronze",
  mensalidade: 108.06,
  modalidadeParticipacao: "Padrão",
  percentualParticipacao: 0.12,
  valorParticipacao: 3412.32,
  adesao: 300,
  statusPrecificacao: "ESTIMATED",
};

function requisicao(corpo: unknown) {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

/** O repositório é memoizado por processo, então cada cenário recarrega o módulo. */
async function carregarRota() {
  vi.resetModules();
  return (await import("@/app/api/lead/route")).POST;
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("produção sem LEAD_WEBHOOK_URL", () => {
  it("recusa o lead com 503 em vez de fingir que salvou", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEAD_WEBHOOK_URL", "");

    const POST = await carregarRota();
    const resposta = await POST(requisicao(SNAPSHOT));
    const corpo = (await resposta.json()) as { erro?: string; persistido?: boolean };

    expect(resposta.status).toBe(503);
    expect(corpo.persistido).toBeUndefined();
    expect(corpo.erro).toBe(
      "O canal de registro da simulação está temporariamente indisponível. Tente novamente.",
    );
  });

  it("nunca responde persistido: true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEAD_WEBHOOK_URL", "");

    const POST = await carregarRota();
    const corpo = (await (await POST(requisicao(SNAPSHOT))).json()) as Record<string, unknown>;

    expect(corpo.persistido).not.toBe(true);
  });
});

describe("produção com webhook configurado", () => {
  it("persiste e responde persistido: true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://hook.exemplo/leads");
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const POST = await carregarRota();
    const resposta = await POST(requisicao(SNAPSHOT));
    const corpo = (await resposta.json()) as { persistido: boolean; repositorio: string };

    expect(resposta.status).toBe(200);
    expect(corpo.persistido).toBe(true);
    expect(corpo.repositorio).toBe("WebhookLeadRepository");

    const enviado = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as CotacaoSnapshot;
    expect(enviado.placa).toBe("ABC1D23");
    expect(enviado.simulationId).toBe(SNAPSHOT.simulationId);
  });
});

describe("desenvolvimento", () => {
  it("o ConsoleLeadRepository continua funcionando, sem afirmar que salvou", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LEAD_WEBHOOK_URL", "");

    const POST = await carregarRota();
    const resposta = await POST(requisicao(SNAPSHOT));
    const corpo = (await resposta.json()) as { ok: boolean; persistido: boolean };

    expect(resposta.status).toBe(200);
    expect(corpo.ok).toBe(true);
    expect(corpo.persistido).toBe(false);
  });
});

describe("validação do snapshot", () => {
  const casos: Array<[string, Partial<CotacaoSnapshot>, RegExp]> = [
    ["sem placa", { placa: "" }, /placa/i],
    ["placa inválida", { placa: "AB123" }, /placa/i],
    ["sem simulationId", { simulationId: "" }, /identificador/i],
    ["sem código", { codigo: "" }, /código/i],
    ["telefone inválido", { telefone: "119" }, /WhatsApp/i],
  ];

  for (const [nome, override, esperado] of casos) {
    it(`recusa lead ${nome}`, async () => {
      vi.stubEnv("NODE_ENV", "development");
      const POST = await carregarRota();
      const resposta = await POST(requisicao({ ...SNAPSHOT, ...override }));
      const corpo = (await resposta.json()) as { erro: string };

      expect(resposta.status).toBe(400);
      expect(corpo.erro).toMatch(esperado);
    });
  }
});

describe("cotação sem precificação (UNAVAILABLE)", () => {
  const SEM_PRECO = {
    ...SNAPSHOT,
    placa: "XYZ9K88",
    tipoVeiculo: "caminhoes" as const,
    marca: "Agrale",
    modelo: "10000 / 10000 S 2p (diesel)",
    versao: "10000 / 10000 S 2p (diesel)",
    combustivel: "Diesel",
    codigoFipe: "501001-0",
    valorFipe: 239584,
    usoDeclarado: null,
    respostasQuestionario: null,
    statusPrecificacao: "UNAVAILABLE" as const,
    planoRecomendado: null,
    planoEscolhido: null,
    mensalidade: null,
    modalidadeParticipacao: null,
    percentualParticipacao: null,
    valorParticipacao: null,
    adesao: null,
  };

  it("é aceita sem mensalidade e chega ao webhook com o status correto", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://hook.exemplo/leads");
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const POST = await carregarRota();
    const resposta = await POST(requisicao(SEM_PRECO));
    const corpo = (await resposta.json()) as { persistido: boolean };

    expect(resposta.status).toBe(200);
    expect(corpo.persistido).toBe(true);

    const enviado = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as CotacaoSnapshot;
    expect(enviado.statusPrecificacao).toBe("UNAVAILABLE");
    expect(enviado.placa).toBe("XYZ9K88");
    expect(enviado.mensalidade).toBeNull();
    expect(enviado.planoEscolhido).toBeNull();
    expect(enviado.adesao).toBeNull();
  });

  it("continua exigindo a placa", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const POST = await carregarRota();
    const resposta = await POST(requisicao({ ...SEM_PRECO, placa: "" }));

    expect(resposta.status).toBe(400);
    expect(((await resposta.json()) as { erro: string }).erro).toMatch(/placa/i);
  });

  it("recusa valores inventados numa cotação UNAVAILABLE", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const POST = await carregarRota();

    for (const campo of ["mensalidade", "adesao", "valorParticipacao"] as const) {
      const resposta = await POST(requisicao({ ...SEM_PRECO, [campo]: 0 }));
      expect(resposta.status).toBe(400);
      expect(((await resposta.json()) as { erro: string }).erro).toMatch(new RegExp(campo, "i"));
    }
  });

  it("cotação ESTIMATED continua exigindo mensalidade positiva", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const POST = await carregarRota();
    const resposta = await POST(requisicao({ ...SNAPSHOT, mensalidade: 0 }));

    expect(resposta.status).toBe(400);
    expect(((await resposta.json()) as { erro: string }).erro).toMatch(/mensalidade/i);
  });
});
