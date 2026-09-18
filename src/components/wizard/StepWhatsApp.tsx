"use client";

import { Check, MessageCircle, RotateCcw, ShieldCheck } from "lucide-react";

import { AVISO_SIMULACAO_ESTIMADA } from "@/lib/config";
import { formatBRL, formatPlaca } from "@/lib/format";
import { whatsAppService } from "@/lib/whatsapp";
import { useWizard } from "@/lib/wizard";

const PASSOS = [
  {
    titulo: "Fale com o consultor Magna",
    texto: "Confirme os detalhes da simulação e tire suas dúvidas.",
  },
  {
    titulo: "Confirme os dados",
    texto: "O consultor orientará sobre os dados e procedimentos necessários.",
  },
  {
    titulo: "Continue a contratação",
    texto: "Siga as orientações fornecidas pelo consultor.",
  },
];

export function StepWhatsApp() {
  const { snapshot, planoSelecionado, reiniciar, irPara } = useWizard();

  if (!snapshot || !planoSelecionado) return null;

  // Link montado a partir do snapshot definitivo — nada fixo no código.
  const linkWhatsApp = whatsAppService.montarLink(snapshot);

  return (
    <div className="animate-fade-in-up space-y-6">
      <header className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-subtle">
          <Check size={26} strokeWidth={2.5} className="text-primary" aria-hidden />
        </span>
        <h1 className="mt-5 text-[28px] font-bold leading-tight md:text-[36px]">
          Sua simulação está pronta
        </h1>
        <p className="mt-2 text-base text-text-secondary">
          Continue o atendimento pelo WhatsApp, {snapshot.nome.split(" ")[0]}.
        </p>
      </header>

      <article className="rounded-card-xl border border-border-subtle bg-white p-6 shadow-card">
        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Código da simulação</dt>
            <dd className="font-semibold">#{snapshot.codigo}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Placa</dt>
            <dd className="font-semibold">{formatPlaca(snapshot.placa)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Veículo</dt>
            <dd className="text-right font-semibold">
              {snapshot.marca} {snapshot.modelo.split(" ")[0]} {snapshot.ano}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Valor FIPE</dt>
            <dd className="font-semibold">{formatBRL(snapshot.valorFipe)}</dd>
          </div>
          {snapshot.usoDeclarado ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-secondary">Uso</dt>
              <dd className="font-semibold">{snapshot.usoDeclarado}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Plano</dt>
            <dd className="font-semibold">{planoSelecionado.nome}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Participação</dt>
            <dd className="text-right font-semibold">
              {snapshot.percentualParticipacao === null
                ? "R$ 0 no 1º evento"
                : formatBRL(snapshot.valorParticipacao)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Taxa de adesão</dt>
            <dd className="font-semibold">{formatBRL(snapshot.adesao)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-border-subtle pt-5">
          <p className="text-sm font-semibold">Mensalidade</p>
          <p className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold tracking-[-0.03em]">
              {formatBRL(snapshot.mensalidade)}
            </span>
            <span className="text-sm text-text-secondary">/mês</span>
          </p>
        </div>

        {snapshot.statusPrecificacao === "ESTIMATED" ? (
          <p className="mt-3 text-xs text-text-muted">{AVISO_SIMULACAO_ESTIMADA}</p>
        ) : null}
      </article>

      <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
        <MessageCircle size={18} strokeWidth={2} aria-hidden />
        Abrir conversa no WhatsApp
      </a>

      <section>
        <h2 className="text-base font-semibold">Próximos passos</h2>
        <ol className="mt-4 space-y-4">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-subtle text-xs font-bold text-primary">
                {indice + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold">{passo.titulo}</span>
                <span className="mt-0.5 block text-sm text-text-secondary">{passo.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-3 border-t border-border-subtle pt-6">
        <button type="button" onClick={() => irPara("resumo")} className="btn-secondary">
          Rever a cotação
        </button>
        <button
          type="button"
          onClick={() => {
            reiniciar();
            window.scrollTo({ top: 0 });
          }}
          className="btn-ghost w-full"
        >
          <RotateCcw size={16} strokeWidth={1.8} aria-hidden />
          Fazer uma nova cotação
        </button>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
        <ShieldCheck size={14} strokeWidth={1.8} aria-hidden />
        Atendimento Magna
      </p>
    </div>
  );
}
