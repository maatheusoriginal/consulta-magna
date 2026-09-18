"use client";

import { ArrowRight, CircleAlert, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isPlacaValida, normalizePlaca } from "@/lib/format";

export function PlacaHeroForm() {
  const router = useRouter();
  const [placa, setPlaca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!isPlacaValida(placa)) {
      setErro("Informe uma placa válida (ABC1234 ou ABC1D23).");
      return;
    }
    router.push(`/cotacao?placa=${normalizePlaca(placa)}`);
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <div>
        <label htmlFor="placa-hero" className="field-label">
          Placa do veículo
        </label>
        <div className="flex items-stretch overflow-hidden rounded-input border border-border-input focus-within:border-primary">
          <span className="flex w-14 shrink-0 flex-col items-center justify-center bg-[#1B3FAE] text-[10px] font-bold text-white">
            <span className="leading-none">BR</span>
          </span>
          <input
            id="placa-hero"
            name="placa"
            value={placa}
            onChange={(e) => {
              setPlaca(normalizePlaca(e.target.value));
              setErro(null);
            }}
            placeholder="ABC1D23"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? "placa-hero-erro" : undefined}
            className="h-14 w-full bg-white px-4 text-lg font-semibold tracking-[0.18em] text-text-primary placeholder:font-normal placeholder:tracking-normal placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">Padrão Mercosul ou Brasil — sem traços.</p>
        {erro ? (
          <p id="placa-hero-erro" className="mt-2 flex items-center gap-1.5 text-sm text-primary">
            <CircleAlert size={15} strokeWidth={1.8} aria-hidden />
            {erro}
          </p>
        ) : null}
      </div>

      <button type="submit" className="btn-primary">
        Consultar veículo
        <ArrowRight size={18} strokeWidth={2} aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => router.push("/cotacao?modo=manual")}
        className="btn-ghost w-full"
      >
        <Search size={16} strokeWidth={1.8} aria-hidden />
        Não sabe a placa? Consultar por marca e modelo
      </button>
    </form>
  );
}
