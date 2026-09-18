"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Card de seleção do DESIGN.md: superfície inteira clicável, borda vermelha de
 * 2px e fundo #FFF4F4 quando selecionado, com check discreto no canto.
 */
export function SelectionCard({
  selecionado,
  onSelect,
  children,
  className = "",
  ariaLabel,
}: {
  selecionado: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={`relative w-full rounded-card-lg border-2 p-5 text-left transition-all duration-200 ${
        selecionado
          ? "border-primary bg-red-subtle shadow-card"
          : "border-border-subtle bg-white hover:border-text-muted/40"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 ${
          selecionado ? "bg-primary text-white" : "bg-bg-secondary text-transparent"
        }`}
      >
        <Check size={14} strokeWidth={2.5} />
      </span>
      {children}
    </button>
  );
}
