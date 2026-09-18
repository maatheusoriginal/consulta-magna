import { describe, expect, it } from "vitest";

import { EstimatedPricingProvider, type PricingConfig } from "@/lib/pricing";
import { PRICING_CONFIG } from "@/lib/pricing/config";
import type { PrecoDisponivel } from "@/lib/pricing/types";

const FIPE_REFERENCIA = 28436;

function config(parcial: Partial<PricingConfig> = {}): PricingConfig {
  return { ...PRICING_CONFIG, ...parcial };
}

function precificar(
  entrada: { categoria: "CAR" | "MOTORCYCLE" | "TRUCK"; valorFipe: number; planoId: "bronze" | "prata" | "ouro" | "premium"; usoComercial?: boolean },
  parcial: Partial<PricingConfig> = {},
) {
  return new EstimatedPricingProvider(config(parcial)).precificar({
    usoComercial: false,
    ...entrada,
  });
}

function disponivel(resultado: ReturnType<typeof precificar>): PrecoDisponivel {
  if (resultado.status === "UNAVAILABLE") throw new Error("esperava preço disponível");
  return resultado;
}

describe("status da precificação", () => {
  it("cotação vinda de regra inferida recebe status ESTIMATED", () => {
    const resultado = precificar({ categoria: "CAR", valorFipe: FIPE_REFERENCIA, planoId: "ouro" });
    expect(resultado.status).toBe("ESTIMATED");
    expect(resultado.status).not.toBe("OFFICIAL");
  });

  it("o provedor se declara ESTIMATED e traz o aviso da regra inferida", () => {
    const provedor = new EstimatedPricingProvider();
    expect(provedor.status).toBe("ESTIMATED");
    expect(provedor.nome).toBe("EstimatedPricingProvider");

    const resultado = disponivel(
      provedor.precificar({
        categoria: "CAR",
        valorFipe: FIPE_REFERENCIA,
        planoId: "ouro",
        usoComercial: false,
      }),
    );
    expect(resultado.observacao).toMatch(/inferida a partir de cotações de referência/i);
    expect(resultado.observacao).toMatch(/substituída por fonte oficial/i);
  });

  it("sem valor FIPE apurado responde UNAVAILABLE", () => {
    const resultado = precificar({ categoria: "CAR", valorFipe: 0, planoId: "ouro" });
    expect(resultado.status).toBe("UNAVAILABLE");
  });
});

describe("regra por categoria de veículo", () => {
  it("moto não usa automaticamente a fórmula de carro", () => {
    const carro = disponivel(
      precificar({ categoria: "CAR", valorFipe: 20000, planoId: "ouro" }),
    );
    const moto = disponivel(
      precificar({ categoria: "MOTORCYCLE", valorFipe: 20000, planoId: "ouro" }),
    );

    expect(moto.mensalidadeBase).not.toBe(carro.mensalidadeBase);
  });

  it("carro e moto têm tabelas de taxas distintas em todos os planos", () => {
    const provedor = new EstimatedPricingProvider();
    const regraCarro = provedor.descreverRegra("CAR");
    const regraMoto = provedor.descreverRegra("MOTORCYCLE");

    expect(regraCarro).toBeDefined();
    expect(regraMoto).toBeDefined();

    for (const plano of ["bronze", "prata", "ouro", "premium"] as const) {
      expect(regraMoto!.taxas[plano].taxaMensalFipe).not.toBe(
        regraCarro!.taxas[plano].taxaMensalFipe,
      );
    }
  });

  it("categoria sem regra cadastrada responde UNAVAILABLE em vez de reaproveitar a de carro", () => {
    const resultado = precificar({ categoria: "TRUCK", valorFipe: 120000, planoId: "ouro" });
    expect(resultado.status).toBe("UNAVAILABLE");
    if (resultado.status === "UNAVAILABLE") {
      expect(resultado.motivo).toMatch(/não há regra de precificação/i);
    }
  });
});

