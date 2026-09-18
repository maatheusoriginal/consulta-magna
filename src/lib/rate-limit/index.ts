import { NextResponse } from "next/server";

import { MemoryRateLimitProvider } from "./memory-rate-limit-provider";
import type { RateLimitProvider, RegraRateLimit } from "./types";
import { UpstashRateLimitProvider } from "./upstash-rate-limit-provider";

export { MemoryRateLimitProvider } from "./memory-rate-limit-provider";
export { UpstashRateLimitProvider } from "./upstash-rate-limit-provider";
export type { RateLimitProvider, RegraRateLimit, ResultadoRateLimit } from "./types";

export const AVISO_RATE_LIMIT_NAO_DISTRIBUIDO =
  "[rate-limit] Nenhum provider distribuído configurado. O MemoryRateLimitProvider " +
  "conta requisições apenas dentro de cada instância — em serverless isso NÃO é um " +
  "limite global. Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN em produção.";

/** Regras aplicadas aos endpoints públicos. Generosas para o uso normal. */
export const REGRAS = {
  /** Envio de lead: dispara webhook, é o endpoint mais caro. */
  lead: { nome: "lead", limite: 8, janelaMs: 10 * 60 * 1000 },
  /** Consulta de placa: bate em provedor externo e na FIPE. */
  placa: { nome: "placa", limite: 30, janelaMs: 10 * 60 * 1000 },
  /** Consultas à FIPE: respondem de cache na maior parte das vezes. */
  fipe: { nome: "fipe", limite: 240, janelaMs: 10 * 60 * 1000 },
} as const satisfies Record<string, RegraRateLimit>;

/**
 * Escolhe o limitador a partir do ambiente.
 *
 * Com Upstash/Vercel KV configurado o limite é global. Sem ele, cai para o
 * limitador em memória e avisa em produção que a cobertura não é global.
 */
export function criarRateLimitProvider(
  env: NodeJS.ProcessEnv = process.env,
  aviso: (mensagem: string) => void = console.warn,
): RateLimitProvider {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) return new UpstashRateLimitProvider(url, token);

  if (env.NODE_ENV === "production") aviso(AVISO_RATE_LIMIT_NAO_DISTRIBUIDO);

  return new MemoryRateLimitProvider();
}

let instancia: RateLimitProvider | undefined;

export function rateLimitProvider(): RateLimitProvider {
  instancia ??= criarRateLimitProvider();
  return instancia;
}

/** Identifica o cliente pelo IP informado pela borda (Vercel, proxy, CDN). */
export function identificarCliente(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) {
    const primeiro = encaminhado.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  return request.headers.get("x-real-ip")?.trim() || "desconhecido";
}

/**
 * Aplica a regra e devolve uma resposta 429 quando o limite estoura.
 *
 * Devolve `null` quando a requisição pode seguir. Uma falha no limitador nunca
 * derruba o endpoint: registramos e deixamos passar.
 */
export async function aplicarRateLimit(
  request: Request,
  regra: RegraRateLimit,
  provider: RateLimitProvider = rateLimitProvider(),
): Promise<NextResponse | null> {
  try {
    const resultado = await provider.consumir(identificarCliente(request), regra);
    if (resultado.permitido) return null;

    return NextResponse.json(
      { erro: "Muitas requisições em pouco tempo. Aguarde um instante e tente novamente." },
      {
        status: 429,
        headers: {
          "Retry-After": String(resultado.retryApos),
          "RateLimit-Limit": String(regra.limite),
          "RateLimit-Remaining": String(resultado.restante),
          "RateLimit-Reset": String(resultado.retryApos),
        },
      },
    );
  } catch (e) {
    // Indisponibilidade do limitador não pode bloquear clientes legítimos.
    console.error("[rate-limit] falha ao consultar o provider:", e);
    return null;
  }
}
