"use client";

import { Check, MessageCircle, RotateCcw, ShieldCheck } from "lucide-react";

import { linkWhatsApp } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { montarMensagemWhatsApp } from "@/lib/mensagem";
import { TAXA_ADESAO } from "@/lib/planos";
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
  const { veiculo, planoSelecionado, participacao, codigo, lead, reiniciar, irPara } = useWizard();

  if (!veiculo || !planoSelecionado || !participacao || !codigo) return null;

  const mensagem = montarMensagemWhatsApp({
    codigo,
    veiculo,
    plano: planoSelecionado,
    participacao,
    taxaAdesao: TAXA_ADESAO,
    lead,
  });

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
          Continue o atendimento pelo WhatsApp{lead?.nome ? `, ${lead.nome.split(" ")[0]}` : ""}.
        </p>
      </header>

      <article className="rounded-card-xl border border-border-subtle bg-white p-6 shadow-card">
        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Código da simulação</dt>
            <dd className="font-semibold">#{codigo}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Veículo</dt>
            <dd className="text-right font-semibold">
              {veiculo.marca} {veiculo.modelo.split(" ")[0]} {veiculo.anoModelo}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Valor FIPE</dt>
            <dd className="font-semibold">{formatBRL(veiculo.valor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Plano</dt>
            <dd className="font-semibold">{planoSelecionado.nome}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Participação</dt>
            <dd className="text-right font-semibold">
              {participacao.percentual === null ? "R$ 0 no 1º evento" : formatBRL(participacao.valor)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">Taxa de adesão</dt>
            <dd className="font-semibold">{formatBRL(TAXA_ADESAO)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-border-subtle pt-5">
          <p className="text-sm font-semibold">Mensalidade</p>
          <p className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold tracking-[-0.03em]">
              {formatBRL(participacao.mensalidade)}
            </span>
            <span className="text-sm text-text-secondary">/mês</span>
          </p>
        </div>
      </article>

      <a
        href={linkWhatsApp(mensagem)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-whatsapp"
      >
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
        Ambiente seguro · Atendimento Magna
      </p>
    </div>
  );
}
