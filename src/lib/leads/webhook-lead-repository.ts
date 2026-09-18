import type { CotacaoSnapshot, LeadRepository, ResultadoPersistencia } from "./types";

/** Encaminha o lead completo para um destino externo (Make, Zapier, n8n, CRM…). */
export class WebhookLeadRepository implements LeadRepository {
  readonly nome = "WebhookLeadRepository";
  readonly duravel = true;

  constructor(
    private readonly url: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async salvar(snapshot: CotacaoSnapshot): Promise<ResultadoPersistencia> {
    const resposta = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!resposta.ok) {
      throw new Error(`Webhook de leads respondeu HTTP ${resposta.status}.`);
    }

    return { persistido: true, repositorio: this.nome };
  }
}
