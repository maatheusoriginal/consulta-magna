import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { gerarCodigoSimulacao, gerarSimulationId, montarSnapshot } from "@/lib/cotacao";
import { EstimatedPricingProvider } from "@/lib/pricing";
import type { PrecoDisponivel } from "@/lib/pricing/types";
import type { FipeVeiculo, PerfilRespostas } from "@/lib/types";

const CARRO: FipeVeiculo = {
  tipo: "carros",
  marcaCodigo: "59",
  marca: "VolksWagen",
  modeloCodigo: "5940",
  modelo: "Gol 1.0 Total Flex 8V 5p",
  anoCodigo: "2013-1",
  anoModelo: 2013,
  combustivel: "Gasolina",
  codigoFipe: "005324-4",
  mesReferencia: "setembro de 2026",
  valor: 28436,
};

const MOTO: FipeVeiculo = {
  ...CARRO,
  tipo: "motos",
  marca: "Honda",
  modelo: "CG 150 FAN ESi",
  codigoFipe: "811101-4",
  valor: 11112,
};

const PERFIL: PerfilRespostas = {
  finalidade: "particular",
  prioridade: "roubo",
  viagens: "quase-nunca",
  carroReserva: "nao-preciso",
  terceiros: "nao-prioridade",
  vidros: "nao",
};

function participacao(veiculo: FipeVeiculo) {
  const preco = new EstimatedPricingProvider().precificar({
    categoria: veiculo.tipo === "motos" ? "MOTORCYCLE" : "CAR",
    valorFipe: veiculo.valor,
    planoId: "bronze",
    usoComercial: false,
  }) as PrecoDisponivel;
  return preco.participacoes.find((p) => p.id === "padrao")!;
}

function snapshot(overrides: { veiculo?: FipeVeiculo; perfil?: PerfilRespostas; placa?: string } = {}) {
  const veiculo = overrides.veiculo ?? CARRO;
  const part = participacao(veiculo);

  return montarSnapshot({
    simulationId: gerarSimulationId(),
    codigo: gerarCodigoSimulacao(),
    consentimentoEm: new Date().toISOString(),
    consentimentoVersao: "lead-contact-v1",
    placa: overrides.placa ?? "abc-1d23",
    veiculo,
    perfil: overrides.perfil ?? PERFIL,
    precificacao: {
      status: "ESTIMATED",
      planoRecomendado: "bronze",
      planoEscolhido: "bronze",
      participacao: part,
      taxaAdesao: part.taxaAdesao,
    },
    lead: { nome: "Ana Souza", whatsapp: "(34) 99196-0908" },
  });
}

describe("identificadores da simulação", () => {
  it("simulationId é um UUID único", () => {
    const ids = new Set(Array.from({ length: 500 }, () => gerarSimulationId()));

    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  it("o código amigável continua sendo gerado no formato MG-XXXXX", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(gerarCodigoSimulacao()).toMatch(/^MG-\d{5}$/);
    }
  });

  it("o snapshot guarda os dois identificadores", () => {
    const s = snapshot();

    expect(s.simulationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(s.codigo).toMatch(/^MG-\d{5}$/);
    expect(s.simulationId).not.toBe(s.codigo);
  });
});

describe("placa no snapshot", () => {
  it("é obrigatória e normalizada", () => {
    expect(snapshot({ placa: "abc-1d23" }).placa).toBe("ABC1D23");
    expect(snapshot({ placa: " abc 1d23 " }).placa).toBe("ABC1D23");
  });

  it("uma cotação sem placa não pode ser fechada", () => {
    expect(() => snapshot({ placa: "" })).toThrow(/sem a placa/i);
    expect(() => snapshot({ placa: "   " })).toThrow(/sem a placa/i);
  });

  it("nunca é reconstruída a partir da FIPE", () => {
    // O veículo da FIPE carrega outra placa; vale a que o cliente informou.
    const s = montarSnapshot({
      simulationId: gerarSimulationId(),
      codigo: gerarCodigoSimulacao(),
      consentimentoEm: new Date().toISOString(),
      consentimentoVersao: "lead-contact-v1",
      placa: "XYZ9K88",
      veiculo: { ...CARRO, placa: "BRA2E19" },
      perfil: PERFIL,
      precificacao: {
        status: "ESTIMATED",
        planoRecomendado: "bronze",
        planoEscolhido: "bronze",
        participacao: participacao(CARRO),
        taxaAdesao: 300,
      },
      lead: { nome: "Ana Souza", whatsapp: "34991960908" },
    });

    expect(s.placa).toBe("XYZ9K88");
  });

  it("o módulo não infere placa a partir dos dados da FIPE", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/cotacao.ts"), "utf8");
    expect(fonte).not.toContain("veiculo.placa");
  });
});

