"use client";

import { ChevronDown } from "lucide-react";

export interface OpcaoSelect {
  codigo: string;
  nome: string;
}

export function Select({
  id,
  label,
  valor,
  opcoes,
  onChange,
  placeholder,
  disabled,
  carregando,
}: {
  id: string;
  label: string;
  valor: string;
  opcoes: OpcaoSelect[];
  onChange: (valor: string) => void;
  placeholder: string;
  disabled?: boolean;
  carregando?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={valor}
          disabled={disabled || carregando}
          onChange={(e) => onChange(e.target.value)}
          className="field-input appearance-none pr-11 disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-text-muted"
        >
          <option value="">{carregando ? "Carregando…" : placeholder}</option>
          {opcoes.map((opcao) => (
            <option key={opcao.codigo} value={opcao.codigo}>
              {opcao.nome}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          strokeWidth={1.8}
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
    </div>
  );
}
