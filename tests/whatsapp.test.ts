import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { WHATSAPP_NUMERO } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { montarSnapshot } from "@/lib/cotacao";
import type { CotacaoSnapshot } from "@/lib/leads/types";
import { EstimatedPricingProvider } from "@/lib/pricing";
import type { PrecoDisponivel } from "@/lib/pricing/types";
import { WhatsAppService, whatsAppService } from "@/lib/whatsapp";

const NUMERO_OFICIAL = "5534991960908";

/** Monta uma cotação de ponta a ponta, como o wizard faz. */
function cotacaoDeTeste(): CotacaoSnapshot {
  const preco = new EstimatedPricingProvider().precificar({
    categoria: "CAR",
    valorFipe: 28436,
    planoId: "ouro",
    usoComercial: true,
  }) as PrecoDisponivel;

  const padrao = preco.participacoes.find((p) => p.id === "padrao")!;

  return montarSnapshot({
    codigo: "MG-48213",
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
    planoRecomendado: "premium",
    planoEscolhido: "ouro",
    participacao: padrao,
    taxaAdesao: padrao.taxaAdesao,
    statusPrecificacao: preco.status,
    lead: { nome: "Ana Souza", whatsapp: "(34) 99196-0908", email: "ana@exemplo.com" },
  });
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
      "NOME",
      "VEÍCULO",
      "FIPE",
      "USO",
      "PLANO",
      "MENSALIDADE",
      "PARTICIPAÇÃO",
      "ADESÃO",
    ]) {
      expect(mensagem).toContain(`\n${secao}\n`);
    }

    expect(mensagem.startsWith("Olá! Fiz uma simulação pelo site")).toBe(true);
    expect(mensagem.endsWith("Gostaria de continuar o atendimento.")).toBe(true);
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
    // Valor conferido contra a própria cotação, não fixado no teste.
    expect(mensagem).toContain(`${formatBRL(cotacao.mensalidade)}/mês`);
    expect(mensagem).toContain("Padrão — 12% da FIPE");
    expect(mensagem).toContain(`${formatBRL(cotacao.valorParticipacao)} por evento coberto`);
    expect(mensagem).toContain(formatBRL(cotacao.adesao));
    expect(mensagem).toContain("MG-48213");
  });

  it("não contém dados de outro veículo nem valores fixos no código", () => {
    const fonte = readFileSync(resolve(__dirname, "../src/lib/whatsapp.ts"), "utf8");

    expect(fonte).not.toMatch(/Gol|Volks|Corolla|28\.?436|164[,.]27|005324/);
    expect(fonte).not.toMatch(/R\$\s?\d/);
  });

  it("descreve corretamente a modalidade de participação zero", () => {
    const preco = new EstimatedPricingProvider().precificar({
      categoria: "CAR",
      valorFipe: 28436,
      planoId: "ouro",
      usoComercial: false,
    }) as PrecoDisponivel;

    const comZero: CotacaoSnapshot = {
      ...cotacao,
      ...(() => {
        const zero = preco.participacoes.find((p) => p.id === "zero")!;
        return {
          modalidadeParticipacao: zero.nome,
          percentualParticipacao: zero.percentual,
          valorParticipacao: zero.valor,
          mensalidade: zero.mensalidade,
        };
      })(),
    };

    const texto = whatsAppService.montarMensagem(comZero);
    expect(texto).toContain("Participação zero — Sem participação no 1º evento coberto");
    expect(texto).toContain("R$ 0,00 no 1º evento coberto");
  });
});
