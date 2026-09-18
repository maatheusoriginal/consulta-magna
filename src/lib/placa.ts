import "server-only";

import { consultarPreco, listarAnos, listarMarcas, listarModelos } from "./fipe";
import { normalizePlaca } from "./format";
import type { FipeItem, FipeVeiculo, TipoVeiculo } from "./types";

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
 * gratuita da FIPE e mantém o fluxo funcional sem nenhuma chave.
 *
 * IMPORTANTE: o retorno é sempre uma LISTA DE CANDIDATOS. A correspondência
 * entre o texto devolvido pelo provedor de placa e as versões da FIPE é
 * aproximada, então a escolha da versão é sempre do usuário — nunca automática.
 */

/** Quantidade máxima de versões oferecidas para o usuário escolher. */
const MAX_CANDIDATOS = 6;

export interface DadosPlaca {
  placa: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  combustivel?: string;
}

export interface ResultadoPlaca {
  configurado: boolean;
  dados?: DadosPlaca;
  /**
   * Versões da FIPE compatíveis com os dados da placa, para o usuário confirmar.
   * Vazio quando não foi possível montar candidatos confiáveis.
   */
  candidatos: FipeVeiculo[];
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

/** Fração dos termos de `alvo` presentes em `candidato` (0 a 1). */
function pontuar(alvo: string, candidato: string): number {
  const termosAlvo = normalizarTexto(alvo).split(" ").filter(Boolean);
  const termosCandidato = new Set(normalizarTexto(candidato).split(" ").filter(Boolean));
  if (termosAlvo.length === 0) return 0;

  let acertos = 0;
  for (const termo of termosAlvo) {
    if (termosCandidato.has(termo)) acertos += 1;
  }
  return acertos / termosAlvo.length;
}

function ordenarPorAderencia(alvo: string | undefined, itens: FipeItem[]): FipeItem[] {
  if (!alvo) return [];
  return itens
    .map((item) => ({ item, nota: pontuar(alvo, item.nome) }))
    .filter(({ nota }) => nota > 0)
    .sort((a, b) => b.nota - a.nota)
    .map(({ item }) => item);
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

  const anoBruto =
    texto(["ano", "anoModelo", "ano_modelo"]) ?? String(bruto.ano ?? bruto.anoModelo ?? "");
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

/**
 * Monta a lista de versões da FIPE compatíveis com os dados da placa.
 *
 * Nunca devolve "a melhor" escolhida por conta própria: devolve todas as
 * candidatas relevantes, já com código e valor FIPE, para o usuário confirmar.
 */
async function montarCandidatos(dados: DadosPlaca, tipo: TipoVeiculo): Promise<FipeVeiculo[]> {
  // Sem o ano não dá para apurar valor FIPE: a busca manual é o caminho.
  if (!dados.ano) return [];

  const marcas = await listarMarcas(tipo);
  const marca = ordenarPorAderencia(dados.marca, marcas)[0];
  if (!marca) return [];

  const modelos = await listarModelos(tipo, marca.codigo);
  const compativeis = ordenarPorAderencia(dados.modelo, modelos).slice(0, MAX_CANDIDATOS);
  if (compativeis.length === 0) return [];

  const candidatos = await Promise.all(
    compativeis.map(async (modelo) => {
      try {
        const anos = await listarAnos(tipo, marca.codigo, modelo.codigo);
        const ano = anos.find((a) => a.nome.startsWith(String(dados.ano)));
        if (!ano) return null;
        return await consultarPreco(tipo, marca.codigo, modelo.codigo, ano.codigo);
      } catch {
        // Uma versão que falhou não pode derrubar as demais.
        return null;
      }
    }),
  );

  return candidatos
    .filter((c): c is FipeVeiculo => c !== null)
    .map((c) => ({ ...c, placa: dados.placa }));
}

export async function consultarPlaca(
  placaBruta: string,
  tipo: TipoVeiculo = "carros",
): Promise<ResultadoPlaca> {
  const placa = normalizePlaca(placaBruta);
  const dados = await consultarProvedor(placa);

  if (!dados) return { configurado: false, candidatos: [] };

  try {
    return { configurado: true, dados, candidatos: await montarCandidatos(dados, tipo) };
  } catch {
    return { configurado: true, dados, candidatos: [] };
  }
}
