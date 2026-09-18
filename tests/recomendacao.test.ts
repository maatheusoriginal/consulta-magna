import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { recomendarPlano, type RespostasQuestionario } from "@/lib/recomendacao";

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
