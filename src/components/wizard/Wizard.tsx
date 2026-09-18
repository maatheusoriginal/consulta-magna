"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { ProgressBar } from "@/components/ProgressBar";
import { WizardHeader } from "@/components/WizardHeader";
import { normalizePlaca } from "@/lib/format";
import { TELAS, useWizard } from "@/lib/wizard";
import { StepComparar } from "./StepComparar";
import { StepParticipacao } from "./StepParticipacao";
import { StepPerfil } from "./StepPerfil";
import { StepPlano } from "./StepPlano";
import { StepResumo } from "./StepResumo";
import { StepVeiculo } from "./StepVeiculo";
import { StepWhatsApp } from "./StepWhatsApp";

export function Wizard() {
  const parametros = useSearchParams();
  const { tela, veiculo, perfilCompleto, snapshot, hidratado, irPara } = useWizard();

  const placaInicial = normalizePlaca(parametros.get("placa") ?? "");
  const modoInicial = parametros.get("modo") === "manual" ? "manual" : "placa";

  // Impede telas órfãs quando o usuário chega por link direto ou recarrega a página.
  useEffect(() => {
    if (!hidratado) return;
    if (tela !== "veiculo" && !veiculo) irPara("veiculo");
    else if (
      ["plano", "comparar", "participacao", "resumo", "whatsapp"].includes(tela) &&
      !perfilCompleto
    ) {
      irPara("perfil");
    } else if (tela === "whatsapp" && !snapshot) {
      // A tela final só existe depois que o lead foi capturado e persistido.
      irPara("resumo");
    }
  }, [hidratado, tela, veiculo, perfilCompleto, snapshot, irPara]);

  const etapaAtual = TELAS.find((t) => t.id === tela)?.etapa ?? 0;
  const largura = tela === "comparar" ? "max-w-compare" : "max-w-wizard";

  if (!hidratado) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="sr-only">Carregando…</span>
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-primary"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WizardHeader largura={largura} />

      {tela !== "whatsapp" ? (
        <div className="border-b border-border-subtle bg-white">
          <div className={`mx-auto ${largura} px-5 py-4`}>
            <ProgressBar etapaAtual={etapaAtual} />
          </div>
        </div>
      ) : null}

      <main className={`mx-auto w-full flex-1 ${largura} px-5 py-8 md:py-10`}>
        {tela === "veiculo" ? (
          <StepVeiculo placaInicial={placaInicial} modoInicial={modoInicial} />
        ) : null}
        {tela === "perfil" ? <StepPerfil /> : null}
        {tela === "plano" ? <StepPlano /> : null}
        {tela === "comparar" ? <StepComparar /> : null}
        {tela === "participacao" ? <StepParticipacao /> : null}
        {tela === "resumo" ? <StepResumo /> : null}
        {tela === "whatsapp" ? <StepWhatsApp /> : null}
      </main>
    </div>
  );
}
