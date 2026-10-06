import { z } from "zod";

const count = z.coerce.number().int().nonnegative();
const money = z.coerce.number().finite();
export const sellerRowSchema = z.object({
  user_id: z.string().uuid(), full_name: z.string().nullable(), email: z.string().nullable(),
  account_status: z.string().nullable(), seller_type: z.string().nullable(), balance_frozen: z.boolean().nullable(), created_at: z.string(),
  attempts: count, sales: count, volume: money, med: count, med_amount: money,
  chargebacks: count, chargeback_amount: money, refunds: count, refund_amount: money,
});
export const sellersPageSchema = z.object({
  rows: z.array(sellerRowSchema), total: count, page: count, page_size: count.positive(), checked_at: z.string(),
  summary: z.object({ registered: count, selling: count, kyc: count, volume: money, med: count, chargebacks: count }),
});
export type SellerRow = z.infer<typeof sellerRowSchema>;
export interface SellerFilters { page: number; search: string; state: string; risk: string; sort: string; sellingOnly: boolean }
export const initialSellerFilters: SellerFilters = { page: 0, search: "", state: "all", risk: "all", sort: "volume", sellingOnly: false };
export function validateSellerNumbers(values: Record<string, string>, percentages: string[], days: string[] = []): boolean {
  return Object.entries(values).every(([key, raw]) => {
    if (!raw.trim()) return true;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && (!percentages.includes(key) || value <= 100)
      && (!days.includes(key) || (Number.isInteger(value) && value >= 1 && value <= 365));
  });
}