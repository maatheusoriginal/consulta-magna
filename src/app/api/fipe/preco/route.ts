import { NextResponse } from "next/server";

import { tratarErro, erro } from "@/lib/api";
import { REGRAS, aplicarRateLimit } from "@/lib/rate-limit";
import { consultarPreco, isTipoVeiculo } from "@/lib/fipe";

export const revalidate = 86400;

export async function GET(request: Request) {
  const limite = await aplicarRateLimit(request, REGRAS.fipe);
  if (limite) return limite;

  const params = new URL(request.url).searchParams;
  const tipo = params.get("tipo") ?? "carros";
  const marca = params.get("marca");
  const modelo = params.get("modelo");
  const ano = params.get("ano");

  if (!isTipoVeiculo(tipo)) return erro("Tipo de veículo inválido.");
  if (!marca || !modelo || !ano) return erro("Informe marca, modelo e ano.");

  try {
    return NextResponse.json({ veiculo: await consultarPreco(tipo, marca, modelo, ano) });
  } catch (e) {
    return tratarErro(e);
  }
}
