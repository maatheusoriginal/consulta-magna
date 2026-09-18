import { MARCA } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-bg-secondary">
      <div className="mx-auto max-w-compare px-5 py-10 md:px-8">
        <p className="text-base font-semibold text-text-primary">{MARCA.nomeCompleto}</p>
        <p className="mt-1 max-w-xl text-sm text-text-secondary">{MARCA.descricao}</p>
        <p className="mt-6 text-xs text-text-muted">
          Os valores exibidos são estimativas baseadas na tabela FIPE e no perfil informado. As
          condições definitivas, coberturas e carências constam no regulamento da associação.
        </p>
        <p className="mt-4 text-xs text-text-muted">
          © {new Date().getFullYear()} {MARCA.nomeCompleto}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
