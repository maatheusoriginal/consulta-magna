import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { WHATSAPP_NUMERO } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { montarSnapshot } from "@/lib/cotacao";
import { temPrecificacao, type CotacaoPrecificada, type CotacaoSnapshot } from "@/lib/leads/types";
import { EstimatedPricingProvider } from "@/lib/pricing";
import type { PrecoDisponivel } from "@/lib/pricing/types";
import { WhatsAppService, whatsAppService } from "@/lib/whatsapp";

const NUMERO_OFICIAL = "5534991960908";

/** Monta uma cotação de ponta a ponta, como o wizard faz. */
function cotacaoDeTeste(): CotacaoPrecificada {
  const preco = new EstimatedPricingProvider().precificar({
    categoria: "CAR",
    valorFipe: 28436,
    planoId: "ouro",
    usoComercial: true,
  }) as PrecoDisponivel;

  const padrao = preco.participacoes.find((p) => p.id === "padrao")!;

  const snapshot = montarSnapshot({
    simulationId: "7c1f2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
    codigo: "MG-48213",
    placa: "BRA2E19",
    veiculo: {
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
      placa: "BRA2E19",
    },
    perfil: {
      finalidade: "aplicativo",
      prioridade: "completa",
      viagens: "frequencia",
      carroReserva: "muito-importante",
      terceiros: "alta",
      vidros: "sim",
    },
    precificacao: {
      status: preco.status,
      planoRecomendado: "premium",
      planoEscolhido: "ouro",
      participacao: padrao,
      taxaAdesao: padrao.taxaAdesao,
    },
    lead: { nome: "Ana Souza", whatsapp: "(34) 99196-0908", email: "ana@exemplo.com" },
  });

  if (!temPrecificacao(snapshot)) throw new Error("esperava cotação precificada");
  return snapshot;
}

describe("número do consultor", () => {
  it("a configuração central usa o número oficial", () => {
    expect(WHATSAPP_NUMERO).toBe(NUMERO_OFICIAL);
    expect(whatsAppService.numeroConfigurado).toBe(NUMERO_OFICIAL);
  });

  it("nenhum número de teste sobrou no código-fonte", () => {
    const proibidos = [/5511999999999/, /5500000000000/, /\+?55\s?11\s?9{4,}/];
    const raiz = resolve(__dirname, "..");

    const arquivos: string[] = [];
    const varrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        if (["node_modules", ".next", ".git", "coverage"].includes(entrada)) continue;
        const caminho = join(dir, entrada);
        if (statSync(caminho).isDirectory()) varrer(caminho);
        else if (/\.(ts|tsx|mjs|md|json)$/.test(entrada) && entrada !== "package-lock.json") {
          arquivos.push(caminho);
        }
      }
    };
    varrer(raiz);

    for (const arquivo of arquivos) {
      if (arquivo.endsWith("whatsapp.test.ts")) continue;
      const conteudo = readFileSync(arquivo, "utf8");
      for (const padrao of proibidos) {
        expect(conteudo, `${arquivo} contém número de teste`).not.toMatch(padrao);
      }
    }
  });
});

describe("link do WhatsApp", () => {
  it("aponta para wa.me com o número oficial e a mensagem codificada", () => {
    const link = whatsAppService.montarLink(cotacaoDeTeste());

    expect(link.startsWith(`https://wa.me/${NUMERO_OFICIAL}?text=`)).toBe(true);
    // Acentos e quebras de linha precisam vir percent-encoded.
    expect(link).toContain("%C3%A7"); // ç de "Participação"
    expect(link).toContain("%0A"); // quebra de linha
    expect(link).not.toContain(" ");
  });

  it("a mensagem decodificada bate exatamente com a original", () => {
    const cotacao = cotacaoDeTeste();
    const link = whatsAppService.montarLink(cotacao);
    const decodificada = decodeURIComponent(link.split("?text=")[1]);

    expect(decodificada).toBe(new WhatsAppService().montarMensagem(cotacao));
  });

  it("respeita um número configurado por ambiente", () => {
    expect(new WhatsAppService("5511888887777").montarLink(cotacaoDeTeste())).toContain(
      "wa.me/5511888887777",
    );
  });
});

