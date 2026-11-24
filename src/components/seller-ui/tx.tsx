import { CreditCard, FileText, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, isPixMethod, type TxTone } from "./txMeta";

const TONE: Record<TxTone, string> = {
  ok: "bg-accent text-accent-foreground",
  wait: "bg-warning/15 text-warning",
  alert: "bg-destructive/15 text-destructive",
  idle: "bg-muted text-muted-foreground",
  info: "bg-info/15 text-info",
};
const DOT: Record<TxTone, string> = { ok: "bg-primary", wait: "bg-warning", alert: "bg-destructive", idle: "bg-muted-foreground/50", info: "bg-info" };

export function StatusPill({ label, tone, className }: { label: string; tone: TxTone; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[12.5px] font-bold", TONE[tone], className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} />{label}
    </span>
  );
}

export function Avatar({ name, ok, size = 44 }: { name: string; ok?: boolean; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className={cn("grid shrink-0 place-items-center rounded-full text-[13px] font-bold", ok ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{initials(name)}</span>
  );
}

/** Ícone + nome do meio de pagamento. */
export function MethodMark({ method, className }: { method: string | null | undefined; className?: string }) {
  const m = (method || "").toLowerCase();
  const pix = isPixMethod(m);
  const card = m === "credit_card" || m === "card" || m.includes("cart");
  const Icon = pix ? QrCode : card ? CreditCard : FileText;
  const label = pix ? "Pix" : card ? "Cartão" : m === "boleto" ? "Boleto" : method || "—";
  return <span className={cn("inline-flex items-center gap-2 text-[13.5px] font-medium text-foreground", className)}><Icon className="h-4 w-4 text-muted-foreground" />{label}</span>;
}

