"use client";

import {
  CircleAlert,
  CreditCard,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { useState } from "react";

import { Aviso } from "@/components/Aviso";
import { ListaCoberturas } from "@/components/ListaCoberturas";
import { postJson } from "@/lib/client-api";
import { AVISO_SIMULACAO_ESTIMADA, URL_POLITICA_PRIVACIDADE } from "@/lib/config";
import type { PrecificacaoDaCotacao } from "@/lib/cotacao";
import {
  formatBRL,
  formatPercentual,
  formatPlaca,
  formatWhatsApp,
  isEmailValido,
  isPlacaValida,
  isWhatsAppValido,
  normalizePlaca,
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
    semPrecificacao,
    placa,
    setPlaca,
    concluir,
    irPara,
  } = useWizard();

  const [nome, setNome] = useState("");
  const [placaDigitada, setPlacaDigitada] = useState(placa);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // Consentimento começa SEMPRE desmarcado — nada de opt-in silencioso.
  const [consentimento, setConsentimento] = useState(false);

  // Veículo sem regra de precificação também captura lead: só não tem valores.
  const precificacao: PrecificacaoDaCotacao | null =
    preco && preco.status !== "UNAVAILABLE" && planoSelecionado && participacao && recomendado
      ? {
          status: preco.status,
          planoRecomendado: recomendado.plano.id,
          planoEscolhido: planoSelecionado.id,
          participacao,
          taxaAdesao: participacao.taxaAdesao,
        }
      : null;

  if (!veiculo || (!precificacao && !semPrecificacao)) return null;

  const placaFinal = normalizePlaca(placaDigitada || placa);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErroEnvio(null);

    // 1 — validação local (o servidor revalida tudo de novo).
    const novosErros: Record<string, string> = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe seu nome completo.";
    if (!isWhatsAppValido(whatsapp)) novosErros.whatsapp = "Informe um WhatsApp válido com DDD.";
    if (email && !isEmailValido(email)) novosErros.email = "E-mail inválido.";
    if (!isPlacaValida(placaFinal)) {
      novosErros.placa = "Informe a placa do veículo (ABC1234 ou ABC1D23).";
    }
    if (!consentimento) {
      novosErros.consentimento = "É necessário concordar com o uso dos dados para continuar.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    // A placa fica guardada no wizard antes de seguir.
    setPlaca(placaFinal);

    const lead = { nome: nome.trim(), whatsapp, email: email.trim() || undefined };

    // 2 — enviamos apenas DADOS DE ENTRADA. Mensalidade, participação, adesão,
    // plano recomendado e status são recalculados no servidor: nada que o
    // navegador calcule é aceito como verdade.
    const solicitacao = {
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      email: lead.email,
      placa: placaFinal,
      consentimento: true,
      veiculo: {
        tipo: veiculo!.tipo,
        marca: veiculo!.marca,
        modelo: veiculo!.modelo,
        anoModelo: veiculo!.anoModelo,
        combustivel: veiculo!.combustivel,
        codigoFipe: veiculo!.codigoFipe,
        valor: veiculo!.valor,
        mesReferencia: veiculo!.mesReferencia,
        marcaCodigo: veiculo!.marcaCodigo,
        modeloCodigo: veiculo!.modeloCodigo,
        anoCodigo: veiculo!.anoCodigo,
      },
      perfil: precificacao ? perfilCompleto : null,
      planoEscolhido: precificacao ? precificacao.planoEscolhido : null,
      participacaoId: precificacao ? precificacao.participacao.id : null,
    };

    setEnviando(true);
    let resposta: { snapshot: CotacaoSnapshot };
    try {
      // 3 — persistir o lead. Só avançamos depois que ele foi aceito.
      resposta = await postJson<{ snapshot: CotacaoSnapshot }>("/api/lead", solicitacao);
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

    // 4 — a tela final e o WhatsApp usam o snapshot DO SERVIDOR, não o local.
    concluir(lead, resposta.snapshot);
    irPara("whatsapp");
  }

  const podeConcluir =
    nome.trim().length >= 2 &&
    isWhatsAppValido(whatsapp) &&
    isPlacaValida(placaFinal) &&
    consentimento &&
    (!email || isEmailValido(email));

  const carencias = (planoSelecionado?.coberturas ?? [])
    .filter((c) => c.nota)
    .map((c) => `${c.label}: ${c.nota}`)
    .join(" · ");

  return (
    <div className="animate-fade-in-up space-y-6">
      <header>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-subtle px-3 py-1.5 text-xs font-semibold text-primary">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden />
          {precificacao ? "Proposta personalizada" : "Análise individual"}
        </span>
        <h1 className="mt-4 text-[28px] font-bold leading-tight md:text-[36px]">
          {precificacao ? "Sua cotação está pronta" : "Vamos preparar sua cotação"}
        </h1>
        <p className="mt-2 text-base text-text-secondary">
          {precificacao
            ? `Confira os detalhes do seu ${veiculo.marca} ${veiculo.modelo.split(" ")[0]}.`
            : "Informe a placa e seus dados de contato para um consultor montar a cotação deste veículo."}
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
          {isPlacaValida(placaFinal) ? (
            <p className="mt-2 text-sm font-semibold">Placa {formatPlaca(placaFinal)}</p>
          ) : null}
        </div>

        {precificacao ? (
        <div className="space-y-5 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Plano</p>
            <p className="text-xl font-bold">{planoSelecionado?.nome}</p>
          </div>

          <div className="rounded-card-lg bg-red-subtle p-5">
            <p className="text-sm font-medium text-text-secondary">Mensalidade estimada</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-semibold text-text-secondary">R$</span>
              <span className="text-[42px] font-extrabold leading-none tracking-[-0.03em]">
                {formatBRL(precificacao.participacao.mensalidade).replace(/^R\$\s*/, "")}
              </span>
              <span className="text-sm font-medium text-text-secondary">/mês</span>
            </p>
            <p className="mt-2 text-xs text-text-secondary">{AVISO_SIMULACAO_ESTIMADA}</p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-border-subtle p-4">
              <dt className="text-xs font-medium text-text-secondary">Participação</dt>
              <dd className="mt-1 text-lg font-bold">
                {precificacao.participacao.percentual === null
                  ? "R$ 0"
                  : formatBRL(precificacao.participacao.valor)}
              </dd>
              <dd className="mt-1 text-xs text-text-muted">
                {precificacao.participacao.percentual === null
                  ? "No 1º evento coberto · carência de 60 dias"
                  : precificacao.participacao.pisoAplicado
                    ? "Piso mínimo contratual — por evento coberto"
                    : `${precificacao.participacao.nome} (${formatPercentual(precificacao.participacao.percentual)}) — por evento coberto`}
              </dd>
            </div>

            <div className="rounded-card border border-border-subtle p-4">
              <dt className="text-xs font-medium text-text-secondary">Taxa de adesão</dt>
              <dd className="mt-1 text-lg font-bold">{formatBRL(precificacao.taxaAdesao)}</dd>
              <dd className="mt-1 text-xs text-text-muted">
                Valor único de ativação · mínimo de{" "}
                {formatBRL(preco && preco.status !== "UNAVAILABLE" ? preco.taxaAdesaoMinima : 300)}
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-3 text-sm font-semibold">Coberturas inclusas no plano</p>
            <ListaCoberturas itens={planoSelecionado?.destaques ?? []} />
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
        ) : (
          <div className="space-y-4 p-5">
            <Aviso titulo="Este veículo precisa de uma análise individual">
              Não temos precificação automática para esta categoria. Um consultor Magna monta a
              cotação manualmente a partir dos dados abaixo.
            </Aviso>
          </div>
        )}
      </article>

      <section className="rounded-card-xl border border-border-subtle bg-white p-6 shadow-card">
        <h2 className="text-xl font-bold leading-tight">Vamos continuar seu atendimento?</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Converse com um consultor pelo WhatsApp para tirar dúvidas e finalizar.
        </p>

        <form onSubmit={enviar} noValidate className="mt-6 space-y-4">
          {/* A placa é obrigatória para o consultor. Quem entrou pela busca
              manual informa aqui; quem veio pela placa já tem o campo preenchido. */}
          {isPlacaValida(placa) ? null : (
            <div>
              <label htmlFor="placa-resumo" className="field-label">
                Placa do veículo
              </label>
              <div className="relative">
                <CreditCard
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  id="placa-resumo"
                  value={placaDigitada}
                  onChange={(e) => setPlacaDigitada(normalizePlaca(e.target.value))}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={10}
                  placeholder="ABC1D23"
                  aria-invalid={Boolean(erros.placa)}
                  className="field-input pl-11 tracking-[0.18em]"
                />
              </div>
              {erros.placa ? <p className="mt-1.5 text-sm text-primary">{erros.placa}</p> : null}
            </div>
          )}

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

          <div>
            <label
              htmlFor="consentimento"
              className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-text-secondary"
            >
              <input
                id="consentimento"
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                aria-invalid={Boolean(erros.consentimento)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-input accent-primary"
              />
              <span>
                Concordo com o uso dos meus dados para dar continuidade a este atendimento.
                {URL_POLITICA_PRIVACIDADE ? (
                  <>
                    {" "}
                    <a
                      href={URL_POLITICA_PRIVACIDADE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      Política de Privacidade
                    </a>
                    .
                  </>
                ) : null}
              </span>
            </label>
            {erros.consentimento ? (
              <p className="mt-1.5 text-sm text-primary">{erros.consentimento}</p>
            ) : null}
          </div>

          <button type="submit" disabled={enviando || !podeConcluir} className="btn-whatsapp">
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
