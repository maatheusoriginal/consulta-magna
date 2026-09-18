import { Lock } from "lucide-react";

export function SeloSeguro({ texto = "Conexão segura" }: { texto?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
      <Lock size={14} strokeWidth={1.8} aria-hidden />
      {texto}
    </span>
  );
}
