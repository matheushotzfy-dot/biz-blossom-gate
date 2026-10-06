import { z } from "zod";
import { csvCell } from "@/features/admin-finance/topSellersExport";
const count = z.number().finite().int().nonnegative();
const date = z.string().datetime({ offset: true });
export const sellerSchema = z.object({ user_id: z.string().uuid(), full_name: z.string().nullable(), email: z.string().nullable(), created_at: date.nullable(), last_login_at: date.nullable(), last_attempt_at: date.nullable(), last_paid_created_at: date.nullable(), last_activity: date, days_since: count, attempts: count, sales: count, volume: z.number().finite(), fees: z.number().finite(), admin_notes: z.string().nullable(), account_status: z.string().nullable() });
export const inactiveSchema = z.object({ as_of: date, page: count, page_size: count.positive(), totals: z.object({ count, over30: count, volume: z.number().finite(), fees: z.number().finite() }), sellers: z.array(sellerSchema).max(25) });
export type InactiveSeller = z.infer<typeof sellerSchema>;
export type InactiveData = z.infer<typeof inactiveSchema>;
export const sortSchema = z.enum(["days", "volume", "fees", "sales"]);
export interface InactiveFilters { days: number; page: number; search: string; sort: z.infer<typeof sortSchema> }
export function validDays(value: string): number | null { const n = Number(value); return value.trim() && Number.isInteger(n) && n >= 1 && n <= 3650 ? n : null; }
export function activityDate(value: string | null): string { return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não registrado"; }
export function emailLink(value: string | null): string | null { return value && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value) ? `mailto:${encodeURIComponent(value)}` : null; }
export function inactiveCSV(data: InactiveData, days: number): string {
 const header = ["Seller ID", "Seller", "E-mail", "Mínimo de dias", "Dias sem atividade", "Última atividade (Brasília)", "Último login", "Última tentativa", "Criação da última venda aprovada", "Vendas aprovadas históricas", "Tentativas históricas", "Volume aprovado histórico", "Taxas históricas"];
 return "\uFEFF" + [header, ...data.sellers.map(s => [s.user_id,s.full_name ?? "",s.email ?? "",days,s.days_since,activityDate(s.last_activity),activityDate(s.last_login_at),activityDate(s.last_attempt_at),activityDate(s.last_paid_created_at),s.sales,s.attempts,s.volume.toFixed(2),s.fees.toFixed(2)])].map(row => row.map(csvCell).join(";")).join("\r\n");
}
