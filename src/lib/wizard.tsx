"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { gerarCodigoSimulacao } from "./cotacao";
import type { CotacaoSnapshot } from "./leads/types";
import { getPlano, PLANOS } from "./planos";
import { pricingProvider } from "./pricing";
import type {
  ParticipacaoPrecificada,
  PrecoDisponivel,
  ResultadoPrecificacao,
} from "./pricing/types";
import { recomendarPlano, type Recomendacao } from "./recomendacao";
import {
  categoriaDoTipo,
  type FipeVeiculo,
  type Lead,
  type ParticipacaoId,
  type PerfilRespostas,
  type Plano,
  type PlanoId,
} from "./types";

export const ETAPAS = ["Veículo", "Perfil", "Plano", "Cotação"] as const;

/** Telas do wizard, na ordem. `etapa` mapeia cada tela para a barra de progresso. */
export const TELAS = [
  { id: "veiculo", etapa: 0 },
  { id: "perfil", etapa: 1 },
  { id: "plano", etapa: 2 },
  { id: "comparar", etapa: 2 },
  { id: "participacao", etapa: 2 },
  { id: "resumo", etapa: 3 },
  { id: "whatsapp", etapa: 3 },
] as const;

export type TelaId = (typeof TELAS)[number]["id"];

interface EstadoWizard {
  tela: TelaId;
  veiculo: FipeVeiculo | null;
  perfil: Partial<PerfilRespostas>;
  planoId: PlanoId | null;
  participacaoId: ParticipacaoId;
  lead: Lead | null;
  snapshot: CotacaoSnapshot | null;
}

const ESTADO_INICIAL: EstadoWizard = {
  tela: "veiculo",
  veiculo: null,
  perfil: {},
  planoId: null,
  participacaoId: "padrao",
  lead: null,
  snapshot: null,
};

const CHAVE_STORAGE = "magna:cotacao";

function perfilCompleto(perfil: Partial<PerfilRespostas>): perfil is PerfilRespostas {
  return (
    !!perfil.finalidade &&
    !!perfil.prioridade &&
    !!perfil.viagens &&
    !!perfil.carroReserva &&
    !!perfil.terceiros &&
    !!perfil.vidros
  );
}

function precoDisponivel(preco: ResultadoPrecificacao | null): preco is PrecoDisponivel {
  return preco !== null && preco.status !== "UNAVAILABLE";
}

interface ContextoWizard extends EstadoWizard {
  hidratado: boolean;
  /** Perfil já validado, ou `null` enquanto o questionário estiver incompleto. */
  perfilCompleto: PerfilRespostas | null;
  /** Plano sugerido pelo questionário (independe da escolha do usuário). */
  recomendado: Recomendacao | null;
  /** Plano efetivamente escolhido — cai para o recomendado enquanto não houver escolha. */
  planoSelecionado: Plano | null;
  /** Resultado do PricingProvider para o plano selecionado. */
  preco: ResultadoPrecificacao | null;
  /** Mensalidade por plano, para a tela de comparação. `null` quando indisponível. */
  precosPorPlano: Record<PlanoId, number | null>;
  participacao: ParticipacaoPrecificada | null;
  participacoes: ParticipacaoPrecificada[];
  irPara: (tela: TelaId) => void;
  voltar: () => void;
  setVeiculo: (veiculo: FipeVeiculo | null) => void;
  setPerfil: (parcial: Partial<PerfilRespostas>) => void;
  setPlano: (id: PlanoId) => void;
  setParticipacao: (id: ParticipacaoId) => void;
  concluir: (lead: Lead, snapshot: CotacaoSnapshot) => void;
  gerarCodigo: () => string;
  reiniciar: () => void;
}

