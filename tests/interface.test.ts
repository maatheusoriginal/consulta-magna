import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(__dirname, "..");
const ler = (caminho: string) => readFileSync(resolve(raiz, caminho), "utf8");

/** Lista todos os arquivos de interface, para varreduras globais de texto. */
const TELAS = [
  "src/app/page.tsx",
  "src/components/wizard/StepVeiculo.tsx",
  "src/components/wizard/StepPerfil.tsx",
  "src/components/wizard/StepPlano.tsx",
  "src/components/wizard/StepComparar.tsx",
  "src/components/wizard/StepParticipacao.tsx",
  "src/components/wizard/StepResumo.tsx",
  "src/components/wizard/StepWhatsApp.tsx",
  "src/components/SeloSeguro.tsx",
  "src/lib/config.ts",
];

describe("participação padrão exibida na tela de plano", () => {
  const fonte = ler("src/components/wizard/StepPlano.tsx");

  it("não tem percentual fixo no texto", () => {
    expect(fonte).not.toContain("12% da FIPE");
    expect(fonte).not.toContain("15% da FIPE");
    expect(fonte).not.toMatch(/participação padrão \(\d/);
  });

  it("lê o percentual da modalidade padrão devolvida pelo PricingProvider", () => {
    expect(fonte).toContain('preco.participacoes.find((p) => p.id === "padrao")');
    expect(fonte).toContain("formatPercentual(participacaoPadrao.percentual)");
  });

  it("não decide o percentual por categoria de veículo", () => {
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/tipo\s*===\s*["']motos["']/);
    expect(codigo).not.toMatch(/categoria\s*===\s*["']MOTORCYCLE["']/);
  });
});

describe("estado sem precificação", () => {
  const fonte = ler("src/components/wizard/StepPlano.tsx");

  it("verifica UNAVAILABLE antes de exigir recomendação e plano", () => {
    const posUnavailable = fonte.indexOf('preco.status === "UNAVAILABLE"');
    const posGuarda = fonte.indexOf("if (!recomendado || !planoSelecionado) return null;");

    expect(posUnavailable).toBeGreaterThan(-1);
    expect(posGuarda).toBeGreaterThan(-1);
    // Sem esta ordem, caminhão renderizaria uma tela em branco.
    expect(posUnavailable).toBeLessThan(posGuarda);
  });

  it("renderiza a explicação de análise individual", () => {
    expect(fonte).toContain("Este veículo precisa de uma análise individual");
  });

  it("não oferece WhatsApp direto, sem captura de lead", () => {
    expect(fonte).not.toContain("montarLinkComTexto");
    expect(fonte).not.toContain("wa.me");
    // O caminho é a tela de resumo, onde o lead é capturado.
    expect(fonte).toContain('irPara("resumo")');
  });

  it("a tela de resumo aceita cotação sem precificação", () => {
    const resumo = ler("src/components/wizard/StepResumo.tsx");
    expect(resumo).toContain("semPrecificacao");
    expect(resumo).toContain("precificacao,");
  });
});

describe("texto dos candidatos da placa", () => {
  const fonte = ler("src/components/wizard/StepVeiculo.tsx");

  it("usa singular quando há apenas um candidato", () => {
    expect(fonte).toContain(
      "Encontramos uma versão compatível. Confirme se é a versão correta do seu veículo.",
    );
  });

  it("usa plural quando há vários candidatos", () => {
    expect(fonte).toContain(
      "Encontramos mais de uma versão compatível. Confirme qual é a do seu veículo.",
    );
  });

  it("escolhe o texto pela quantidade de candidatos", () => {
    expect(fonte).toContain("candidatos.length === 1");
  });

  it("o usuário confirma a versão nos dois casos", () => {
    // A lista de seleção é renderizada independentemente da quantidade.
    expect(fonte).toContain("candidatos.map((candidato)");
  });
});

describe("a interface não sugere fonte oficial da FIPE", () => {
  it("não diz 'dados oficiais da tabela FIPE'", () => {
    for (const caminho of TELAS) {
      expect(ler(caminho), caminho).not.toMatch(/dados oficiais/i);
    }
  });

  it("não chama o valor da FIPE de oficial", () => {
    for (const caminho of TELAS) {
      const conteudo = ler(caminho);
      expect(conteudo, caminho).not.toMatch(/tabela FIPE oficial/i);
      expect(conteudo, caminho).not.toMatch(/valor oficial/i);
      expect(conteudo, caminho).not.toMatch(/FIPE oficial/i);
    }
  });

  it("usa 'valor de referência' e 'dados de referência'", () => {
    const veiculo = ler("src/components/wizard/StepVeiculo.tsx");
    expect(veiculo).toContain("Confira os dados de referência da tabela FIPE para continuar.");
    expect(veiculo).toContain("Valor de referência FIPE");
  });
});

describe("comentários sobre motocicleta", () => {
  const arquivos = [
    "src/lib/wizard.tsx",
    "src/lib/types.ts",
    "src/lib/cotacao.ts",
    "src/components/wizard/StepPerfil.tsx",
  ];

  it("não afirmam que moto não roda em aplicativo/táxi", () => {
    for (const caminho of arquivos) {
      expect(ler(caminho), caminho).not.toMatch(/não roda em aplicativo/i);
    }
  });

  it("explicam que a finalidade não altera a precificação", () => {
    const encontrados = arquivos.filter((c) =>
      /finalidade não altera a precificação|não altera a cotação/i.test(ler(c)),
    );
    expect(encontrados.length).toBeGreaterThan(0);
  });
});

describe("navegação para veículo sem precificação", () => {
  const wizard = ler("src/components/wizard/Wizard.tsx");
  const veiculo = ler("src/components/wizard/StepVeiculo.tsx");

  it("o botão de confirmar pula o questionário", () => {
    expect(veiculo).toContain('irPara(semPrecificacao ? "plano" : "perfil")');
  });

  it("a guarda de rota não devolve o usuário ao questionário", () => {
    // Sem esta condição o wizard rebate de "plano" para "perfil" e o cliente
    // nunca chega à tela de análise individual.
    expect(wizard).toContain(
      'semPrecificacao && ["perfil", "comparar", "participacao"].includes(tela)',
    );
    expect(wizard).toContain("!semPrecificacao &&");
  });

  it("a guarda considera semPrecificacao nas dependências do efeito", () => {
    expect(wizard).toMatch(/\[hidratado, tela, veiculo, perfilCompleto, semPrecificacao/);
  });

  it("nenhum atributo de depuração sobrou na interface", () => {
    for (const caminho of TELAS) {
      expect(ler(caminho), caminho).not.toMatch(/data-debug/);
    }
  });
});
