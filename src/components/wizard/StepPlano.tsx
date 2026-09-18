"use client";

import { ArrowRight, Lightbulb, SlidersHorizontal, Star } from "lucide-react";

import { ListaCoberturas } from "@/components/ListaCoberturas";
import { Preco } from "@/components/Preco";
import { VeiculoResumo } from "@/components/VeiculoResumo";
import { formatBRL } from "@/lib/format";
import { PLANOS, calcularPrecos } from "@/lib/planos";
import { useWizard } from "@/lib/wizard";

export function StepPlano() {
  const { veiculo, recomendado, planoSelecionado, mensalidadeBase, setPlano, irPara } = useWizard();

  if (!veiculo || !recomendado || !planoSelecionado) return null;

  const precos = calcularPrecos(veiculo.valor);
  const outros = PLANOS.filter((p) => p.id !== planoSelecionado.id);
  const ehRecomendado = planoSelecionado.id === recomendado.plano.id;

  return (
    <div className="animate-fade-in-up space-y-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight md:text-[36px]">
          Seu plano ideal está pronto
        </h1>
        <p className="mt-2 text-base text-text-secondary">
          Com base no seu {veiculo.marca} {veiculo.modelo.split(" ")[0]} {veiculo.anoModelo} (FIPE{" "}
          {formatBRL(veiculo.valor)}) e no perfil informado.
        </p>
      </header>

      <VeiculoResumo veiculo={veiculo} />

      <article className="rounded-card-xl border-2 border-primary bg-white p-6 shadow-card-primary">
        {ehRecomendado ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
            <Star size={12} strokeWidth={2.5} aria-hidden />
            Recomendado para você
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-bg-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-text-secondary">
            Plano escolhido por você
          </span>
        )}

        <h2 className="mt-4 text-2xl font-bold">Plano {planoSelecionado.nome}</h2>
        <Preco valor={mensalidadeBase} tamanho="lg" className="mt-2" />
        <p className="mt-2 text-xs text-text-muted">
          Valor na participação padrão (12% da FIPE). Você escolhe a participação na próxima tela.
        </p>

        <div className="mt-6">
          <ListaCoberturas itens={planoSelecionado.destaques} />
        </div>
      </article>

      {ehRecomendado ? (
        <section className="rounded-card-lg border border-border-subtle bg-bg-secondary p-5">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} strokeWidth={1.8} className="text-primary" aria-hidden />
            <h3 className="text-base font-semibold">Por que indicamos este plano?</h3>
          </div>
          <ol className="mt-4 space-y-3">
            {recomendado.justificativas.map((motivo, indice) => (
              <li key={motivo} className="flex gap-3 text-sm text-text-secondary">
                <span className="font-bold text-primary">{indice + 1}.</span>
                {motivo}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setPlano(planoSelecionado.id);
            irPara("participacao");
          }}
          className="btn-primary"
        >
          <span className="truncate">
            Escolher plano {planoSelecionado.nome} · {formatBRL(mensalidadeBase)}/mês
          </span>
          <ArrowRight size={18} strokeWidth={2} aria-hidden />
        </button>

        <button type="button" onClick={() => irPara("comparar")} className="btn-secondary">
          <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden />
          Comparar os {PLANOS.length} planos
        </button>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-secondary">Outras opções</h3>
        <ul className="space-y-2">
          {outros.map((plano) => (
            <li key={plano.id}>
              <button
                type="button"
                onClick={() => {
                  setPlano(plano.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex w-full items-center justify-between gap-4 rounded-card border border-border-subtle bg-white p-4 text-left transition-colors hover:bg-bg-secondary"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{plano.nome}</span>
                  <span className="mt-0.5 block truncate text-xs text-text-secondary">
                    {plano.descricao}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-base font-bold">{formatBRL(precos[plano.id])}</span>
                  <span className="block text-xs text-text-secondary">/mês</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
