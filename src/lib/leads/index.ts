import { ConsoleLeadRepository } from "./console-lead-repository";
import type { LeadRepository } from "./types";
import { WebhookLeadRepository } from "./webhook-lead-repository";

export { ConsoleLeadRepository } from "./console-lead-repository";
export { WebhookLeadRepository } from "./webhook-lead-repository";
export type {
  CotacaoSnapshot,
  LeadRepository,
  ResultadoPersistencia,
} from "./types";

export const AVISO_SEM_PERSISTENCIA =
  "[leads] LEAD_WEBHOOK_URL não está configurada. Os leads NÃO serão persistidos — " +
  "o ConsoleLeadRepository apenas registra um resumo no log do servidor. " +
  "Configure uma persistência real antes de usar em produção.";

/**
 * Escolhe o repositório de leads a partir do ambiente.
 *
 * Em produção sem `LEAD_WEBHOOK_URL`, emite um aviso explícito: log de servidor
 * não é persistência de produção.
 */
export function criarLeadRepository(
  env: NodeJS.ProcessEnv = process.env,
  aviso: (mensagem: string) => void = console.warn,
): LeadRepository {
  const url = env.LEAD_WEBHOOK_URL?.trim();

  if (url) return new WebhookLeadRepository(url);

  if (env.NODE_ENV === "production") aviso(AVISO_SEM_PERSISTENCIA);

  return new ConsoleLeadRepository();
}

let instancia: LeadRepository | undefined;

/** Repositório compartilhado do processo (criado na primeira utilização). */
export function leadRepository(): LeadRepository {
  instancia ??= criarLeadRepository();
  return instancia;
}