const Contexto = createContext<ContextoWizard | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoWizard>(ESTADO_INICIAL);
  const [hidratado, setHidratado] = useState(false);

  // Restaura a sessão para que o usuário possa voltar sem perder as escolhas.
  useEffect(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_STORAGE);
      if (bruto) setEstado({ ...ESTADO_INICIAL, ...(JSON.parse(bruto) as EstadoWizard) });
    } catch {
      // sessionStorage indisponível (modo privado, por exemplo): seguimos em memória.
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      sessionStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado));
    } catch {
      // Ignorado de propósito: persistir é uma conveniência, não um requisito.
    }
  }, [estado, hidratado]);

  const irPara = useCallback((tela: TelaId) => {
    setEstado((atual) => ({ ...atual, tela }));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const voltar = useCallback(() => {
    setEstado((atual) => {
      const indice = TELAS.findIndex((t) => t.id === atual.tela);
      // "Comparar" e "Participação" são ramificações da tela de plano.
      if (atual.tela === "comparar" || atual.tela === "participacao") {
        return { ...atual, tela: "plano" };
      }
      return { ...atual, tela: TELAS[Math.max(0, indice - 1)].id };
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const setVeiculo = useCallback((veiculo: FipeVeiculo | null) => {
    setEstado((atual) => ({ ...atual, veiculo }));
  }, []);

  const setPerfil = useCallback((parcial: Partial<PerfilRespostas>) => {
    setEstado((atual) => ({ ...atual, perfil: { ...atual.perfil, ...parcial } }));
  }, []);

  const setPlano = useCallback((planoId: PlanoId) => {
    setEstado((atual) => ({ ...atual, planoId }));
  }, []);

  const setParticipacao = useCallback((participacaoId: ParticipacaoId) => {
    setEstado((atual) => ({ ...atual, participacaoId }));
  }, []);

  const concluir = useCallback((lead: Lead, snapshot: CotacaoSnapshot) => {
    setEstado((atual) => ({ ...atual, lead, snapshot }));
  }, []);

  const gerarCodigo = useCallback(() => gerarCodigoSimulacao(), []);

  const reiniciar = useCallback(() => {
    setEstado(ESTADO_INICIAL);
    try {
      sessionStorage.removeItem(CHAVE_STORAGE);
    } catch {
      // Ignorado: ver comentário acima.
    }
  }, []);

  const valor = useMemo<ContextoWizard>(() => {
    const perfil = estado.perfil;
    const completo = perfilCompleto(perfil);

    // O plano recomendado sai apenas do questionário: a finalidade (particular
    // ou aplicativo/táxi) não entra nesta decisão.
    const recomendado = completo
      ? recomendarPlano({
          prioridade: perfil.prioridade,
          viagens: perfil.viagens,
          carroReserva: perfil.carroReserva,
          terceiros: perfil.terceiros,
          vidros: perfil.vidros,
        })
      : null;

    const planoSelecionado = estado.planoId
      ? getPlano(estado.planoId)
      : (recomendado?.plano ?? null);

    const veiculo = estado.veiculo;
    const usoComercial = perfil.finalidade === "aplicativo";

    const precificar = (planoId: PlanoId): ResultadoPrecificacao | null =>
      veiculo
        ? pricingProvider.precificar({
            categoria: categoriaDoTipo(veiculo.tipo),
            valorFipe: veiculo.valor,
            planoId,
            usoComercial,
          })
        : null;

    const preco = planoSelecionado ? precificar(planoSelecionado.id) : null;

    const precosPorPlano = PLANOS.reduce(
      (acc, plano) => {
        const resultado = precificar(plano.id);
        acc[plano.id] = precoDisponivel(resultado) ? resultado.mensalidadeBase : null;
        return acc;
      },
      {} as Record<PlanoId, number | null>,
    );

    const participacoes = precoDisponivel(preco) ? preco.participacoes : [];
    const participacao =
      participacoes.find((p) => p.id === estado.participacaoId) ?? participacoes[0] ?? null;

    return {
      ...estado,
      hidratado,
      perfilCompleto: completo ? perfil : null,
      recomendado,
      planoSelecionado,
      preco,
      precosPorPlano,
      participacao,
      participacoes,
      irPara,
      voltar,
      setVeiculo,
      setPerfil,
      setPlano,
      setParticipacao,
      concluir,
      gerarCodigo,
      reiniciar,
    };
  }, [
    estado,
    hidratado,
    irPara,
    voltar,
    setVeiculo,
    setPerfil,
    setPlano,
    setParticipacao,
    concluir,
    gerarCodigo,
    reiniciar,
  ]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useWizard(): ContextoWizard {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useWizard precisa estar dentro de <WizardProvider>.");
  return contexto;
}
