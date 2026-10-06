import { z } from "zod";

const count = z.coerce.number().int().nonnegative();
const money = z.coerce.number().finite();
export const analyticsSellerSchema = z.object({
  user_id: z.string().uuid(), name: z.string(), email: z.string(), account_status: z.string().nullable(), active: z.boolean(), created_at: z.string(),
  attempts: count, sales: count, volume: money, fees: money, acquirer: money, clients: count, failed: count,
  refunds: count, refund_amount: money, chargebacks: count, chargeback_amount: money, med: count, med_amount: money, risk_events: count,
});
export const analyticsSchema = z.object({
  summary: z.object({ registered_sellers: count, active_sellers: count, selling_sellers: count, selling_today: count, clients: count, repeat_clients: count, unidentified_sales: count, new_registrations: count,
    refunds: count, refund_amount: money, chargebacks: count, chargeback_amount: money, med: count, med_amount: money, pending_transactions: count, failed_transactions: count }),
  operations: z.object({ pending_refunds: count, refunds_reserved: money, pending_withdrawals: count, withdrawal_amount: money, open_med: count, kyc_pending: count, frozen_sellers: count }),
  daily: z.array(z.object({ day: z.string(), sales: count, sellers: count, clients: count, volume: money, registrations: count })),
  sellers: z.array(analyticsSellerSchema), seller_count: count, page: count, page_size: count.positive(), checked_at: z.string(),
});
export type AnalyticsData = z.infer<typeof analyticsSchema>;
export type AnalyticsSeller = z.infer<typeof analyticsSellerSchema>;
export type AnalyticsSort = "volume" | "sales" | "newest" | "risk";
export interface AnalyticsFilters { page: number; search: string; sellingOnly: boolean; sort: AnalyticsSort }
export const initialAnalyticsFilters: AnalyticsFilters = { page: 0, search: "", sellingOnly: false, sort: "volume" };
export function sellerPageCount(count: number, size = 25): number { return Math.max(1, Math.ceil(count / size)); }