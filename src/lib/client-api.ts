export class ApiError extends Error {}

export async function getJson<T>(url: string, sinal?: AbortSignal): Promise<T> {
  const resposta = await fetch(url, { signal: sinal, headers: { Accept: "application/json" } });
  const corpo = (await resposta.json().catch(() => null)) as (T & { erro?: string }) | null;

  if (!resposta.ok || !corpo) {
    throw new ApiError(corpo?.erro ?? "Não foi possível completar a consulta. Tente novamente.");
  }
  return corpo;
}

export async function postJson<T>(url: string, dados: unknown): Promise<T> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  const corpo = (await resposta.json().catch(() => null)) as (T & { erro?: string }) | null;

  if (!resposta.ok || !corpo) {
    throw new ApiError(corpo?.erro ?? "Não foi possível enviar seus dados. Tente novamente.");
  }
  return corpo;
}
