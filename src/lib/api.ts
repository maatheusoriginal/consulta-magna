import { NextResponse } from "next/server";

import { FipeError } from "./fipe";

export function erro(mensagem: string, status = 400) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export function tratarErro(e: unknown) {
  if (e instanceof FipeError) return erro(e.message, e.status);
  if (e instanceof Error && e.name === "TimeoutError") {
    return erro("A consulta à tabela FIPE demorou demais. Tente novamente.", 504);
  }
  console.error("[api] erro inesperado:", e);
  return erro("Não foi possível completar a consulta agora. Tente novamente.", 502);
}
