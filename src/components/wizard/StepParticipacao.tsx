"use client";

import { ArrowRight, Clock, Flame, ShieldCheck, Wallet } from "lucide-react";
import { useEffect } from "react";

import { Aviso } from "@/components/Aviso";
import { SelectionCard } from "@/components/SelectionCard";
import { VeiculoResumo } from "@/components/VeiculoResumo";
import { AVISO_SIMULACAO_ESTIMADA } from "@/lib/config";
import { formatBRL, formatPercentual } from "@/lib/format";
import { PRICING_CONFIG } from "@/lib/pricing";
import { useWizard } from "@/lib/wizard";

export function StepParticipacao() {
  const {
    veiculo,
    planoSelecionado,
    preco,
    participacoes,
    participacaoId,
    participacao,
    setParticipacao,
    irPara,
  } = useWizard();

  // Uma modalidade pode ficar indisponível (piso mínimo ou restrição de uso comercial).
  const primeiroId = participacoes[0]?.id;
  const indisponivel =
    participacoes.length > 0 && !participacoes.some((o) => o.id === participacaoId);
  useEffect(() => {
    if (indisponivel && primeiroId) setParticipacao(primeiroId);
  }, [indisponivel, primeiroId, setParticipacao]);

  if (!veiculo || !planoSelecionado || !participacao || !preco || preco.status === "UNAVAILABLE") {
    return null;
  }

  return (
    <div className="animate-fade-in-up space-y-6 pb-28">
      <header>
        <h1 className="text-[28px] font-bold leading-tight md:text-[36px]">
          Como prefere sua participação em caso de evento?
        </h1>
        <p className="mt-2 text-base leading-relaxed text-text-secondary">
          A participação é o valor pago quando houver um evento coberto, conforme as condições
          aplicáveis. Escolha o equilíbrio ideal para você.
        </p>
      </header>

      <VeiculoResumo veiculo={veiculo} />

      <div role="radiogroup" aria-label="Modalidade de participação" className="space-y-3">
        {participacoes.map((opcao) => {
          const selecionado = opcao.id === participacaoId;
          const zero = opcao.percentual === null;

          return (
            <SelectionCard
              key={opcao.id}
              selecionado={selecionado}
              onSelect={() => setParticipacao(opcao.id)}
              ariaLabel={`${opcao.nome}: mensalidade ${formatBRL(opcao.mensalidade)} por mês`}
            >
              {opcao.badge ? (
                <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-red-subtle px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {opcao.id === "padrao" ? (
                    <Flame size={11} strokeWidth={2.5} aria-hidden />
                  ) : zero ? (
                    <ShieldCheck size={11} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Wallet size={11} strokeWidth={2.5} aria-hidden />
                  )}
                  {opcao.badge}
                </span>
              ) : opcao.pisoAplicado ? (
                <span className="mb-2 inline-flex items-center rounded-full bg-bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Piso mínimo aplicado
                </span>
              ) : null}

              <p className="pr-8 text-lg font-bold uppercase tracking-tight">
                {opcao.nome}
                {opcao.percentual !== null ? (
                  <span className="ml-1.5 text-sm font-semibold text-text-secondary">
                    ({formatPercentual(opcao.percentual)} FIPE)
                  </span>
                ) : null}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-text-secondary">
                    {zero ? "Participação no 1º evento" : "Participação"}
                  </dt>
                  <dd className="mt-1 text-xl font-bold tracking-[-0.02em]">
                    {zero ? "R$ 0" : formatBRL(opcao.valor)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-text-secondary">
                    Mensalidade do {planoSelecionado.nome}
                  </dt>
                  <dd className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold tracking-[-0.02em]">
                      {formatBRL(opcao.mensalidade)}
                    </span>
                    <span className="text-xs text-text-secondary">/mês</span>
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs leading-relaxed text-text-secondary">
                {opcao.pisoAplicado
                  ? `Piso de ${formatBRL(PRICING_CONFIG.participacaoMinima)} aplicado conforme regulamento.`
                  : opcao.descricao}
              </p>

              {opcao.carenciaDias ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Clock size={13} strokeWidth={2} aria-hidden />
                  Carência de {opcao.carenciaDias} dias para acionamento com participação zero.
                </p>
              ) : null}
            </SelectionCard>
          );
        })}
      </div>

      <Aviso titulo="Condições claras e transparentes">
        <p>
          <strong className="font-semibold text-text-primary">
            Taxa de adesão: {formatBRL(participacao.taxaAdesao)}.
          </strong>{" "}
          Valor único de filiação e ativação da proteção — não se confunde com a participação.
          Corresponde à mensalidade escolhida, com mínimo de{" "}
          {formatBRL(preco.taxaAdesaoMinima)}.
        </p>
        <p className="mt-2">
          <strong className="font-semibold text-text-primary">Participação:</strong> paga somente
          quando houver evento coberto no veículo. Piso mínimo contratual de{" "}
          {formatBRL(PRICING_CONFIG.participacaoMinima)}.
        </p>
        <p className="mt-2">{AVISO_SIMULACAO_ESTIMADA}</p>
      </Aviso>

      {/* Barra fixa com o total, conforme a tela 06 do wizard */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
        <div className="mx-auto flex max-w-wizard items-center gap-4 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-text-secondary">
              {planoSelecionado.nome}
              {participacao.percentual !== null
                ? ` · ${formatPercentual(participacao.percentual)} FIPE`
                : " · Participação zero"}
            </p>
            <p className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold tracking-[-0.02em]">
                {formatBRL(participacao.mensalidade)}
              </span>
              <span className="text-xs text-text-secondary">/mês</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => irPara("resumo")}
            className="btn-primary h-12 w-auto shrink-0 px-5 text-sm"
          >
            Ver resumo
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
