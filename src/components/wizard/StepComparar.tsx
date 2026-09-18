"use client";

import { ArrowRight, Check, Minus, Star } from "lucide-react";
import { useState } from "react";

import { Preco } from "@/components/Preco";
import { VeiculoResumo } from "@/components/VeiculoResumo";
import { AVISO_SIMULACAO_ESTIMADA } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { ITENS_COMPARACAO, PLANOS } from "@/lib/planos";
import type { CoberturaItem, PlanoId } from "@/lib/types";
import { useWizard } from "@/lib/wizard";

function ValorCobertura({ item }: { item: CoberturaItem | undefined }) {
  if (!item || item.valor === false) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-text-muted">
        <Minus size={16} strokeWidth={2} aria-hidden />
        <span className="sr-only">Não incluso</span>
      </span>
    );
  }

  if (item.valor === true) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-primary">
        <Check size={16} strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Incluso</span>
      </span>
    );
  }

  return (
    <span className="block">
      <span className="text-sm font-semibold text-text-primary">{item.valor}</span>
      {item.nota ? <span className="mt-0.5 block text-[11px] text-text-muted">{item.nota}</span> : null}
    </span>
  );
}

export function StepComparar() {
  const { veiculo, recomendado, planoSelecionado, precosPorPlano, setPlano, irPara } = useWizard();
  const [aba, setAba] = useState<PlanoId>(planoSelecionado?.id ?? "ouro");

  if (!veiculo || !planoSelecionado) return null;

  const idRecomendado = recomendado?.plano.id;
  const planoAba = PLANOS.find((p) => p.id === aba)!;

  function escolher(id: PlanoId) {
    setPlano(id);
    irPara("participacao");
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight md:text-[36px]">
          Compare e escolha o seu plano
        </h1>
        <p className="mt-2 text-base text-text-secondary">
          Transparência total em cada item coberto. {AVISO_SIMULACAO_ESTIMADA}
        </p>
      </header>

      <VeiculoResumo veiculo={veiculo} />

      {/* Mobile: abas + card único (DESIGN.md §19) */}
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="Planos"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2"
        >
          {PLANOS.map((plano) => (
            <button
              key={plano.id}
              role="tab"
              type="button"
              aria-selected={aba === plano.id}
              onClick={() => setAba(plano.id)}
              className={`shrink-0 rounded-btn border px-4 py-2.5 text-sm transition-all duration-200 ${
                aba === plano.id
                  ? "border-primary bg-red-subtle font-semibold text-primary"
                  : "border-border-subtle bg-white font-medium text-text-secondary"
              }`}
            >
              {plano.nome}
              {plano.id === idRecomendado ? " ★" : ""}
            </button>
          ))}
        </div>

        <article
          className={`mt-4 rounded-card-xl border bg-white p-6 ${
            planoAba.id === idRecomendado
              ? "border-2 border-primary shadow-card-primary"
              : "border-border-subtle shadow-card"
          }`}
        >
          {planoAba.id === idRecomendado ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
              <Star size={11} strokeWidth={2.5} aria-hidden />
              Recomendado
            </span>
          ) : null}

          <h2 className="mt-3 text-xl font-bold">{planoAba.nome}</h2>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {planoAba.subtitulo}
          </p>
          {precosPorPlano[planoAba.id] !== null ? (
            <Preco valor={precosPorPlano[planoAba.id]!} tamanho="md" className="mt-3" />
          ) : null}
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{planoAba.descricao}</p>

          <dl className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
            {ITENS_COMPARACAO.map((rotulo) => {
              const item = planoAba.coberturas.find((c) => c.label === rotulo);
              return (
                <div key={rotulo} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-text-secondary">{rotulo}</dt>
                  <dd className="shrink-0 text-right">
                    <ValorCobertura item={item} />
                  </dd>
                </div>
              );
            })}
          </dl>

          <button
            type="button"
            onClick={() => escolher(planoAba.id)}
            className={`mt-6 ${planoAba.id === planoSelecionado.id ? "btn-primary" : "btn-secondary"}`}
          >
            {planoAba.id === planoSelecionado.id
              ? "Continuar com este plano"
              : `Escolher ${planoAba.nome}`}
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </button>
        </article>
      </div>

      {/* Desktop: tabela (DESIGN.md §19 e §29) */}
      <div className="hidden lg:block">
        <div className="overflow-hidden rounded-card-xl border border-border-subtle">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Comparação de coberturas entre os planos</caption>
            <thead>
              <tr className="bg-bg-secondary">
                <th scope="col" className="w-[26%] p-4 text-sm font-semibold">
                  Cobertura
                </th>
                {PLANOS.map((plano) => (
                  <th
                    key={plano.id}
                    scope="col"
                    className={`p-4 align-top ${plano.id === idRecomendado ? "bg-red-subtle" : ""}`}
                  >
                    <span className="block text-base font-bold">{plano.nome}</span>
                    {plano.id === idRecomendado ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        <Star size={10} strokeWidth={2.5} aria-hidden />
                        Recomendado
                      </span>
                    ) : null}
                    <span className="mt-2 block text-xl font-extrabold tracking-[-0.02em]">
                      {precosPorPlano[plano.id] !== null
                        ? formatBRL(precosPorPlano[plano.id]!)
                        : "—"}
                      <span className="ml-1 text-xs font-medium text-text-secondary">/mês</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ITENS_COMPARACAO.map((rotulo, indice) => (
                <tr key={rotulo} className={indice % 2 === 1 ? "bg-bg-secondary/50" : ""}>
                  <th scope="row" className="p-4 text-sm font-medium text-text-secondary">
                    {rotulo}
                  </th>
                  {PLANOS.map((plano) => (
                    <td
                      key={plano.id}
                      className={`p-4 ${plano.id === idRecomendado ? "bg-red-subtle/50" : ""}`}
                    >
                      <ValorCobertura item={plano.coberturas.find((c) => c.label === rotulo)} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4" />
                {PLANOS.map((plano) => (
                  <td key={plano.id} className="p-4 align-top">
                    <button
                      type="button"
                      onClick={() => escolher(plano.id)}
                      className={`h-12 w-full rounded-btn px-3 text-sm font-semibold transition-colors ${
                        plano.id === planoSelecionado.id
                          ? "bg-primary text-white hover:bg-primary-hover"
                          : "border border-border-subtle bg-white text-text-primary hover:bg-bg-secondary"
                      }`}
                    >
                      {plano.id === planoSelecionado.id ? "Continuar" : "Selecionar"}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <button type="button" onClick={() => irPara("plano")} className="btn-ghost w-full">
        Voltar para a recomendação
      </button>
    </div>
  );
}