describe("calibração com as cotações de referência", () => {
  const esperado = { bronze: 108.07, prata: 132.87, ouro: 164.27, premium: 177.77 } as const;

  for (const [planoId, valor] of Object.entries(esperado)) {
    it(`reproduz ${planoId} = R$ ${valor}`, () => {
      const resultado = disponivel(
        precificar({
          categoria: "CAR",
          valorFipe: FIPE_REFERENCIA,
          planoId: planoId as keyof typeof esperado,
        }),
      );
      expect(resultado.mensalidadeBase).toBe(valor);
    });
  }

  it("reproduz as participações de referência", () => {
    const resultado = disponivel(
      precificar({ categoria: "CAR", valorFipe: FIPE_REFERENCIA, planoId: "ouro" }),
    );
    const porId = Object.fromEntries(resultado.participacoes.map((p) => [p.id, p]));

    expect(porId.padrao.valor).toBe(3412.32);
    expect(porId.padrao.mensalidade).toBe(164.27);
    expect(porId.reduzida.valor).toBe(2274.88);
    expect(porId.reduzida.mensalidade).toBe(173.4);
    expect(porId.minima.valor).toBe(1800);
    expect(porId.minima.mensalidade).toBe(182.52);
    expect(porId.zero.valor).toBe(0);
    expect(porId.zero.mensalidade).toBe(219.03);
  });
});

describe("hideDominatedParticipationOptions", () => {
  // FIPE baixa: 12%, 8% e 6% caem todos no piso de R$ 1.800.
  const FIPE_BAIXA = 6136;

  it("tem padrão false", () => {
    expect(PRICING_CONFIG.hideDominatedParticipationOptions).toBe(false);
  });

  it("com false mantém todas as modalidades, mesmo as dominadas pelo piso", () => {
    const resultado = disponivel(
      precificar(
        { categoria: "CAR", valorFipe: FIPE_BAIXA, planoId: "ouro" },
        { hideDominatedParticipationOptions: false },
      ),
    );

    expect(resultado.participacoes.map((p) => p.id).sort()).toEqual([
      "minima",
      "padrao",
      "reduzida",
      "zero",
    ]);
    // As três primeiras batem no piso e ficam com a mesma participação.
    const noPiso = resultado.participacoes.filter((p) => p.pisoAplicado);
    expect(noPiso).toHaveLength(3);
    expect(new Set(noPiso.map((p) => p.valor))).toEqual(new Set([1800]));
  });

  it("com true remove apenas as opções economicamente dominadas", () => {
    const resultado = disponivel(
      precificar(
        { categoria: "CAR", valorFipe: FIPE_BAIXA, planoId: "ouro" },
        { hideDominatedParticipationOptions: true },
      ),
    );

    expect(resultado.participacoes.map((p) => p.id)).toEqual(["padrao", "zero"]);
  });

  it("com true não remove nada quando nenhuma opção é dominada", () => {
    const resultado = disponivel(
      precificar(
        { categoria: "CAR", valorFipe: FIPE_REFERENCIA, planoId: "ouro" },
        { hideDominatedParticipationOptions: true },
      ),
    );

    expect(resultado.participacoes).toHaveLength(4);
  });
});

describe("uso comercial", () => {
  it("por padrão não altera a mensalidade (agravo aguarda definição da Magna)", () => {
    expect(PRICING_CONFIG.fatorUsoComercial).toBe(1);

    const particular = disponivel(
      precificar({ categoria: "CAR", valorFipe: FIPE_REFERENCIA, planoId: "ouro" }),
    );
    const comercial = disponivel(
      precificar({
        categoria: "CAR",
        valorFipe: FIPE_REFERENCIA,
        planoId: "ouro",
        usoComercial: true,
      }),
    );

    expect(comercial.mensalidadeBase).toBe(particular.mensalidadeBase);
  });

  it("quando configurado, o agravo incide sobre a mensalidade", () => {
    const comercial = disponivel(
      precificar(
        {
          categoria: "CAR",
          valorFipe: FIPE_REFERENCIA,
          planoId: "ouro",
          usoComercial: true,
        },
        { fatorUsoComercial: 1.2 },
      ),
    );

    expect(comercial.mensalidadeBase).toBe(197.12);
  });

  it("quando configurado, pode restringir modalidades de participação", () => {
    const comercial = disponivel(
      precificar(
        {
          categoria: "CAR",
          valorFipe: FIPE_REFERENCIA,
          planoId: "ouro",
          usoComercial: true,
        },
        { participacoesBloqueadasUsoComercial: ["zero"] },
      ),
    );

    expect(comercial.participacoes.map((p) => p.id)).not.toContain("zero");
  });
});
