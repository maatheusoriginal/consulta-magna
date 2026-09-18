import type { CotacaoSnapshot, LeadRepository, ResultadoPersistencia } from "./types";

/** Mantém apenas os últimos dígitos do telefone: o resto não vai para o log. */
function mascararTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length <= 4 ? "****" : `****${digitos.slice(-4)}`;
}

/**
 * Repositório de desenvolvimento.
 *
 * Escreve um resumo SEM dados pessoais no log do servidor e devolve sempre
 * `persistido: false` — log de servidor não é persistência de produção e o lead
 * não pode ser anunciado como salvo.
 */
export class ConsoleLeadRepository implements LeadRepository {
  readonly nome = "ConsoleLeadRepository";
  readonly duravel = false;

  async salvar(snapshot: CotacaoSnapshot): Promise<ResultadoPersistencia> {
    // Resumo deliberadamente sem nome, e-mail, placa ou telefone completo.
    console.info("[lead] recebido (não persistido)", {
      codigo: snapshot.codigo,
      criadoEm: snapshot.criadoEm,
      telefone: mascararTelefone(snapshot.telefone),
      veiculo: `${snapshot.marca} ${snapshot.modelo} ${snapshot.ano}`,
      planoEscolhido: snapshot.planoEscolhido,
      mensalidade: snapshot.mensalidade,
      statusPrecificacao: snapshot.statusPrecificacao,
    });

    return { persistido: false, repositorio: this.nome };
  }
}
