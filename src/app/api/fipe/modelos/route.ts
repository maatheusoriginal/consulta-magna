import { NextResponse } from "next/server";

import { tratarErro, erro } from "@/lib/api";
import { isTipoVeiculo, listarModelos } from "@/lib/fipe";

export const revalidate = 86400;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tipo = params.get("tipo") ?? "carros";
  const marca = params.get("marca");

  if (!isTipoVeiculo(tipo)) return erro("Tipo de veículo inválido.");
  if (!marca) return erro("Informe a marca.");

  try {
    return NextResponse.json({ modelos: await listarModelos(tipo, marca) });
  } catch (e) {
    return tratarErro(e);
  }
}
