import { describe, expect, it } from "vitest";

import { EstimatedPricingProvider, REFERENCIAS, type PricingConfig } from "@/lib/pricing";
import { PRICING_CONFIG } from "@/lib/pricing/config";
import type { PrecoDisponivel, ResultadoPrecificacao } from "@/lib/pricing/types";
import type { CategoriaVeiculo, PlanoId } from "@/lib/types";

/** Tolerância aceita contra as cotações reais: centavos, nunca dezenas de reais. */
const TOLERANCIA = 0.1;

function config(parcial: Partial<PricingConfig> = {}): PricingConfig {
  return { ...PRICING_CONFIG, ...parcial };
}

function precificar(
  entrada: {
    categoria: CategoriaVeiculo;
    valorFipe: number;
    planoId: PlanoId;
    usoComercial?: boolean;
  },
  parcial: Partial<PricingConfig> = {},
): ResultadoPrecificacao {
  return new EstimatedPricingProvider(config(parcial)).precificar({
    usoComercial: false,
    ...entrada,
  });
}

function disponivel(resultado: ResultadoPrecificacao): PrecoDisponivel {
  if (resultado.status === "UNAVAILABLE") {
    throw new Error(`esperava preço disponível, veio UNAVAILABLE: ${resultado.motivo}`);
  }
  return resultado;
}

function mensalidade(
  entrada: Parameters<typeof precificar>[0],
  parcial: Partial<PricingConfig> = {},
): number {
  return disponivel(precificar(entrada, parcial)).mensalidadeBase;
}

// ---------------------------------------------------------------- referências

describe("cotações reais de carro", () => {
  for (const ref of REFERENCIAS.CAR) {
    describe(`${ref.nome} (FIPE R$ ${ref.valorFipe})`, () => {
      for (const planoId of ["bronze", "prata", "ouro", "premium"] as const) {
        it(`${planoId} ≈ R$ ${ref[planoId].toFixed(2)}`, () => {
          const calculado = mensalidade({
            categoria: "CAR",
            valorFipe: ref.valorFipe,
            planoId,
          });
          expect(Math.abs(calculado - ref[planoId])).toBeLessThanOrEqual(TOLERANCIA);
        });
      }
    });
  }

  it("a mensalidade não é mais um percentual puro da FIPE", () => {
    // Num modelo `FIPE * taxa`, dobrar a FIPE dobraria a mensalidade.
    // A estrutura real tem um componente fixo, então a razão fica bem abaixo de 2.
    const menor = mensalidade({ categoria: "CAR", valorFipe: 28436, planoId: "ouro" });
    const maior = mensalidade({ categoria: "CAR", valorFipe: 56872, planoId: "ouro" });
    expect(maior / menor).toBeLessThan(1.3);
  });
});

describe("cotações reais de moto", () => {
  for (const ref of REFERENCIAS.MOTORCYCLE) {
    describe(`${ref.nome} (FIPE R$ ${ref.valorFipe}, cód. ${ref.codigoFipe})`, () => {
      for (const planoId of ["bronze", "prata"] as const) {
        it(`${planoId} ≈ R$ ${ref[planoId].toFixed(2)}`, () => {
          const calculado = mensalidade({
            categoria: "MOTORCYCLE",
            valorFipe: ref.valorFipe,
            planoId,
          });
          expect(Math.abs(calculado - ref[planoId])).toBeLessThanOrEqual(TOLERANCIA);
        });
      }
    });
  }

  it("a CG 150 respeita a mensalidade mínima de R$ 80,00", () => {
    expect(mensalidade({ categoria: "MOTORCYCLE", valorFipe: 11112, planoId: "bronze" })).toBe(80);
  });
});

// ------------------------------------------------------------ planos por tipo

