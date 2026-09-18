"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { useWizard } from "@/lib/wizard";
import { Logo } from "./Logo";
import { SeloSeguro } from "./SeloSeguro";

export function WizardHeader({
  podeVoltar = true,
  largura = "max-w-wizard",
}: {
  podeVoltar?: boolean;
  largura?: string;
}) {
  const { voltar, tela } = useWizard();
  const naPrimeiraTela = tela === "veiculo";

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-white/95 backdrop-blur">
      <div className={`mx-auto flex h-16 ${largura} items-center justify-between gap-3 px-5 md:h-[72px]`}>
        {podeVoltar && !naPrimeiraTela ? (
          <button
            type="button"
            onClick={voltar}
            aria-label="Voltar para a etapa anterior"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-btn text-text-primary transition-colors hover:bg-bg-secondary"
          >
            <ArrowLeft size={20} strokeWidth={1.8} aria-hidden />
          </button>
        ) : (
          <Link href="/" aria-label="Voltar para a página inicial">
            <Logo />
          </Link>
        )}

        {podeVoltar && !naPrimeiraTela ? <Logo /> : <span />}

        <SeloSeguro />
      </div>
    </header>
  );
}
