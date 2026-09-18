import { CircleCheck } from "lucide-react";

export function ListaCoberturas({ itens }: { itens: string[] }) {
  return (
    <ul className="space-y-3">
      {itens.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed text-text-primary">
          <CircleCheck size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
