import { NextResponse } from "next/server";

import { tratarErro, erro } from "@/lib/api";
import { isTipoVeiculo } from "@/lib/fipe";
import { isPlacaValida } from "@/lib/format";
import { consultarPlaca } from "@/lib/placa";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const placa = params.get("placa") ?? "";
  const tipoBruto = params.get("tipo");

  // Sem `tipo` a consulta NÃO assume carros: quem decide é o provedor ou o usuário.
  if (tipoBruto !== null && !isTipoVeiculo(tipoBruto)) return erro("Tipo de veículo inválido.");
  if (!isPlacaValida(placa)) return erro("Placa inválida. Use o padrão ABC1234 ou ABC1D23.");

  try {
    return NextResponse.json(await consultarPlaca(placa, tipoBruto ?? undefined));
  } catch (e) {
    return tratarErro(e);
  }
}
