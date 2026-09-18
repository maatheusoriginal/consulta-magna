import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CotacaoSnapshot } from "@/lib/leads/types";
import { EstimatedPricingProvider } from "@/lib/pricing";
import type { PrecoDisponivel } from "@/lib/pricing/types";

/** Veículos usados nos cenários, com os mesmos dados que a FIPE devolveria. */
const CARRO = {
  tipo: "carros" as const,
  marca: "VolksWagen",
  modelo: "Gol 1.0 Total Flex 8V 5p",
  anoModelo: 2013,
  combustivel: "Gasolina",
  codigoFipe: "005324-4",
  valor: 28436,
  mesReferencia: "setembro de 2026",
};

const MOTO = {
  ...CARRO,
  tipo: "motos" as const,
  marca: "Honda",
  modelo: "CG 150 FAN ESi",
  codigoFipe: "811101-4",
  valor: 11112,
};

const CAMINHAO = {
  ...CARRO,
  tipo: "caminhoes" as const,
  marca: "Agrale",
  modelo: "10000 / 10000 S 2p (diesel)",
  combustivel: "Diesel",
  codigoFipe: "501034-9",
  valor: 239584,
};

const PERFIL = {
  finalidade: "particular" as const,
  prioridade: "roubo" as const,
  viagens: "quase-nunca" as const,
  carroReserva: "nao-preciso" as const,
  terceiros: "nao-prioridade" as const,
  vidros: "nao" as const,
};

/** Solicitação válida: apenas DADOS DE ENTRADA, nenhum valor calculado. */
const SOLICITACAO = {
  nome: "Ana Souza",
  whatsapp: "(34) 99196-0908",
  email: "ana@exemplo.com",
  placa: "abc-1d23",
  consentimento: true,
  veiculo: CARRO,
  perfil: PERFIL,
  planoEscolhido: "bronze" as const,
  participacaoId: "padrao" as const,
};

function requisicao(corpo: unknown) {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(corpo),
  });
}

/** O repositório é memoizado por processo, então cada cenário recarrega o módulo. */
async function carregarRota() {
  vi.resetModules();
  return (await import("@/app/api/lead/route")).POST;
}

function webhookOk() {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Envia uma solicitação já com webhook configurado e devolve corpo + enviado. */
async function enviar(corpo: unknown) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LEAD_WEBHOOK_URL", "https://hook.exemplo/leads");
  const fetchMock = webhookOk();

  const POST = await carregarRota();
  const resposta = await POST(requisicao(corpo));
  const json = (await resposta.json()) as { erro?: string; snapshot?: CotacaoSnapshot };

  const persistido = fetchMock.mock.calls[0]
    ? (JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as CotacaoSnapshot)
    : null;

  return { status: resposta.status, json, persistido };
}

