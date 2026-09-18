import "server-only";

import { consultarPreco, listarAnos, listarMarcas, listarModelos } from "./fipe";
import { normalizePlaca } from "./format";
import type { FipeItem, FipeVeiculo, TipoVeiculo } from "./types";

/**
 * Consulta de placa.
 *
 * Não existe API pública e gratuita de consulta por placa — os dados do
 * Denatran são restritos. Verificamos a documentação da Invertexto
 * (https://api.invertexto.com/, consultada em setembro de 2026): ela oferece
 * Tabela FIPE, CEP, CNPJ, feriados e outras APIs, mas **não** possui consulta
 * de placa. A integração específica que existia aqui foi removida por não ser
 * confirmável.
 *
 * Restou apenas a abstração genérica: configure `PLACA_API_URL` apontando para
 * o provedor que você contratar, usando `{placa}` como marcador, e
 * opcionalmente `PLACA_API_AUTH_HEADER` / `PLACA_API_AUTH_VALUE`.
 *
 * Sem provedor configurado a consulta responde `configurado: false` e a
 * interface encaminha o usuário para a busca por marca/modelo/ano — que usa
 * apenas a API gratuita da FIPE e mantém o fluxo funcional sem nenhuma chave.
 * Nunca fingimos que a consulta por placa funcionou.
 *
 * A correspondência entre o texto devolvido pelo provedor e as versões da FIPE
 * é aproximada, então o retorno é sempre uma LISTA DE CANDIDATOS: a escolha da
 * versão é do usuário.
 */

/** Quantidade máxima de versões oferecidas para o usuário escolher. */
const MAX_CANDIDATOS = 8;

export interface DadosPlaca {
  placa: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  combustivel?: string;
  /** Categoria informada pelo provedor, já normalizada. */
  tipo?: TipoVeiculo;
}

export interface ResultadoPlaca {
  configurado: boolean;
  dados?: DadosPlaca;
  /**
   * `true` quando nem o provedor nem quem chamou informaram a categoria do
   * veículo. A interface precisa perguntar antes de buscar na FIPE — assumir
   * "carros" faria uma moto ser pesquisada na tabela de carros.
   */
  precisaTipoVeiculo?: boolean;
  /** Versões compatíveis. A escolha é sempre do usuário — nunca automática. */
  candidatos: FipeVeiculo[];
}

/**
 * Normaliza a categoria devolvida pelo provedor de placa para o vocabulário da
 * FIPE. Devolve `undefined` quando não reconhece — nunca chuta "carros".
 */
export function normalizarTipoVeiculoPlaca(valor: unknown): TipoVeiculo | undefined {
  if (valor === null || valor === undefined) return undefined;

  const texto = String(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!texto) return undefined;

  const CARROS = ["CARRO", "CARROS", "AUTOMOVEL", "AUTOMOVEIS", "AUTO", "CAR", "PASSEIO", "1"];
  const MOTOS = [
    "MOTO",
    "MOTOS",
    "MOTOCICLETA",
    "MOTOCICLO",
    "MOTORCYCLE",
    "CICLOMOTOR",
    "TRICICLO",
    "2",
  ];
  const CAMINHOES = [
    "CAMINHAO",
    "CAMINHOES",
    "TRUCK",
    "CAMINHAOTRATOR",
    "ONIBUS",
    "MICROONIBUS",
    "3",
  ];

  if (CARROS.includes(texto)) return "carros";
  if (MOTOS.includes(texto)) return "motos";
  if (CAMINHOES.includes(texto)) return "caminhoes";
  return undefined;
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
  const urlConfigurada = process.env.PLACA_API_URL;
  if (!urlConfigurada) return null;

  const headers: Record<string, string> = { Accept: "application/json" };
  const nomeHeader = process.env.PLACA_API_AUTH_HEADER;
  const valorHeader = process.env.PLACA_API_AUTH_VALUE;
  if (nomeHeader && valorHeader) headers[nomeHeader] = valorHeader;

  const resposta = await fetch(urlConfigurada.replace("{placa}", encodeURIComponent(placa)), {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
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
    tipo: normalizarTipoVeiculoPlaca(
      bruto.tipoVeiculo ?? bruto.tipo ?? bruto.categoria ?? bruto.segmento ?? bruto.especie,
    ),
  };

  return dados.marca || dados.modelo ? dados : null;
}

/**
 * Monta a lista de versões da FIPE compatíveis com os dados da placa.
 *
 * Considera TODAS as entradas do ano informado — um mesmo ano pode ter Gasolina,
 * Flex e Diesel — e usa o combustível da placa apenas para priorizar, nunca para
 * decidir sozinho. Nenhuma mensalidade é calculada aqui.
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

  const listas = await Promise.all(
    compativeis.map(async (modelo) => {
      try {
        const anos = await listarAnos(tipo, marca.codigo, modelo.codigo);
        // Todas as entradas daquele ano, não apenas a primeira.
        const doAno = anos.filter((a) => a.nome.startsWith(`${dados.ano} `) || a.nome === String(dados.ano));

        return await Promise.all(
          doAno.map(async (ano) => {
            try {
              return await consultarPreco(tipo, marca.codigo, modelo.codigo, ano.codigo);
            } catch {
              return null;
            }
          }),
        );
      } catch {
        // Uma versão que falhou não pode derrubar as demais.
        return [];
      }
    }),
  );

  const candidatos = listas.flat().filter((c): c is FipeVeiculo => c !== null);

  // O combustível da placa só prioriza a ordem; nada é descartado por causa dele.
  const alvoCombustivel = dados.combustivel ? normalizarTexto(dados.combustivel) : null;
  const ordenados = alvoCombustivel
    ? [...candidatos].sort(
        (a, b) =>
          pontuar(alvoCombustivel, b.combustivel) - pontuar(alvoCombustivel, a.combustivel),
      )
    : candidatos;

  return ordenados.slice(0, MAX_CANDIDATOS).map((c) => ({ ...c, placa: dados.placa }));
}

export async function consultarPlaca(
  placaBruta: string,
  tipoInformado?: TipoVeiculo,
): Promise<ResultadoPlaca> {
  const placa = normalizePlaca(placaBruta);
  const dados = await consultarProvedor(placa);

  if (!dados) return { configurado: false, candidatos: [] };

  // Sem categoria conhecida não pesquisamos: a interface pergunta ao usuário.
  const tipo = tipoInformado ?? dados.tipo;
  if (!tipo) return { configurado: true, dados, precisaTipoVeiculo: true, candidatos: [] };

  try {
    return { configurado: true, dados, candidatos: await montarCandidatos(dados, tipo) };
  } catch {
    return { configurado: true, dados, candidatos: [] };
  }
}
