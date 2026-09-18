import { splitBRL } from "@/lib/format";

type Tamanho = "sm" | "md" | "lg";

const TAMANHOS: Record<Tamanho, { simbolo: string; numero: string; sufixo: string }> = {
  sm: { simbolo: "text-sm", numero: "text-2xl", sufixo: "text-sm" },
  md: { simbolo: "text-base", numero: "text-4xl", sufixo: "text-base" },
  lg: { simbolo: "text-lg", numero: "text-5xl", sufixo: "text-base" },
};

export function Preco({
  valor,
  tamanho = "md",
  sufixo = "/mês",
  className = "",
}: {
  valor: number;
  tamanho?: Tamanho;
  sufixo?: string | null;
  className?: string;
}) {
  const { simbolo, numero } = splitBRL(valor);
  const escala = TAMANHOS[tamanho];

  return (
    <p className={`flex items-baseline gap-1 ${className}`}>
      <span className={`${escala.simbolo} font-semibold text-text-secondary`}>{simbolo}</span>
      <span className={`${escala.numero} font-extrabold leading-none tracking-[-0.03em]`}>
        {numero}
      </span>
      {sufixo ? (
        <span className={`${escala.sufixo} font-medium text-text-secondary`}>{sufixo}</span>
      ) : null}
    </p>
  );
}
