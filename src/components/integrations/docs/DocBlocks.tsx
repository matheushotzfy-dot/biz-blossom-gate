import { useState, type ReactNode } from "react";
import { Check, Copy, Info, TriangleAlert } from "lucide-react";
import { copyText } from "@/components/seller-ui/copy";
import { StatusPill } from "@/components/seller-ui/tx";
import type { TxTone } from "@/components/seller-ui/txMeta";
import { cn } from "@/lib/utils";

/** Bloco de uma seção da documentação, ancorado pelo id para a navegação lateral. */
export function DocSection({ id, title, status, intro, children }: { id: string; title: string; status?: { label: string; tone: TxTone }; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="vp-sheet scroll-mt-6 space-y-7 p-5 sm:p-7 md:p-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id={`${id}-title`} className="font-heading text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{title}</h2>
          {status && <StatusPill label={status.label} tone={status.tone} />}
        </div>
        {intro && <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">{intro}</p>}
      </header>
      {children}
    </section>
  );
}

export function Sub({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[16px] font-bold leading-snug text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-[68ch] text-[14.5px] leading-relaxed text-foreground/85", className)}>{children}</p>;
}

/** Trecho de código em linha. */
export function C({ children }: { children: ReactNode }) {
  return <code className="rounded-[8px] bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">{children}</code>;
}

export function CodeBlock({ code, label, toast = "Código copiado." }: { code: string; label?: string; toast?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => { if (await copyText(code, toast)) { setDone(true); window.setTimeout(() => setDone(false), 1800); } };
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-muted/60">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="truncate text-[12.5px] font-semibold text-muted-foreground">{label ?? "Código"}</span>
        <button type="button" onClick={() => { void copy(); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {done ? <><Check className="h-3.5 w-3.5" />Copiado</> : <><Copy className="h-3.5 w-3.5" />Copiar</>}
        </button>
      </div>
      <pre tabIndex={0} aria-label={label} className="max-h-[420px] overflow-auto px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-foreground/90"><code>{code}</code></pre>
    </div>
  );
}

export interface CodeTab { id: string; label: string; code: string }

export function CodeTabs({ tabs, label }: { tabs: CodeTab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;
  return (
    <div className="space-y-2.5">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5 !border-0">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === current.id} onClick={() => setActive(t.id)}
            className={cn("vp-pill !h-9 !px-4 text-[13.5px] font-semibold", t.id === current.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock code={current.code} label={current.label} />
    </div>
  );
}

export interface ParamRow { name: string; type?: string; required?: boolean; desc: ReactNode }

/** Lista de campos: no celular empilha, no desktop vira duas colunas. */
export function ParamList({ rows, label, plain = false }: { rows: ParamRow[]; label: string; plain?: boolean }) {
  return (
    <dl aria-label={label} className="divide-y divide-border overflow-hidden rounded-[16px] border border-border">
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,230px)_minmax(0,1fr)]">
          <dt className="min-w-0">
            <span className={cn("break-words text-foreground", plain ? "text-[14.5px] font-bold" : "break-all font-mono text-[13px] font-semibold")}>{r.name}</span>
            {(r.type || r.required !== undefined) && (
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
                {r.type && <span className="font-mono">{r.type}</span>}
                {r.required !== undefined && <span className={r.required ? "font-semibold text-foreground/80" : undefined}>{r.required ? "Obrigatório" : "Opcional"}</span>}
              </span>
            )}
          </dt>
          <dd className="min-w-0 text-[14px] leading-snug text-muted-foreground">{r.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

const METHOD_TONE: Record<string, string> = { GET: "bg-accent text-accent-foreground", POST: "bg-warning/15 text-warning", DELETE: "bg-destructive/10 text-destructive" };

export function Endpoint({ method, path, desc }: { method: "GET" | "POST" | "DELETE"; path: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[16px] border border-border px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[12px] font-bold", METHOD_TONE[method])}>{method}</span>
        <code className="min-w-0 break-all font-mono text-[13px] font-semibold text-foreground">{path}</code>
      </div>
      {desc && <span className="text-[13.5px] text-muted-foreground sm:ml-auto sm:text-right">{desc}</span>}
    </div>
  );
}

export function Note({ tone = "info", title, children }: { tone?: "info" | "warn" | "ok"; title?: string; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div role="note" className={cn("flex items-start gap-3 rounded-[16px] px-4 py-3.5", tone === "warn" ? "bg-warning/15" : "bg-accent")}>
      <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", tone === "warn" ? "text-warning" : "text-accent-foreground")} aria-hidden />
      <div className={cn("min-w-0 text-[14px] leading-snug", tone === "warn" ? "text-foreground" : "text-accent-foreground")}>
        {title && <p className="mb-0.5 font-bold">{title}</p>}
        <div className="[&_code]:bg-background/60">{children}</div>
      </div>
    </div>
  );
}

/** Passos em sequência (a ordem importa). */
export function Steps({ items }: { items: Array<{ title: string; body: ReactNode }> }) {
  return (
    <ol className="space-y-4">
      {items.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[14px] font-extrabold text-accent-foreground">{i + 1}</span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] font-bold leading-snug text-foreground">{s.title}</p>
            <div className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
