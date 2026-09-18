import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AVISO_SEM_PERSISTENCIA,
  ConsoleLeadRepository,
  WebhookLeadRepository,
  criarLeadRepository,
} from "@/lib/leads";
import type { CotacaoSnapshot } from "@/lib/leads/types";

const SNAPSHOT: CotacaoSnapshot = {
  simulationId: "7c1f2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
  codigo: "MG-12345",
  consentimentoEm: "2026-09-18T12:00:00.000Z",
  criadoEm: "2026-09-18T12:00:00.000Z",
  nome: "Ana Souza",
  telefone: "34991960908",
  email: "ana@exemplo.com",
  placa: "BRA2E19",
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
    prioridade: "completa",
    viagens: "frequencia",
    carroReserva: "muito-importante",
    terceiros: "alta",
    vidros: "sim",
  },
  planoRecomendado: "premium",
  planoEscolhido: "ouro",
  mensalidade: 164.27,
  modalidadeParticipacao: "Padrão",
  percentualParticipacao: 0.12,
  valorParticipacao: 3412.32,
  adesao: 300,
  statusPrecificacao: "ESTIMATED",
};

afterEach(() => vi.restoreAllMocks());

describe("seleção do repositório de leads", () => {
  it("usa o webhook quando LEAD_WEBHOOK_URL está configurada", () => {
    const aviso = vi.fn();
    const repo = criarLeadRepository(
      { NODE_ENV: "production", LEAD_WEBHOOK_URL: "https://hook.exemplo/leads" },
      aviso,
    );

    expect(repo).toBeInstanceOf(WebhookLeadRepository);
    expect(repo.duravel).toBe(true);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("em produção sem persistência real emite aviso explícito", () => {
    const aviso = vi.fn();
    const repo = criarLeadRepository({ NODE_ENV: "production" }, aviso);

    expect(repo).toBeInstanceOf(ConsoleLeadRepository);
    expect(repo.duravel).toBe(false);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalledWith(AVISO_SEM_PERSISTENCIA);
    expect(AVISO_SEM_PERSISTENCIA).toMatch(/NÃO serão persistidos/);
  });

  it("uma URL só de espaços conta como ausente", () => {
    const aviso = vi.fn();
    const repo = criarLeadRepository({ NODE_ENV: "production", LEAD_WEBHOOK_URL: "   " }, aviso);

    expect(repo).toBeInstanceOf(ConsoleLeadRepository);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("fora de produção não emite aviso", () => {
    const aviso = vi.fn();
    criarLeadRepository({ NODE_ENV: "development" }, aviso);
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe("ConsoleLeadRepository", () => {
  it("recebe a placa no snapshot", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const repo = new ConsoleLeadRepository();

    await repo.salvar(SNAPSHOT);
    expect(SNAPSHOT.placa).toBe("BRA2E19");
    // ...mas a placa não vai para o log, que é resumo sem dados pessoais.
    expect(JSON.stringify(info.mock.calls)).not.toContain(SNAPSHOT.placa);
  });

  it("não anuncia o lead como salvo", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const resultado = await new ConsoleLeadRepository().salvar(SNAPSHOT);

    expect(resultado.persistido).toBe(false);
    expect(resultado.repositorio).toBe("ConsoleLeadRepository");
  });

  it("não escreve dados pessoais no log", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleLeadRepository().salvar(SNAPSHOT);

    const registrado = JSON.stringify(info.mock.calls);
    expect(registrado).not.toContain(SNAPSHOT.nome);
    expect(registrado).not.toContain(SNAPSHOT.email);
    expect(registrado).not.toContain(SNAPSHOT.placa);
    expect(registrado).not.toContain(SNAPSHOT.telefone);
    expect(registrado).toContain("****0908");
    expect(registrado).toContain(SNAPSHOT.codigo);
  });
});

describe("WebhookLeadRepository", () => {
  it("envia o snapshot completo e marca como persistido", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await new WebhookLeadRepository("https://hook.exemplo/leads").salvar(SNAPSHOT);

    expect(resultado.persistido).toBe(true);
    const corpo = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as CotacaoSnapshot;
    expect(corpo).toEqual(SNAPSHOT);
    // A placa é o dado mais importante para o consultor: tem que chegar.
    expect(corpo.placa).toBe(SNAPSHOT.placa);
    expect(corpo.simulationId).toBe(SNAPSHOT.simulationId);

    vi.unstubAllGlobals();
  });

  it("propaga a falha quando o destino recusa o lead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));

    await expect(
      new WebhookLeadRepository("https://hook.exemplo/leads").salvar(SNAPSHOT),
    ).rejects.toThrow(/HTTP 500/);

    vi.unstubAllGlobals();
  });
});

describe("snapshot do lead", () => {
  it("carrega todos os campos exigidos pelo atendimento", () => {
    const obrigatorios: Array<keyof CotacaoSnapshot> = [
      "nome",
      "telefone",
      "email",
      "placa",
      "marca",
      "modelo",
      "versao",
      "ano",
      "combustivel",
      "codigoFipe",
      "valorFipe",
      "mesReferenciaFipe",
      "usoDeclarado",
      "usoParaPrecificacao",
      "respostasQuestionario",
      "planoRecomendado",
      "planoEscolhido",
      "mensalidade",
      "modalidadeParticipacao",
      "percentualParticipacao",
      "valorParticipacao",
      "adesao",
      "statusPrecificacao",
      "criadoEm",
      "codigo",
      "simulationId",
    ];

    for (const campo of obrigatorios) expect(SNAPSHOT[campo]).toBeDefined();
  });
});
