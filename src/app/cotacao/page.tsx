import type { Metadata } from "next";
import { Suspense } from "react";

import { Wizard } from "@/components/wizard/Wizard";
import { WizardProvider } from "@/lib/wizard";

export const metadata: Metadata = {
  title: "Cotação · Magna Proteção Automotiva",
  description:
    "Consulte a tabela FIPE do seu veículo e receba uma recomendação de plano de proteção veicular em poucos minutos.",
};

export default function CotacaoPage() {
  return (
    <WizardProvider>
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center">
            <span
              aria-hidden
              className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-primary"
            />
          </div>
        }
      >
        <Wizard />
      </Suspense>
    </WizardProvider>
  );
}
