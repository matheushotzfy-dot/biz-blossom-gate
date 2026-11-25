import { useEffect, useState } from "react";
import { Check, Copy, Loader2, ShieldAlert, Webhook } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogHead, FieldHint, FieldLabel, FormSection, GroupBox, dialogShell } from "@/components/seller-ui/form";
import { copyText } from "@/components/seller-ui/copy";
import { cn } from "@/lib/utils";
import { ALL_EVENTS, EVENT_GROUPS, validateWebhookUrl } from "./webhookMeta";
import type { SaveResult } from "./KeyDialogs";

export interface EndpointTarget { mode: "create" | "edit"; id?: string; url?: string; events?: string[] }
export interface EndpointValues { url: string; events: string[] }

export function EndpointDialog({ target, existingUrls, onOpenChange, onSave }: {
  target: EndpointTarget | null;
  /** URLs já usadas por outros endpoints da conta (sem a do que está sendo editado). */
  existingUrls: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (values: EndpointValues) => Promise<SaveResult>;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setUrl(target.url ?? "");
    // Endpoint sem eventos no banco recebe todos: ao editar, mostramos todos marcados.
    setEvents(target.mode === "edit" && (target.events ?? []).length > 0 ? target.events! : ALL_EVENTS);
    setTouched(false); setBusy(false); setError(null);
  }, [target]);

  const urlError = validateWebhookUrl(url) ?? (existingUrls.includes(url.trim()) ? "Você já tem um endpoint com essa URL." : null);
  const noEvents = events.length === 0;
  const edit = target?.mode === "edit";
  const allOn = ALL_EVENTS.every((e) => events.includes(e));

  const toggle = (key: string) => setEvents((cur) => (cur.includes(key) ? cur.filter((e) => e !== key) : [...cur, key]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (urlError || noEvents || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await onSave({ url: url.trim(), events: ALL_EVENTS.filter((k) => events.includes(k)) });
      if (!res.ok) setError(res.message || "Não foi possível salvar. Tente de novo.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[min(92dvh,780px)] w-[calc(100vw-1rem)] max-w-[600px] flex-col")}>
        <DialogHead icon={<Webhook className="h-5 w-5" />} title={edit ? "Editar endpoint" : "Novo endpoint"} subtitle="Enviamos um POST com os dados do evento para a sua URL." />
        <form onSubmit={(e) => { void submit(e); }} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
            <div>
              <FieldLabel htmlFor="wh-url">URL do seu servidor</FieldLabel>
              <input id="wh-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} className="vp-field font-mono !text-[14px]" value={url} autoFocus={!edit}
                onChange={(e) => { setUrl(e.target.value); setError(null); }} placeholder="https://seusite.com/webhooks/vemprapay" aria-invalid={touched && !!urlError} aria-describedby="wh-url-hint" />
              {touched && urlError ? <p id="wh-url-hint" role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{urlError}</p> : <FieldHint><span id="wh-url-hint">Precisa ser https e acessível pela internet. Se responder com 2xx, contamos como entregue.</span></FieldHint>}
            </div>

            <FormSection
              title="Eventos" subtitle="Escolha o que vale a pena receber."
              aside={<button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => setEvents(allOn ? [] : ALL_EVENTS)}>{allOn ? "Desmarcar todos" : "Marcar todos"}</button>}
            >
              <div className="space-y-4">
                {EVENT_GROUPS.map((g) => (
                  <div key={g.label}>
                    <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{g.label}</p>
                    <GroupBox>
                      {g.events.map((ev) => (
                        <label key={ev.key} className="flex cursor-pointer items-center gap-3.5 px-4 py-3 hover:bg-muted/40">
                          <Checkbox checked={events.includes(ev.key)} onCheckedChange={() => toggle(ev.key)} aria-label={ev.label} />
                          <span className="min-w-0">
                            <span className="block text-[14.5px] font-semibold leading-tight text-foreground">{ev.label}</span>
                            <span className="block text-[13px] leading-snug text-muted-foreground">{ev.hint}</span>
                          </span>
                        </label>
                      ))}
                    </GroupBox>
                  </div>
                ))}
              </div>
              {touched && noEvents && <p role="alert" className="text-[12.5px] font-medium text-destructive">Escolha pelo menos um evento.</p>}
            </FormSection>
          </div>
          {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : edit ? "Salvar endpoint" : "Criar endpoint"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface RevealedSecret { url: string; secret: string; rotated: boolean }

/** A chave de assinatura é mostrada inteira só aqui; depois a lista mostra só o começo. */
export function WebhookSecretDialog({ value, onClose }: { value: RevealedSecret | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (value) setCopied(false); }, [value]);

  return (
    <Dialog open={!!value} onOpenChange={() => { /* só fecha pelo botão: a chave não aparece de novo */ }}>
      <DialogContent className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[560px] [&>button]:hidden")} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHead icon={<ShieldAlert className="h-5 w-5" />} title={value?.rotated ? "Nova chave de assinatura" : "Endpoint criado"} subtitle={value?.url} />
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p className="rounded-[16px] bg-warning/15 px-4 py-3 text-[13.5px] font-medium leading-snug text-warning">
            {value?.rotated
              ? "A chave anterior parou de valer agora. Coloque esta no seu servidor antes de receber os próximos eventos."
              : "Copie a chave de assinatura agora. Ela só aparece inteira desta vez e serve para conferir que cada evento veio da Vemprapay."}
          </p>
          <div>
            <FieldLabel htmlFor="wh-secret">Chave de assinatura</FieldLabel>
            <div className="flex items-center gap-2">
              <input id="wh-secret" readOnly className="vp-field min-w-0 flex-1 font-mono !text-[13px]" value={value?.secret ?? ""} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="vp-pill !h-12 shrink-0 bg-accent !px-4 text-accent-foreground hover:!bg-accent" onClick={async () => { if (value && (await copyText(value.secret, "Chave copiada."))) setCopied(true); }}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiada" : "Copiar"}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-border bg-card px-6 py-4 sm:px-8">
          <button type="button" className="vp-cta !h-12 justify-center" onClick={onClose}>Já guardei a chave</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
