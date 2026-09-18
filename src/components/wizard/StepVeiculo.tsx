"use client";

import { ArrowRight, Car, CircleAlert, CircleCheck, Loader2, PenLine, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Select } from "@/components/Select";
import { getJson } from "@/lib/client-api";
import { formatBRL, formatPlaca, isPlacaValida, normalizePlaca, titleCase } from "@/lib/format";
import type { FipeItem, FipeVeiculo, TipoVeiculo } from "@/lib/types";
import { useWizard } from "@/lib/wizard";

interface RespostaPlaca {
  configurado: boolean;
  dados?: { marca?: string; modelo?: string; ano?: number };
  sugestao?: { tipo: TipoVeiculo; marca?: FipeItem; modelo?: FipeItem; ano?: FipeItem };
}

const TIPOS: Array<{ id: TipoVeiculo; label: string }> = [
  { id: "carros", label: "Carro" },
  { id: "motos", label: "Moto" },
  { id: "caminhoes", label: "Caminhão" },
];

export function StepVeiculo({
  placaInicial = "",
  modoInicial = "placa",
}: {
  placaInicial?: string;
  modoInicial?: "placa" | "manual";
}) {
  const { veiculo, setVeiculo, irPara } = useWizard();

  const [modo, setModo] = useState<"placa" | "manual">(modoInicial);
  const [placa, setPlaca] = useState(normalizePlaca(placaInicial));
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);

  const [tipo, setTipo] = useState<TipoVeiculo>("carros");
  const [marcas, setMarcas] = useState<FipeItem[]>([]);
  const [modelos, setModelos] = useState<FipeItem[]>([]);
  const [anos, setAnos] = useState<FipeItem[]>([]);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [carregando, setCarregando] = useState<"marcas" | "modelos" | "anos" | null>(null);

  const buscarPreco = useCallback(
    async (t: TipoVeiculo, ma: string, mo: string, an: string) => {
      setConsultando(true);
      setErro(null);
      try {
        const { veiculo: encontrado } = await getJson<{ veiculo: FipeVeiculo }>(
          `/api/fipe/preco?tipo=${t}&marca=${ma}&modelo=${mo}&ano=${an}`,
        );
        setVeiculo({ ...encontrado, placa: placa || undefined });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível consultar a tabela FIPE.");
      } finally {
        setConsultando(false);
      }
    },
    [placa, setVeiculo],
  );

  // Carrega as marcas assim que a busca manual é aberta (ou o tipo muda).
  useEffect(() => {
    if (modo !== "manual") return;
    const controlador = new AbortController();

    setCarregando("marcas");
    setMarcas([]);
    setModelos([]);
    setAnos([]);
    setMarca("");
    setModelo("");
    setAno("");

    getJson<{ marcas: FipeItem[] }>(`/api/fipe/marcas?tipo=${tipo}`, controlador.signal)
      .then((r) => setMarcas(r.marcas))
      .catch((e: unknown) => {
        if (controlador.signal.aborted) return;
        setErro(e instanceof Error ? e.message : "Não foi possível carregar as marcas.");
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCarregando(null);
      });

    return () => controlador.abort();
  }, [modo, tipo]);

  async function selecionarMarca(codigo: string) {
    setMarca(codigo);
    setModelo("");
    setAno("");
    setModelos([]);
    setAnos([]);
    if (!codigo) return;

    setCarregando("modelos");
    try {
      const r = await getJson<{ modelos: FipeItem[] }>(
        `/api/fipe/modelos?tipo=${tipo}&marca=${codigo}`,
      );
      setModelos(r.modelos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os modelos.");
    } finally {
      setCarregando(null);
    }
  }

  async function selecionarModelo(codigo: string) {
    setModelo(codigo);
    setAno("");
    setAnos([]);
    if (!codigo) return;

    setCarregando("anos");
    try {
      const r = await getJson<{ anos: FipeItem[] }>(
        `/api/fipe/anos?tipo=${tipo}&marca=${marca}&modelo=${codigo}`,
      );
      setAnos(r.anos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os anos.");
    } finally {
      setCarregando(null);
    }
  }

  async function selecionarAno(codigo: string) {
    setAno(codigo);
    if (codigo) await buscarPreco(tipo, marca, modelo, codigo);
  }

  async function consultarPlaca(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setAviso(null);

    if (!isPlacaValida(placa)) {
      setErro("Informe uma placa válida (ABC1234 ou ABC1D23).");
      return;
    }

    setConsultando(true);
    try {
      const resposta = await getJson<RespostaPlaca>(`/api/placa?placa=${normalizePlaca(placa)}`);

      if (!resposta.configurado) {
        setAviso(
          "A consulta automática por placa não está disponível. Selecione marca, modelo e ano — o valor FIPE é buscado na hora.",
        );
        setModo("manual");
        return;
      }

      const s = resposta.sugestao;
      if (s?.marca && s.modelo && s.ano) {
        setTipo(s.tipo);
        setMarca(s.marca.codigo);
        setModelo(s.modelo.codigo);
        setAno(s.ano.codigo);
        await buscarPreco(s.tipo, s.marca.codigo, s.modelo.codigo, s.ano.codigo);
        return;
      }

      setAviso(
        `Encontramos ${[resposta.dados?.marca, resposta.dados?.modelo].filter(Boolean).join(" ") || "o veículo"}, mas precisamos que você confirme a versão exata para buscar a FIPE.`,
      );
      setModo("manual");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar a placa.");
    } finally {
      setConsultando(false);
    }
  }

  // ---------------------------------------------------------------- resultado
  if (veiculo) {
    return (
      <div className="animate-fade-in-up space-y-6">
        <header>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-subtle px-3 py-1.5 text-xs font-semibold text-primary">
            <CircleCheck size={14} strokeWidth={2} aria-hidden />
            Consulta concluída
          </span>
          <h1 className="mt-4 text-[28px] font-bold leading-tight md:text-[36px]">
            Identificamos o seu veículo
          </h1>
          <p className="mt-2 text-base text-text-secondary">
            Confira os dados oficiais da tabela FIPE para continuar.
          </p>
        </header>

        <article className="rounded-card-xl border border-border-subtle bg-white p-6 shadow-card-elevated">
          {veiculo.placa ? (
            <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CircleCheck size={14} strokeWidth={2} aria-hidden />
              Placa {formatPlaca(veiculo.placa)}
            </p>
          ) : null}

          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
            {veiculo.marca}
          </p>
          <h2 className="mt-1 text-2xl font-bold leading-tight md:text-[28px]">{veiculo.modelo}</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {veiculo.anoModelo} · {titleCase(veiculo.combustivel)}
          </p>

          <div className="mt-6 rounded-card-lg bg-bg-secondary p-5">
            <p className="text-sm font-medium text-text-secondary">Valor de referência FIPE</p>
            <p className="mt-1 text-[34px] font-extrabold leading-none tracking-[-0.03em]">
              {formatBRL(veiculo.valor)}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              Cód. FIPE: {veiculo.codigoFipe}
              {veiculo.mesReferencia ? ` · Referência ${veiculo.mesReferencia}` : ""}
            </p>
          </div>
        </article>

        <div className="space-y-3">
          <button type="button" onClick={() => irPara("perfil")} className="btn-primary">
            Confirmar e continuar
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setVeiculo(null);
              setAviso(null);
              setErro(null);
            }}
            className="btn-ghost w-full"
          >
            <PenLine size={16} strokeWidth={1.8} aria-hidden />
            Não é este veículo? Consultar novamente
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ consulta
  return (
    <div className="animate-fade-in-up space-y-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight md:text-[36px]">
          Vamos identificar o seu veículo
        </h1>
        <p className="mt-2 text-base text-text-secondary">
          Buscamos o valor oficial na tabela FIPE para calcular a sua proteção.
        </p>
      </header>

      {aviso ? (
        <div className="aviso">
          <CircleAlert size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p>{aviso}</p>
        </div>
      ) : null}

      {modo === "placa" ? (
        <form onSubmit={consultarPlaca} noValidate className="space-y-5">
          <div>
            <label htmlFor="placa" className="field-label">
              Placa do veículo
            </label>
            <div className="flex items-stretch overflow-hidden rounded-input border border-border-input focus-within:border-primary">
              <span className="flex w-14 shrink-0 items-center justify-center bg-[#1B3FAE] text-[10px] font-bold text-white">
                BR
              </span>
              <input
                id="placa"
                value={placa}
                onChange={(e) => {
                  setPlaca(normalizePlaca(e.target.value));
                  setErro(null);
                }}
                placeholder="ABC1D23"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                aria-invalid={Boolean(erro)}
                className="h-14 w-full bg-white px-4 text-lg font-semibold tracking-[0.18em] placeholder:font-normal placeholder:tracking-normal placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-text-muted">Padrão Mercosul ou Brasil — sem traços.</p>
          </div>

          {erro ? (
            <p className="flex items-center gap-1.5 text-sm text-primary" role="alert">
              <CircleAlert size={15} strokeWidth={1.8} aria-hidden />
              {erro}
            </p>
          ) : null}

          <button type="submit" disabled={consultando} className="btn-primary">
            {consultando ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden />
                Consultando…
              </>
            ) : (
              <>
                Consultar veículo
                <ArrowRight size={18} strokeWidth={2} aria-hidden />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setModo("manual");
              setErro(null);
              setAviso(null);
            }}
            className="btn-ghost w-full"
          >
            <Search size={16} strokeWidth={1.8} aria-hidden />
            Não sabe a placa? Consultar por marca e modelo
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="field-label">Tipo de veículo</p>
            <div role="radiogroup" aria-label="Tipo de veículo" className="flex gap-2">
              {TIPOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={tipo === item.id}
                  onClick={() => setTipo(item.id)}
                  className={`flex-1 rounded-btn border px-4 py-3 text-sm transition-all duration-200 ${
                    tipo === item.id
                      ? "border-primary bg-red-subtle font-semibold text-primary"
                      : "border-border-subtle bg-white font-medium text-text-secondary hover:bg-bg-secondary"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <Select
            id="marca"
            label="Marca"
            valor={marca}
            opcoes={marcas}
            onChange={selecionarMarca}
            placeholder="Selecione a marca"
            carregando={carregando === "marcas"}
          />
          <Select
            id="modelo"
            label="Modelo"
            valor={modelo}
            opcoes={modelos}
            onChange={selecionarModelo}
            placeholder="Selecione o modelo"
            disabled={!marca}
            carregando={carregando === "modelos"}
          />
          <Select
            id="ano"
            label="Ano e combustível"
            valor={ano}
            opcoes={anos}
            onChange={selecionarAno}
            placeholder="Selecione o ano"
            disabled={!modelo}
            carregando={carregando === "anos"}
          />

          {erro ? (
            <p className="flex items-center gap-1.5 text-sm text-primary" role="alert">
              <CircleAlert size={15} strokeWidth={1.8} aria-hidden />
              {erro}
            </p>
          ) : null}

          {consultando ? (
            <p className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Consultando a tabela FIPE…
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setModo("placa");
              setErro(null);
              setAviso(null);
            }}
            className="btn-ghost w-full"
          >
            <Car size={16} strokeWidth={1.8} aria-hidden />
            Prefiro consultar pela placa
          </button>
        </div>
      )}
    </div>
  );
}
