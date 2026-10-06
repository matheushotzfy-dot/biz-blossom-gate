import { z } from "zod";

const number = z.coerce.number().finite();
export const overviewSchema = z.object({
  summary: z.object({ gross: number, fees: number, acquirer: number, profit: number, sales: number, attempts: number }),
  daily: z.array(z.object({ day: z.string(), gross: number, fees: number, acquirer: number, profit: number, sales: number })),
  hourly: z.array(z.object({ hour: number, gross: number, profit: number, sales: number })),
  methods: z.array(z.object({ method: z.string(), total: number, sales: number, gross: number })),
  risk: z.object({ chargebacks: number, chargeback_amount: number, med_count: number, med_amount: number, med_open: number }),
  new_users: number, kyc_pending: number, from: z.string(), to: z.string(), timezone: z.string(),
});
export type OverviewMetrics = z.infer<typeof overviewSchema>;
export function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator * 100 : 0;
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}