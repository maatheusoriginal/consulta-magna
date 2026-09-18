"use client";

import { CircleAlert, Info, Loader2, Mail, MessageCircle, Phone, ShieldCheck, User } from "lucide-react";
import { useState } from "react";

import { ListaCoberturas } from "@/components/ListaCoberturas";
import { postJson } from "@/lib/client-api";
import { AVISO_SIMULACAO_ESTIMADA } from "@/lib/config";
import { montarSnapshot } from "@/lib/cotacao";
import {
  formatBRL,
  formatPercentual,
  formatWhatsApp,
  isEmailValido,
  isWhatsAppValido,
} from "@/lib/format";
import type { CotacaoSnapshot } from "@/lib/leads/types";
import { useWizard } from "@/lib/wizard";

export function StepResumo() {
  const {
    veiculo,
    perfilCompleto,
    recomendado,
    planoSelecionado,
    preco,
    participacao,
    concluir,
    gerarCodigo,
    irPara,
  } = useWizard();

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  if (
    !veiculo ||
    !planoSelecionado ||
    !participacao ||
    !recomendado ||
    !preco ||
    preco.status === "UNAVAILABLE" ||
    !perfilCompleto
  ) {
    return null;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErroEnvio(null);

    // 1 e 2 — validação de nome e telefone antes de qualquer outra coisa.
    const novosErros: Record<string, string> = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe seu nome completo.";
    if (!isWhatsAppValido(whatsapp)) novosErros.whatsapp = "Informe um WhatsApp válido com DDD.";
    if (email && !isEmailValido(email)) novosErros.email = "E-mail inválido.";

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const lead = { nome: nome.trim(), whatsapp, email: email.trim() || undefined };

    // 3 — snapshot definitivo da cotação que o usuário acabou de fazer.
    const snapshot: CotacaoSnapshot = montarSnapshot({
      codigo: gerarCodigo(),
      veiculo: veiculo!,
      perfil: perfilCompleto!,
      planoRecomendado: recomendado!.plano.id,
      planoEscolhido: planoSelecionado!.id,
      participacao: participacao!,
      taxaAdesao: participacao!.taxaAdesao,
      statusPrecificacao: preco!.status,
      lead,
    });

    setEnviando(true);
    try {
      // 4 — persistir o lead. Só avançamos depois que ele foi aceito.
      await postJson("/api/lead", snapshot);
    } catch (e) {
      setErroEnvio(
        e instanceof Error
          ? e.message
          : "Não foi possível registrar seus dados agora. Tente novamente.",
      );
      return;
    } finally {
      setEnviando(false);
    }

    // 5 — só agora o WhatsApp fica disponível, montado a partir do snapshot.
    concluir(lead, snapshot);
    irPara("whatsapp");
  }

  const carencias = planoSelecionado.coberturas
    .filter((c) => c.nota)
    .map((c) => `${c.label}: ${c.nota}`)
    .join(" · ");

  return (
    <div className="animate-fade-in-up space-y-6">
      <header>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-subtle px-3 py-1.5 text-xs font-semibold text-primary">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden />
          Proposta personalizada
        </span>
        <h1 className="mt-4 text-[28px] font-bold leading-tight md:text-[36px]">
          Sua cotação está pronta
        </h1>
        <p className="mt-2 text-base text-text-secondary">
          Confira os detalhes do seu {veiculo.marca} {veiculo.modelo.split(" ")[0]}.
        </p>
      </header>

      <article className="overflow-hidden rounded-card-xl border border-border-subtle bg-white shadow-card-elevated">
        <div className="border-b border-border-subtle bg-bg-secondary p-5">
          <p className="text-sm font-semibold">
            {veiculo.marca} {veiculo.modelo} {veiculo.anoModelo}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            FIPE {formatBRL(veiculo.valor)} · cód. {veiculo.codigoFipe}
            {veiculo.mesReferencia ? ` · ref. ${veiculo.mesReferencia}` : ""}
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Plano</p>
            <p className="text-xl font-bold">{planoSelecionado.nome}</p>
          </div>

          <div className="rounded-card-lg bg-red-subtle p-5">
            <p className="text-sm font-medium text-text-secondary">Mensalidade estimada</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-semibold text-text-secondary">R$</span>
              <span className="text-[42px] font-extrabold leading-none tracking-[-0.03em]">
                {formatBRL(participacao.mensalidade).replace(/^R\$\s*/, "")}
              </span>
              <span className="text-sm font-medium text-text-secondary">/mês</span>
            </p>
            <p className="mt-2 text-xs text-text-secondary">{AVISO_SIMULACAO_ESTIMADA}</p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-border-subtle p-4">
              <dt className="text-xs font-medium text-text-secondary">Participação</dt>
              <dd className="mt-1 text-lg font-bold">
                {participacao.percentual === null ? "R$ 0" : formatBRL(participacao.valor)}
              </dd>
              <dd className="mt-1 text-xs text-text-muted">
                {participacao.percentual === null
                  ? "No 1º evento coberto · carência de 60 dias"
                  : participacao.pisoAplicado
                    ? "Piso mínimo contratual — por evento coberto"
                    : `${participacao.nome} (${formatPercentual(participacao.percentual)}) — por evento coberto`}
              </dd>
            </div>

            <div className="rounded-card border border-border-subtle p-4">
              <dt className="text-xs font-medium text-text-secondary">Taxa de adesão</dt>
              <dd className="mt-1 text-lg font-bold">{formatBRL(participacao.taxaAdesao)}</dd>
              <dd className="mt-1 text-xs text-text-muted">
                Valor único de ativação · mínimo de {formatBRL(preco.taxaAdesaoMinima)}
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-3 text-sm font-semibold">Coberturas inclusas no plano</p>
            <ListaCoberturas itens={planoSelecionado.destaques} />
          </div>

          {carencias ? (
            <div className="flex gap-3 rounded-card bg-bg-secondary p-4 text-xs text-text-secondary">
              <Info size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <span>
                <strong className="font-semibold text-text-primary">Carências:</strong> {carencias}.
              </span>
            </div>
          ) : null}
        </div>
      </article>

      <section className="rounded-card-xl border border-border-subtle bg-white p-6 shadow-card">
        <h2 className="text-xl font-bold leading-tight">Vamos continuar seu atendimento?</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Converse com um consultor pelo WhatsApp para tirar dúvidas e finalizar.
        </p>

        <form onSubmit={enviar} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="nome" className="field-label">
              Nome completo
            </label>
            <div className="relative">
              <User
                size={18}
                strokeWidth={1.8}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                placeholder="Como podemos te chamar?"
                aria-invalid={Boolean(erros.nome)}
                className="field-input pl-11"
              />
            </div>
            {erros.nome ? <p className="mt-1.5 text-sm text-primary">{erros.nome}</p> : null}
          </div>

          <div>
            <label htmlFor="whatsapp" className="field-label">
              Seu WhatsApp
            </label>
            <div className="relative">
              <Phone
                size={18}
                strokeWidth={1.8}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 90000-0000"
                aria-invalid={Boolean(erros.whatsapp)}
                className="field-input pl-11"
              />
            </div>
            {erros.whatsapp ? <p className="mt-1.5 text-sm text-primary">{erros.whatsapp}</p> : null}
          </div>

          <div>
            <label htmlFor="email" className="field-label">
              E-mail <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <div className="relative">
              <Mail
                size={18}
                strokeWidth={1.8}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="voce@email.com"
                aria-invalid={Boolean(erros.email)}
                className="field-input pl-11"
              />
            </div>
            {erros.email ? <p className="mt-1.5 text-sm text-primary">{erros.email}</p> : null}
          </div>

          {erroEnvio ? (
            <p className="flex items-center gap-1.5 text-sm text-primary" role="alert">
              <CircleAlert size={15} strokeWidth={1.8} aria-hidden />
              {erroEnvio}
            </p>
          ) : null}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
            <ShieldCheck size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" aria-hidden />
            Seus dados estão protegidos e são usados apenas para este atendimento.
          </p>

          <button type="submit" disabled={enviando} className="btn-whatsapp">
            {enviando ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden />
                Conectando ao consultor…
              </>
            ) : (
              <>
                <MessageCircle size={18} strokeWidth={2} aria-hidden />
                Continuar pelo WhatsApp
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
