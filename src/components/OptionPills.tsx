"use client";

export interface Opcao<T extends string> {
  valor: T;
  label: string;
}

export function OptionPills<T extends string>({
  opcoes,
  valor,
  onChange,
  legenda,
}: {
  opcoes: ReadonlyArray<Opcao<T>>;
  valor: T | undefined;
  onChange: (valor: T) => void;
  legenda: string;
}) {
  return (
    <div role="radiogroup" aria-label={legenda} className="flex flex-wrap gap-2">
      {opcoes.map((opcao) => {
        const selecionado = valor === opcao.valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={selecionado}
            onClick={() => onChange(opcao.valor)}
            className={`rounded-btn border px-4 py-2.5 text-sm transition-all duration-200 ${
              selecionado
                ? "border-primary bg-red-subtle font-semibold text-primary"
                : "border-border-subtle bg-white font-medium text-text-secondary hover:bg-bg-secondary"
            }`}
          >
            {opcao.label}
          </button>
        );
      })}
    </div>
  );
}
