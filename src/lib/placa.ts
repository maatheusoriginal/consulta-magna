import "server-only";

import { listarAnos, listarMarcas, listarModelos } from "./fipe";
import { normalizePlaca } from "./format";
import type { FipeItem, TipoVeiculo } from "./types";

/**
 * Consulta de placa.
 *
 * Não existe API pública e gratuita de consulta por placa (os dados do Denatran
 * são restritos), então este módulo trabalha com provedores opcionais:
 *
 *  - `PLACA_API_TOKEN`: usa a API da Invertexto (https://api.invertexto.com), que
 *    possui plano gratuito com token;
 *  - `PLACA_API_URL`: qualquer provedor próprio. Use `{placa}` como marcador na
 *    URL e, se necessário, `PLACA_API_AUTH_HEADER` / `PLACA_API_AUTH_VALUE`.
 *
 * Sem provedor configurado a consulta responde `configurado: false` e a interface
 * encaminha o usuário para a busca por marca/modelo/ano — que usa apenas a API
 * gratuita da FIPE e mantém o fluxo 100% funcional sem nenhuma chave.
 */

export interface DadosPlaca {
  placa: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  combustivel?: string;
}

export interface SugestaoPlaca {
  tipo: TipoVeiculo;
  marca?: FipeItem;
  modelo?: FipeItem;
  ano?: FipeItem;
}

export interface ResultadoPlaca {
  configurado: boolean;
  dados?: DadosPlaca;
  sugestao?: SugestaoPlaca;
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pontua o quanto `candidato` combina com `alvo`, contando os termos em comum. */
function pontuar(alvo: string, candidato: string): number {
  const termosAlvo = normalizarTexto(alvo).split(" ").filter(Boolean);
  const termosCandidato = new Set(normalizarTexto(candidato).split(" ").filter(Boolean));
  if (termosAlvo.length === 0) return 0;

  let acertos = 0;
  for (const termo of termosAlvo) {
    if (termosCandidato.has(termo)) acertos += 1;
  }
  // Penaliza candidatos muito mais longos que o alvo para evitar versões exóticas.
  return acertos / termosAlvo.length - termosCandidato.size / 200;
}

function melhorCorrespondencia(alvo: string | undefined, itens: FipeItem[]): FipeItem | undefined {
  if (!alvo) return undefined;
  let melhor: FipeItem | undefined;
  let melhorNota = 0;
  for (const item of itens) {
    const nota = pontuar(alvo, item.nome);
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = item;
    }
  }
  return melhorNota > 0 ? melhor : undefined;
}

async function consultarProvedor(placa: string): Promise<DadosPlaca | null> {
  const token = process.env.PLACA_API_TOKEN;
  const urlCustomizada = process.env.PLACA_API_URL;

  let url: string | undefined;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (urlCustomizada) {
    url = urlCustomizada.replace("{placa}", encodeURIComponent(placa));
    const nomeHeader = process.env.PLACA_API_AUTH_HEADER;
    const valorHeader = process.env.PLACA_API_AUTH_VALUE;
    if (nomeHeader && valorHeader) headers[nomeHeader] = valorHeader;
  } else if (token) {
    url = `https://api.invertexto.com/v1/placa/${encodeURIComponent(placa)}?token=${encodeURIComponent(token)}`;
  }

  if (!url) return null;

  const resposta = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!resposta.ok) return null;

  const bruto = (await resposta.json()) as Record<string, unknown>;
  const texto = (chaves: string[]): string | undefined => {
    for (const chave of chaves) {
      const valor = bruto[chave];
      if (typeof valor === "string" && valor.trim()) return valor.trim();
    }
    return undefined;
  };

  const anoBruto = texto(["ano", "anoModelo", "ano_modelo"]) ?? String(bruto.ano ?? bruto.anoModelo ?? "");
  const ano = Number.parseInt(anoBruto, 10);

  const dados: DadosPlaca = {
    placa,
    marca: texto(["marca", "brand", "fabricante"]),
    modelo: texto(["modelo", "model"]),
    ano: Number.isFinite(ano) && ano > 1900 ? ano : undefined,
    combustivel: texto(["combustivel", "fuel"]),
  };

  return dados.marca || dados.modelo ? dados : null;
}

/** Mapeia os dados brutos da placa para os códigos correspondentes da tabela FIPE. */
async function sugerirFipe(dados: DadosPlaca, tipo: TipoVeiculo): Promise<SugestaoPlaca> {
  const sugestao: SugestaoPlaca = { tipo };

  const marcas = await listarMarcas(tipo);
  sugestao.marca = melhorCorrespondencia(dados.marca, marcas);
  if (!sugestao.marca) return sugestao;

  const modelos = await listarModelos(tipo, sugestao.marca.codigo);
  sugestao.modelo = melhorCorrespondencia(dados.modelo, modelos);
  if (!sugestao.modelo || !dados.ano) return sugestao;

  const anos = await listarAnos(tipo, sugestao.marca.codigo, sugestao.modelo.codigo);
  sugestao.ano = anos.find((a) => a.nome.startsWith(String(dados.ano)));

  return sugestao;
}

export async function consultarPlaca(
  placaBruta: string,
  tipo: TipoVeiculo = "carros",
): Promise<ResultadoPlaca> {
  const placa = normalizePlaca(placaBruta);
  const dados = await consultarProvedor(placa);

  if (!dados) return { configurado: false };

  try {
    const sugestao = await sugerirFipe(dados, tipo);
    return { configurado: true, dados, sugestao };
  } catch {
    return { configurado: true, dados };
  }
}