describe("planos disponíveis por categoria", () => {
  const provedor = new EstimatedPricingProvider();

  it("carro oferece os quatro planos", () => {
    expect(provedor.getAvailablePlanIds("CAR")).toEqual(["bronze", "prata", "ouro", "premium"]);
  });

  it("moto oferece apenas Bronze e Prata", () => {
    expect(provedor.getAvailablePlanIds("MOTORCYCLE")).toEqual(["bronze", "prata"]);
  });

  it("caminhão não tem oferta", () => {
    expect(provedor.getAvailablePlanIds("TRUCK")).toEqual([]);
  });

  it("Ouro e Premium respondem UNAVAILABLE para moto", () => {
    for (const planoId of ["ouro", "premium"] as const) {
      const resultado = precificar({ categoria: "MOTORCYCLE", valorFipe: 25197, planoId });
      expect(resultado.status).toBe("UNAVAILABLE");
      if (resultado.status === "UNAVAILABLE") {
        expect(resultado.motivo).toMatch(/não é oferecido para esta categoria/i);
      }
    }
  });

  it("caminhão responde UNAVAILABLE em vez de reaproveitar a regra de carro", () => {
    const resultado = precificar({ categoria: "TRUCK", valorFipe: 120000, planoId: "bronze" });
    expect(resultado.status).toBe("UNAVAILABLE");
  });
});

describe("regra por categoria", () => {
  it("moto não usa a fórmula de carro", () => {
    const carro = mensalidade({ categoria: "CAR", valorFipe: 25197, planoId: "bronze" });
    const moto = mensalidade({ categoria: "MOTORCYCLE", valorFipe: 25197, planoId: "bronze" });
    expect(moto).not.toBe(carro);
  });

  it("carro e moto têm bases distintas", () => {
    const provedor = new EstimatedPricingProvider();
    const carro = provedor.descreverRegra("CAR")!;
    const moto = provedor.descreverRegra("MOTORCYCLE")!;

    expect(moto.base.valorFixo).not.toBe(carro.base.valorFixo);
    expect(moto.base.fatorFipe).not.toBe(carro.base.fatorFipe);
    expect(moto.percentuaisParticipacao).not.toEqual(carro.percentuaisParticipacao);
  });
});

// ---------------------------------------------------------------- participação

describe("participação por categoria", () => {
  it("carro usa 12%, 8%, 6% e zero", () => {
    const preco = disponivel(precificar({ categoria: "CAR", valorFipe: 100000, planoId: "ouro" }));
    const porId = Object.fromEntries(preco.participacoes.map((p) => [p.id, p]));

    expect(porId.padrao.percentual).toBe(0.12);
    expect(porId.reduzida.percentual).toBe(0.08);
    expect(porId.minima.percentual).toBe(0.06);
    expect(porId.zero.percentual).toBeNull();
  });

  it("moto usa 15%, 12,5%, 10% e zero", () => {
    const preco = disponivel(
      precificar({ categoria: "MOTORCYCLE", valorFipe: 25197, planoId: "bronze" }),
    );
    const porId = Object.fromEntries(preco.participacoes.map((p) => [p.id, p]));

    expect(porId.padrao.percentual).toBe(0.15);
    expect(porId.reduzida.percentual).toBe(0.125);
    expect(porId.minima.percentual).toBe(0.1);
    expect(porId.zero.percentual).toBeNull();
  });

  it("XRE 190: participações e mensalidades conferem com a cotação real", () => {
    const preco = disponivel(
      precificar({ categoria: "MOTORCYCLE", valorFipe: 25197, planoId: "bronze" }),
    );
    const porId = Object.fromEntries(preco.participacoes.map((p) => [p.id, p]));

    const esperado = {
      padrao: { participacao: 3779.55, mensalidade: 118.19 },
      reduzida: { participacao: 3149.63, mensalidade: 124.75 },
      minima: { participacao: 2519.7, mensalidade: 131.32 },
      zero: { participacao: 0, mensalidade: 157.58 },
    } as const;

    for (const [id, alvo] of Object.entries(esperado)) {
      expect(porId[id].valor).toBeCloseTo(alvo.participacao, 2);
      expect(Math.abs(porId[id].mensalidade - alvo.mensalidade)).toBeLessThanOrEqual(TOLERANCIA);
    }

    // Nenhuma modalidade da XRE encosta no piso.
    expect(preco.participacoes.every((p) => !p.pisoAplicado)).toBe(true);
  });

  it("CG 150: todas as modalidades percentuais caem no piso de R$ 1.800", () => {
    const preco = disponivel(
      precificar({ categoria: "MOTORCYCLE", valorFipe: 11112, planoId: "bronze" }),
    );

    for (const participacao of preco.participacoes) {
      if (participacao.percentual === null) {
        expect(participacao.valor).toBe(0);
        continue;
      }
      // 15%, 12,5% e 10% de R$ 11.112 ficam todos abaixo de R$ 1.800.
      expect(11112 * participacao.percentual).toBeLessThan(1800);
      expect(participacao.pisoAplicado).toBe(true);
      expect(participacao.valor).toBe(1800);
    }
  });

  it("Gol: participações de carro conferem com a referência", () => {
    const preco = disponivel(precificar({ categoria: "CAR", valorFipe: 28436, planoId: "ouro" }));
    const porId = Object.fromEntries(preco.participacoes.map((p) => [p.id, p]));

    expect(porId.padrao.valor).toBe(3412.32);
    expect(porId.reduzida.valor).toBe(2274.88);
    expect(porId.minima.valor).toBe(1800); // 6% = R$ 1.706,16 → piso
    expect(porId.minima.pisoAplicado).toBe(true);
    expect(porId.zero.valor).toBe(0);
  });
});

