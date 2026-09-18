import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CotacaoSnapshot } from "@/lib/leads/types";
import { EstimatedPricingProvider } from "@/lib/pricing";
import { whatsAppService } from "@/lib/whatsapp";
import type { PrecoDisponivel } from "@/lib/pricing/types";
import type { FipeVeiculo } from "@/lib/types";

/**
 * Catálogo FIPE de mentira, indexado por tipo + códigos.
 *
 * É a tabela que o servidor consulta: qualquer combinação fora daqui não existe
 * e precisa ser rejeitada — inclusive códigos de carro enviados como moto.
 */
const CATALOGO: Record<string, FipeVeiculo> = {
  "carros/59/6280/2013-5": {
    tipo: "carros",
    marcaCodigo: "59",
    marca: "VolksWagen",
    modeloCodigo: "6280",
    modelo: "Gol (novo) 1.0 Mi Total Flex 8V 2p",
    anoCodigo: "2013-5",
    anoModelo: 2013,
    combustivel: "Flex",
    codigoFipe: "005345-7",
    mesReferencia: "setembro de 2026",
    valor: 28436,
  },
  "motos/80/6876/2015-5": {
    tipo: "motos",
    marcaCodigo: "80",
    marca: "Honda",
    modeloCodigo: "6876",
    modelo: "CG 150 FAN ESi",
    anoCodigo: "2015-5",
    anoModelo: 2015,
    combustivel: "Flex",
    codigoFipe: "811123-5",
    mesReferencia: "setembro de 2026",
    valor: 11112,
  },
  "caminhoes/102/5986/2022-3": {
    tipo: "caminhoes",
    marcaCodigo: "102",
    marca: "Agrale",
    modeloCodigo: "5986",
    modelo: "10000 / 10000 S 2p (diesel)",
    anoCodigo: "2022-3",
    anoModelo: 2022,
    combustivel: "Diesel",
    codigoFipe: "501034-9",
    mesReferencia: "setembro de 2026",
    valor: 239584,
  },
};

/** Quando verdadeiro, a FIPE simula indisponibilidade (erro 502). */
let fipeForaDoAr = false;

const consultarPreco = vi.fn(
  async (tipo: string, marca: string, modelo: string, ano: string): Promise<FipeVeiculo> => {
    const { FipeError } = await import("@/lib/fipe");
    if (fipeForaDoAr) throw new FipeError("Falha ao consultar a FIPE (HTTP 502).", 502);

    const encontrado = CATALOGO[`${tipo}/${marca}/${modelo}/${ano}`];
    if (!encontrado) throw new FipeError("Falha ao consultar a FIPE (HTTP 404).", 404);
    return encontrado;
  },
);

vi.mock("@/lib/fipe", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/fipe")>();
  return { ...real, consultarPreco: (...args: Parameters<typeof consultarPreco>) => consultarPreco(...args) };
});

const CODIGOS_CARRO = { tipo: "carros" as const, marcaCodigo: "59", modeloCodigo: "6280", anoCodigo: "2013-5" };
const CODIGOS_MOTO = { tipo: "motos" as const, marcaCodigo: "80", modeloCodigo: "6876", anoCodigo: "2015-5" };
const CODIGOS_CAMINHAO = { tipo: "caminhoes" as const, marcaCodigo: "102", modeloCodigo: "5986", anoCodigo: "2022-3" };

/** Dados que o navegador manda "para UX" — o servidor não deve confiar neles. */
const IDENTIDADE_DO_CLIENTE = {
  marca: "VolksWagen",
  modelo: "Gol 1.0 Total Flex 8V 5p",
  anoModelo: 2013,
  combustivel: "Gasolina",
  codigoFipe: "005324-4",
  valor: 28436,
  mesReferencia: "setembro de 2026",
};

const PERFIL = {
  finalidade: "particular" as const,
  prioridade: "roubo" as const,
  viagens: "quase-nunca" as const,
  carroReserva: "nao-preciso" as const,
  terceiros: "nao-prioridade" as const,
  vidros: "nao" as const,
};

const SOLICITACAO = {
  nome: "Ana Souza",
  whatsapp: "(34) 99196-0908",
  email: "ana@exemplo.com",
  placa: "abc-1d23",
  consentimento: true,
  veiculo: { ...CODIGOS_CARRO, ...IDENTIDADE_DO_CLIENTE },
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
  fipeForaDoAr = false;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  consultarPreco.mockClear();
});

// ============================================================ FIPE canônica

