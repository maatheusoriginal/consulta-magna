import type { RateLimitProvider, RegraRateLimit, ResultadoRateLimit } from "./types";

interface Janela {
  contagem: number;
  resetEm: number;
}

/**
 * Limitador em memória, por processo.
 *
 * ATENÇÃO: NÃO é global. Em serverless (Vercel, Lambda) cada instância tem a
 * sua própria contagem e instâncias ociosas são recicladas, então o limite
 * efetivo é multiplicado pelo número de instâncias ativas. Serve como defesa
 * de profundidade e para desenvolvimento; para um limite real em produção use
 * um provider distribuído (ver `src/lib/rate-limit/index.ts`).
 */
export class MemoryRateLimitProvider implements RateLimitProvider {
  readonly nome = "MemoryRateLimitProvider";
  readonly distribuido = false;

  private readonly janelas = new Map<string, Janela>();

  async consumir(chave: string, regra: RegraRateLimit): Promise<ResultadoRateLimit> {
    const agora = Date.now();
    const id = `${regra.nome}:${chave}`;
    const janela = this.janelas.get(id);

    if (!janela || janela.resetEm <= agora) {
      const resetEm = agora + regra.janelaMs;
      this.janelas.set(id, { contagem: 1, resetEm });
      this.limpar(agora);
      return {
        permitido: true,
        restante: regra.limite - 1,
        resetEm,
        retryApos: Math.ceil(regra.janelaMs / 1000),
      };
    }

    janela.contagem += 1;
    const permitido = janela.contagem <= regra.limite;

    return {
      permitido,
      restante: Math.max(0, regra.limite - janela.contagem),
      resetEm: janela.resetEm,
      retryApos: Math.max(1, Math.ceil((janela.resetEm - agora) / 1000)),
    };
  }

  /** Remove janelas expiradas para o mapa não crescer indefinidamente. */
  private limpar(agora: number): void {
    if (this.janelas.size < 5_000) return;
    for (const [id, janela] of this.janelas) {
      if (janela.resetEm <= agora) this.janelas.delete(id);
    }
  }
}
