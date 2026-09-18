import { ShieldCheck } from "lucide-react";

import { MARCA } from "@/lib/config";

export function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
        <ShieldCheck size={18} strokeWidth={2} aria-hidden />
      </span>
      <span className="text-lg font-bold tracking-[-0.02em] text-text-primary">
        {compacto ? MARCA.nome : MARCA.nome}
      </span>
    </span>
  );
}
