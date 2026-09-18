import { NextResponse } from "next/server";

import { tratarErro, erro } from "@/lib/api";
import { REGRAS, aplicarRateLimit } from "@/lib/rate-limit";
import { isTipoVeiculo, listarAnos } from "@/lib/fipe";

export const revalidate = 86400;

export async function GET(request: Request) {
  const limite = await aplicarRateLimit(request, REGRAS.fipe);
  if (limite) return limite;

  const params = new URL(request.url).searchParams;
  const tipo = params.get("tipo") ?? "carros";
  const marca = params.get("marca");
  const modelo = params.get("modelo");

  if (!isTipoVeiculo(tipo)) return erro("Tipo de veículo inválido.");
  if (!marca || !modelo) return erro("Informe a marca e o modelo.");

  try {
    return NextResponse.json({ anos: await listarAnos(tipo, marca, modelo) });
  } catch (e) {
    return tratarErro(e);
  }
}