describe("uso declarado", () => {
  it("carro particular registra Particular", () => {
    const s = snapshot();
    expect(s.usoDeclarado).toBe("Particular");
    expect(s.usoParaPrecificacao).toBe("STANDARD");
  });

  it("carro de aplicativo registra Aplicativo / Táxi e uso comercial", () => {
    const s = snapshot({ perfil: { ...PERFIL, finalidade: "aplicativo" } });
    expect(s.usoDeclarado).toBe("Aplicativo / Táxi");
    expect(s.usoParaPrecificacao).toBe("COMERCIAL");
  });

  it("moto NÃO grava 'Particular' sem o cliente ter declarado", () => {
    const s = snapshot({ veiculo: MOTO });

    expect(s.usoDeclarado).toBeNull();
    expect(s.usoParaPrecificacao).toBe("STANDARD");
  });

  it("moto ignora qualquer finalidade herdada do estado do wizard", () => {
    const s = snapshot({ veiculo: MOTO, perfil: { ...PERFIL, finalidade: "aplicativo" } });

    expect(s.usoDeclarado).toBeNull();
    expect(s.usoParaPrecificacao).toBe("STANDARD");
  });
});

describe("cotação sem precificação (UNAVAILABLE)", () => {
  const CAMINHAO: FipeVeiculo = {
    ...CARRO,
    tipo: "caminhoes",
    marca: "Agrale",
    modelo: "10000 / 10000 S 2p (diesel)",
    combustivel: "Diesel",
    codigoFipe: "501001-0",
    valor: 239584,
  };

  function semPreco() {
    return montarSnapshot({
      simulationId: gerarSimulationId(),
      codigo: gerarCodigoSimulacao(),
      consentimentoEm: new Date().toISOString(),
      consentimentoVersao: "lead-contact-v1",
      placa: "abc-1d23",
      veiculo: CAMINHAO,
      perfil: null,
      precificacao: null,
      lead: { nome: "Ana Souza", whatsapp: "34991960908" },
    });
  }

  it("marca statusPrecificacao como UNAVAILABLE", () => {
    expect(semPreco().statusPrecificacao).toBe("UNAVAILABLE");
  });

  it("não inventa R$ 0 como se fosse preço", () => {
    const s = semPreco();

    expect(s.planoRecomendado).toBeNull();
    expect(s.planoEscolhido).toBeNull();
    expect(s.mensalidade).toBeNull();
    expect(s.modalidadeParticipacao).toBeNull();
    expect(s.percentualParticipacao).toBeNull();
    expect(s.valorParticipacao).toBeNull();
    expect(s.adesao).toBeNull();
  });

  it("mantém placa, veículo, FIPE e contato", () => {
    const s = semPreco();

    expect(s.placa).toBe("ABC1D23");
    expect(s.marca).toBe("Agrale");
    expect(s.codigoFipe).toBe("501001-0");
    expect(s.valorFipe).toBe(239584);
    expect(s.nome).toBe("Ana Souza");
    expect(s.telefone).toBe("34991960908");
  });

  it("não registra uso nem questionário que não foram perguntados", () => {
    const s = semPreco();

    expect(s.usoDeclarado).toBeNull();
    expect(s.respostasQuestionario).toBeNull();
    expect(s.usoParaPrecificacao).toBe("STANDARD");
  });

  it("continua exigindo a placa", () => {
    expect(() =>
      montarSnapshot({
        simulationId: gerarSimulationId(),
        codigo: gerarCodigoSimulacao(),
        consentimentoEm: new Date().toISOString(),
        consentimentoVersao: "lead-contact-v1",
        placa: "",
        veiculo: CAMINHAO,
        perfil: null,
        precificacao: null,
        lead: { nome: "Ana Souza", whatsapp: "34991960908" },
      }),
    ).toThrow(/sem a placa/i);
  });
});
