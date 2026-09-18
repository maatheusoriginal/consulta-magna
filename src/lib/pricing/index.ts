import { PRICING_CONFIG } from "./config";
import { EstimatedPricingProvider } from "./estimated-pricing-provider";
import type { PricingProvider } from "./types";

export { PRICING_CONFIG, type PricingConfig } from "./config";
export {
  AVISO_REGRA_INFERIDA,
  EstimatedPricingProvider,
  REFERENCIAS,
} from "./estimated-pricing-provider";
export type {
  EntradaPrecificacao,
  ParticipacaoPrecificada,
  PrecoDisponivel,
  PrecoIndisponivel,
  PricingProvider,
  PricingStatus,
  ResultadoPrecificacao,
} from "./types";

/**
 * Provedor de preços em uso.
 *
 * Hoje é o `EstimatedPricingProvider` (regra inferida → status `ESTIMATED`).
 * Quando a Magna disponibilizar a tabela oficial, troque a implementação aqui
 * por um provedor `OFFICIAL` — nada mais no app precisa mudar.
 */
export const pricingProvider: PricingProvider = new EstimatedPricingProvider(PRICING_CONFIG);
