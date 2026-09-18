"use client";

import { ArrowRight, Car, CarTaxiFront } from "lucide-react";
import { useState } from "react";

import { OptionPills } from "@/components/OptionPills";
import { SelectionCard } from "@/components/SelectionCard";
import type { PerfilRespostas } from "@/lib/types";
import { useWizard } from "@/lib/wizard";

const FINALIDADES = [
  {
    valor: "particular" as const,
    icone: Car,
    titulo: "Uso particular",
    texto: "Passeio, fins de semana e rotina pessoal",
  },
  {
    valor: "aplicativo" as const,
    icone: CarTaxiFront,
    titulo: "Aplicativo / Táxi",
    texto: "Uber, 99 ou táxi com atividade profissional",
  },
];

const PERGUNTAS = [
  {
    campo: "prioridade" as const,
    titulo: "O que é mais importante para você?",
    opcoes: [
      { valor: "roubo" as const, label: "Roubo e furto" },
      { valor: "colisao" as const, label: "Colisão e acidentes" },
      { valor: "terceiros" as const, label: "Proteção para terceiros" },
      { valor: "completa" as const, label: "Quero uma proteção mais completa" },
    ],
  },
  {
    campo: "viagens" as const,
    titulo: "Você costuma viajar ou rodar longas distâncias?",
    opcoes: [
      { valor: "quase-nunca" as const, label: "Quase nunca" },
      { valor: "as-vezes" as const, label: "Às vezes" },
      { valor: "frequencia" as const, label: "Com frequência" },
    ],
  },
  {
    campo: "carroReserva" as const,
    titulo: "Ter um veículo reserva seria importante para você?",
    opcoes: [
      { valor: "nao-preciso" as const, label: "Não preciso" },
      { valor: "interessante" as const, label: "Seria interessante" },
      { valor: "muito-importante" as const, label: "É muito importante" },
    ],
  },
  {
    campo: "terceiros" as const,
    titulo: "Quanto você valoriza uma proteção maior para terceiros?",
    opcoes: [
      { valor: "nao-prioridade" as const, label: "Não é prioridade" },
      { valor: "intermediaria" as const, label: "Proteção intermediária" },
      { valor: "alta" as const, label: "Proteção alta" },
    ],
  },
  {
    campo: "vidros" as const,
    titulo: "Proteção para vidros, faróis e retrovisores é importante?",
    opcoes: [
      { valor: "nao" as const, label: "Não" },
      { valor: "um-pouco" as const, label: "Um pouco" },
      { valor: "sim" as const, label: "Sim" },
    ],
  },
];

export function StepPerfil() {
  const { perfil, finalidadeFixa, setPerfil, irPara } = useWizard();
  const [tentouAvancar, setTentouAvancar] = useState(false);

  const faltando = [
    !finalidadeFixa && !perfil.finalidade && "finalidade",
    ...PERGUNTAS.map((p) => (!perfil[p.campo] ? p.campo : null)),
  ].filter(Boolean);

  const completo = faltando.length === 0;

  function avancar() {
    setTentouAvancar(true);
    if (completo) irPara("plano");
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      <header>
        <h1 className="text-[28px] font-bold leading-tight md:text-[36px]">
          Como você utiliza o seu veículo?
        </h1>
        <p className="mt-2 text-base text-text-secondary">
          Personalizamos a recomendação para você pagar apenas pelo que realmente precisa.
        </p>
      </header>

      {/* Moto não roda em aplicativo/táxi: a pergunta não é exibida. */}
      {finalidadeFixa ? null : (
      <section>
        <h2 className="mb-3 text-base font-semibold">Finalidade principal</h2>
        <div role="radiogroup" aria-label="Finalidade principal" className="grid gap-3 sm:grid-cols-2">
          {FINALIDADES.map(({ valor, icone: Icone, titulo, texto }) => {
            const selecionado = perfil.finalidade === valor;
            return (
              <SelectionCard
                key={valor}
                selecionado={selecionado}
                onSelect={() => setPerfil({ finalidade: valor })}
                ariaLabel={titulo}
              >
                <Icone
                  size={22}
                  strokeWidth={1.8}
                  aria-hidden
                  className={selecionado ? "text-primary" : "text-text-secondary"}
                />
                <p className="mt-3 pr-8 text-base font-semibold">{titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{texto}</p>
              </SelectionCard>
            );
          })}
        </div>
      </section>
      )}

      <section className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Questionário rápido de perfil</h2>
          <span className="text-xs font-medium text-text-muted">{PERGUNTAS.length} perguntas</span>
        </div>

        {PERGUNTAS.map((pergunta, indice) => (
          <div key={pergunta.campo} className="card rounded-card-lg p-5">
            <div className="mb-4 flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-subtle text-xs font-bold text-primary">
                {indice + 1}
              </span>
              <p className="text-base font-semibold leading-snug">{pergunta.titulo}</p>
            </div>
            <OptionPills
              legenda={pergunta.titulo}
              opcoes={pergunta.opcoes}
              valor={perfil[pergunta.campo] as PerfilRespostas[typeof pergunta.campo] | undefined}
              onChange={(valor) =>
                setPerfil({ [pergunta.campo]: valor } as Partial<PerfilRespostas>)
              }
            />
          </div>
        ))}
      </section>

      {tentouAvancar && !completo ? (
        <p className="text-sm text-primary" role="alert">
          Responda todas as perguntas para receber a recomendação certa.
        </p>
      ) : null}

      <button type="button" onClick={avancar} disabled={!completo} className="btn-primary">
        Ver meu plano recomendado
        <ArrowRight size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
