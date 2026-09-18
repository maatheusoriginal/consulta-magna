import { NextResponse } from "next/server";

import { tratarErro, erro } from "@/lib/api";
import { REGRAS, aplicarRateLimit } from "@/lib/rate-limit";
import { isTipoVeiculo, listarMarcas } from "@/lib/fipe";

export const revalidate = 86400;

export async function GET(request: Request) {
  const limite = await aplicarRateLimit(request, REGRAS.fipe);
  if (limite) return limite;

  const tipo = new URL(request.url).searchParams.get("tipo") ?? "carros";
  if (!isTipoVeiculo(tipo)) return erro("Tipo de veículo inválido.");

  try {
    return NextResponse.json({ marcas: await listarMarcas(tipo) });
  } catch (e) {
    return tratarErro(e);
  }
}