// ---------------------------------------------------------------------- adesão

describe("taxa de adesão", () => {
  it("o piso configurado é R$ 300", () => {
    expect(PRICING_CONFIG.taxaAdesaoMinima).toBe(300);
  });

  it("mensalidade abaixo do piso resulta em adesão de R$ 300", () => {
    const preco = disponivel(precificar({ categoria: "CAR", valorFipe: 28436, planoId: "ouro" }));
    const padrao = preco.participacoes.find((p) => p.id === "padrao")!;

    expect(padrao.mensalidade).toBeLessThan(300);
    expect(padrao.taxaAdesao).toBe(300);
  });

  it("mensalidade acima do piso resulta em adesão igual à mensalidade", () => {
    // FIPE alta o bastante para a mensalidade passar de R$ 300.
    const preco = disponivel(precificar({ categoria: "CAR", valorFipe: 400000, planoId: "premium" }));
    const padrao = preco.participacoes.find((p) => p.id === "padrao")!;

    expect(padrao.mensalidade).toBeGreaterThan(300);
    expect(padrao.taxaAdesao).toBe(padrao.mensalidade);
  });

  it("a adesão acompanha a mensalidade FINAL da modalidade, não a base do plano", () => {
    const preco = disponivel(precificar({ categoria: "CAR", valorFipe: 400000, planoId: "premium" }));
    const padrao = preco.participacoes.find((p) => p.id === "padrao")!;
    const zero = preco.participacoes.find((p) => p.id === "zero")!;

    expect(zero.mensalidade).toBeGreaterThan(padrao.mensalidade);
    expect(zero.taxaAdesao).toBe(zero.mensalidade);
    expect(zero.taxaAdesao).toBeGreaterThan(padrao.taxaAdesao);
  });

  it("cada faixa da regra max(300, mensalidade) se comporta como esperado", () => {
    const casos: Array<[number, number]> = [
      [164.27, 300],
      [299, 300],
      [300, 300],
      [420, 420],
      [560, 560],
    ];
    for (const [mensalidadeFinal, adesaoEsperada] of casos) {
      expect(Math.max(PRICING_CONFIG.taxaAdesaoMinima, mensalidadeFinal)).toBe(adesaoEsperada);
    }
  });
});

// --------------------------------------------------------------- uso comercial

