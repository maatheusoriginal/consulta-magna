import {
  BadgeCheck,
  Car,
  CircleCheck,
  GitCompareArrows,
  MessageCircle,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { Aviso } from "@/components/Aviso";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PlacaHeroForm } from "@/components/PlacaHeroForm";
import { Preco } from "@/components/Preco";
import { formatBRL } from "@/lib/format";
import { PLANOS, TAXA_ADESAO, calcularPrecos } from "@/lib/planos";

const BENEFICIOS = [
  {
    icone: SlidersHorizontal,
    titulo: "Cotação personalizada",
    texto: "Adequada às suas necessidades e preferências.",
  },
  {
    icone: GitCompareArrows,
    titulo: "Compare diferentes planos",
    texto: "Opções claras para você escolher com tranquilidade.",
  },
  {
    icone: MessageCircle,
    titulo: "Continue o atendimento pelo WhatsApp",
    texto: "Tire dúvidas e finalize com praticidade.",
  },
];

const PASSOS = [
  {
    titulo: "Identifique o veículo",
    texto: "Informe a placa ou escolha marca, modelo e ano. Buscamos o valor na tabela FIPE.",
  },
  {
    titulo: "Conte o que importa para você",
    texto: "Cinco perguntas rápidas sobre como você usa o veículo e o que quer proteger.",
  },
  {
    titulo: "Receba e compare",
    texto: "Mostramos o plano indicado, os outros três e o efeito de cada participação.",
  },
  {
    titulo: "Continue pelo WhatsApp",
    texto: "Só pedimos seus dados depois da cotação pronta, para falar com um consultor.",
  },
];

const DUVIDAS = [
  {
    pergunta: "Qual a diferença entre adesão e participação?",
    resposta: `A adesão é um valor único de filiação e ativação da proteção, a partir de ${formatBRL(TAXA_ADESAO)}. A participação é o valor pago apenas quando há um evento coberto, com piso mínimo contratual de ${formatBRL(1800)}.`,
  },
  {
    pergunta: "De onde vem o valor FIPE mostrado na cotação?",
    resposta:
      "Consultamos a tabela FIPE oficial em tempo real por APIs públicas e gratuitas, sempre no mês de referência mais recente. O código FIPE do veículo aparece na tela para você conferir.",
  },
  {
    pergunta: "Existe carência?",
    resposta:
      "Sim, e mostramos todas: carro reserva e vidros têm 7 dias de carência. A modalidade de participação zero tem 60 dias de carência para acionamento.",
  },
  {
    pergunta: "Preciso informar meus dados para ver o preço?",
    resposta:
      "Não. A cotação completa aparece antes de qualquer cadastro. Nome e WhatsApp só são pedidos se você quiser continuar o atendimento com um consultor.",
  },
];

/** Valor de referência só para ilustrar os preços na vitrine da home. */
const FIPE_EXEMPLO = 28436;