describe("mensagem final", () => {
  const cotacao = cotacaoDeTeste();
  const mensagem = whatsAppService.montarMensagem(cotacao);

  it("segue o formato acordado", () => {
    for (const secao of [
      "🚗 PLACA",
      "👤 CLIENTE",
      "🚘 VEÍCULO",
      "📊 FIPE",
      "USO",
      "PLANO",
      "MENSALIDADE",
      "PARTICIPAÇÃO",
      "ADESÃO",
    ]) {
      expect(mensagem).toContain(`\n${secao}\n`);
    }

    expect(mensagem.startsWith("Olá! Fiz uma simulação pelo site")).toBe(true);
    expect(mensagem).toContain("Código da simulação:");
    expect(mensagem.endsWith("Gostaria de continuar o atendimento.")).toBe(true);
  });

  it("coloca a placa entre as primeiras informações, antes do veículo", () => {
    const posPlaca = mensagem.indexOf("🚗 PLACA");
    const posCliente = mensagem.indexOf("👤 CLIENTE");
    const posVeiculo = mensagem.indexOf("🚘 VEÍCULO");
    const posFipe = mensagem.indexOf("📊 FIPE");

    expect(posPlaca).toBeGreaterThan(-1);
    expect(posPlaca).toBeLessThan(posCliente);
    expect(posPlaca).toBeLessThan(posVeiculo);
    expect(posPlaca).toBeLessThan(posFipe);
    // Está no começo, não escondida no fim.
    expect(posPlaca / mensagem.length).toBeLessThan(0.2);
  });

  it("contém a placa exatamente como o cliente informou", () => {
    expect(mensagem).toContain("BRA-2E19");
    expect(mensagem).not.toMatch(/Placa não informada/i);
  });

  it("recusa montar a mensagem sem placa", () => {
    expect(() =>
      whatsAppService.montarMensagem({ ...cotacao, placa: "" }),
    ).toThrow(/exige a placa/i);
  });

  it("traz os dados da cotação que acabou de ser feita", () => {
    expect(mensagem).toContain("Ana Souza");
    expect(mensagem).toContain("VolksWagen Gol 1.0 Total Flex 8V 5p");
    expect(mensagem).toContain("2013");
    expect(mensagem).toContain("Código: 005324-4");
    expect(mensagem).toContain("R$ 28.436,00");
    expect(mensagem).toContain("Referência: setembro de 2026");
    expect(mensagem).toContain("Aplicativo / Táxi");
    expect(mensagem).toContain("OURO");
    // Valores conferidos contra a própria cotação, não fixados no teste.
    expect(mensagem).toContain(`${formatBRL(cotacao.mensalidade)}/mês`);
    expect(mensagem).toContain(`${formatBRL(cotacao.valorParticipacao)} por evento coberto`);
    expect(mensagem).toContain(formatBRL(cotacao.adesao));
    expect(mensagem).toContain("MG-48213");
  });

  it("omite a seção USO quando o cliente não declarou a finalidade", () => {
    const semUso = whatsAppService.montarMensagem({
      ...cotacao,
      usoDeclarado: null,
      usoParaPrecificacao: "STANDARD",
    });

    expect(semUso).not.toContain("\nUSO\n");
    expect(semUso).not.toContain("Particular");
    // O resto da mensagem continua íntegro.
    expect(semUso).toContain("🚗 PLACA");
    expect(semUso).toContain("\nPLANO\n");
  });

  it("não contém dados de outro veículo nem valores fixos no código", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/whatsapp.ts"), "utf8");

    expect(fonte).not.toMatch(/Gol|Volks|Corolla|28\.?436|164[,.]27|005324|BRA2E19/);
    expect(fonte).not.toMatch(/R\$\s?\d/);
  });

  it("descreve corretamente a modalidade de participação zero", () => {
    const preco = new EstimatedPricingProvider().precificar({
      categoria: "CAR",
      valorFipe: 28436,
      planoId: "ouro",
      usoComercial: false,
    }) as PrecoDisponivel;

    const zero = preco.participacoes.find((p) => p.id === "zero")!;
    const texto = whatsAppService.montarMensagem({
      ...cotacao,
      modalidadeParticipacao: zero.nome,
      percentualParticipacao: zero.percentual,
      valorParticipacao: zero.valor,
      mensalidade: zero.mensalidade,
    });

    expect(texto).toContain("Participação zero — Sem participação no 1º evento coberto");
    expect(texto).toContain("R$ 0,00 no 1º evento coberto");
  });

  it("exibe a participação de moto como 12,5%, sem arredondar", () => {
    const texto = whatsAppService.montarMensagem({
      ...cotacao,
      modalidadeParticipacao: "Reduzida",
      percentualParticipacao: 0.125,
    });

    expect(texto).toContain("Reduzida — 12,5%");
    expect(texto).not.toContain("13%");
  });
});

