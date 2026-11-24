import { isApprovedTransaction } from "@/lib/utils";

export type TxTone = "ok" | "wait" | "alert" | "idle" | "info";
const SP = "America/Sao_Paulo";

/** Rótulo e tom de uma venda a partir do status derivado (deriveTransactionStatus). */
export function txStatusMeta(st: string): { label: string; tone: TxTone } {
  if (isApprovedTransaction(st)) return { label: "Paga", tone: "ok" };
  if (st === "pending" || st === "processing") return { label: "Aguardando", tone: "wait" };
  if (st === "refunded" || st === "partially_refunded") return { label: "Reembolsada", tone: "idle" };
  if (st === "chargeback") return { label: "Chargeback", tone: "alert" };
  if (st === "med_lost") return { label: "MED perdido", tone: "alert" };
  if (["med", "mediation", "dispute", "disputed"].includes(st)) return { label: "MED em análise", tone: "wait" };
  if (st === "expired") return { label: "Expirada", tone: "idle" };
  if (st === "error" || st === "failed") return { label: "Com erro", tone: "alert" };
  if (st === "cancelled" || st === "canceled") return { label: "Cancelada", tone: "idle" };
  return { label: "Não concluída", tone: "idle" };
}

export const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "V";
export const isPixMethod = (m: string | null | undefined) => (m || "").toLowerCase().includes("pix");

/** "Hoje, 18:29" / "Ontem, 14:13" / "22 nov, 14:53" (horário de São Paulo). */
export function whenLabel(iso: string): string {
  const d = new Date(iso);
  const key = d.toLocaleDateString("pt-BR", { timeZone: SP });
  const t = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP });
  if (key === new Date().toLocaleDateString("pt-BR", { timeZone: SP })) return `Hoje, ${t}`;
  if (key === new Date(Date.now() - 864e5).toLocaleDateString("pt-BR", { timeZone: SP })) return `Ontem, ${t}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: SP }).replace(".", "")}, ${t}`;
}
