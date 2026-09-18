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

import { calcularMensalidadeBase, calcularParticipacao, getModalidade, getPlano } from "./planos";
import { recomendarPlano } from "./recomendacao";
import type {
  FipeVeiculo,
  Lead,
  ParticipacaoId,
  PerfilRespostas,
  PlanoId,
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
  codigo: string | null;
}

const ESTADO_INICIAL: EstadoWizard = {
  tela: "veiculo",
  veiculo: null,
  perfil: {},
  planoId: null,
  participacaoId: "padrao",
  lead: null,
  codigo: null,
};

const CHAVE_STORAGE = "magna:cotacao";

function gerarCodigo(): string {
  return `MG-${Math.floor(10_000 + Math.random() * 89_999)}`;
}

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

interface ContextoWizard extends EstadoWizard {
  hidratado: boolean;
  /** Plano sugerido pelo questionário (independe da escolha do usuário). */
  recomendado: ReturnType<typeof recomendarPlano> | null;
  /** Plano efetivamente escolhido — cai para o recomendado enquanto não houver escolha. */
  planoSelecionado: ReturnType<typeof getPlano> | null;
  mensalidadeBase: number;
  participacao: ReturnType<typeof calcularParticipacao> | null;
  irPara: (tela: TelaId) => void;
  voltar: () => void;
  setVeiculo: (veiculo: FipeVeiculo | null) => void;
  setPerfil: (parcial: Partial<PerfilRespostas>) => void;
  setPlano: (id: PlanoId) => void;
  setParticipacao: (id: ParticipacaoId) => void;
  setLead: (lead: Lead) => void;
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
      // "Comparar" é uma ramificação da tela de plano: voltar retorna para ela.
      if (atual.tela === "comparar") return { ...atual, tela: "plano" };
      if (atual.tela === "participacao") return { ...atual, tela: "plano" };
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

  const setLead = useCallback((lead: Lead) => {
    setEstado((atual) => ({ ...atual, lead, codigo: atual.codigo ?? gerarCodigo() }));
  }, []);

  const reiniciar = useCallback(() => {
    setEstado(ESTADO_INICIAL);
    try {
      sessionStorage.removeItem(CHAVE_STORAGE);
    } catch {
      // Ignorado: ver comentário acima.
    }
  }, []);

  const valor = useMemo<ContextoWizard>(() => {
    const recomendado = perfilCompleto(estado.perfil) ? recomendarPlano(estado.perfil) : null;
    const planoSelecionado = estado.planoId
      ? getPlano(estado.planoId)
      : (recomendado?.plano ?? null);

    const valorFipe = estado.veiculo?.valor ?? 0;
    const mensalidadeBase =
      planoSelecionado && valorFipe > 0 ? calcularMensalidadeBase(planoSelecionado, valorFipe) : 0;
    const participacao =
      mensalidadeBase > 0
        ? calcularParticipacao(getModalidade(estado.participacaoId), valorFipe, mensalidadeBase)
        : null;

    return {
      ...estado,
      hidratado,
      recomendado,
      planoSelecionado,
      mensalidadeBase,
      participacao,
      irPara,
      voltar,
      setVeiculo,
      setPerfil,
      setPlano,
      setParticipacao,
      setLead,
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
    setLead,
    reiniciar,
  ]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useWizard(): ContextoWizard {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useWizard precisa estar dentro de <WizardProvider>.");
  return contexto;
}
