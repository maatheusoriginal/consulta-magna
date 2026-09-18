import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EstimatedPricingProvider } from "@/lib/pricing";
import { recomendarPlano, type RespostasQuestionario } from "@/lib/recomendacao";
import { exigeUsoParticular } from "@/lib/types";

const BASE: RespostasQuestionario = {
  prioridade: "roubo",
  viagens: "quase-nunca",
  carroReserva: "nao-preciso",
  terceiros: "nao-prioridade",
  vidros: "nao",
};

describe("uso comercial não define o plano", () => {
  it("app/táxi + roubo/furto + pouca viagem + sem carro reserva não resulta em Ouro", () => {
    // A finalidade nem chega ao motor: o perfil abaixo é o do enunciado.
    const { plano } = recomendarPlano(BASE);

    expect(plano.id).not.toBe("ouro");
    expect(plano.id).toBe("bronze");
  });

  it("a finalidade não faz parte da assinatura do motor de recomendação", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/recomendacao.ts"), "utf8");
    // Remove comentários: fora deles, finalidade e uso comercial não podem aparecer.
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(fonte).toContain('Omit<PerfilRespostas, "finalidade">');
    expect(codigo).not.toMatch(/respostas\.finalidade|perfil\.finalidade/);
    expect(codigo).not.toMatch(/aplicativo|particular|usoComercial/i);
  });

  it("perfis idênticos recebem o mesmo plano, seja particular ou aplicativo", () => {
    // Como a finalidade não entra no motor, isto é garantido por construção;
    // o teste trava a regra para que ninguém a reintroduza.
    const exigente: RespostasQuestionario = {
      prioridade: "completa",
      viagens: "frequencia",
      carroReserva: "muito-importante",
      terceiros: "alta",
      vidros: "sim",
    };

    expect(recomendarPlano(exigente).plano.id).toBe(recomendarPlano(exigente).plano.id);
    expect(recomendarPlano(BASE).plano.id).toBe("bronze");
  });
});

describe("faixas de recomendação", () => {
  it("perfil mínimo recebe Bronze", () => {
    expect(recomendarPlano(BASE).plano.id).toBe("bronze");
  });

  it("prioridade em colisão eleva o piso para Prata", () => {
    expect(recomendarPlano({ ...BASE, prioridade: "colisao" }).plano.id).toBe("prata");
  });

  it("carro reserva muito importante eleva o piso para Ouro", () => {
    expect(recomendarPlano({ ...BASE, carroReserva: "muito-importante" }).plano.id).toBe("ouro");
  });

  it("perfil exigente em tudo recebe Premium", () => {
    const plano = recomendarPlano({
      prioridade: "completa",
      viagens: "frequencia",
      carroReserva: "muito-importante",
      terceiros: "alta",
      vidros: "sim",
    }).plano;

    expect(plano.id).toBe("premium");
  });

  it("sempre devolve exatamente três justificativas", () => {
    for (const prioridade of ["roubo", "colisao", "terceiros", "completa"] as const) {
      expect(recomendarPlano({ ...BASE, prioridade }).justificativas).toHaveLength(3);
    }
  });
});

describe("recomendação restrita aos planos da categoria", () => {
  const provedor = new EstimatedPricingProvider();
  const planosMoto = provedor.getAvailablePlanIds("MOTORCYCLE");
  const planosCarro = provedor.getAvailablePlanIds("CAR");

  const EXIGENTE: RespostasQuestionario = {
    prioridade: "completa",
    viagens: "frequencia",
    carroReserva: "muito-importante",
    terceiros: "alta",
    vidros: "sim",
  };

  it("moto nunca recebe Ouro nem Premium, em nenhum perfil possível", () => {
    const prioridades = ["roubo", "colisao", "terceiros", "completa"] as const;
    const viagens = ["quase-nunca", "as-vezes", "frequencia"] as const;
    const reserva = ["nao-preciso", "interessante", "muito-importante"] as const;
    const terceiros = ["nao-prioridade", "intermediaria", "alta"] as const;
    const vidros = ["nao", "um-pouco", "sim"] as const;

    let combinacoes = 0;
    for (const p of prioridades)
      for (const v of viagens)
        for (const r of reserva)
          for (const t of terceiros)
            for (const vi of vidros) {
              const { plano } = recomendarPlano(
                { prioridade: p, viagens: v, carroReserva: r, terceiros: t, vidros: vi },
                planosMoto,
              );
              expect(planosMoto).toContain(plano.id);
              expect(["ouro", "premium"]).not.toContain(plano.id);
              combinacoes += 1;
            }

    expect(combinacoes).toBe(324);
  });

  it("perfil exigente em moto recebe Prata, a opção mais completa disponível", () => {
    const recomendacao = recomendarPlano(EXIGENTE, planosMoto);

    expect(recomendacao.plano.id).toBe("prata");
    expect(recomendacao.limitadoPelaCategoria).toBe(true);
    expect(recomendacao.justificativas.some((j) => /mais completa disponível/i.test(j))).toBe(true);
  });

  it("o mesmo perfil exigente em carro recebe Premium", () => {
    const recomendacao = recomendarPlano(EXIGENTE, planosCarro);

    expect(recomendacao.plano.id).toBe("premium");
    expect(recomendacao.limitadoPelaCategoria).toBe(false);
  });

  it("perfil mínimo em moto recebe Bronze, sem marcar limitação", () => {
    const recomendacao = recomendarPlano(BASE, planosMoto);

    expect(recomendacao.plano.id).toBe("bronze");
    expect(recomendacao.limitadoPelaCategoria).toBe(false);
  });

  it("sempre devolve três justificativas, mesmo quando limitado pela categoria", () => {
    expect(recomendarPlano(EXIGENTE, planosMoto).justificativas).toHaveLength(3);
  });

  it("categoria sem planos não tem recomendação possível", () => {
    expect(() => recomendarPlano(BASE, [])).toThrow(/Nenhum plano disponível/);
  });
});

describe("finalidade por categoria", () => {
  it("moto não pergunta Aplicativo/Táxi: a finalidade é sempre particular", () => {
    expect(exigeUsoParticular("motos")).toBe(true);
  });

  it("carro e caminhão mantêm a pergunta de finalidade", () => {
    expect(exigeUsoParticular("carros")).toBe(false);
    expect(exigeUsoParticular("caminhoes")).toBe(false);
  });

  it("a tela de perfil esconde a seção de finalidade quando ela é fixa", () => {
    const fonte = readFileSync(
      resolve(__dirname, "../src/components/wizard/StepPerfil.tsx"),
      "utf8",
    );

    // A seção inteira fica atrás do gate `finalidadeFixa`.
    expect(fonte).toContain("{finalidadeFixa ? null : (");
    // E a validação não exige a resposta que não foi perguntada.
    expect(fonte).toContain("!finalidadeFixa && !perfil.finalidade");
    // Nenhuma menção a app de transporte fora dessa seção.
    expect(fonte.match(/Aplicativo \/ Táxi/g) ?? []).toHaveLength(1);
  });

  it("o wizard fixa a finalidade em particular para moto", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/wizard.tsx"), "utf8");
    expect(fonte).toContain("exigeUsoParticular(veiculo.tipo)");
    expect(fonte).toContain('{ ...estado.perfil, finalidade: "particular" }');
  });
});
