import type { RateLimitProvider, RegraRateLimit, ResultadoRateLimit } from "./types";

/**
 * Limitador distribuído sobre Redis via API REST do Upstash.
 *
 * Funciona em serverless porque não depende de conexão TCP persistente nem de
 * estado no processo: a contagem vive no Redis e vale para toda a frota.
 * Compatível com Upstash Redis e com o Vercel KV (que expõe a mesma API REST).
 *
 * Configuração: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
 */
export class UpstashRateLimitProvider implements RateLimitProvider {
  readonly nome = "UpstashRateLimitProvider";
  readonly distribuido = true;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly timeoutMs = 2_000,
  ) {}

  async consumir(chave: string, regra: RegraRateLimit): Promise<ResultadoRateLimit> {
    const id = `ratelimit:${regra.nome}:${chave}`;
    const janelaSegundos = Math.ceil(regra.janelaMs / 1000);

    // INCR cria a chave já em 1; o EXPIRE com NX só define o TTL na primeira
    // requisição da janela, deixando o resto da janela deslizar corretamente.
    const resposta = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", id],
        ["EXPIRE", id, String(janelaSegundos), "NX"],
        ["TTL", id],
      ]),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!resposta.ok) throw new Error(`Upstash respondeu HTTP ${resposta.status}.`);

    const corpo = (await resposta.json()) as Array<{ result?: number; error?: string }>;
    const contagem = Number(corpo[0]?.result ?? 0);
    const ttl = Number(corpo[2]?.result ?? janelaSegundos);
    const retryApos = ttl > 0 ? ttl : janelaSegundos;

    return {
      permitido: contagem <= regra.limite,
      restante: Math.max(0, regra.limite - contagem),
      resetEm: Date.now() + retryApos * 1000,
      retryApos,
    };
  }
}