/** Valor que o servidor deve calcular para um cenário, via o mesmo provider. */
function precoEsperado(
  categoria: "CAR" | "MOTORCYCLE",
  valorFipe: number,
  planoId: "bronze" | "prata" | "ouro" | "premium",
  usoComercial = false,
) {
  const preco = new EstimatedPricingProvider().precificar({
    categoria,
    valorFipe,
    planoId,
    usoComercial,
  }) as PrecoDisponivel;
  return preco.participacoes.find((p) => p.id === "padrao")!;
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

// ------------------------------------------------ valores recalculados no servidor

describe("o cliente não controla os valores da cotação", () => {
  it("mensalidade enviada pelo navegador é ignorada", async () => {
    const esperado = precoEsperado("CAR", CARRO.valor, "bronze");
    const { persistido } = await enviar({ ...SOLICITACAO, mensalidade: 1 });

    expect(persistido!.mensalidade).toBe(esperado.mensalidade);
    expect(persistido!.mensalidade).not.toBe(1);
  });

  it("participação enviada pelo navegador é ignorada", async () => {
    const esperado = precoEsperado("CAR", CARRO.valor, "bronze");
    const { persistido } = await enviar({
      ...SOLICITACAO,
      valorParticipacao: 1,
      percentualParticipacao: 0.99,
      modalidadeParticipacao: "Inventada",
    });

    expect(persistido!.valorParticipacao).toBe(esperado.valor);
    expect(persistido!.percentualParticipacao).toBe(esperado.percentual);
    expect(persistido!.modalidadeParticipacao).toBe(esperado.nome);
  });

  it("adesão é recalculada como max(300, mensalidade final)", async () => {
    const esperado = precoEsperado("CAR", CARRO.valor, "bronze");
    const { persistido } = await enviar({ ...SOLICITACAO, adesao: 1 });

    expect(persistido!.adesao).toBe(esperado.taxaAdesao);
    expect(persistido!.adesao).toBe(Math.max(300, esperado.mensalidade));
  });

  it("plano recomendado é decidido pelo servidor", async () => {
    const { persistido } = await enviar({ ...SOLICITACAO, planoRecomendado: "premium" });

    // Perfil mínimo recomenda Bronze, não o que o request pediu.
    expect(persistido!.planoRecomendado).toBe("bronze");
  });

  it("simulationId e código também são do servidor", async () => {
    const { persistido } = await enviar({
      ...SOLICITACAO,
      simulationId: "fraude",
      codigo: "MG-00000",
    });

    expect(persistido!.simulationId).not.toBe("fraude");
    expect(persistido!.simulationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(persistido!.codigo).not.toBe("MG-00000");
    expect(persistido!.codigo).toMatch(/^MG-\d{5}$/);
  });
});

describe("o cliente não escolhe o status da precificação", () => {
  it("não consegue transformar ESTIMATED em OFFICIAL", async () => {
    const { persistido } = await enviar({ ...SOLICITACAO, statusPrecificacao: "OFFICIAL" });

    expect(persistido!.statusPrecificacao).toBe("ESTIMATED");
  });

  it("não consegue forçar UNAVAILABLE num veículo que tem preço", async () => {
    const { persistido } = await enviar({ ...SOLICITACAO, statusPrecificacao: "UNAVAILABLE" });

    expect(persistido!.statusPrecificacao).toBe("ESTIMATED");
    expect(persistido!.mensalidade).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------- integridade da oferta

describe("planos por categoria", () => {
  for (const plano of ["ouro", "premium"] as const) {
    it(`moto não consegue enviar ${plano}`, async () => {
      const { status, json, persistido } = await enviar({
        ...SOLICITACAO,
        veiculo: MOTO,
        planoEscolhido: plano,
      });

      expect(status).toBe(422);
      expect(json.erro).toMatch(/não é oferecido para esta categoria/i);
      expect(persistido).toBeNull();
    });
  }

  it("moto com Bronze é aceita e usa a fórmula de moto", async () => {
    const esperado = precoEsperado("MOTORCYCLE", MOTO.valor, "bronze");
    const { status, persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: MOTO,
      planoEscolhido: "bronze",
    });

    expect(status).toBe(200);
    expect(persistido!.mensalidade).toBe(esperado.mensalidade);
  });

  it("moto não registra uso declarado, mesmo enviando finalidade aplicativo", async () => {
    const { persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: MOTO,
      planoEscolhido: "bronze",
      perfil: { ...PERFIL, finalidade: "aplicativo" },
    });

    expect(persistido!.usoDeclarado).toBeNull();
    expect(persistido!.usoParaPrecificacao).toBe("STANDARD");
    // E a mensalidade não pode levar agravo comercial.
    expect(persistido!.mensalidade).toBe(precoEsperado("MOTORCYCLE", MOTO.valor, "bronze").mensalidade);
  });
});

describe("uso comercial", () => {
  const comercial = { ...SOLICITACAO, perfil: { ...PERFIL, finalidade: "aplicativo" as const } };

  for (const modalidade of ["reduzida", "minima", "zero"] as const) {
    it(`aplicativo não consegue enviar participação ${modalidade}`, async () => {
      const { status, json, persistido } = await enviar({
        ...comercial,
        participacaoId: modalidade,
      });

      expect(status).toBe(422);
      expect(json.erro).toMatch(/não está disponível para o uso informado/i);
      expect(persistido).toBeNull();
    });
  }

  it("aplicativo com Padrão é aceito e leva o agravo comercial", async () => {
    const esperado = precoEsperado("CAR", CARRO.valor, "bronze", true);
    const particular = precoEsperado("CAR", CARRO.valor, "bronze", false);
    const { status, persistido } = await enviar(comercial);

    expect(status).toBe(200);
    expect(persistido!.usoDeclarado).toBe("Aplicativo / Táxi");
    expect(persistido!.usoParaPrecificacao).toBe("COMERCIAL");
    expect(persistido!.mensalidade).toBe(esperado.mensalidade);
    expect(persistido!.mensalidade).toBeGreaterThan(particular.mensalidade);
  });
});

// -------------------------------------------------------------- caminhão / UNAVAILABLE

describe("veículo sem precificação", () => {
  const solicitacaoCaminhao = {
    ...SOLICITACAO,
    veiculo: CAMINHAO,
    perfil: null,
    planoEscolhido: null,
    participacaoId: null,
  };

  it("continua UNAVAILABLE e sem valores inventados", async () => {
    const { status, persistido } = await enviar(solicitacaoCaminhao);

    expect(status).toBe(200);
    expect(persistido!.statusPrecificacao).toBe("UNAVAILABLE");
    expect(persistido!.planoRecomendado).toBeNull();
    expect(persistido!.planoEscolhido).toBeNull();
    expect(persistido!.mensalidade).toBeNull();
    expect(persistido!.modalidadeParticipacao).toBeNull();
    expect(persistido!.percentualParticipacao).toBeNull();
    expect(persistido!.valorParticipacao).toBeNull();
    expect(persistido!.adesao).toBeNull();
  });

  it("recusa caminhão que tente enviar um plano", async () => {
    const { status, json } = await enviar({ ...solicitacaoCaminhao, planoEscolhido: "ouro" });

    expect(status).toBe(422);
    expect(json.erro).toMatch(/não tem planos disponíveis/i);
  });

  it("preserva a placa", async () => {
    const { persistido } = await enviar(solicitacaoCaminhao);
    expect(persistido!.placa).toBe("ABC1D23");
  });
});

// ------------------------------------------------------------- snapshot canônico

describe("snapshot canônico", () => {
  it("o snapshot persistido é o mesmo devolvido ao frontend", async () => {
    const { json, persistido } = await enviar(SOLICITACAO);

    expect(json.snapshot).toBeDefined();
    expect(json.snapshot).toEqual(persistido);
  });

  it("a resposta informa a persistência", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://hook.exemplo/leads");
    webhookOk();

    const POST = await carregarRota();
    const corpo = (await (await POST(requisicao(SOLICITACAO))).json()) as {
      ok: boolean;
      persistido: boolean;
      repositorio: string;
    };

    expect(corpo.ok).toBe(true);
    expect(corpo.persistido).toBe(true);
    expect(corpo.repositorio).toBe("WebhookLeadRepository");
  });

  it("registra a placa normalizada e o momento do consentimento", async () => {
    const { persistido } = await enviar(SOLICITACAO);

    expect(persistido!.placa).toBe("ABC1D23");
    expect(persistido!.consentimentoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// -------------------------------------------------------------------- validação

describe("validação da solicitação", () => {
  const casos: Array<[string, Record<string, unknown>, RegExp]> = [
    ["sem consentimento", { consentimento: false }, /concordar com o uso dos dados/i],
    ["com consentimento ausente", { consentimento: undefined }, /concordar com o uso dos dados/i],
    ["sem placa", { placa: "" }, /placa/i],
    ["placa inválida", { placa: "AB123" }, /placa/i],
    ["sem nome", { nome: "A" }, /nome completo/i],
    ["telefone inválido", { whatsapp: "119" }, /WhatsApp/i],
    ["e-mail inválido", { email: "nao-e-email" }, /e-mail/i],
    ["sem veículo", { veiculo: undefined }, /dados do veículo/i],
    ["tipo de veículo inválido", { veiculo: { ...CARRO, tipo: "barcos" } }, /tipo de veículo/i],
    ["valor FIPE zerado", { veiculo: { ...CARRO, valor: 0 } }, /valor FIPE/i],
    ["sem código FIPE", { veiculo: { ...CARRO, codigoFipe: "" } }, /código FIPE/i],
    ["sem ano", { veiculo: { ...CARRO, anoModelo: 0 } }, /ano do veículo/i],
    ["perfil inválido", { perfil: { ...PERFIL, prioridade: "qualquer" } }, /prioridade/i],
    ["sem plano", { planoEscolhido: null }, /plano escolhido/i],
    ["sem modalidade", { participacaoId: null }, /modalidade de participação/i],
  ];

  for (const [nome, override, esperado] of casos) {
    it(`recusa solicitação ${nome}`, async () => {
      vi.stubEnv("NODE_ENV", "development");
      const POST = await carregarRota();
      const resposta = await POST(requisicao({ ...SOLICITACAO, ...override }));
      const corpo = (await resposta.json()) as { erro: string };

      expect([400, 422]).toContain(resposta.status);
      expect(corpo.erro).toMatch(esperado);
    });
  }
});

// ------------------------------------------------------------------ persistência

describe("persistência", () => {
  it("produção sem LEAD_WEBHOOK_URL recusa com 503", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEAD_WEBHOOK_URL", "");

    const POST = await carregarRota();
    const resposta = await POST(requisicao(SOLICITACAO));
    const corpo = (await resposta.json()) as { erro?: string; persistido?: boolean };

    expect(resposta.status).toBe(503);
    expect(corpo.persistido).toBeUndefined();
    expect(corpo.erro).toBe(
      "O canal de registro da simulação está temporariamente indisponível. Tente novamente.",
    );
  });

  it("desenvolvimento aceita o ConsoleLeadRepository, sem afirmar que salvou", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LEAD_WEBHOOK_URL", "");

    const POST = await carregarRota();
    const resposta = await POST(requisicao(SOLICITACAO));
    const corpo = (await resposta.json()) as { ok: boolean; persistido: boolean };

    expect(resposta.status).toBe(200);
    expect(corpo.ok).toBe(true);
    expect(corpo.persistido).toBe(false);
  });
});
