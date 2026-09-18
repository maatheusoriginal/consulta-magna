import { ETAPAS } from "@/lib/wizard";

export function ProgressBar({ etapaAtual }: { etapaAtual: number }) {
  const percentual = Math.round(((etapaAtual + 1) / ETAPAS.length) * 100);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-semibold text-text-primary">
          Etapa {etapaAtual + 1} de {ETAPAS.length}
          <span className="ml-2 font-normal text-text-secondary">{ETAPAS[etapaAtual]}</span>
        </p>
        <p className="text-xs font-medium text-text-muted">{percentual}% concluído</p>
      </div>

      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={ETAPAS.length}
        aria-valuenow={etapaAtual + 1}
        aria-label={`Etapa ${etapaAtual + 1} de ${ETAPAS.length}: ${ETAPAS[etapaAtual]}`}
      >
        {ETAPAS.map((etapa, indice) => (
          <span
            key={etapa}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              indice <= etapaAtual ? "bg-primary" : "bg-border-subtle"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
