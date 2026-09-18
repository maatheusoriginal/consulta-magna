import { Car } from "lucide-react";

import { formatBRL } from "@/lib/format";
import type { FipeVeiculo } from "@/lib/types";

export function VeiculoResumo({ veiculo }: { veiculo: FipeVeiculo }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-border-subtle bg-bg-secondary p-4">
      <Car size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {veiculo.marca} {veiculo.modelo}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {veiculo.anoModelo} · FIPE {formatBRL(veiculo.valor)}
        </p>
      </div>
    </div>
  );
}
