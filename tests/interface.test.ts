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
    // Sem precificação, plano e modalidade vão nulos para o servidor.
    expect(resumo).toContain("planoEscolhido: precificacao ? precificacao.planoEscolhido : null");
    expect(resumo).toContain("participacaoId: precificacao ? precificacao.participacao.id : null");
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

describe("o frontend não é a fonte da verdade da cotação", () => {
  const resumo = ler("src/components/wizard/StepResumo.tsx");

  it("envia dados de entrada, não valores calculados", () => {
    // O corpo do POST carrega veículo, perfil e escolhas — nada de preço.
    expect(resumo).toContain("const solicitacao = {");
    expect(resumo).toContain("planoEscolhido:");
    expect(resumo).toContain("participacaoId:");
    expect(resumo).not.toMatch(/solicitacao[\s\S]{0,600}mensalidade:/);
    expect(resumo).not.toMatch(/solicitacao[\s\S]{0,600}statusPrecificacao:/);
    expect(resumo).not.toMatch(/solicitacao[\s\S]{0,600}adesao:/);
  });

  it("não monta mais o snapshot no navegador", () => {
    expect(resumo).not.toContain("montarSnapshot");
    expect(resumo).not.toContain("gerarSimulationId");
    expect(resumo).not.toContain("gerarCodigoSimulacao");
  });

  it("usa o snapshot devolvido pela API na conclusão", () => {
    expect(resumo).toContain("concluir(lead, resposta.snapshot)");
  });

  it("montarSnapshot é usado apenas no servidor", () => {
    const servidor = ler("src/lib/cotacao-servidor.ts");
    expect(servidor).toContain('import "server-only";');
    expect(servidor).toContain("montarSnapshot");
  });
});

describe("consentimento", () => {
  const resumo = ler("src/components/wizard/StepResumo.tsx");

  it("o checkbox começa desmarcado", () => {
    expect(resumo).toContain("useState(false)");
    expect(resumo).toContain("checked={consentimento}");
    // Nada de defaultChecked nem de estado inicial verdadeiro.
    expect(resumo).not.toContain("defaultChecked");
    expect(resumo).not.toMatch(/const \[consentimento, setConsentimento\] = useState\(true\)/);
  });

  it("bloqueia a conclusão sem consentimento", () => {
    expect(resumo).toMatch(/podeConcluir =[\s\S]{0,240}consentimento &&/);
    expect(resumo).toContain("É necessário concordar com o uso dos dados para continuar.");
  });

  it("o texto é curto e não inventa política jurídica", () => {
    expect(resumo).toContain(
      "Concordo com o uso dos meus dados para dar continuidade a este atendimento.",
    );
    expect(resumo).not.toMatch(/LGPD|Lei n|artigo \d/i);
  });

  it("o link da política é configurável e opcional", () => {
    expect(ler("src/lib/config.ts")).toContain("NEXT_PUBLIC_PRIVACY_POLICY_URL");
    expect(resumo).toContain("URL_POLITICA_PRIVACIDADE ? (");
  });
});

describe("rate limit nos endpoints públicos", () => {
  const rotas = [
    "src/app/api/lead/route.ts",
    "src/app/api/placa/route.ts",
    "src/app/api/fipe/marcas/route.ts",
    "src/app/api/fipe/modelos/route.ts",
    "src/app/api/fipe/anos/route.ts",
    "src/app/api/fipe/preco/route.ts",
  ];

  it("todas as rotas públicas aplicam o limite antes de qualquer trabalho", () => {
    for (const caminho of rotas) {
      const fonte = ler(caminho);
      expect(fonte, caminho).toContain("aplicarRateLimit");
      const posLimite = fonte.indexOf("aplicarRateLimit(request");
      const posJson = fonte.indexOf("request.json()");
      if (posJson > -1) expect(posLimite, caminho).toBeLessThan(posJson);
    }
  });
});

describe("revalidação da FIPE no servidor", () => {
  const servidor = ler("src/lib/cotacao-servidor.ts");
  const rota = ler("src/app/api/lead/route.ts");

  it("usa consultarPreco de src/lib/fipe, sem duplicar a integração", () => {
    expect(servidor).toContain('from "./fipe"');
    expect(servidor).toContain("consultarPreco(");
    // Nenhuma chamada HTTP própria à FIPE.
    expect(servidor).not.toContain("parallelum");
    expect(servidor).not.toMatch(/fetch\(/);
  });

  it("a reconstrução é assíncrona e a rota espera por ela", () => {
    expect(servidor).toContain("export async function reconstruirCotacao");
    expect(rota).toContain("await reconstruirCotacao(bruto)");
  });

  it("a identidade usada é a devolvida pela FIPE", () => {
    // O snapshot recebe o veículo revalidado, não o do request.
    expect(servidor).toContain("veiculo: { ...revalidado, placa }");
    expect(servidor).toContain("valorFipe: revalidado.valor");
    expect(servidor).toContain("categoriaDoTipo(revalidado.tipo)");
  });

  it("não há fallback para o valor enviado pelo navegador", () => {
    const codigo = servidor.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // Depois da revalidação, `veiculo` (o do request) não alimenta preço nem snapshot.
    expect(codigo).not.toMatch(/valorFipe:\s*veiculo\.valor/);
    expect(codigo).not.toMatch(/valor:\s*veiculo\.valor/);
  });
});

describe("versão do consentimento", () => {
  it("fica registrada no snapshot", () => {
    expect(ler("src/lib/config.ts")).toContain('VERSAO_CONSENTIMENTO = "lead-contact-v1"');
    expect(ler("src/lib/cotacao-servidor.ts")).toContain("consentimentoVersao: VERSAO_CONSENTIMENTO");
    expect(ler("src/lib/leads/types.ts")).toContain("consentimentoVersao: string;");
  });
});
