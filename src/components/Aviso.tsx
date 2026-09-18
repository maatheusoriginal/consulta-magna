import { Info } from "lucide-react";
import type { ReactNode } from "react";

export function Aviso({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="aviso">
      <Info size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <div className="space-y-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        <div className="text-text-secondary">{children}</div>
      </div>
    </div>
  );
}