describe("a FIPE é revalidada no servidor", () => {
  it("o valor FIPE enviado pelo navegador é ignorado", async () => {
    const { persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...SOLICITACAO.veiculo, valor: 5000 },
    });

    expect(persistido!.valorFipe).toBe(28436);
    expect(persistido!.valorFipe).not.toBe(5000);
  });

  it("a mensalidade é calculada sobre a FIPE revalidada, não sobre a enviada", async () => {
    const esperado = precoEsperado("CAR", 28436, "bronze");
    const comFipeFalsa = precoEsperado("CAR", 5000, "bronze");
    const { persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...SOLICITACAO.veiculo, valor: 5000 },
    });

    expect(persistido!.mensalidade).toBe(esperado.mensalidade);
    expect(persistido!.mensalidade).not.toBe(comFipeFalsa.mensalidade);
  });

  it("marca, modelo, ano, combustível e código FIPE vêm da API", async () => {
    const { persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: {
        ...CODIGOS_CARRO,
        marca: "Ferrari",
        modelo: "F40",
        anoModelo: 2026,
        combustivel: "Gasolina Premium",
        codigoFipe: "000000-0",
        valor: 3_000_000,
        mesReferencia: "janeiro de 1990",
      },
    });

    const canonico = CATALOGO["carros/59/6280/2013-5"];
    expect(persistido!.marca).toBe(canonico.marca);
    expect(persistido!.modelo).toBe(canonico.modelo);
    expect(persistido!.versao).toBe(canonico.modelo);
    expect(persistido!.ano).toBe(canonico.anoModelo);
    expect(persistido!.combustivel).toBe(canonico.combustivel);
    expect(persistido!.codigoFipe).toBe(canonico.codigoFipe);
    expect(persistido!.mesReferenciaFipe).toBe(canonico.mesReferencia);
    expect(persistido!.valorFipe).toBe(canonico.valor);

    expect(persistido!.marca).not.toBe("Ferrari");
    expect(persistido!.codigoFipe).not.toBe("000000-0");
  });

  it("consulta a FIPE com os códigos enviados, nada mais", async () => {
    await enviar(SOLICITACAO);

    expect(consultarPreco).toHaveBeenCalledWith("carros", "59", "6280", "2013-5");
  });

  it("o snapshot preserva os códigos para uma revalidação futura", async () => {
    const { json } = await enviar(SOLICITACAO);
    // Os códigos ficam no snapshot através da identidade devolvida pela FIPE.
    expect(json.snapshot!.codigoFipe).toBe("005345-7");
  });
});

describe("categoria não pode ser trocada pelo request", () => {
  it("códigos de carro enviados como moto são rejeitados", async () => {
    const { status, json, persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...SOLICITACAO.veiculo, ...CODIGOS_CARRO, tipo: "motos" },
      planoEscolhido: "bronze",
    });

    expect(status).toBe(422);
    expect(json.erro).toMatch(/não foi possível confirmar os dados fipe/i);
    expect(persistido).toBeNull();
    // Nenhuma tentativa de "tentar de novo como carro".
    expect(consultarPreco).toHaveBeenCalledTimes(1);
    expect(consultarPreco).toHaveBeenCalledWith("motos", "59", "6280", "2013-5");
  });

  it("códigos de moto enviados como carro são rejeitados", async () => {
    const { status, persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...SOLICITACAO.veiculo, ...CODIGOS_MOTO, tipo: "carros" },
    });

    expect(status).toBe(422);
    expect(persistido).toBeNull();
  });

  it("combinação de códigos inexistente é rejeitada", async () => {
    const { status, json } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...SOLICITACAO.veiculo, modeloCodigo: "999999" },
    });

    expect(status).toBe(422);
    expect(json.erro).toMatch(/selecione o veículo novamente/i);
  });
});

describe("códigos FIPE são obrigatórios", () => {
  for (const campo of ["marcaCodigo", "modeloCodigo", "anoCodigo"] as const) {
    it(`sem ${campo} a cotação é recusada antes de precificar`, async () => {
      const veiculo = { ...SOLICITACAO.veiculo };
      delete (veiculo as Record<string, unknown>)[campo];

      const { status, json, persistido } = await enviar({ ...SOLICITACAO, veiculo });

      expect(status).toBe(422);
      expect(json.erro).toBe(
        "Não foi possível confirmar os dados FIPE deste veículo. Volte e selecione o veículo novamente.",
      );
      expect(persistido).toBeNull();
      expect(consultarPreco).not.toHaveBeenCalled();
    });
  }
});

