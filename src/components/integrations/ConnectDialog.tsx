import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldHint, FieldLabel, FormSection, GroupBox, dialogShell } from "@/components/seller-ui/form";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AppLogo } from "./AppCard";
import { APP_EVENTS, validateConnection, type AppConnection, type AppDef, type AppField } from "./appCatalog";
import type { SaveResult } from "./KeyDialogs";

export interface ConnectTarget { app: AppDef; connection?: AppConnection }
export interface ConnectSave { fields: Record<string, string>; productId: string | null; events: string[] }
export interface ProductOption { id: string; name: string }

const isSecret = (f: AppField) => f.target === "api_key" || f.kind === "secret";

export function ConnectDialog({ target, products, siblings, onOpenChange, onSave }: {
  target: ConnectTarget | null;
  products: ProductOption[];
  /** Outras conexões ativas do mesmo app (sem a que está sendo editada). */
  siblings: AppConnection[];
  onOpenChange: (open: boolean) => void;
  onSave: (values: ConnectSave) => Promise<SaveResult>;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [product, setProduct] = useState("all");
  const [events, setEvents] = useState<string[]>([]);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const app = target?.app;
  const conn = target?.connection;
  const editing = !!conn;

  useEffect(() => {
    if (!target) return;
    const { app: a, connection: c } = target;
    const init: Record<string, string> = {};
    for (const f of a.fields) {
      if (f.target === "api_url" && c?.api_url) init[f.key] = c.api_url;
      if (f.target === "config" && c?.config && c.config[f.key] != null) init[f.key] = String(c.config[f.key]);
    }
    setFields(init); setShown({}); setTouched(false); setBusy(false); setError(null);
    setProduct(c?.product_id ?? "all");
    setEvents(c ? (c.events ?? []).filter((e) => a.events.includes(e)) : a.events);
  }, [target]);

  const errors = useMemo(() => (app ? validateConnection(app, { fields, productId: product, events }, editing) : {}), [app, fields, product, events, editing]);
  const hasErrors = Object.keys(errors).length > 0;
  const overlap = siblings.some((s) => s.product_id === null || product === "all" || s.product_id === product);
  const allOn = !!app && app.events.every((e) => events.includes(e));

  if (!app) return <Dialog open={false}><DialogContent className="hidden" /></Dialog>;

  const set = (k: string, v: string) => { setFields((cur) => ({ ...cur, [k]: v })); setError(null); };
  const toggle = (k: string) => setEvents((cur) => (cur.includes(k) ? cur.filter((e) => e !== k) : [...cur, k]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (hasErrors || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await onSave({ fields, productId: product === "all" ? null : product, events: APP_EVENTS.map((x) => x.key).filter((k) => events.includes(k)) });
      if (!res.ok) setError(res.message || "Não foi possível salvar. Tente de novo.");
    } finally { setBusy(false); }
  };

  const savedHint = (f: AppField): string | undefined => {
    if (!editing) return undefined;
    if (f.target === "api_key" && conn?.api_key_masked) return `Salvo como ${conn.api_key_masked}. Deixe em branco para manter.`;
    if (f.target === "webhook_url" && conn?.webhook_url) return `Salvo como ${conn.webhook_url}. Deixe em branco para manter.`;
    return undefined;
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[min(92dvh,820px)] w-[calc(100vw-1rem)] max-w-[640px] flex-col")}>
        <div className="flex items-center gap-4 border-b border-border py-5 pl-6 pr-14 sm:pl-8">
          <AppLogo app={app} className="h-14 w-[4.5rem]" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate font-heading text-[21px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{editing ? `Editar ${app.name}` : `Conectar ${app.name}`}</DialogTitle>
            <DialogDescription className="mt-0.5 truncate text-[14px] text-muted-foreground">{app.desc}</DialogDescription>
          </div>
        </div>

        <form onSubmit={(e) => { void submit(e); }} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
            {app.help && <p className="rounded-[16px] bg-accent px-4 py-3 text-[13.5px] font-medium leading-snug text-accent-foreground">{app.help}</p>}

            <FormSection title="Produto" subtitle="Escolha de qual produto vêm as vendas enviadas para este app.">
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger aria-label="Produto" className="vp-r16 h-12"><SelectValue /></SelectTrigger>
                <SelectContent collisionPadding={16}>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {overlap && (
                <p role="status" className="flex items-start gap-2 rounded-[16px] bg-warning/15 px-4 py-3 text-[13.5px] font-medium leading-snug text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Você já tem uma conexão ativa de {app.name} que cobre esse produto. As duas vão receber cada evento.
                </p>
              )}
            </FormSection>

            {app.fields.length > 0 && (
              <FormSection title="Dados da conta" subtitle={`Copie do painel do ${app.name}. Guardamos criptografado e nunca mostramos de novo.`}>
                <div className="space-y-5">
                  {app.fields.map((f) => {
                    const secret = isSecret(f);
                    const err = touched ? errors[f.key] : undefined;
                    const id = `app-${f.key}`;
                    return (
                      <div key={f.key}>
                        <FieldLabel htmlFor={id}>{f.label}{!f.required && <span className="ml-2 text-[12.5px] font-medium text-muted-foreground">Opcional</span>}</FieldLabel>
                        <div className="relative">
                          <input id={id} className={cn("vp-field font-mono !text-[13.5px]", secret && "!pr-12")} type={secret && !shown[f.key] ? "password" : "text"} autoComplete="off" spellCheck={false}
                            value={fields[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={editing && secret && savedHint(f) ? "••••••••" : f.placeholder} aria-invalid={!!err} aria-describedby={`${id}-hint`} />
                          {secret && (
                            <button type="button" onClick={() => setShown((s) => ({ ...s, [f.key]: !s[f.key] }))} aria-label={shown[f.key] ? `Ocultar ${f.label}` : `Mostrar ${f.label}`} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                              {shown[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        {err ? <p id={`${id}-hint`} role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{err}</p> : <FieldHint><span id={`${id}-hint`}>{savedHint(f) ?? f.help ?? ""}</span></FieldHint>}
                      </div>
                    );
                  })}
                </div>
              </FormSection>
            )}

            {app.events.length > 0 && (
              <FormSection
                title="Quando enviar" subtitle="Cada evento marcado vira uma chamada para o app."
                aside={<button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => setEvents(allOn ? [] : app.events)}>{allOn ? "Desmarcar todos" : "Marcar todos"}</button>}
              >
                <GroupBox>
                  {APP_EVENTS.filter((e) => app.events.includes(e.key)).map((ev) => (
                    <label key={ev.key} className="flex cursor-pointer items-center gap-3.5 px-4 py-3 hover:bg-muted/40">
                      <Checkbox checked={events.includes(ev.key)} onCheckedChange={() => toggle(ev.key)} aria-label={ev.label} />
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-semibold leading-tight text-foreground">{ev.label}</span>
                        <span className="block text-[13px] leading-snug text-muted-foreground">{ev.hint}</span>
                      </span>
                    </label>
                  ))}
                </GroupBox>
                {touched && errors.events && <p role="alert" className="text-[12.5px] font-medium text-destructive">{errors.events}</p>}
              </FormSection>
            )}
          </div>
          {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : editing ? "Salvar alterações" : "Conectar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
