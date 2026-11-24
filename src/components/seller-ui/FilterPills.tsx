import { cn } from "@/lib/utils";

export interface FilterOption<T extends string> { value: T; label: string; count?: number }

/** Filtro em pílulas (uma opção ativa por vez). Rola na horizontal no celular. */
export function FilterPills<T extends string>({ value, options, onChange, label, className }: {
  value: T; options: FilterOption<T>[]; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 py-1 scrollbar-none", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" className="vp-pill" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="rounded-full bg-foreground/[0.07] px-1.5 text-[12px] font-bold tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
