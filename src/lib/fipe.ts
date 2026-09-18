import "server-only";

import { limparMarca, parseValorFipe } from "./format";
import type { FipeItem, FipeVeiculo, TipoVeiculo } from "./types";

/**
 * Integração com APIs públicas e gratuitas da Tabela FIPE.
 *
 * Fonte primária: Parallelum FIPE API (https://deividfortuna.github.io/fipe/)
 * Fonte de contingência: BrasilAPI (https://brasilapi.com.br/docs#tag/FIPE)
 *
 * Nenhuma das duas exige chave de API ou cadastro.
 */
const PARALLELUM = process.env.FIPE_API_URL ?? "https://parallelum.com.br/fipe/api/v1";
const BRASILAPI = "https://brasilapi.com.br/api/fipe";

const TIPOS: TipoVeiculo[] = ["carros", "motos", "caminhoes"];

export function isTipoVeiculo(valor: string | null): valor is TipoVeiculo {
  return valor !== null && (TIPOS as string[]).includes(valor);
}

export class FipeError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "FipeError";
  }
}

/** Cache em memória do processo — evita repetir chamadas idênticas na mesma instância. */
const memoria = new Map<string, { expiraEm: number; dados: unknown }>();
const TTL_MS = 1000 * 60 * 60 * 6; // 6 horas: a tabela FIPE muda 1x por mês

async function buscarJson<T>(url: string, revalidate: number): Promise<T> {
  const cacheado = memoria.get(url);
  if (cacheado && cacheado.expiraEm > Date.now()) return cacheado.dados as T;

  const resposta = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resposta.ok) {
    // 404 significa combinação inexistente na tabela — é diferente de a API
    // estar fora do ar, e quem chama precisa distinguir os dois casos.
    const status = resposta.status === 404 || resposta.status === 400 ? 404 : 502;
    throw new FipeError(`Falha ao consultar a FIPE (HTTP ${resposta.status}).`, status);
  }

  const dados = (await resposta.json()) as T;
  memoria.set(url, { expiraEm: Date.now() + TTL_MS, dados });
  return dados;
}

/** Tenta a fonte primária e, em caso de erro, a de contingência. */
async function comFallback<T>(primaria: () => Promise<T>, contingencia: () => Promise<T>): Promise<T> {
  try {
    return await primaria();
  } catch {
    return await contingencia();
  }
}

function ordenarPorNome(itens: FipeItem[]): FipeItem[] {
  return [...itens].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function listarMarcas(tipo: TipoVeiculo): Promise<FipeItem[]> {
  const itens = await comFallback(
    async () => {
      const dados = await buscarJson<Array<{ codigo: string; nome: string }>>(
        `${PARALLELUM}/${tipo}/marcas`,
        86_400,
      );
      return dados.map((m) => ({ codigo: String(m.codigo), nome: m.nome }));
    },
    async () => {
      const dados = await buscarJson<Array<{ nome: string; valor: string }>>(
        `${BRASILAPI}/marcas/v1/${tipo}`,
        86_400,
      );
      return dados.map((m) => ({ codigo: String(m.valor), nome: m.nome }));
    },
  );

  return ordenarPorNome(itens);
}

export async function listarModelos(tipo: TipoVeiculo, marca: string): Promise<FipeItem[]> {
  const itens = await comFallback(
    async () => {
      const dados = await buscarJson<{ modelos: Array<{ codigo: number | string; nome: string }> }>(
        `${PARALLELUM}/${tipo}/marcas/${marca}/modelos`,
        86_400,
      );
      return (dados.modelos ?? []).map((m) => ({ codigo: String(m.codigo), nome: m.nome }));
    },
    async () => {
      const dados = await buscarJson<Array<{ modelo: string; valor: string }>>(
        `${BRASILAPI}/veiculos/v1/${tipo}/${marca}`,
        86_400,
      );
      return dados.map((m) => ({ codigo: String(m.valor), nome: m.modelo }));
    },
  );

  return ordenarPorNome(itens);
}

export async function listarAnos(
  tipo: TipoVeiculo,
  marca: string,
  modelo: string,
): Promise<FipeItem[]> {
  const dados = await buscarJson<Array<{ codigo: string; nome: string }>>(
    `${PARALLELUM}/${tipo}/marcas/${marca}/modelos/${modelo}/anos`,
    86_400,
  );
  return dados.map((a) => ({ codigo: String(a.codigo), nome: a.nome }));
}

interface PrecoParallelum {
  Valor?: string;
  Marca?: string;
  Modelo?: string;
  AnoModelo?: number;
  Combustivel?: string;
  CodigoFipe?: string;
  MesReferencia?: string;
  error?: string;
}

export async function consultarPreco(
  tipo: TipoVeiculo,
  marca: string,
  modelo: string,
  ano: string,
): Promise<FipeVeiculo> {
  const dados = await buscarJson<PrecoParallelum>(
    `${PARALLELUM}/${tipo}/marcas/${marca}/modelos/${modelo}/anos/${ano}`,
    86_400,
  );

  if (dados.error || !dados.Valor) {
    throw new FipeError(
      dados.error ?? "Veículo não encontrado na tabela FIPE para a referência informada.",
      404,
    );
  }

  const valor = parseValorFipe(dados.Valor);
  if (valor <= 0) {
    throw new FipeError("A tabela FIPE retornou um valor inválido para este veículo.", 502);
  }

  return {
    tipo,
    marcaCodigo: marca,
    marca: limparMarca(dados.Marca ?? ""),
    modeloCodigo: modelo,
    modelo: dados.Modelo ?? "",
    anoCodigo: ano,
    anoModelo: dados.AnoModelo ?? Number.parseInt(ano.split("-")[0] ?? "0", 10),
    combustivel: dados.Combustivel ?? "",
    codigoFipe: dados.CodigoFipe ?? "",
    mesReferencia: (dados.MesReferencia ?? "").trim(),
    valor,
  };
}