describe("uso comercial", () => {
  it("por padrão só a participação Padrão fica disponível", () => {
    expect(PRICING_CONFIG.participacoesBloqueadasUsoComercial).toEqual([
      "reduzida",
      "minima",
      "zero",
    ]);

    const preco = disponivel(
      precificar({ categoria: "CAR", valorFipe: 51630, planoId: "ouro", usoComercial: true }),
    );
    expect(preco.participacoes.map((p) => p.id)).toEqual(["padrao"]);
  });

  it("uso particular mantém as quatro modalidades", () => {
    const preco = disponivel(precificar({ categoria: "CAR", valorFipe: 51630, planoId: "ouro" }));
    expect(preco.participacoes).toHaveLength(4);
  });

  it("uso comercial nunca sai com o mesmo preço do particular", () => {
    expect(PRICING_CONFIG.fatorUsoComercial).toBeGreaterThan(1);

    const particular = mensalidade({ categoria: "CAR", valorFipe: 51630, planoId: "ouro" });
    const comercial = mensalidade({
      categoria: "CAR",
      valorFipe: 51630,
      planoId: "ouro",
      usoComercial: true,
    });
    expect(comercial).toBeGreaterThan(particular);
  });

  it("Prisma comercial reproduz a cotação conhecida", () => {
    const esperado = { bronze: 163.88, prata: 192.8, ouro: 229.44, premium: 245.19 } as const;

    for (const [planoId, alvo] of Object.entries(esperado)) {
      const calculado = mensalidade({
        categoria: "CAR",
        valorFipe: 51630,
        planoId: planoId as PlanoId,
        usoComercial: true,
      });
      expect(Math.abs(calculado - alvo)).toBeLessThanOrEqual(TOLERANCIA);
    }
  });

  it("o agravo continua configurável", () => {
    const comercial = mensalidade(
      { categoria: "CAR", valorFipe: 51630, planoId: "ouro", usoComercial: true },
      { fatorUsoComercial: 1 },
    );
    const particular = mensalidade({ categoria: "CAR", valorFipe: 51630, planoId: "ouro" });
    expect(comercial).toBe(particular);
  });
});

// ------------------------------------------------------------ status e opções

describe("status da precificação", () => {
  it("cotação vinda de regra inferida recebe status ESTIMATED", () => {
    const resultado = precificar({ categoria: "CAR", valorFipe: 28436, planoId: "ouro" });
    expect(resultado.status).toBe("ESTIMATED");
    expect(resultado.status).not.toBe("OFFICIAL");
  });

  it("o provedor se declara ESTIMATED e traz o aviso da regra inferida", () => {
    const provedor = new EstimatedPricingProvider();
    expect(provedor.status).toBe("ESTIMATED");

    const preco = disponivel(
      provedor.precificar({
        categoria: "CAR",
        valorFipe: 28436,
        planoId: "ouro",
        usoComercial: false,
      }),
    );
    expect(preco.observacao).toMatch(/inferida a partir de cotações de referência/i);
    expect(preco.observacao).toMatch(/substituída por fonte oficial/i);
  });

  it("sem valor FIPE apurado responde UNAVAILABLE", () => {
    expect(precificar({ categoria: "CAR", valorFipe: 0, planoId: "ouro" }).status).toBe(
      "UNAVAILABLE",
    );
  });
});

describe("hideDominatedParticipationOptions", () => {
  it("tem padrão false", () => {
    expect(PRICING_CONFIG.hideDominatedParticipationOptions).toBe(false);
  });

  it("com false mantém todas as modalidades, mesmo as dominadas pelo piso", () => {
    // CG 150: 15%, 12,5% e 10% caem todos no piso de R$ 1.800.
    const preco = disponivel(
      precificar(
        { categoria: "MOTORCYCLE", valorFipe: 11112, planoId: "bronze" },
        { hideDominatedParticipationOptions: false },
      ),
    );

    expect(preco.participacoes.map((p) => p.id).sort()).toEqual([
      "minima",
      "padrao",
      "reduzida",
      "zero",
    ]);
  });

  it("com true remove apenas as opções economicamente dominadas", () => {
    const preco = disponivel(
      precificar(
        { categoria: "MOTORCYCLE", valorFipe: 11112, planoId: "bronze" },
        { hideDominatedParticipationOptions: true },
      ),
    );

    expect(preco.participacoes.map((p) => p.id)).toEqual(["padrao", "zero"]);
  });
});