describe("mensagem de veículo sem precificação", () => {
  const base = cotacaoDeTeste();
  const semPreco: CotacaoSnapshot = {
    ...base,
    placa: "XYZ9K88",
    tipoVeiculo: "caminhoes",
    marca: "Agrale",
    modelo: "10000 / 10000 S 2p (diesel)",
    versao: "10000 / 10000 S 2p (diesel)",
    combustivel: "Diesel",
    codigoFipe: "501001-0",
    valorFipe: 239584,
    usoDeclarado: null,
    respostasQuestionario: null,
    statusPrecificacao: "UNAVAILABLE",
    planoRecomendado: null,
    planoEscolhido: null,
    mensalidade: null,
    modalidadeParticipacao: null,
    percentualParticipacao: null,
    valorParticipacao: null,
    adesao: null,
  };
  const mensagem = whatsAppService.montarMensagem(semPreco);

  it("começa com a placa, antes dos dados do veículo", () => {
    const iPlaca = mensagem.indexOf("🚗 PLACA");
    const iVeiculo = mensagem.indexOf("VEÍCULO");

    expect(iPlaca).toBeGreaterThan(-1);
    expect(iPlaca).toBeLessThan(iVeiculo);
    expect(mensagem).toContain("XYZ-9K88");
    expect(mensagem).not.toMatch(/Placa não informada/i);
  });

  it("usa o ícone de caminhão na seção de veículo", () => {
    expect(mensagem).toContain("🚚 VEÍCULO");
  });

  it("traz cliente e dados da FIPE", () => {
    expect(mensagem).toContain("👤 CLIENTE");
    expect(mensagem).toContain("Ana Souza");
    expect(mensagem).toContain("Código: 501001-0");
    expect(mensagem).toContain("R$ 239.584,00");
  });

  it("pede cotação em vez de anunciar valores inexistentes", () => {
    expect(mensagem.endsWith("Gostaria de receber uma cotação para este veículo.")).toBe(true);
    expect(mensagem).not.toContain("\nMENSALIDADE\n");
    expect(mensagem).not.toContain("\nPLANO\n");
    expect(mensagem).not.toContain("\nADESÃO\n");
    expect(mensagem).not.toContain("\nPARTICIPAÇÃO\n");
    // Nenhum R$ 0 apresentado como se fosse preço.
    expect(mensagem).not.toMatch(/R\$ 0,00\/mês/);
  });

  it("continua exigindo a placa", () => {
    expect(() => whatsAppService.montarMensagem({ ...semPreco, placa: "" })).toThrow(/exige a placa/i);
  });

  it("carrega o código da simulação", () => {
    expect(mensagem).toContain("Código da simulação:");
    expect(mensagem).toContain(semPreco.codigo);
  });
});