export default function Home() {
  const precos = calcularPrecos(FIPE_EXEMPLO);
  const ouro = PLANOS.find((p) => p.id === "ouro")!;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-compare px-5 py-12 md:px-8 md:py-20">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-secondary">
                <BadgeCheck size={14} strokeWidth={1.8} className="text-primary" aria-hidden />
                Gratuito e sem compromisso
              </span>

              <h1 className="mt-6 text-[34px] font-bold leading-[1.1] md:text-[52px]">
                A proteção sob medida
                <br />
                para o seu veículo.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
                Consulte seu veículo, conte o que é importante para você e encontre uma opção de
                proteção adequada ao seu perfil.
              </p>

              <div className="mt-8 rounded-card-xl border border-border-subtle bg-white p-6 shadow-card-elevated lg:max-w-md">
                <div className="mb-5 flex items-center gap-2">
                  <Car size={18} strokeWidth={1.8} className="text-primary" aria-hidden />
                  <p className="text-base font-semibold">Identificação do veículo</p>
                </div>
                <PlacaHeroForm />
              </div>

              <ul className="mt-10 grid gap-6 sm:grid-cols-3">
                {BENEFICIOS.map(({ icone: Icone, titulo, texto }) => (
                  <li key={titulo}>
                    <Icone size={20} strokeWidth={1.8} className="text-primary" aria-hidden />
                    <p className="mt-3 text-sm font-semibold">{titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{texto}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mockup da própria interface, conforme DESIGN.md §14 */}
            <div
              aria-hidden
              className="hidden space-y-4 rounded-card-xl bg-bg-secondary p-6 lg:block"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Cotação instantânea
              </p>

              <div className="card rounded-card-lg p-5">
                <div className="flex items-center gap-2">
                  <CircleCheck size={16} strokeWidth={1.8} className="text-primary" />
                  <p className="text-xs font-semibold text-text-secondary">Veículo localizado</p>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Volkswagen
                </p>
                <p className="text-xl font-bold leading-tight">Gol 1.0 Total Flex 8V 5p</p>
                <p className="mt-1 text-sm text-text-secondary">2013 · Gasolina/Etanol</p>
                <div className="mt-4 rounded-card bg-bg-secondary p-4">
                  <p className="text-xs font-medium text-text-secondary">Valor de referência FIPE</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-[-0.03em]">
                    {formatBRL(FIPE_EXEMPLO)}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">Cód. FIPE 005324-4</p>
                </div>
              </div>

              <div className="rounded-card-lg border-2 border-primary bg-white p-5 shadow-card-primary">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Recomendado para você
                </span>
                <p className="mt-3 text-lg font-bold">Plano {ouro.nome}</p>
                <Preco valor={precos.ouro} tamanho="md" className="mt-1" />
                <ul className="mt-4 space-y-2">
                  {ouro.destaques.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-2 text-xs text-text-secondary">
                      <CircleCheck size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="border-t border-border-subtle bg-bg-secondary">
          <div className="mx-auto max-w-compare px-5 py-16 md:px-8 md:py-20">
            <h2 className="text-[28px] font-bold leading-tight md:text-[40px]">Como funciona</h2>
            <p className="mt-3 max-w-2xl text-base text-text-secondary">
              Quatro etapas curtas, uma decisão por tela e nenhum dado pedido antes da hora.
            </p>

            <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {PASSOS.map((passo, indice) => (
                <li key={passo.titulo} className="card rounded-card-lg p-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-subtle text-sm font-bold text-primary">
                    {indice + 1}
                  </span>
                  <p className="mt-4 text-base font-semibold">{passo.titulo}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{passo.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="mx-auto max-w-compare px-5 py-16 md:px-8 md:py-20">
          <h2 className="text-[28px] font-bold leading-tight md:text-[40px]">Planos e coberturas</h2>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Valores de exemplo para um veículo com FIPE de {formatBRL(FIPE_EXEMPLO)}. Na cotação, a
            mensalidade é calculada sobre a FIPE real do seu veículo.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLANOS.map((plano) => {
              const recomendado = plano.id === "ouro";
              return (
                <article
                  key={plano.id}
                  className={`flex flex-col rounded-card-lg border bg-white p-6 ${
                    recomendado
                      ? "border-2 border-primary shadow-card-primary"
                      : "border-border-subtle shadow-card"
                  }`}
                >
                  {recomendado ? (
                    <span className="mb-3 inline-flex w-fit items-center rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Mais escolhido
                    </span>
                  ) : null}
                  <p className="text-xl font-bold">{plano.nome}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {plano.subtitulo}
                  </p>
                  <Preco valor={precos[plano.id]} tamanho="sm" className="mt-4" />
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    {plano.descricao}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plano.destaques.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-text-secondary">
                        <CircleCheck
                          size={16}
                          strokeWidth={1.8}
                          className="mt-0.5 shrink-0 text-primary"
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="mt-8">
            <Aviso titulo="Adesão e participação são coisas diferentes">
              A taxa de adesão é única, a partir de {formatBRL(TAXA_ADESAO)}. A participação só é
              paga quando houver um evento coberto e tem piso mínimo de {formatBRL(1800)}.
            </Aviso>
          </div>

          <div className="mt-10 flex justify-center">
            <Link href="/cotacao" className="btn-primary max-w-sm">
              Fazer minha cotação
            </Link>
          </div>
        </section>

        {/* Dúvidas */}
        <section id="duvidas" className="border-t border-border-subtle bg-bg-secondary">
          <div className="mx-auto max-w-wizard px-5 py-16 md:py-20">
            <h2 className="text-[28px] font-bold leading-tight md:text-[40px]">Dúvidas frequentes</h2>
            <div className="mt-8 space-y-3">
              {DUVIDAS.map((item) => (
                <details key={item.pergunta} className="card group rounded-card-lg p-5">
                  <summary className="cursor-pointer list-none text-base font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {item.pergunta}
                      <span className="text-primary transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{item.resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-wizard px-5 py-16 text-center">
          <ShieldCheck size={28} strokeWidth={1.6} className="mx-auto text-primary" aria-hidden />
          <h2 className="mt-4 text-[26px] font-bold leading-tight md:text-[34px]">
            Faça sua cotação em menos de 2 minutos
          </h2>
          <p className="mt-3 text-base text-text-secondary">
            Sem cadastro para ver o preço. Sem ligações insistentes.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/cotacao" className="btn-primary max-w-sm">
              Começar agora
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
