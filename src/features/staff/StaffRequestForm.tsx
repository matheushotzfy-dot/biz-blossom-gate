import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { STAFF_KIND_LABEL } from "@/features/admin-finance/StaffRequestsTab";
import { staffError } from "@/features/staff-panel/staffPanelModel";

type Kind = "acquirer_change" | "acquirer_toggle" | "fee_change" | "seller_freeze" | "platform_setting" | "other";

const KINDS: { value: Kind; hint: string }[] = [
  { value: "acquirer_change", hint: "Passar um seller para outra adquirente. O dono aprovando, a troca acontece na hora." },
  { value: "acquirer_toggle", hint: "Ligar ou desligar uma adquirente para todos. O dono aprovando, vale na hora." },
  { value: "fee_change", hint: "Uma taxa diferente para um seller. O dono decide e ajusta." },
  { value: "seller_freeze", hint: "Congelar um seller. O dono decide e congela." },
  { value: "platform_setting", hint: "Alguma configuração da plataforma." },
  { value: "other", hint: "Qualquer outro pedido." },
];
const NEEDS_SELLER = new Set<Kind>(["acquirer_change", "seller_freeze"]);
const NEEDS_ACQ = new Set<Kind>(["acquirer_change", "acquirer_toggle"]);
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Esperando o dono", cls: "bg-warning/15 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/15 text-success" },
  rejected: { label: "Recusado", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const box = { border: "1px solid hsl(var(--border))" } as const;

/**
 * Pedido ao dono (gerente e sócio): o dono aprova ou recusa na aba "Pedidos da equipe". Gerente só pede sobre seller
 * da própria carteira (o servidor confere). Ligar/desligar adquirente exige dizer qual dos dois: sem isso, aprovar
 * desligava a adquirente mesmo quando o pedido era para ligar.
 */
export function StaffRequestForm({ sellerHint }: { sellerHint?: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("acquirer_change");
  const [reason, setReason] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [acq, setAcq] = useState("");
  const [active, setActive] = useState<"on" | "off" | "">("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acqs = useQuery({ queryKey: ["acq-basic"], staleTime: 300_000, queryFn: async () => (await supabase.rpc("list_acquirers_basic")).data ?? [] });
  const mine = useQuery({
    queryKey: ["my-staff-req", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error: e } = await supabase.from("staff_action_requests").select("id,kind,status,reason,decision_note,created_at,decided_at")
        .eq("requested_by", user?.id ?? "").order("created_at", { ascending: false }).limit(50);
      if (e) throw e;
      return data ?? [];
    },
  });

  const needsSeller = NEEDS_SELLER.has(kind);
  const needsAcq = NEEDS_ACQ.has(kind);
  const errs = {
    seller: needsSeller && !EMAIL.test(sellerEmail.trim()) ? "Informe o e-mail da conta do seller." : null,
    acq: needsAcq && !acq ? "Escolha a adquirente." : null,
    active: kind === "acquirer_toggle" && !active ? "Diga se é para ligar ou desligar." : null,
    reason: reason.trim().length < 5 ? "Explique o pedido em pelo menos 5 caracteres." : reason.trim().length > 1000 ? "Use no máximo 1000 caracteres." : null,
  };
  const invalid = Object.values(errs).some(Boolean);
  const show = (k: keyof typeof errs) => (tried ? errs[k] : null);

  const submit = async () => {
    setTried(true); setError(null);
    if (invalid || busy) return;
    setBusy(true);
    try {
      const { error: e } = await supabase.rpc("request_staff_action", {
        _kind: kind, _reason: reason.trim(), _target_acquirer: needsAcq ? acq : undefined,
        _payload: { seller_email: needsSeller ? sellerEmail.trim().toLowerCase() : null, ...(kind === "acquirer_toggle" ? { active: active === "on" } : {}) },
      });
      if (e) { setError(staffError(e)); return; }
      toast.success("Pedido enviado ao dono.");
      setReason(""); setSellerEmail(""); setActive(""); setTried(false);
      void qc.invalidateQueries({ queryKey: ["my-staff-req"] });
    } finally { setBusy(false); }
  };

  const input = "h-11 w-full rounded-[12px] bg-background px-4 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none";
  const borderFor = (bad: string | null) => ({ border: `1px solid hsl(var(--${bad ? "destructive" : "border"}))` });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section aria-labelledby="req-new" className="space-y-5 rounded-[16px] bg-card p-5" style={box}>
        <div>
          <h3 id="req-new" className="text-[16px] font-semibold text-foreground">Novo pedido</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">O dono vê o pedido em "Pedidos da equipe" e aprova ou recusa. Você acompanha a resposta ao lado.</p>
        </div>
        <fieldset>
          <legend className="text-[13.5px] font-semibold text-foreground">O que você precisa</legend>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {KINDS.map((k) => (
              <label key={k.value} className={cn("flex cursor-pointer items-start gap-2.5 rounded-[12px] px-3.5 py-3", kind === k.value ? "bg-accent" : "hover:bg-muted/50")}
                style={{ boxShadow: kind === k.value ? "inset 0 0 0 1.5px hsl(var(--primary) / .45)" : "inset 0 0 0 1px hsl(var(--border))" }}>
                <input type="radio" name="req-kind" value={k.value} checked={kind === k.value} onChange={() => { setKind(k.value); setError(null); }} className="mt-1 accent-[hsl(var(--primary))]" />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-foreground">{STAFF_KIND_LABEL[k.value]}</span>
                  <span className="block text-[12.5px] leading-snug text-muted-foreground">{k.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {needsSeller && (
          <div>
            <label htmlFor="req-email" className="text-[13.5px] font-semibold text-foreground">E-mail do seller</label>
            <input id="req-email" type="email" maxLength={254} value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} placeholder="email@da-conta.com"
              aria-invalid={!!show("seller") || undefined} className={cn(input, "mt-2")} style={borderFor(show("seller"))} />
            <p className={show("seller") ? "mt-1.5 text-[12.5px] font-medium text-destructive" : "mt-1.5 text-[12.5px] text-muted-foreground"}>{show("seller") ?? sellerHint ?? "O e-mail que o seller usa para entrar."}</p>
          </div>
        )}
        {needsAcq && (
          <div>
            <label htmlFor="req-acq" className="text-[13.5px] font-semibold text-foreground">Adquirente</label>
            <select id="req-acq" value={acq} onChange={(e) => setAcq(e.target.value)} aria-invalid={!!show("acq") || undefined} className={cn(input, "mt-2")} style={borderFor(show("acq"))}>
              <option value="">{acqs.isPending ? "Carregando…" : (acqs.data ?? []).length ? "Escolha" : "Nenhuma adquirente cadastrada"}</option>
              {(acqs.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {show("acq") && <p className="mt-1.5 text-[12.5px] font-medium text-destructive">{show("acq")}</p>}
          </div>
        )}
        {kind === "acquirer_toggle" && (
          <fieldset>
            <legend className="text-[13.5px] font-semibold text-foreground">Ligar ou desligar</legend>
            <div className="mt-2 flex gap-2">
              {([["on", "Ligar"], ["off", "Desligar"]] as const).map(([v, l]) => (
                <label key={v} className={cn("flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium", active === v ? "bg-accent text-accent-foreground" : "")}
                  style={{ boxShadow: active === v ? "inset 0 0 0 1.5px hsl(var(--primary) / .45)" : "inset 0 0 0 1px hsl(var(--border))" }}>
                  <input type="radio" name="req-active" value={v} checked={active === v} onChange={() => setActive(v)} className="accent-[hsl(var(--primary))]" />{l}
                </label>
              ))}
            </div>
            {show("active") && <p className="mt-1.5 text-[12.5px] font-medium text-destructive">{show("active")}</p>}
          </fieldset>
        )}
        <div>
          <label htmlFor="req-reason" className="text-[13.5px] font-semibold text-foreground">Por quê</label>
          <textarea id="req-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={4} placeholder="Conte o motivo e o que você espera"
            aria-invalid={!!show("reason") || undefined} className="mt-2 w-full resize-y rounded-[12px] bg-background px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none" style={borderFor(show("reason"))} />
          <p className={show("reason") ? "mt-1 text-[12.5px] font-medium text-destructive" : "mt-1 text-[12px] tabular-nums text-muted-foreground"}>{show("reason") ?? `${reason.trim().length}/1000`}</p>
        </div>
        {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
        <button type="button" onClick={() => void submit()} disabled={busy} className="vp-cta vp-r12 h-11 px-5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar ao dono
        </button>
      </section>

      <section aria-labelledby="req-mine" className="space-y-3">
        <h3 id="req-mine" className="text-[16px] font-semibold text-foreground">Seus pedidos</h3>
        {mine.isError ? (
          <p role="alert" className="text-[13px] text-destructive">Não foi possível carregar seus pedidos. <button type="button" className="font-semibold underline" onClick={() => void mine.refetch()}>Tentar de novo</button></p>
        ) : mine.isPending ? (
          <p className="text-[13px] text-muted-foreground">Carregando…</p>
        ) : (mine.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[16px] px-6 py-10 text-center" style={box}>
            <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-[14px] font-semibold text-foreground">Nenhum pedido enviado</p>
            <p className="text-[13px] text-muted-foreground">Os pedidos aparecem aqui com a resposta do dono.</p>
          </div>
        ) : (
          <ul className="m-0 space-y-2 p-0" style={{ listStyle: "none" }}>
            {(mine.data ?? []).map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, cls: "bg-muted text-muted-foreground" };
              return (
                <li key={r.id} className="rounded-[14px] bg-card px-4 py-3.5" style={box}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-foreground">{STAFF_KIND_LABEL[r.kind] ?? "Pedido"}</span>
                    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12.5px] font-semibold", st.cls)}>{st.label}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">Enviado em {when(r.created_at)}{r.decided_at ? `, respondido em ${when(r.decided_at)}` : ""}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] text-foreground">{r.reason}</p>
                  {r.decision_note && <p className="mt-2 rounded-[10px] bg-muted/60 px-3 py-2 text-[13px] text-foreground">Resposta do dono: {r.decision_note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
