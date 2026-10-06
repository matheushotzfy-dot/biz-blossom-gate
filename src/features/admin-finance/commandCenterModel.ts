import { z } from "zod";

const count = z.coerce.number().finite().nonnegative();
const deliveries = z.object({ delivered: count, failed: count, pending: count });
export const commandCenterSchema = z.object({
  withdrawals: z.object({ count, amount: count, oldest: z.string().nullable() }),
  kyc: count, med: count, chargebacks: count, refunds: count, support: count, error_count: count,
  errors: z.array(z.object({ id: z.string(), error_type: z.string(), message: z.string(), created_at: z.string() })),
  fraud: z.array(z.object({ id: z.string(), block_type: z.string(), block_reason: z.string(), matched_value: z.string().nullable(), created_at: z.string() })),
  webhooks: deliveries, apps: deliveries,
  risky_sellers: z.array(z.object({ user_id: z.string(), name: z.string(), approved: count, bad: count, volume: count, rate: count })),
  checked_at: z.string(),
});
export function validateCommandSearch(raw: string): string {
  const query = raw.trim();
  if (query.length < 3 || query.length > 120) throw new Error("Digite entre 3 e 120 caracteres");
  return query;
}