describe("FIPE indisponível", () => {
  it("não usa o valor do navegador como fallback nem persiste o lead", async () => {
    fipeForaDoAr = true;

    const { status, json, persistido } = await enviar(SOLICITACAO);

    expect(status).toBe(503);
    expect(json.erro).toBe(
      "Não foi possível confirmar o valor FIPE agora. Tente novamente em alguns instantes.",
    );
    expect(json.snapshot).toBeUndefined();
    expect(persistido).toBeNull();
  });

  it("também bloqueia veículo sem precificação automática", async () => {
    fipeForaDoAr = true;

    const { status, persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...SOLICITACAO.veiculo, ...CODIGOS_CAMINHAO },
      perfil: null,
      planoEscolhido: null,
      participacaoId: null,
    });

    expect(status).toBe(503);
    expect(persistido).toBeNull();
  });
});

// ============================================== valores recalculados no servidor

describe("o cliente não controla os valores da cotação", () => {
  it("mensalidade enviada pelo navegador é ignorada", async () => {
    const esperado = precoEsperado("CAR", 28436, "bronze");
    const { persistido } = await enviar({ ...SOLICITACAO, mensalidade: 1 });

    expect(persistido!.mensalidade).toBe(esperado.mensalidade);
    expect(persistido!.mensalidade).not.toBe(1);
  });

  it("participação enviada pelo navegador é ignorada", async () => {
    const esperado = precoEsperado("CAR", 28436, "bronze");
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
    const esperado = precoEsperado("CAR", 28436, "bronze");
    const { persistido } = await enviar({ ...SOLICITACAO, adesao: 1 });

    expect(persistido!.adesao).toBe(esperado.taxaAdesao);
    expect(persistido!.adesao).toBe(Math.max(300, esperado.mensalidade));
  });

  it("plano recomendado é decidido pelo servidor", async () => {
    const { persistido } = await enviar({ ...SOLICITACAO, planoRecomendado: "premium" });
    expect(persistido!.planoRecomendado).toBe("bronze");
  });

  it("simulationId e código também são do servidor", async () => {
    const { persistido } = await enviar({
      ...SOLICITACAO,
      simulationId: "fraude",
      codigo: "MG-00000",
    });

    expect(persistido!.simulationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(persistido!.codigo).toMatch(/^MG-\d{5}$/);
    expect(persistido!.simulationId).not.toBe("fraude");
    expect(persistido!.codigo).not.toBe("MG-00000");
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
  const solicitacaoMoto = {
    ...SOLICITACAO,
    veiculo: { ...SOLICITACAO.veiculo, ...CODIGOS_MOTO },
  };

  for (const plano of ["ouro", "premium"] as const) {
    it(`moto não consegue enviar ${plano}`, async () => {
      const { status, json, persistido } = await enviar({
        ...solicitacaoMoto,
        planoEscolhido: plano,
      });

      expect(status).toBe(422);
      expect(json.erro).toMatch(/não é oferecido para esta categoria/i);
      expect(persistido).toBeNull();
    });
  }

  it("moto com Bronze usa a fórmula de moto sobre a FIPE revalidada", async () => {
    const esperado = precoEsperado("MOTORCYCLE", 11112, "bronze");
    const { status, persistido } = await enviar(solicitacaoMoto);

    expect(status).toBe(200);
    expect(persistido!.valorFipe).toBe(11112);
    expect(persistido!.mensalidade).toBe(esperado.mensalidade);
  });

  it("moto não registra uso declarado nem agravo comercial", async () => {
    const { persistido } = await enviar({
      ...solicitacaoMoto,
      perfil: { ...PERFIL, finalidade: "aplicativo" },
    });

    expect(persistido!.usoDeclarado).toBeNull();
    expect(persistido!.usoParaPrecificacao).toBe("STANDARD");
    expect(persistido!.mensalidade).toBe(precoEsperado("MOTORCYCLE", 11112, "bronze").mensalidade);
  });
});

describe("uso comercial", () => {
  const comercial = { ...SOLICITACAO, perfil: { ...PERFIL, finalidade: "aplicativo" as const } };

  for (const modalidade of ["reduzida", "minima", "zero"] as const) {
    it(`aplicativo não consegue enviar participação ${modalidade}`, async () => {
      const { status, json } = await enviar({ ...comercial, participacaoId: modalidade });

      expect(status).toBe(422);
      expect(json.erro).toMatch(/não está disponível para o uso informado/i);
    });
  }

  it("aplicativo com Padrão leva o agravo comercial sobre a FIPE revalidada", async () => {
    const esperado = precoEsperado("CAR", 28436, "bronze", true);
    const particular = precoEsperado("CAR", 28436, "bronze", false);
    const { status, persistido } = await enviar(comercial);

    expect(status).toBe(200);
    expect(persistido!.usoDeclarado).toBe("Aplicativo / Táxi");
    expect(persistido!.mensalidade).toBe(esperado.mensalidade);
    expect(persistido!.mensalidade).toBeGreaterThan(particular.mensalidade);
  });
});

// -------------------------------------------------------------- UNAVAILABLE

describe("veículo sem precificação", () => {
  const solicitacaoCaminhao = {
    ...SOLICITACAO,
    veiculo: { ...SOLICITACAO.veiculo, ...CODIGOS_CAMINHAO },
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

  it("mas a identidade do veículo também é revalidada", async () => {
    const { persistido } = await enviar(solicitacaoCaminhao);
    const canonico = CATALOGO["caminhoes/102/5986/2022-3"];

    expect(consultarPreco).toHaveBeenCalledWith("caminhoes", "102", "5986", "2022-3");
    expect(persistido!.marca).toBe(canonico.marca);
    expect(persistido!.codigoFipe).toBe(canonico.codigoFipe);
    // O valor FIPE é informativo para o consultor; não vira preço.
    expect(persistido!.valorFipe).toBe(canonico.valor);
    expect(persistido!.mensalidade).toBeNull();
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

  it("registra placa, consentimento e a versão do texto aceito", async () => {
    const { persistido } = await enviar(SOLICITACAO);

    expect(persistido!.placa).toBe("ABC1D23");
    expect(persistido!.consentimentoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(persistido!.consentimentoVersao).toBe("lead-contact-v1");
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
    [
      "tipo de veículo inválido",
      { veiculo: { ...SOLICITACAO.veiculo, tipo: "barcos" } },
      /tipo de veículo/i,
    ],
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

describe("a FIPE canônica chega ao destino final", () => {
  it("o webhook recebe os dados da FIPE revalidada", async () => {
    const canonico = CATALOGO["carros/59/6280/2013-5"];
    const { persistido } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...CODIGOS_CARRO, marca: "Ferrari", modelo: "F40", anoModelo: 2026,
                 combustivel: "X", codigoFipe: "000000-0", valor: 5000, mesReferencia: "x" },
    });

    expect(persistido!.valorFipe).toBe(canonico.valor);
    expect(persistido!.codigoFipe).toBe(canonico.codigoFipe);
    expect(persistido!.marca).toBe(canonico.marca);
    expect(persistido!.mesReferenciaFipe).toBe(canonico.mesReferencia);
  });

  it("a mensagem do WhatsApp usa a mesma FIPE canônica", async () => {
    const canonico = CATALOGO["carros/59/6280/2013-5"];
    const { json } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...CODIGOS_CARRO, marca: "Ferrari", modelo: "F40", anoModelo: 2026,
                 combustivel: "X", codigoFipe: "000000-0", valor: 5000, mesReferencia: "x" },
    });

    const mensagem = whatsAppService.montarMensagem(json.snapshot!);

    expect(mensagem).toContain(`Código: ${canonico.codigoFipe}`);
    expect(mensagem).toContain("R$ 28.436,00");
    expect(mensagem).toContain(canonico.marca);
    expect(mensagem).toContain(`Referência: ${canonico.mesReferencia}`);
    // Nada da identidade inventada pelo cliente sobrevive.
    expect(mensagem).not.toContain("Ferrari");
    expect(mensagem).not.toContain("F40");
    expect(mensagem).not.toContain("000000-0");
    expect(mensagem).not.toContain("R$ 5.000,00");
  });

  it("a mensalidade da mensagem é a calculada sobre a FIPE revalidada", async () => {
    const esperado = precoEsperado("CAR", 28436, "bronze");
    const { json } = await enviar({
      ...SOLICITACAO,
      veiculo: { ...SOLICITACAO.veiculo, valor: 5000 },
    });

    const mensagem = whatsAppService.montarMensagem(json.snapshot!);
    const formatado = esperado.mensalidade.toFixed(2).replace(".", ",");

    expect(mensagem).toContain(`R$ ${formatado}/mês`);
  });
});
