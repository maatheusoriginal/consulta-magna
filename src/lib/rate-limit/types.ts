export interface ResultadoRateLimit {
  permitido: boolean;
  /** Requisições ainda disponíveis na janela atual. */
  restante: number;
  /** Momento (epoch ms) em que a janela reinicia. */
  resetEm: number;
  /** Segundos até a janela reiniciar — usado no header `Retry-After`. */
  retryApos: number;
}

export interface RegraRateLimit {
  /** Identificador da regra, usado como prefixo da chave. */
  nome: string;
  /** Requisições permitidas por janela. */
  limite: number;
  /** Tamanho da janela, em milissegundos. */
  janelaMs: number;
}

/**
 * Contrato de um limitador de requisições.
 *
 * `distribuido` distingue um limitador que vale para toda a frota (Redis, por
 * exemplo) de um que só conhece o próprio processo. Em serverless, um limitador
 * em memória protege apenas a instância que o atendeu — o app diz isso
 * explicitamente em vez de fingir cobertura global.
 */
export interface RateLimitProvider {
  readonly nome: string;
  readonly distribuido: boolean;
  consumir(chave: string, regra: RegraRateLimit): Promise<ResultadoRateLimit>;
}
