import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap,
  QrCode,
  Shuffle,
  Radar,
  Inbox,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  Ban,
  Ghost,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TxEvent = {
  id: string;
  transaction_id: string;
  event_type: string;
  description: string;
  actor: string;
  acquirer_slug: string | null;
  visibility: "public" | "admin";
  metadata: Record<string, unknown> | null;
  created_at: string;
};

interface Props {
  transactionId: string;
  /** admin sees everything; sellers see only public events (RLS enforced) */
  variant?: "admin" | "seller";
  className?: string;
}

const dt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "medium",
});

type EventVisual = {
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "destructive" | "info" | "muted";
  label: string;
};

const EVENT_MAP: Record<string, EventVisual> = {
  created: { icon: Zap, tone: "primary", label: "Criada" },
  pix_generated: { icon: QrCode, tone: "info", label: "PIX gerado" },
  acquirer_routed: { icon: Radar, tone: "info", label: "Roteado" },
  acquirer_switched: { icon: Shuffle, tone: "warning", label: "Adquirente trocada" },
  polling_check: { icon: Radar, tone: "muted", label: "Polling" },
  postback_received: { icon: Inbox, tone: "info", label: "Postback recebido" },
  paid: { icon: CheckCircle2, tone: "success", label: "Pago" },
  approved: { icon: CheckCircle2, tone: "success", label: "Aprovada" },
  expired: { icon: Ghost, tone: "muted", label: "Expirada" },
  refunded: { icon: RefreshCw, tone: "warning", label: "Reembolsada" },
  chargeback: { icon: ShieldAlert, tone: "destructive", label: "Chargeback" },
  dispute_opened: { icon: AlertTriangle, tone: "destructive", label: "Disputa" },
  canceled: { icon: Ban, tone: "muted", label: "Cancelada" },
  status_changed: { icon: ArrowRight, tone: "muted", label: "Status" },
};

const TONE_STYLES = {
  primary: { dot: "bg-primary text-primary-foreground", ring: "ring-primary/20", text: "text-primary" },
  success: { dot: "bg-success text-success-foreground", ring: "ring-success/20", text: "text-success" },
  warning: { dot: "bg-warning text-warning-foreground", ring: "ring-warning/20", text: "text-warning" },
  destructive: { dot: "bg-destructive text-destructive-foreground", ring: "ring-destructive/20", text: "text-destructive" },
  info: { dot: "bg-info text-info-foreground", ring: "ring-info/20", text: "text-info" },
  muted: { dot: "bg-muted text-muted-foreground", ring: "ring-border/40", text: "text-muted-foreground" },
} as const;

function visualFor(type: string): EventVisual {
  return EVENT_MAP[type] || { icon: Clock, tone: "muted", label: type };
}

/** Sellers never see provider names — everything is branded VENXPAY. */
const BRAND_LABEL = "VENXPAY";
function maskAcquirer(text: string | null | undefined, variant: "admin" | "seller"): string {
  if (!text) return "";
  if (variant === "admin") return text;
  return BRAND_LABEL;
}

function metaSummary(ev: TxEvent, variant: "admin" | "seller"): string | null {
  const m = ev.metadata || {};
  const parts: string[] = [];
  if (ev.event_type === "acquirer_switched") {
    const from = m["from"] as string | undefined;
    const to = m["to"] as string | undefined;
    if (variant === "admin" && from && to) {
      parts.push(`${from.toUpperCase()} → ${to.toUpperCase()}`);
    } else if (variant === "seller") {
      parts.push("Roteamento atualizado");
    }
    if (m["reason"] && variant === "admin") parts.push(String(m["reason"]));
  } else if (ev.event_type === "expired") {
    const reason = (m["reason"] as string) || "Prazo do PIX vencido";
    parts.push(reason);
  } else if (ev.event_type === "postback_received" && variant === "admin") {
    if (m["gateway_status"]) parts.push(`status: ${m["gateway_status"]}`);
    if (m["event_id"]) parts.push(`event: ${m["event_id"]}`);
  } else if (ev.event_type === "polling_check" && variant === "admin") {
    if (m["result"]) parts.push(String(m["result"]));
  } else if (ev.event_type === "pix_generated") {
    if (m["expires_at"]) {
      try {
        parts.push(`Expira em ${dt.format(new Date(String(m["expires_at"])))}`);
      } catch {
        /* ignore */
      }
    }
  } else if (ev.event_type === "created" || ev.event_type === "acquirer_routed") {
    if (variant === "admin" && ev.acquirer_slug) parts.push(ev.acquirer_slug.toUpperCase());
    else if (variant === "seller") parts.push(BRAND_LABEL);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function TransactionTimeline({ transactionId, variant = "seller", className }: Props) {
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const load = async () => {
      const { data, error: err } = await supabase
        .from("transaction_events")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      if (!alive) return;
      if (err) {
        setError(err.message);
      } else {
        setEvents((data as TxEvent[]) || []);
        setError(null);
      }
      setLoading(false);
    };

    void load();

    const channel = supabase
      .channel(`tx-events-${transactionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transaction_events",
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          if (!alive) return;
          setEvents((prev) => {
            if (prev.some((e) => e.id === (payload.new as TxEvent).id)) return prev;
            const next = [...prev, payload.new as TxEvent];
            next.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [transactionId]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/50" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-[12px] text-destructive", className)}>
        Não foi possível carregar a timeline: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-border/40 bg-muted/[0.03] p-4 text-center text-[12px] text-muted-foreground", className)}>
        Sem eventos registrados ainda.
      </div>
    );
  }

  return (
    <ol className={cn("relative space-y-3", className)}>
      <span aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-border/50" />
      {events.map((ev) => {
        const v = visualFor(ev.event_type);
        const Icon = v.icon;
        const tone = TONE_STYLES[v.tone];
        const summary = metaSummary(ev, variant);
        const isAdminOnly = ev.visibility === "admin";

        return (
          <li key={ev.id} className="relative flex gap-3 pl-0">
            <div className={cn(
              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
              tone.dot,
            )}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-[12px] font-semibold ", tone.text)}>
                  {v.label}
                </span>
                {(variant === "admin" ? ev.acquirer_slug : true) && (
                  <span className="inline-flex items-center rounded-full border border-border/50 bg-background/60 px-2 py-0.5 text-[11px] font-semibold text-foreground/80">
                    {variant === "admin" ? ev.acquirer_slug : BRAND_LABEL}
                  </span>
                )}
                {isAdminOnly && variant === "admin" && (
                  <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                    admin
                  </span>
                )}
                <span className="ml-auto text-[10.5px] font-medium tabular-nums text-muted-foreground/80">
                  {dt.format(new Date(ev.created_at))}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-foreground/90 break-words">{maskAcquirer(ev.description, variant)}</p>
              {summary && (
                <p className="mt-0.5 text-[11px] text-muted-foreground/80 break-words">{summary}</p>
              )}
              {variant === "admin" && ev.metadata && Object.keys(ev.metadata).length > 0 && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground">
                    metadata
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-border/40 bg-background/50 p-2 text-[10.5px] leading-snug text-foreground/80">
{JSON.stringify(ev.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default TransactionTimeline;
