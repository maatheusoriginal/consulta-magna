import Link from "next/link";

import { Logo } from "./Logo";

const LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#duvidas", label: "Dúvidas" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-compare items-center justify-between px-5 md:h-[72px] md:px-8">
        <Link href="/" aria-label="Página inicial">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href="/cotacao"
          className="inline-flex h-10 items-center justify-center rounded-btn bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Fazer cotação
        </Link>
      </div>
    </header>
  );
}
